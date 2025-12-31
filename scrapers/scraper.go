package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// Schedule represents operating hours
type Schedule struct {
	FirstDeparture string `json:"first_departure"`
	LastDeparture  string `json:"last_departure"`
	Frequency      string `json:"frequency"`
}

// Pricing represents fare information
type Pricing struct {
	StandardFare    float64 `json:"standard_fare"`
	Currency        string  `json:"currency"`
	TransferAllowed bool    `json:"transfer_allowed"`
	TransferNote    string  `json:"transfer_note"`
}

// Station represents a transport station with coordinates
type Station struct {
	ID       int64   `json:"id"`
	Name     string  `json:"name"`
	NameAr   string  `json:"name_ar,omitempty"`
	Lat      float64 `json:"lat"`
	Lon      float64 `json:"lon"`
	Ref      string  `json:"ref,omitempty"`
	LineRefs []string `json:"line_refs,omitempty"`
}

// Line represents a transport line
type Line struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Color       string   `json:"color"`
	Origin      string   `json:"origin"`
	Destination string   `json:"destination"`
	Schedule    Schedule `json:"schedule"`
	DetailURL   string   `json:"detail_url"`
}

// Network represents the entire transport network
type Network struct {
	ScrapedAt string    `json:"scraped_at"`
	Source    string    `json:"source"`
	Pricing   Pricing   `json:"pricing"`
	Lines     []Line    `json:"lines"`
	Stations  []Station `json:"stations"`
}

// OverpassResponse represents the Overpass API response
type OverpassResponse struct {
	Elements []struct {
		Type string  `json:"type"`
		ID   int64   `json:"id"`
		Lat  float64 `json:"lat"`
		Lon  float64 `json:"lon"`
		Tags struct {
			Name   string `json:"name"`
			NameAr string `json:"name:ar"`
			NameFr string `json:"name:fr"`
			Ref    string `json:"ref"`
		} `json:"tags"`
	} `json:"elements"`
}

const baseURL = "https://www.casatramway.ma"

// Known schedules from casatramway.ma (Winter 2025)
var lineSchedules = map[string]Schedule{
	"T1": {
		FirstDeparture: "05:30",
		LastDeparture:  "22:30",
		Frequency:      "6-10 min (peak), 12-15 min (off-peak)",
	},
	"T2": {
		FirstDeparture: "05:30",
		LastDeparture:  "22:30",
		Frequency:      "6-10 min (peak), 12-15 min (off-peak)",
	},
	"T3": {
		FirstDeparture: "05:30",
		LastDeparture:  "22:30",
		Frequency:      "6-10 min (peak), 12-15 min (off-peak)",
	},
	"T4": {
		FirstDeparture: "05:30",
		LastDeparture:  "22:30",
		Frequency:      "6-10 min (peak), 12-15 min (off-peak)",
	},
	"BW1": {
		FirstDeparture: "05:30",
		LastDeparture:  "22:30",
		Frequency:      "8-12 min (peak), 15-20 min (off-peak)",
	},
	"BW2": {
		FirstDeparture: "05:30",
		LastDeparture:  "22:30",
		Frequency:      "8-12 min (peak), 15-20 min (off-peak)",
	},
}

func fetchPage(url string) (*goquery.Document, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("status code: %d", resp.StatusCode)
	}

	return goquery.NewDocumentFromReader(resp.Body)
}

func scrapeLineList() ([]Line, error) {
	doc, err := fetchPage(baseURL + "/se-deplacer/lignes-et-horaires")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch line list: %w", err)
	}

	var lines []Line

	doc.Find(".card--ligne").Each(func(i int, card *goquery.Selection) {
		line := Line{}

		badge := card.Find(".ligne__badge")
		line.ID = strings.TrimSpace(badge.Text())
		if style, exists := badge.Attr("style"); exists {
			if idx := strings.Index(style, "background-color:"); idx != -1 {
				colorPart := style[idx+17:]
				if endIdx := strings.Index(colorPart, ";"); endIdx != -1 {
					line.Color = strings.TrimSpace(colorPart[:endIdx])
				}
			}
		}

		line.Name = strings.TrimSpace(card.Find(".title a span").Text())

		if strings.HasPrefix(line.ID, "T") {
			line.Type = "tram"
		} else if strings.HasPrefix(line.ID, "BW") {
			line.Type = "busway"
		}

		line.Origin = strings.TrimSpace(card.Find(".field-pg-origine").Text())
		line.Destination = strings.TrimSpace(card.Find(".field-pg-destination").Text())

		// Add schedule from known data
		if schedule, ok := lineSchedules[line.ID]; ok {
			line.Schedule = schedule
		}

		if href, exists := card.Find(".title a").Attr("href"); exists {
			if strings.HasPrefix(href, "/") {
				line.DetailURL = baseURL + href
			} else {
				line.DetailURL = href
			}
		}

		if line.ID != "" {
			lines = append(lines, line)
		}
	})

	return lines, nil
}

