package routing

import (
	"fmt"
	"math"
)

const (
	MaxRounds     = 6
	Infinity      = math.MaxInt32
	TransferCost  = 60 // penalty in seconds
	WalkRouteID   = -1 // Added for walk legs in reconstruction
)

type Raptor struct {
	Data *RaptorData
}

func NewRaptor(data *RaptorData) *Raptor {
	return &Raptor{Data: data}
}

type Journey struct {
	Legs []Leg `json:"legs"`
}

type Leg struct {
	Type       string `json:"type"` // "transit" or "walk"
	FromStop   Stop   `json:"fromStop"`
	ToStop     Stop   `json:"toStop"`
	StartTime  string `json:"startTime"`
	EndTime    string `json:"endTime"`
	Duration   int    `json:"duration"`
	RouteCode  string `json:"routeCode"`
	RouteColor string `json:"routeColor"`
	WaitTime   int    `json:"waitTime"`
	Stops      []Stop        `json:"stops,omitempty"`
	Geometry   [][2]float64  `json:"geometry,omitempty"`
}

// FindRoute finds the best route from source stops to target stops
// sourceStops: map[StopID]int (stop -> initial walk time)
func (r *Raptor) FindRoute(sourceStops map[StopID]int, targetStops map[StopID]bool, departureTime int, dayType string) *Journey {
	// Initialize
	rounds := make([][]int, MaxRounds+1) // [k][stopID] -> earliest arrival time
	for k := 0; k <= MaxRounds; k++ {
		rounds[k] = make([]int, len(r.Data.Stops))
		for i := range rounds[k] {
			rounds[k][i] = Infinity
		}
	}

	markedStops := make(map[StopID]bool)

	// Set initial times for source stops (round 0)
	for stopID, walkTime := range sourceStops {
		rounds[0][stopID] = departureTime + walkTime
		markedStops[stopID] = true
	}

	// Backtracking pointers: [k][stopID] -> {fromStop, tripID, boardStop}
	// We need to store how we got here to reconstruct the journey
	type Label struct {
		fromStop  StopID
		routeID   int // Changed to int to allow -1
		tripID    TripID
		boardTime int
	}
	labels := make([][]Label, MaxRounds+1)
	for k := 0; k <= MaxRounds; k++ {
		labels[k] = make([]Label, len(r.Data.Stops))
	}

	// Algorithm Loop
	for k := 1; k <= MaxRounds; k++ {
		// Copy previous round best times as baseline
		copy(rounds[k], rounds[k-1])
		
		// 1. Accumulate routes to process
		routesToProcess := make(map[RouteID]StopID) // Route -> Earliest marked stop index
		// Optimization: Build Stop->Routes map on Init
		stopRoutes := r.buildStopRoutesIndex()

		for stopID := range markedStops {
			if rRouteIDs, ok := stopRoutes[stopID]; ok {
				for _, rid := range rRouteIDs {
					// Check if this stop is earlier in the route than what we have
					// We need the index of stopID in route rid
					// Using cached index would be better.
					if existingStop, ok := routesToProcess[rid]; ok {
						// we want the earliest stop in the sequence
						if r.getStopIndex(rid, stopID) < r.getStopIndex(rid, existingStop) {
							routesToProcess[rid] = stopID
						}
					} else {
						routesToProcess[rid] = stopID
					}
				}
			}
		}
		
		markedStops = make(map[StopID]bool) // Clear for next round

		// 2. Process Routes
		for rid, startStopID := range routesToProcess {
			route := r.Data.Routes[rid]
			var currentTrip *Trip
			var boardStop StopID
			var boardTime int
			
			// Iterate stops starting from startStopID
			startIdx := r.getStopIndex(rid, startStopID)
			for i := startIdx; i < len(route.Stops); i++ {
				stopID := route.Stops[i]
				
				// Can we improve arrival at this stop?
				if currentTrip != nil {
					arrivalTime := currentTrip.StopTimes[i].Arrival
					if arrivalTime < rounds[k][stopID] {
						rounds[k][stopID] = arrivalTime
						labels[k][stopID] = Label{
							fromStop:  boardStop,
							routeID:   int(rid),
							tripID:    currentTrip.ID,
							boardTime: boardTime,
						}
						markedStops[stopID] = true
					}
				}

				// Can we board a trip here?
				prevArrival := rounds[k-1][stopID]
				if prevArrival < Infinity {
					// Find earliest trip departing >= prevArrival
					// Filter by service day
					foundTrip := false
					for _, trip := range route.Trips {
						if trip.ServiceId != dayType { continue }
						dep := trip.StopTimes[i].Departure
						if dep >= prevArrival {
							currentTrip = &trip
							boardStop = stopID
							boardTime = dep
							foundTrip = true
							break 
						}
					}
					if !foundTrip {
						currentTrip = nil 
					}
				}
			}
		}

		// 3. Process Transfers
		transitMarked := make([]StopID, 0, len(markedStops))
		for s := range markedStops {
			transitMarked = append(transitMarked, s)
		}

		for _, stopID := range transitMarked {
			arrivalTime := rounds[k][stopID]
			transfers := r.Data.Transfers[stopID]
			for _, tr := range transfers {
				walkArr := arrivalTime + tr.TimeSeconds
				if walkArr < rounds[k][tr.ToStop] {
					rounds[k][tr.ToStop] = walkArr
					labels[k][tr.ToStop] = Label{
						fromStop: stopID,
						routeID:  WalkRouteID,
						// tripID meaningless
						boardTime: arrivalTime, // Start walk time
					}
					markedStops[tr.ToStop] = true
				}
			}
		}

		// Optimization: If no stops marked, break
		if len(markedStops) == 0 {
			break
		}
	}

	// Reconstruction
	// Find best target stop
	bestTime := Infinity
	var bestTarget StopID
	
	for tStop := range targetStops {
		for k := 1; k <= MaxRounds; k++ {
			if rounds[k][tStop] < bestTime {
				bestTime = rounds[k][tStop]
				bestTarget = tStop
			}
		}
	}

	if bestTime == Infinity {
		return nil
	}

	// Reconstruct path
	var legs []Leg
	currentStop := bestTarget
	
	// Find the round k where the best time was achieved
	bestK := 0
	for k := 1; k <= MaxRounds; k++ {
		if rounds[k][bestTarget] == bestTime {
			bestK = k
			break
		}
	}

	for k := bestK; k > 0; k-- {
		// If no improvement in this round, skip to previous
		if rounds[k][currentStop] == rounds[k-1][currentStop] {
			continue
		}

		label := labels[k][currentStop]
		fromStop := label.fromStop
		
		if label.routeID == WalkRouteID {
			// Walk Leg
			walkStops := []Stop{r.Data.Stops[fromStop], r.Data.Stops[currentStop]}
			walkGeom := [][2]float64{
				{r.Data.Stops[fromStop].Lon, r.Data.Stops[fromStop].Lat},
				{r.Data.Stops[currentStop].Lon, r.Data.Stops[currentStop].Lat},
			}

			leg := Leg{
				Type:       "walk",
				FromStop:   r.Data.Stops[fromStop],
				ToStop:     r.Data.Stops[currentStop],
				StartTime:  SecondsToTime(label.boardTime),
				EndTime:    SecondsToTime(rounds[k][currentStop]),
				Duration:   rounds[k][currentStop] - label.boardTime,
				Stops:      walkStops,
				Geometry:   walkGeom,
			}
			legs = append([]Leg{leg}, legs...)
			
			// Update currentStop to the start of the walk
			currentStop = fromStop
			
			// Now check if THIS stop was reached via Transit in the SAME round
			// If so, we need to extract that transit leg too.
			if rounds[k][currentStop] < rounds[k-1][currentStop] {
				// Yes, it was updated in this round. Grab its label.
				label = labels[k][currentStop]
				fromStop = label.fromStop
				
				route := r.Data.Routes[label.routeID]
				stopsSeq, geom := r.buildLegPath(route, fromStop, currentStop)
				leg := Leg{
					Type:       "transit",
					FromStop:   r.Data.Stops[fromStop],
					ToStop:     r.Data.Stops[currentStop],
					StartTime:  SecondsToTime(label.boardTime),
					EndTime:    SecondsToTime(rounds[k][currentStop]), 
					Duration:   rounds[k][currentStop] - label.boardTime,
					RouteCode:  route.LineCode,
					RouteColor: route.LineColor,
					Stops:      stopsSeq,
					Geometry:   geom,
				}
				legs = append([]Leg{leg}, legs...)
				currentStop = fromStop
			}
		} else {
			// Transit Leg Only
			route := r.Data.Routes[label.routeID]
			stopsSeq, geom := r.buildLegPath(route, fromStop, currentStop)

			leg := Leg{
				Type:       "transit",
				FromStop:   r.Data.Stops[fromStop],
				ToStop:     r.Data.Stops[currentStop],
				StartTime:  SecondsToTime(label.boardTime),
				EndTime:    SecondsToTime(rounds[k][currentStop]), 
				Duration:   rounds[k][currentStop] - label.boardTime,
				RouteCode:  route.LineCode,
				RouteColor: route.LineColor,
				Stops:      stopsSeq,
				Geometry:   geom,
			}
			legs = append([]Leg{leg}, legs...)
			currentStop = fromStop
		}
	}
	
	// Add initial walk if needed
	// The `rounds[0]` initialization already accounts for initial walk time.
	// If the `currentStop` after reconstruction is not one of the initial source stops,
	// or if it is a source stop but the `departureTime` + `walkTime` to it
	// is different from `rounds[0][currentStop]`, then an initial walk occurred.
	// For now, we assume the `rounds[0]` correctly sets the starting point.
	// If `currentStop` is not in `sourceStops`, it means the first leg was a walk from a source.
	// This part of reconstruction is often tricky and depends on how `rounds[0]` is defined.
	// For simplicity, we'll assume `currentStop` is now one of the initial source stops.
	
	return &Journey{Legs: legs}
}

