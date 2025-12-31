package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// Data structures matching manual_schedules.json
type ManualData struct {
	Tramway TransportSection `json:"tramway"`
	Busway  TransportSection `json:"busway"`
	Bus     BusSection       `json:"bus"`
}

type TransportSection struct {
	Price string      `json:"price"`
	Lines []LineSched `json:"lines"`
}

type LineSched struct {
	Line      string     `json:"line"`
	Route     string     `json:"route"`
	Schedules []Schedule `json:"schedules"`
}

type Schedule struct {
	Direction   string      `json:"direction"`
	Frequencies Frequencies `json:"frequencies"`
}

type Frequencies struct {
	MondayFriday []TimeRange `json:"monday_friday"`
	Saturday     []TimeRange `json:"saturday"`
	Sunday       []TimeRange `json:"sunday_holidays"`
}

type TimeRange struct {
	Range    string `json:"time_range"`
	Interval string `json:"interval"`
}

type BusSection struct {
	Lines []BusLine `json:"lines"`
}

type BusLine struct {
	Line     string `json:"line"`
	Route    string `json:"route"`
	Price    string `json:"price"`
	Schedule string `json:"schedule"`
}

// Database helpers
func connectDB() (*sql.DB, error) {
	connStr := "host=localhost port=5433 user=transport password=transport_dev_pwd dbname=transport sslmode=disable"
	return sql.Open("postgres", connStr)
}

func parsePrice(priceStr string) float64 {
	re := regexp.MustCompile(`(\d+(\.\d+)?)`)
	matches := re.FindStringSubmatch(priceStr)
	if len(matches) > 1 {
		val, _ := strconv.ParseFloat(matches[1], 64)
		return val
	}
	return 0.0
}

func parseTime(tStr string) (time.Time, error) {
	return time.Parse("15:04", strings.TrimSpace(tStr))
}

func parseInterval(iStr string) time.Duration {
	iStr = strings.ToLower(iStr)
	// Handle "05 min 30s"
	min := 0
	sec := 0
	
	reMin := regexp.MustCompile(`(\d+)\s*min`)
	reSec := regexp.MustCompile(`(\d+)s`)
	
	m := reMin.FindStringSubmatch(iStr)
	if len(m) > 1 {
		min, _ = strconv.Atoi(m[1])
	}
	
	s := reSec.FindStringSubmatch(iStr)
	if len(s) > 1 {
		sec, _ = strconv.Atoi(s[1])
	}
	
	return time.Duration(min)*time.Minute + time.Duration(sec)*time.Second
}

func generateDependures(ranges []TimeRange) []string {
	var departures []string
	
	for _, r := range ranges {
		parts := strings.Split(r.Range, "-")
		if len(parts) != 2 {
			continue
		}
		
		start, err1 := parseTime(parts[0])
		end, err2 := parseTime(parts[1])
		interval := parseInterval(r.Interval)
		
		if err1 != nil || err2 != nil || interval == 0 {
			continue
		}
		
		// If end match start of next range, we might duplicate? 
		// Usually ranges are inclusive on start, exclusive on end or inclusive.
		// Let's assume start inclusive, end inclusive for the sequence generation
		
		curr := start
		for curr.Before(end) || curr.Equal(end) {
			departures = append(departures, curr.Format("15:04:05"))
			curr = curr.Add(interval)
		}
	}
	// Sort and deduplicate would be good but simple append is okay for MVP
	return departures
}

func main() {
	// Read JSON
	dataBytes, err := os.ReadFile("manual_schedules.json")
	if err != nil {
		log.Fatal(err)
	}
	
	var data ManualData
	if err := json.Unmarshal(dataBytes, &data); err != nil {
		log.Fatal(err)
	}
	
	db, err := connectDB()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	
	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()
	
	// 1. Process Trams and Busways
	processSection(tx, data.Tramway.Lines, "tram")
	processSection(tx, data.Busway.Lines, "busway")
	
	// 2. Process Buses
	processBuses(tx, data.Bus.Lines)

	// 3. Update Fares
	updateFares(tx, data)
	
	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("✅ Import completed successfully!")
}

