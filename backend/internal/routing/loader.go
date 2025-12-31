package routing

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Loader struct {
	db *pgxpool.Pool
}

func NewLoader(db *pgxpool.Pool) *Loader {
	return &Loader{db: db}
}

func (l *Loader) LoadData(ctx context.Context) (*RaptorData, error) {
	log.Println("Loading RAPTOR data from database...")
	start := time.Now()

	data := &RaptorData{
		Transfers:    make(map[StopID][]Transfer),
		DBIDToStopID: make(map[int]StopID),
	}

	// 1. Load All Stops
	// Map DB ID -> Raptor ID
	stopMap := make(map[int]StopID)

	rows, err := l.db.Query(ctx, "SELECT id, code, name_fr, ST_X(location::geometry), ST_Y(location::geometry) FROM stops")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var s Stop
		var dbID int
		if err := rows.Scan(&dbID, &s.Code, &s.Name, &s.Lon, &s.Lat); err != nil {
			return nil, err
		}
		s.DBID = dbID
		s.ID = StopID(len(data.Stops))
		stopMap[dbID] = s.ID
		data.DBIDToStopID[dbID] = s.ID
		data.Stops = append(data.Stops, s)
	}
	log.Printf("Loaded %d stops", len(data.Stops))

	// 2. Load Routes and Trips
	// We group by (line_id, direction) to form unique physical paths (Patterns)
	// Theoretically, RAPTOR routes are unique stop sequences.
	
	// Query: distinct line_id, direction
	patternRows, err := l.db.Query(ctx, "SELECT DISTINCT line_id, direction FROM line_stops")
	if err != nil {
		return nil, err
	}
	defer patternRows.Close()

	patterns := [][2]int{} // [line_id, direction]
	for patternRows.Next() {
		var lid, dir int
		patternRows.Scan(&lid, &dir)
		patterns = append(patterns, [2]int{lid, dir})
	}

	for _, p := range patterns {
		lineID, dirID := p[0], p[1]

		// Get Line Info
		var lineCode, lineType, lineColor string
		err := l.db.QueryRow(ctx, "SELECT code, line_type, COALESCE(color, '#000000') FROM lines WHERE id=$1", lineID).Scan(&lineCode, &lineType, &lineColor)
		if err != nil {
			log.Println("Skipping line", lineID, err)
			continue
		}

		// Get Ordered Stops
		stopRows, err := l.db.Query(ctx, "SELECT stop_id FROM line_stops WHERE line_id=$1 AND direction=$2 ORDER BY stop_sequence", lineID, dirID)
		if err != nil {
			return nil, err
		}
		var stopIDs []StopID
		var dbStopIDs []int
		for stopRows.Next() {
			var sid int
			stopRows.Scan(&sid)
			if rid, ok := stopMap[sid]; ok {
				stopIDs = append(stopIDs, rid)
				dbStopIDs = append(dbStopIDs, sid)
			}
		}
		stopRows.Close()

		if len(stopIDs) < 2 {
			continue
		}

		// Create Route
		route := Route{
			ID:        RouteID(len(data.Routes)),
			Stops:     stopIDs,
			LineID:    lineID,
			LineCode:  lineCode,
			LineType:  lineType,
			LineColor: lineColor,
			Price:     5.0, // Default base price, should load from fares
		}
		if lineType == "tram" || lineType == "busway" {
			route.Price = 8.0 // Simplified for now
		}

		// Load Schedules (Trips)
		// We fetch all departure times for the FIRST stop of this pattern
		// Then we extrapolate the rest based on generic travel times if we don't have exact times for every stop.
		// However, our `schedules` table stores `stop_id`. 
		// Ideally we grab all schedules for this line/direction.
		
		// For simplicity/speed in this demo:
		// fetch distinct days first
		for _, dayType := range []string{"weekday", "saturday", "sunday"} {
			// Find trips for this day. 
			// We group by departure_time at the first stop to define a Trip.
			
			firstStopDBID := dbStopIDs[0]
			tripRows, err := l.db.Query(ctx, `
				SELECT departure_time FROM schedules 
				WHERE line_id=$1 AND direction=$2 AND stop_id=$3 AND day_type=$4
				ORDER BY departure_time
			`, lineID, dirID, firstStopDBID, dayType)
			if err != nil {
				continue
			}
			
			var startTimes []string
			for tripRows.Next() {
				var t string
				tripRows.Scan(&t)
				startTimes = append(startTimes, t)
			}
			tripRows.Close()

			for _, st := range startTimes {
				trip := Trip{
					ID:        TripID(len(route.Trips)), // Local ID within route? No, usually global needed? No, RAPTOR uses Route->Trip structure
					ServiceId: dayType,
					StopTimes: make([]StopTime, len(stopIDs)),
				}

				// Calculate times
				// Simple logic: Assume 3 minutes? minutes between stops for Bus, 2 for Tram
				// Better: Use `estimate_travel_time` or distance based.
				// For now: 15km/h avg speed -> distance between stops.
				// Let's use a fixed offset for robustness now: 3 mins per stop
				
				startTime, _ := time.Parse("15:04:05", st)
				startSecs := TimeToSeconds(startTime)

				currentSecs := startSecs
				for i := range stopIDs {
					trip.StopTimes[i] = StopTime{
						Arrival:   currentSecs,
						Departure: currentSecs,
					}
					// Add travel time to next stop
					currentSecs += 180 // 3 minutes
				}
				route.Trips = append(route.Trips, trip)
			}
		}

		data.Routes = append(data.Routes, route)
	}
	log.Printf("Loaded %d routes", len(data.Routes))

	// 3. Generate Transfers
	// Simple euclidean distance < 300m (approx 0.003 degrees? No, need Haversine or PostGIS)
	// We can use PostGIS to fetch pairs quickly!
	
	log.Println("Generating transfers...")
	tRows, err := l.db.Query(ctx, `
		SELECT s1.id, s2.id, ST_Distance(s1.location::geography, s2.location::geography) 
		FROM stops s1
		JOIN stops s2 ON ST_DWithin(s1.location::geography, s2.location::geography, 300)
		WHERE s1.id != s2.id
	`)
	if err != nil {
		return nil, err
	}
	defer tRows.Close()

	transferCount := 0
	for tRows.Next() {
		var id1, id2 int
		var dist float64
		tRows.Scan(&id1, &id2, &dist)

		if rid1, ok := stopMap[id1]; ok {
			if rid2, ok := stopMap[id2]; ok {
				// Assume 1m/s walking speed
				walkTime := int(dist) // seconds
				data.Transfers[rid1] = append(data.Transfers[rid1], Transfer{
					ToStop:      rid2,
					TimeSeconds: walkTime,
				})
				transferCount++
			}
		}
	}
	log.Printf("Generated %d transfers", transferCount)

	log.Printf("RAPTOR Data Load complete in %s", time.Since(start))
	return data, nil
}
