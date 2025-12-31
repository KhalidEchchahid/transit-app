package routing

import "github.com/antigravity/morocco-transport/internal/models"

func (r *Raptor) ConvertStopsToIDs(stops []models.Stop, initialWalk int) map[StopID]int {
	result := make(map[StopID]int)
	for _, s := range stops {
		if id, ok := r.Data.DBIDToStopID[s.ID]; ok {
			result[id] = initialWalk
		}
	}
	return result
}