func processSection(tx *sql.Tx, lines []LineSched, mode string) {
	for _, lineData := range lines {
		fmt.Printf("Processing %s %s...\n", mode, lineData.Line)
		
		// Find line ID
		var lineID int
		err := tx.QueryRow("SELECT id FROM lines WHERE code = $1", lineData.Line).Scan(&lineID)
		if err != nil {
			log.Printf("⚠️ Line %s not found in DB, skipping schedules", lineData.Line)
			continue
		}
		
		for _, sched := range lineData.Schedules {
			// Determine direction (0 or 1) based on route text matching origin/dest?
			// For simplicity: DB schema has 0 and 1. We need to map "Lissasfa - Terminus" to 0 or 1.
			// Let's rely on valid endpoints.
			// Check DB line origin/dest
			var origin, dest string
			tx.QueryRow("SELECT origin_name, destination_name FROM lines WHERE id = $1", lineID).Scan(&origin, dest)
			
			direction := 0 // default
			// Heuristic: if direction string contains destination name, it's 0 (or 1 depending on convention)
			// Let's assume Direction 0 is Origin -> Destination
			// Direction 1 is Destination -> Origin
			// The JSON says "Lissasfa - Terminus". If Line is Lissasfa <-> Sidi Moumen
			// Then "Lissasfa - Terminus" usually means TO Lissasfa. So Dest -> Origin => Dir 1.
			
			// Normalize strings for comparison
			dirStr := strings.ToLower(sched.Direction)
			origLower := strings.ToLower(origin)
			destLower := strings.ToLower(dest)
			
			if strings.Contains(dirStr, origLower) {
				direction = 1
			} else if strings.Contains(dirStr, destLower) {
				direction = 0
			}
			
			// Generate times
			weekdayTimes := generateDependures(sched.Frequencies.MondayFriday)
			saturdayTimes := generateDependures(sched.Frequencies.Saturday)
			sundayTimes := generateDependures(sched.Frequencies.Sunday)
			
			insertSchedules(tx, lineID, direction, "weekday", weekdayTimes)
			insertSchedules(tx, lineID, direction, "saturday", saturdayTimes)
			insertSchedules(tx, lineID, direction, "sunday", sundayTimes)
		}
	}
}

func processBuses(tx *sql.Tx, lines []BusLine) {
	for _, bus := range lines {
		// Clean line code: L005 -> L5, 5 -> 5
		// DB likely has "L5" or "5". JSON has "L005".
		// Try L005, then L5, then 5.
		
		codes := []string{bus.Line, strings.Replace(bus.Line, "L00", "L", 1), strings.Replace(bus.Line, "L0", "L", 1)}
		var lineID int
		found := false
		
		for _, code := range codes {
			err := tx.QueryRow("SELECT id FROM lines WHERE code = $1 AND line_type = 'bus'", code).Scan(&lineID)
			if err == nil {
				found = true
				break
			}
		}
		
		if !found {
			log.Printf("⚠️ Bus Line %s not found in DB", bus.Line)
			continue
		}
		
		// Update price
		price := parsePrice(bus.Price)
		if price > 0 {
			// Update fares table or specific line fare?
			// Schema has `fares` linked to `operators`.
			// We can assume standard bus fare, but if lines have specific fares, we might need a specific fare override
			// For now, let's just log it or update a generic fare if needed.
			// Ideally we create a fare rule for this line if different from standard.
		}
		
		// Generate synthetic schedule if range provided
		if bus.Schedule != "" {
			// "Mon-Sun approx 05:40 - 21:00"
			re := regexp.MustCompile(`(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})`)
			m := re.FindStringSubmatch(bus.Schedule)
			if len(m) > 2 {
				startStr, endStr := m[1], m[2]
				start, _ := parseTime(startStr)
				end, _ := parseTime(endStr)
				
				// Generate every 20 mins
				var times []string
				curr := start
				for curr.Before(end) {
					times = append(times, curr.Format("15:04:05"))
					curr = curr.Add(20 * time.Minute)
				}
				
				// Insert for both directions
				insertSchedules(tx, lineID, 0, "weekday", times)
				insertSchedules(tx, lineID, 1, "weekday", times)
				insertSchedules(tx, lineID, 0, "saturday", times)
				insertSchedules(tx, lineID, 1, "saturday", times)
				insertSchedules(tx, lineID, 0, "sunday", times)
				insertSchedules(tx, lineID, 1, "sunday", times)
			}
		}
	}
}

func insertSchedules(tx *sql.Tx, lineID, direction int, dayType string, times []string) {
	// Find all stops for this line/direction to populate schedule for *every* stop?
	// Real GTFS has times per stop. 
	// Basic routing needs at least departure from first stop. 
	// For RAPTOR, we need times at stops.
	// We can calculate time offsets based on distance/speed if we only have start time.
	// In this simplified import, let's just insert departure times for the *first* stop of the direction.
	// The routing engine (RAPTOR) will calculate arrival at subsequent stops based on travel time.
	
	// Get first stop ID
	var stopID int
	err := tx.QueryRow(`
		SELECT stop_id FROM line_stops 
		WHERE line_id = $1 AND direction = $2 
		ORDER BY stop_sequence ASC LIMIT 1
	`, lineID, direction).Scan(&stopID)
	
	if err != nil {
		// log.Printf("No stops found for line %d dir %d", lineID, direction)
		return
	}
	
	stmt, _ := tx.Prepare(`INSERT INTO schedules (line_id, stop_id, direction, day_type, departure_time) VALUES ($1, $2, $3, $4, $5)`)
	defer stmt.Close()
	
	for _, t := range times {
		stmt.Exec(lineID, stopID, direction, dayType, t)
	}
}

func updateFares(tx *sql.Tx, data ManualData) {
	// Simple update of base fares
	tramPrice := parsePrice(data.Tramway.Price)
	if tramPrice > 0 {
		tx.Exec("UPDATE fares SET fare_mad = $1 WHERE line_type = 'tram'", tramPrice)
		tx.Exec("UPDATE fares SET fare_mad = $1 WHERE line_type = 'busway'", tramPrice)
	}
}