func fetchOSMStations() ([]Station, error) {
	query := `[out:json][timeout:60];
(
  node["railway"="tram_stop"](33.45,-7.75,33.65,-7.40);
  node["public_transport"="platform"]["tram"="yes"](33.45,-7.75,33.65,-7.40);
);
out body;`

	client := &http.Client{Timeout: 60 * time.Second}
	
	resp, err := client.PostForm("https://overpass-api.de/api/interpreter",
		url.Values{"data": {query}})
	if err != nil {
		return nil, fmt.Errorf("overpass request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var overpassResp OverpassResponse
	if err := json.Unmarshal(body, &overpassResp); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	stationMap := make(map[string]Station)
	for _, elem := range overpassResp.Elements {
		name := elem.Tags.Name
		if name == "" {
			continue
		}

		if existing, ok := stationMap[name]; ok {
			if existing.NameAr == "" && elem.Tags.NameAr != "" {
				existing.NameAr = elem.Tags.NameAr
				stationMap[name] = existing
			}
		} else {
			stationMap[name] = Station{
				ID:     elem.ID,
				Name:   name,
				NameAr: elem.Tags.NameAr,
				Lat:    elem.Lat,
				Lon:    elem.Lon,
				Ref:    elem.Tags.Ref,
			}
		}
	}

	var stations []Station
	for _, s := range stationMap {
		stations = append(stations, s)
	}

	return stations, nil
}

func main() {
	fmt.Println("🚃 Casablanca Transport Network Scraper v2")
	fmt.Println("==========================================")
	fmt.Println("Sources: casatramway.ma + OpenStreetMap")
	fmt.Println()

	// Step 1: Get lines from casatramway.ma
	fmt.Println("📋 Fetching lines from casatramway.ma...")
	lines, err := scrapeLineList()
	if err != nil {
		log.Fatalf("Failed to scrape lines: %v", err)
	}
	fmt.Printf("✅ Found %d lines\n", len(lines))

	// Step 2: Get stations from OpenStreetMap
	fmt.Println("\n📍 Fetching stations from OpenStreetMap...")
	stations, err := fetchOSMStations()
	if err != nil {
		log.Printf("⚠️  Warning: Failed to fetch OSM stations: %v", err)
		stations = []Station{}
	} else {
		fmt.Printf("✅ Found %d unique stations\n", len(stations))
	}

	// Step 3: Create network with pricing info
	network := Network{
		ScrapedAt: time.Now().Format(time.RFC3339),
		Source:    "casatramway.ma + OpenStreetMap",
		Pricing: Pricing{
			StandardFare:    8.0,
			Currency:        "MAD",
			TransferAllowed: true,
			TransferNote:    "Valid for tram-tram and tram-busway transfers within 1 hour",
		},
		Lines:    lines,
		Stations: stations,
	}

	jsonData, err := json.MarshalIndent(network, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal JSON: %v", err)
	}

	outputFile := "casablanca_transport.json"
	if err := os.WriteFile(outputFile, jsonData, 0644); err != nil {
		log.Fatalf("Failed to write output: %v", err)
	}

	fmt.Printf("\n✅ Data saved to %s\n", outputFile)
	
	// Print summary
	fmt.Println("\n📊 Network Summary:")
	fmt.Println("-------------------")
	fmt.Printf("💰 Standard Fare: %.0f %s\n", network.Pricing.StandardFare, network.Pricing.Currency)
	fmt.Printf("🔄 Transfers: %s\n", network.Pricing.TransferNote)
	fmt.Println()
	fmt.Printf("Lines: %d\n", len(lines))
	for _, l := range lines {
		fmt.Printf("  • %s (%s): %s ↔ %s\n", l.ID, l.Type, l.Origin, l.Destination)
		fmt.Printf("    ⏰ %s - %s | %s\n", l.Schedule.FirstDeparture, l.Schedule.LastDeparture, l.Schedule.Frequency)
	}
	fmt.Printf("\nStations: %d unique stops\n", len(stations))
}
