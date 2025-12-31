package models

import "time"

type Line struct {
	ID              int     `json:"id"`
	Code            string  `json:"code"`
	Name            string  `json:"name"`
	Type            string  `json:"type"` // tram, bus, busway, train
	Color           string  `json:"color"`
	OperatorID      int     `json:"operator_id"`
	Origin          string  `json:"origin"`
	Destination     string  `json:"destination"`
	StopCount       int     `json:"stop_count,omitempty"`
}

type Stop struct {
	ID          int     `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	Type        string  `json:"type"`
	Sequence    int     `json:"sequence,omitempty"`
}

type Schedule struct {
	DepartureTime time.Time `json:"departure_time"`
	Headsign      string    `json:"headsign"`
}
