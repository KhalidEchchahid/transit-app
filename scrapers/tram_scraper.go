package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// Line represents a transport line
type Line struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Type        string   `json:"type"` // "tram" or "busway"
	Color       string   `json:"color"`
	Origin      string   `json:"origin"`
	Destination string   `json:"destination"`
	Stations    []string `json:"stations"`
	DetailURL   string   `json:"detail_url"`
}

// Network represents the entire transport network
type Network struct {
	ScrapedAt string `json:"scraped_at"`
	Lines     []Line `json:"lines"`
}

const baseURL = "https://www.casatramway.ma"

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

	// Find all line cards
	doc.Find(".card--ligne").Each(func(i int, card *goquery.Selection) {
		line := Line{}

		// Get line badge (ID and color)
		badge := card.Find(".ligne__badge")
		line.ID = strings.TrimSpace(badge.Text())
		if style, exists := badge.Attr("style"); exists {
			// Extract background-color from style
			if idx := strings.Index(style, "background-color:"); idx != -1 {
				colorPart := style[idx+17:]
				if endIdx := strings.Index(colorPart, ";"); endIdx != -1 {
					line.Color = strings.TrimSpace(colorPart[:endIdx])
				}
			}
		}

		// Get line name
		line.Name = strings.TrimSpace(card.Find(".title a span").Text())

		// Determine type based on ID prefix
		if strings.HasPrefix(line.ID, "T") {
			line.Type = "tram"
		} else if strings.HasPrefix(line.ID, "BW") {
			line.Type = "busway"
		}

		// Get origin and destination
		line.Origin = strings.TrimSpace(card.Find(".field-pg-origine").Text())
		line.Destination = strings.TrimSpace(card.Find(".field-pg-destination").Text())

		// Get detail URL
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

func scrapeLineStations(line *Line) error {
	if line.DetailURL == "" {
		return nil
	}

	doc, err := fetchPage(line.DetailURL)
	if err != nil {
		return fmt.Errorf("failed to fetch line detail %s: %w", line.ID, err)
	}

	// Look for station names in the schedule component or station list
	// The casatramway site uses a Vue component for schedules, but station names
	// might be in selectable dropdowns or lists
	
	// Try to find station options in select elements
	doc.Find("select option, .station-name, .stop-name").Each(func(i int, s *goquery.Selection) {
		name := strings.TrimSpace(s.Text())
		if name != "" && name != "Choisir un arrêt" && name != "Veuillez sélectionner un arrêt" {
			// Avoid duplicates
			found := false
			for _, existing := range line.Stations {
				if existing == name {
					found = true
					break
				}
			}
			if !found {
				line.Stations = append(line.Stations, name)
			}
		}
	})

	return nil
}

func main() {
	fmt.Println("🚃 Starting Casablanca Transport Scraper...")
	fmt.Println("=======================================")

	// Step 1: Get list of all lines
	fmt.Println("\n📋 Fetching line list from casatramway.ma...")
	lines, err := scrapeLineList()
	if err != nil {
		log.Fatalf("Failed to scrape line list: %v", err)
	}
	fmt.Printf("✅ Found %d lines\n", len(lines))

	// Step 2: Get stations for each line
	for i := range lines {
		fmt.Printf("📍 Fetching stations for line %s...\n", lines[i].ID)
		if err := scrapeLineStations(&lines[i]); err != nil {
			fmt.Printf("⚠️  Warning: %v\n", err)
		} else {
			fmt.Printf("   Found %d stations\n", len(lines[i].Stations))
		}
		// Be polite, add delay between requests
		time.Sleep(500 * time.Millisecond)
	}

	// Step 3: Create network object and save to JSON
	network := Network{
		ScrapedAt: time.Now().Format(time.RFC3339),
		Lines:     lines,
	}

	jsonData, err := json.MarshalIndent(network, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal JSON: %v", err)
	}

	outputFile := "casablanca_network.json"
	if err := os.WriteFile(outputFile, jsonData, 0644); err != nil {
		log.Fatalf("Failed to write output file: %v", err)
	}

	fmt.Printf("\n✅ Scraped data saved to %s\n", outputFile)
	fmt.Println("\n📊 Summary:")
	for _, line := range lines {
		fmt.Printf("   • %s (%s): %s → %s\n", line.ID, line.Type, line.Origin, line.Destination)
	}
}
