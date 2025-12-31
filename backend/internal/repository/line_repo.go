package repository

import (
	"context"
	"errors"

	"github.com/antigravity/morocco-transport/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LineRepository struct {
	db *pgxpool.Pool
}

func NewLineRepository(db *pgxpool.Pool) *LineRepository {
	return &LineRepository{db: db}
}

func (r *LineRepository) GetAllLines(ctx context.Context) ([]models.Line, error) {
	query := `
		SELECT l.id, l.code, l.name_fr, l.line_type, COALESCE(l.color, '#000000'), l.operator_id, 
		       l.origin_name, l.destination_name, 
		       (SELECT COUNT(*) FROM line_stops WHERE line_id = l.id) as stop_count
		FROM lines l
		ORDER BY 
			CASE 
				WHEN line_type = 'tram' THEN 1 
				WHEN line_type = 'busway' THEN 2 
				WHEN line_type = 'train' THEN 3 
				ELSE 4 
			END,
			l.code ASC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lines []models.Line
	for rows.Next() {
		var l models.Line
		err := rows.Scan(&l.ID, &l.Code, &l.Name, &l.Type, &l.Color, &l.OperatorID, &l.Origin, &l.Destination, &l.StopCount)
		if err != nil {
			return nil, err
		}
		lines = append(lines, l)
	}
	return lines, nil
}

func (r *LineRepository) GetLineDetails(ctx context.Context, lineID int) (*models.Line, []models.Stop, error) {
	// 1. Get Line Info
	var l models.Line
	err := r.db.QueryRow(ctx, `
		SELECT id, code, name_fr, line_type, COALESCE(color, '#000000'), operator_id, origin_name, destination_name
		FROM lines WHERE id = $1
	`, lineID).Scan(&l.ID, &l.Code, &l.Name, &l.Type, &l.Color, &l.OperatorID, &l.Origin, &l.Destination)
	if err != nil {
		return nil, nil, err
	}

	// 2. Get Stops (Ordered by sequence for direction 0)
	// TODO: Support direction parameter
	query := `
		SELECT s.id, s.code, s.name_fr, ST_X(s.location::geometry), ST_Y(s.location::geometry), s.stop_type, ls.stop_sequence
		FROM stops s
		JOIN line_stops ls ON s.id = ls.stop_id
		WHERE ls.line_id = $1 AND ls.direction = 0
		ORDER BY ls.stop_sequence ASC
	`
	rows, err := r.db.Query(ctx, query, lineID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var stops []models.Stop
	for rows.Next() {
		var s models.Stop
		err := rows.Scan(&s.ID, &s.Code, &s.Name, &s.Lon, &s.Lat, &s.Type, &s.Sequence)
		if err != nil {
			return nil, nil, err
		}
		stops = append(stops, s)
	}

	return &l, stops, nil
}

func (r *LineRepository) GetStopsInViewport(ctx context.Context, minLat, minLon, maxLat, maxLon float64) ([]models.Stop, error) {
	query := `
		SELECT id, code, name_fr, ST_X(location::geometry), ST_Y(location::geometry), stop_type
		FROM stops
		WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
		LIMIT 200
	`
	rows, err := r.db.Query(ctx, query, minLon, minLat, maxLon, maxLat)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stops []models.Stop
	for rows.Next() {
		var s models.Stop
		err := rows.Scan(&s.ID, &s.Code, &s.Name, &s.Lon, &s.Lat, &s.Type)
		if err != nil {
			return nil, err
		}
		stops = append(stops, s)
	}
	return stops, nil
}

func (r *LineRepository) GetStopDetails(ctx context.Context, stopID int) (*models.Stop, []models.Line, error) {
	// 1) Stop info
	var s models.Stop
	err := r.db.QueryRow(ctx, `
		SELECT id, code, name_fr, ST_X(location::geometry), ST_Y(location::geometry), stop_type
		FROM stops
		WHERE id = $1
	`, stopID).Scan(&s.ID, &s.Code, &s.Name, &s.Lon, &s.Lat, &s.Type)
	if err != nil {
		return nil, nil, err
	}

	// 2) Connected lines
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT l.id, l.code, l.name_fr, l.line_type, COALESCE(l.color, '#000000'), l.operator_id,
		       l.origin_name, l.destination_name
		FROM lines l
		JOIN line_stops ls ON ls.line_id = l.id
		WHERE ls.stop_id = $1
		ORDER BY l.code ASC
	`, stopID)
	if err != nil {
		return &s, nil, err
	}
	defer rows.Close()

	var lines []models.Line
	for rows.Next() {
		var l models.Line
		if err := rows.Scan(&l.ID, &l.Code, &l.Name, &l.Type, &l.Color, &l.OperatorID, &l.Origin, &l.Destination); err != nil {
			return &s, nil, err
		}
		lines = append(lines, l)
	}

	// rows.Err() is redundant in pgx v5 if Scan errors are handled, but keep for completeness.
	if err := rows.Err(); err != nil {
		return &s, nil, err
	}

	return &s, lines, nil
}

func IsNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
