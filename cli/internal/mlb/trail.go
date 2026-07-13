package mlb

import (
	"fmt"
	"sort"
)

var trailLevels = []struct {
	SportID int
	Label   string
	Order   int
}{
	{1, "MLB", 0}, {11, "AAA", 1}, {12, "AA", 2}, {13, "A+", 3}, {14, "A", 4}, {16, "Rookie", 5},
}

// TrailRow is one (season, level) line in a player's promotion trail.
type TrailRow struct {
	Season string
	Level  string
	Order  int
	Team   string
	Stat   map[string]interface{}
}

// SortTrail orders rows by season ascending, then level Rookie→MLB within a
// season so the timeline reads as a climb.
func SortTrail(rows []TrailRow) []TrailRow {
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].Season != rows[j].Season {
			return rows[i].Season < rows[j].Season
		}
		return rows[i].Order > rows[j].Order
	})
	return rows
}

// HasMinors reports whether any row is below MLB.
func HasMinors(rows []TrailRow) bool {
	for _, r := range rows {
		if r.Order > 0 {
			return true
		}
	}
	return false
}

// PlayerTrail fetches a player's yearByYear line at each level (MLB→Rookie) and
// merges them into one timeline. Best-effort per level: a failing or empty level
// contributes nothing.
func (c *Client) PlayerTrail(personID int, group string) ([]TrailRow, error) {
	var rows []TrailRow
	for _, lvl := range trailLevels {
		url := fmt.Sprintf("%s/people/%d/stats?stats=yearByYear&group=%s&sportId=%d&hydrate=team(sport)",
			c.v1, personID, group, lvl.SportID)
		var resp struct {
			Stats []struct {
				Splits []struct {
					Season string `json:"season"`
					Team   struct {
						Name string `json:"name"`
					} `json:"team"`
					Stat map[string]interface{} `json:"stat"`
				} `json:"splits"`
			} `json:"stats"`
		}
		if err := c.get(url, &resp); err != nil {
			continue
		}
		if len(resp.Stats) == 0 {
			continue
		}
		for _, s := range resp.Stats[0].Splits {
			rows = append(rows, TrailRow{
				Season: s.Season,
				Level:  lvl.Label,
				Order:  lvl.Order,
				Team:   s.Team.Name,
				Stat:   s.Stat,
			})
		}
	}
	return SortTrail(rows), nil
}
