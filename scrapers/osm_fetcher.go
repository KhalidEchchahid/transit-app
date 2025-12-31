package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// OSM Overpass response structures
type OverpassResponse struct {
	Elements []Element `json:"elements"`
}

type Element struct {
	Type    string            `json:"type"`
	ID      int64             `json:"id"`
	Lat     float64           `json:"lat,omitempty"`
	Lon     float64           `json:"lon,omitempty"`
	Tags    map[string]string `json:"tags,omitempty"`
	Members []Member          `json:"members,omitempty"`
}

type Member struct {
	Type string `json:"type"`
	Ref  int64  `json:"ref"`
	Role string `json:"role"`
}

// Database models
type Station struct {
	OSMID      int64
	Name       string
	NameAr     string
	Lat        float64
	Lon        float64
	LineRefs   []string
	StopType   string
}

type Line struct {
	OSMID        int64
	Ref          string
	Name         string
	Color        string
	From         string
	To           string
	Operator     string
	RouteType    string
	StationOrder []int64 // OSM node IDs in order
}

const overpassURL = "https://lz4.overpass-api.de/api/interpreter"

func queryOverpass(query string) (*OverpassResponse, error) {
	resp, err := http.PostForm(overpassURL, url.Values{"data": {query}})
	if err != nil {
		return nil, fmt.Errorf("overpass request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("overpass returned %d: %s", resp.StatusCode, body)
	}

	var result OverpassResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode overpass response: %w", err)
	}

	return &result, nil
}

func fetchOverpass(query string) ([]Line, map[int64]*Station, error) {
	fmt.Println("🔍 Querying Overpass API...")
	result, err := queryOverpass(query)
	if err != nil {
		return nil, nil, err
	}
	fmt.Printf("📦 Received %d elements\n", len(result.Elements))

	lines := []Line{}
	nodeMap := make(map[int64]*Element)
	stations := make(map[int64]*Station)

	// First pass: collect nodes
	for i := range result.Elements {
		el := &result.Elements[i]
		if el.Type == "node" {
			nodeMap[el.ID] = el
		}
	}

	// Second pass: process relations
	for _, el := range result.Elements {
		if el.Type != "relation" {
			continue
		}

		line := Line{
			OSMID:     el.ID,
			Ref:       el.Tags["ref"],
			Name:      el.Tags["name"],
			Color:     el.Tags["colour"],
			From:      el.Tags["from"],
			To:        el.Tags["to"],
			Operator:  el.Tags["operator"],
			RouteType: el.Tags["route"],
		}
		
		if line.Name == "" {
			line.Name = fmt.Sprintf("Line %s", line.Ref)
		}

		// Collect stops
		for _, member := range el.Members {
			if member.Type == "node" && (member.Role == "stop" || member.Role == "stop_entry_only" || member.Role == "stop_exit_only" || member.Role == "platform") {
				line.StationOrder = append(line.StationOrder, member.Ref)

				if _, exists := stations[member.Ref]; !exists {
					if node, ok := nodeMap[member.Ref]; ok {
						stations[member.Ref] = &Station{
							OSMID:    node.ID,
							Name:     node.Tags["name"],
							NameAr:   node.Tags["name:ar"],
							Lat:      node.Lat,
							Lon:      node.Lon,
							LineRefs: []string{line.Ref},
							StopType: "stop",
						}
					}
				} else {
					stations[member.Ref].LineRefs = append(stations[member.Ref].LineRefs, line.Ref)
				}
			}
		}

		if len(line.StationOrder) > 0 {
			lines = append(lines, line)
		}
	}
	return lines, stations, nil
}

