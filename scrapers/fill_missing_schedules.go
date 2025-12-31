package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

func main() {
	db, err := sql.Open("postgres", "host=localhost port=5433 user=transport password=transport_dev_pwd dbname=transport sslmode=disable")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// 1. Identify Lines with NO schedules
	rows, err := db.Query(`
		SELECT id, code, line_type FROM lines 
		WHERE id NOT IN (SELECT distinct line_id FROM schedules)
	`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()

	// Default Schedule: 06:00 - 22:00 every 30 mins
	start, _ := time.Parse("15:04", "06:00")
	end, _ := time.Parse("15:04", "22:00")
	var times []string
	curr := start
	for curr.Before(end) || curr.Equal(end) {
		times = append(times, curr.Format("15:04:05"))
		curr = curr.Add(30 * time.Minute)
	}

	count := 0
	for rows.Next() {
		var lineID int
		var code, lType string
		if err := rows.Scan(&lineID, &code, &lType); err != nil {
			log.Fatal(err)
		}

		fmt.Printf("Generating fallback schedule for %s (%s)...\n", code, lType)

		// For each direction (0 and 1)
		for dir := 0; dir <= 1; dir++ {
			// Find first stop
			var stopID int
			err := db.QueryRow(`
				SELECT stop_id FROM line_stops 
				WHERE line_id = $1 AND direction = $2 
				ORDER BY stop_sequence ASC LIMIT 1
			`, lineID, dir).Scan(&stopID)

			if err != nil {
				// No stops for this direction, skip
				continue
			}

			// Insert for Weekday, Saturday, Sunday
			for _, day := range []string{"weekday", "saturday", "sunday"} {
				for _, t := range times {
					_, err := tx.Exec(`
						INSERT INTO schedules (line_id, stop_id, direction, day_type, departure_time)
						VALUES ($1, $2, $3, $4, $5)
					`, lineID, stopID, dir, day, t)
					if err != nil {
						log.Println("Error inserting schedule:", err)
					}
				}
			}
		}
		count++
	}

	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("✅ Generated schedules for %d missing lines.\n", count)
}
