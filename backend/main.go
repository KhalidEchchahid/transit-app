package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/antigravity/morocco-transport/internal/handler"
	"github.com/antigravity/morocco-transport/internal/repository"
	"github.com/antigravity/morocco-transport/internal/routing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"
)

func main() {
	// Database connection
	dbURL := "postgres://transport:transport_dev_pwd@localhost:5433/transport?sslmode=disable"
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatal("Unable to parse DB URL:", err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatal("Unable to create connection pool:", err)
	}
	defer pool.Close()

	// Verify connection
	if err := pool.Ping(context.Background()); err != nil {
		log.Fatal("Unable to connect to database:", err)
	}
	log.Println("✅ Connected to PostGIS database")

	// Router setup
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})
	r.Use(c.Handler)

	// Initialize layers
	lineRepo := repository.NewLineRepository(pool)
	
	// Load Routing Data
	loader := routing.NewLoader(pool)
	raptorData, err := loader.LoadData(context.Background())
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load RAPTOR data: %v\n", err)
		os.Exit(1)
	}
	raptorEngine := routing.NewRaptor(raptorData)

	transportHandler := handler.NewTransportHandler(lineRepo, raptorEngine)

	// Routes
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok", "service":"morocco_transport_api"}`))
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		err := pool.Ping(r.Context())
		if err != nil {
			http.Error(w, `{"status":"error", "db":"disconnected"}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok", "db":"connected"}`))
	})

	// API Routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/lines", transportHandler.GetAllLines)
		r.Get("/lines/{id}", transportHandler.GetLineDetails)
		r.Get("/stops", transportHandler.GetStops)
		r.Get("/stops/{id}", transportHandler.GetStopDetails)
		r.Get("/route", transportHandler.GetRoute)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