func fetchCasablancaTransit() ([]Line, map[int64]*Station, error) {
	allLines := []Line{}
	allStations := make(map[int64]*Station)

	// 1. Trams and Busways (proven to work with BBox key)
	// BBox: 33.45,-7.75,33.70,-7.45
	tramQuery := `
		[out:json][timeout:60];
		(
		  relation["route"="tram"](33.45,-7.75,33.70,-7.45);
		  relation["route"="bus"]["ref"~"^BW"](33.45,-7.75,33.70,-7.45);
		);
		out body;
		>;
		out body qt;
	`
	trams, tramStations, err := fetchOverpass(tramQuery)
	if err != nil {
		fmt.Printf("⚠️ Failed to fetch trams: %v\n", err)
	} else {
		allLines = append(allLines, trams...)
		for k, v := range tramStations { allStations[k] = v }
	}

	// 2. Trains (Broader BBox)
	// BBox: 33.1,-7.9,33.9,-7.1 (Casablanca region)
	trainQuery := `
		[out:json][timeout:60];
		(
		  relation["route"="train"](33.1,-7.9,33.9,-7.1);
		);
		out body;
		>;
		out body qt;
	`
	trains, trainStations, err := fetchOverpass(trainQuery)
	if err != nil {
		fmt.Printf("⚠️ Failed to fetch trains: %v\n", err)
	} else {
		allLines = append(allLines, trains...)
		for k, v := range trainStations { allStations[k] = v }
	}

	// 3. City Buses (Casablanca Central)
	// BBox: 33.50,-7.70,33.65,-7.50
	busQuery := `
		[out:json][timeout:90];
		(
		  relation["route"="bus"]["ref"!~"^BW"](33.50,-7.70,33.65,-7.50);
		);
		out body;
		>;
		out body qt;
	`
	buses, busStations, err := fetchOverpass(busQuery)
	if err != nil {
		fmt.Printf("⚠️ Failed to fetch buses: %v\n", err)
	} else {
		allLines = append(allLines, buses...)
		for k, v := range busStations { allStations[k] = v }
	}

	// 4. Mohammedia Buses (L902, L903, L904, etc.)
	// BBox: 33.66,-7.45,33.74,-7.32
	mohammediaQuery := `
		[out:json][timeout:90];
		(
		  relation["route"="bus"]["ref"~"^L9"](33.66,-7.45,33.74,-7.32);
		  relation["route"="bus"]["ref"~"^L09"](33.66,-7.45,33.74,-7.32);
		);
		out body;
		>;
		out body qt;
	`
	mohammediaBuses, mohammediaStations, err := fetchOverpass(mohammediaQuery)
	if err != nil {
		fmt.Printf("⚠️ Failed to fetch Mohammedia buses: %v\n", err)
	} else {
		// Dedup in case some were already found
		for _, line := range mohammediaBuses {
			exists := false
			for _, existing := range allLines {
				if existing.Ref == line.Ref && existing.RouteType == line.RouteType {
					exists = true
					break
				}
			}
			if !exists {
				allLines = append(allLines, line)
			}
		}
		for k, v := range mohammediaStations { allStations[k] = v }
	}

	return allLines, allStations, nil
}

