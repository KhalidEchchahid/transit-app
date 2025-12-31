package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/antigravity/morocco-transport/internal/repository"
	"github.com/antigravity/morocco-transport/internal/routing"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type TransportHandler struct {
	Repo   *repository.LineRepository
	Raptor *routing.Raptor
}

func NewTransportHandler(repo *repository.LineRepository, raptor *routing.Raptor) *TransportHandler {
	return &TransportHandler{Repo: repo, Raptor: raptor}
}

func (h *TransportHandler) GetAllLines(w http.ResponseWriter, r *http.Request) {
	lines, err := h.Repo.GetAllLines(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(lines)
}

func (h *TransportHandler) GetLineDetails(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid line ID", http.StatusBadRequest)
		return
	}

	line, stops, err := h.Repo.GetLineDetails(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"line":  line,
		"stops": stops,
	}
	json.NewEncoder(w).Encode(response)
}

func (h *TransportHandler) GetRoute(w http.ResponseWriter, r *http.Request) {
	fromLat, _ := strconv.ParseFloat(r.URL.Query().Get("from_lat"), 64)
	fromLon, _ := strconv.ParseFloat(r.URL.Query().Get("from_lon"), 64)
	toLat, _ := strconv.ParseFloat(r.URL.Query().Get("to_lat"), 64)
	toLon, _ := strconv.ParseFloat(r.URL.Query().Get("to_lon"), 64)
	
	// Parse time (in seconds from midnight) and day type
	departureTime := 8*3600 + 30*60 // Default: 08:30
	if timeParam := r.URL.Query().Get("time"); timeParam != "" {
		if parsed, err := strconv.Atoi(timeParam); err == nil && parsed >= 0 && parsed < 86400 {
			departureTime = parsed
		}
	}
	
	dayType := "weekday" // Default
	if dayParam := r.URL.Query().Get("day"); dayParam != "" {
		dayParam = strings.ToLower(dayParam)
		// Normalize weekend variants to a special bucket we will fan out later
		if dayParam == "weekend" {
			dayType = "weekend"
		} else if dayParam == "saturday" || dayParam == "sunday" {
			dayType = dayParam
		}
	}

	if fromLat == 0 || toLat == 0 {
		http.Error(w, "Missing source/destination coordinates", http.StatusBadRequest)
		return
	}

	// 1. Find multiple source stops (within 1km)
	// We need a helper for this. Using DB or In-Memory?
	// The DB has geospatial index, use Repo.
	// Repository signature is (minLat, minLon, maxLat, maxLon)
	sources, err := h.Repo.GetStopsInViewport(r.Context(), fromLat-0.01, fromLon-0.01, fromLat+0.01, fromLon+0.01)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	targets, err := h.Repo.GetStopsInViewport(r.Context(), toLat-0.01, toLon-0.01, toLat+0.01, toLon+0.01)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Convert to Raptor Map
	// Let's debug what stops we found
	fmt.Printf("GetRoute: Found %d source stops, %d target stops, time=%d, day=%s\n", len(sources), len(targets), departureTime, dayType)
	if len(sources) > 0 {
		fmt.Printf("Source[0] DBID: %d\n", sources[0].ID)
	}

	sourceMap := h.Raptor.ConvertStopsToIDs(sources, 0) // 0 walk time for now
	targetMapB := h.Raptor.ConvertStopsToIDs(targets, 0)
	targetMap := make(map[routing.StopID]bool)
	for k := range targetMapB { targetMap[k] = true }

	fmt.Printf("Mapped Source IDs: %v\n", sourceMap)
	
	if len(sourceMap) == 0 || len(targetMap) == 0 {
		http.Error(w, "No nearby stops found", http.StatusNotFound)
		return
	}
	
	// Try one or more service patterns depending on requested day.
	dayOptions := []string{dayType}
	if dayType == "weekend" {
		dayOptions = []string{"saturday", "sunday"}
	}

	var journey *routing.Journey
	for _, d := range dayOptions {
		journey = h.Raptor.FindRoute(sourceMap, targetMap, departureTime, d)
		if journey != nil {
			break
		}
	}

	if journey == nil {
		http.Error(w, "No route found", http.StatusNotFound)
		return
	}
	
	json.NewEncoder(w).Encode(journey)
}

func (h *TransportHandler) GetStops(w http.ResponseWriter, r *http.Request) {
	// Parse viewport params
	minLat, _ := strconv.ParseFloat(r.URL.Query().Get("min_lat"), 64)
	minLon, _ := strconv.ParseFloat(r.URL.Query().Get("min_lon"), 64)
	maxLat, _ := strconv.ParseFloat(r.URL.Query().Get("max_lat"), 64)
	maxLon, _ := strconv.ParseFloat(r.URL.Query().Get("max_lon"), 64)

	if minLat == 0 || maxLat == 0 {
		http.Error(w, "Missing viewport coordinates", http.StatusBadRequest)
		return
	}

	stops, err := h.Repo.GetStopsInViewport(r.Context(), minLat, minLon, maxLat, maxLon)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(stops)
}

func (h *TransportHandler) GetStopDetails(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid stop ID", http.StatusBadRequest)
		return
	}

	stop, lines, err := h.Repo.GetStopDetails(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "Stop not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"stop":  stop,
		"lines": lines,
	}
	json.NewEncoder(w).Encode(response)
}
