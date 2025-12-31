package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"

	_ "github.com/lib/pq"
)

type OverpassResponse struct {
	Elements []Element `json:"elements"`
}

type Element struct {
	Type    string            `json:"type"`
	ID      int64             `json:"id"`
	Lat     float64           `json:"lat"`
	Lon     float64           `json:"lon"`
	Tags    map[string]string `json:"tags"`
	Members []Member          `json:"members"`
}

type Member struct {
	Type string `json:"type"`
	Ref  int64  `json:"ref"`
	Role string `json:"role"`
}

const overpassURL = "https://overpass-api.de/api/interpreter"

func main() {
	// Missing lines
	refs := []string{"L902", "L903", "L904", "L905", "L906", "L907", "902", "903", "904", "905", "906", "907"}
	
	// Query by ref
	// relation["route"="bus"]["ref"~"L902|L903..."];
	refRegex := strings.Join(refs, "|")
	query := fmt.Sprintf(`
		[out:json][timeout:60];
		(
		  relation["route"="bus"]["ref"~"^(%s)$"](33.1,-7.9,33.9,-7.1);
		);
		out body;
		>;
		out body qt;
	`, refRegex)
	
	fmt.Println("🔍 Querying for specific Mohammedia lines:", refRegex)
	
	resp, err := http.PostForm(overpassURL, url.Values{"data": {query}})
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()
	
	var result OverpassResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatal(err)
	}
	
	fmt.Printf("📦 Received %d elements\n", len(result.Elements))
	
	// Database connection
	db, err := sql.Open("postgres", "host=localhost port=5433 user=transport password=transport_dev_pwd dbname=transport sslmode=disable")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	
	importData(db, result)
}

func importData(db *sql.DB, result OverpassResponse) {
	nodeMap := make(map[int64]Element)
	for _, el := range result.Elements {
		if el.Type == "node" {
			nodeMap[el.ID] = el
		}
	}
	
	// Get operator ID
	var casabusID int
	db.QueryRow("SELECT id FROM operators WHERE code = 'casabus'").Scan(&casabusID)
	
	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()
	
	count := 0
	for _, el := range result.Elements {
		if el.Type != "relation" {
			continue
		}
		
		ref := el.Tags["ref"]
		name := el.Tags["name"]
		from := el.Tags["from"]
		to := el.Tags["to"]
		
		if name == "" {
			name = fmt.Sprintf("Line %s", ref)
		}
		
		fmt.Printf("Processing %s: %s\n", ref, name)
		
		// Insert Line
		var lineID int
		err := tx.QueryRow(`
			INSERT INTO lines (code, name_fr, line_type, operator_id, origin_name, destination_name)
			VALUES ($1, $2, 'bus', $3, $4, $5)
			ON CONFLICT (code, operator_id) DO UPDATE SET name_fr = EXCLUDED.name_fr
			RETURNING id
		`, ref, name, casabusID, from, to).Scan(&lineID)
		if err != nil {
			log.Println("Error inserting line:", err)
			continue
		}
		count++
		
		// Stops
		seq := 0
		for _, m := range el.Members {
			if m.Type == "node" && (m.Role == "stop" || m.Role == "stop_entry_only" || m.Role == "stop_exit_only" || m.Role == "platform") {
				node, ok := nodeMap[m.Ref]
				if !ok {
					continue
				}
				
				stopName := node.Tags["name"]
				
				var stopID int
				err := tx.QueryRow(`
					INSERT INTO stops (code, name_fr, location, operator_id, stop_type)
					VALUES ($1, $2, ST_MakePoint($3, $4)::geography, $5, 'stop')
					ON CONFLICT (code) DO UPDATE SET name_fr = EXCLUDED.name_fr
					RETURNING id
				`, fmt.Sprintf("osm_%d", node.ID), stopName, node.Lon, node.Lat, casabusID).Scan(&stopID)
				if err != nil {
					log.Println("Error inserting stop:", err)
					continue
				}
				
				tx.Exec(`
					INSERT INTO line_stops (line_id, stop_id, direction, stop_sequence)
					VALUES ($1, $2, 0, $3)
					ON CONFLICT DO NOTHING
				`, lineID, stopID, seq)
				seq++
			}
		}
	}
	
	tx.Commit()
	fmt.Printf("✅ Imported %d lines\n", count)
}