func saveToJSON(lines []Line, stations map[int64]*Station) error {
	// Convert to exportable format
	type ExportData struct {
		FetchedAt string     `json:"fetched_at"`
		Source    string     `json:"source"`
		Lines     []Line     `json:"lines"`
		Stations  []Station  `json:"stations"`
	}

	stationList := make([]Station, 0, len(stations))
	for _, s := range stations {
		stationList = append(stationList, *s)
	}

	data := ExportData{
		FetchedAt: time.Now().Format(time.RFC3339),
		Source:    "OpenStreetMap via Overpass API",
		Lines:     lines,
		Stations:  stationList,
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	filename := "osm_casablanca_transit.json"
	if err := os.WriteFile(filename, jsonData, 0644); err != nil {
		return err
	}

	fmt.Printf("💾 Saved to %s\n", filename)
	return nil
}

func importToDatabase(lines []Line, stations map[int64]*Station) error {
	connStr := "host=localhost port=5433 user=transport password=transport_dev_pwd dbname=transport sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	fmt.Println("📤 Importing to PostgreSQL...")

	// Get operator IDs
	var casatramID, casabusID, oncfID int
	db.QueryRow("SELECT id FROM operators WHERE code = 'casatram'").Scan(&casatramID)
	db.QueryRow("SELECT id FROM operators WHERE code = 'casabus'").Scan(&casabusID)
	db.QueryRow("SELECT id FROM operators WHERE code = 'oncf'").Scan(&oncfID)

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Import stations
	stationIDMap := make(map[int64]int) // OSM ID -> DB ID
	for _, station := range stations {
		operatorID := casatramID
		if strings.Contains(strings.Join(station.LineRefs, ","), "ONCF") {
			operatorID = oncfID
		} else if station.StopType == "station" { // Train station
			operatorID = oncfID
		}

		var dbID int
		err := tx.QueryRow(`
			INSERT INTO stops (code, name_fr, name_ar, location, operator_id, stop_type)
			VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7)
			ON CONFLICT (code) DO UPDATE SET name_fr = EXCLUDED.name_fr
			RETURNING id
		`, fmt.Sprintf("osm_%d", station.OSMID), station.Name, station.NameAr, station.Lon, station.Lat, operatorID, station.StopType).Scan(&dbID)
		if err != nil {
			log.Printf("Warning: failed to insert station %s (ID %d): %v", station.Name, station.OSMID, err)
			continue
		}
		stationIDMap[station.OSMID] = dbID
	}
	fmt.Printf("   ✅ Imported %d stations\n", len(stations))

	// Import lines
	for _, line := range lines {
		var lineType string
		var operatorID int

		switch line.RouteType {
		case "tram":
			lineType = "tram"
			operatorID = casatramID
		case "train":
			lineType = "train"
			operatorID = oncfID
		case "bus":
			if strings.HasPrefix(line.Ref, "BW") {
				lineType = "busway"
				operatorID = casatramID
			} else {
				lineType = "bus"
				operatorID = casabusID
			}
		default:
			lineType = "bus"
			operatorID = casabusID
		}

		var lineID int
		err := tx.QueryRow(`
			INSERT INTO lines (code, name_fr, line_type, color, operator_id, origin_name, destination_name)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (code, operator_id) DO UPDATE SET name_fr = EXCLUDED.name_fr
			RETURNING id
		`, line.Ref, line.Name, lineType, line.Color, operatorID, line.From, line.To).Scan(&lineID)
		if err != nil {
			log.Printf("Warning: failed to insert line %s: %v", line.Ref, err)
			continue
		}

		// Import line stops (ordered)
		for seq, osmStopID := range line.StationOrder {
			if dbStopID, ok := stationIDMap[osmStopID]; ok {
				_, err := tx.Exec(`
					INSERT INTO line_stops (line_id, stop_id, direction, stop_sequence)
					VALUES ($1, $2, 0, $3)
					ON CONFLICT DO NOTHING
				`, lineID, dbStopID, seq)
				if err != nil {
					log.Printf("Warning: failed to insert line_stop for %s: %v", line.Ref, err)
				}
			}
		}
	}
	fmt.Printf("   ✅ Imported %d lines with stop sequences\n", len(lines))

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func main() {
	fmt.Println("🗺️  Casablanca Transit Data Fetcher")
	fmt.Println("====================================")

	lines, stations, err := fetchCasablancaTransit()
	if err != nil {
		log.Fatalf("Failed to fetch transit data: %v", err)
	}

	fmt.Printf("\n📊 Summary:\n")
	fmt.Printf("   Lines: %d\n", len(lines))
	fmt.Printf("   Stations: %d\n", len(stations))

	for _, line := range lines {
		fmt.Printf("   • %s: %s → %s (%d stops)\n", line.Ref, line.From, line.To, len(line.StationOrder))
	}

	// Save to JSON
	if err := saveToJSON(lines, stations); err != nil {
		log.Printf("Warning: failed to save JSON: %v", err)
	}

	// Import to database
	if err := importToDatabase(lines, stations); err != nil {
		log.Fatalf("Failed to import to database: %v", err)
	}

	fmt.Println("\n✅ Done!")
}