// buildLegPath returns the ordered stops and a simple polyline (lon/lat pairs) between two stops along a route.
func (r *Raptor) buildLegPath(route Route, from StopID, to StopID) ([]Stop, [][2]float64) {
	fromIdx := r.getStopIndex(route.ID, from)
	toIdx := r.getStopIndex(route.ID, to)
	if fromIdx == -1 || toIdx == -1 {
		return nil, nil
	}
	if fromIdx > toIdx {
		fromIdx, toIdx = toIdx, fromIdx
	}

	sequence := route.Stops[fromIdx : toIdx+1]
	stops := make([]Stop, 0, len(sequence))
	geometry := make([][2]float64, 0, len(sequence))

	for _, sid := range sequence {
		st := r.Data.Stops[sid]
		stops = append(stops, st)
		geometry = append(geometry, [2]float64{st.Lon, st.Lat})
	}

	return stops, geometry
}

func SecondsToTime(seconds int) string {
	h := seconds / 3600
	m := (seconds % 3600) / 60
	s := seconds % 60
	return fmt.Sprintf("%02d:%02d:%02d", h, m, s)
}

// Helpers

func (r *Raptor) buildStopRoutesIndex() map[StopID][]RouteID {
	idx := make(map[StopID][]RouteID)
	for _, route := range r.Data.Routes {
		for _, s := range route.Stops {
			idx[s] = append(idx[s], route.ID)
		}
	}
	return idx
}

func (r *Raptor) getStopIndex(rid RouteID, sid StopID) int {
	for i, s := range r.Data.Routes[rid].Stops {
		if s == sid {
			return i
		}
	}
	return -1
}
