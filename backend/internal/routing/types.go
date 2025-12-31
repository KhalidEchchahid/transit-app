package routing

import (
	"time"
)

// RAPTOR Data Structures (optimized for memory/speed)

type StopID int32
type RouteID int32
type TripID int32

type RaptorData struct {
	Stops        []Stop                `json:"-"`
	Routes       []Route               `json:"-"`
	Transfers    map[StopID][]Transfer `json:"-"` // Pre-calculated walking transfers
	DBIDToStopID map[int]StopID        `json:"-"` // Fast lookup
}

type Stop struct {
	ID   StopID  `json:"id"`
	DBID int     `json:"db_id,omitempty"` // database ID
	Code string  `json:"code,omitempty"`
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
	Name string  `json:"name"`
}

type Route struct {
	ID       RouteID  `json:"id"`
	Stops    []StopID `json:"stops"` // Ordered sequence of stops
	Trips    []Trip   `json:"trips"` // Sorted mainly by departure time of first stop (simplified)
	LineID   int      `json:"line_id"` // DB Line ID for reference
	LineCode string   `json:"line_code"`
	LineType string   `json:"line_type"`
	LineColor string  `json:"line_color"`
	Price    float64  `json:"price"`
}

type Trip struct {
	ID        TripID    `json:"id"`
	StopTimes []StopTime `json:"stop_times"`
	ServiceId string    `json:"service_id"` // "weekday", "saturday", "sunday"
}

type StopTime struct {
	Arrival   int `json:"arrival"`   // Seconds since midnight
	Departure int `json:"departure"` // Seconds since midnight
}

type Transfer struct {
	ToStop      StopID `json:"to_stop"`
	TimeSeconds int    `json:"time_seconds"` // Walking time
}

// Helper to convert time.Time to seconds from midnight
func TimeToSeconds(t time.Time) int {
	return t.Hour()*3600 + t.Minute()*60 + t.Second()
}
