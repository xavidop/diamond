// Package savant reads Baseball Savant percentile-rankings (best-effort, never fatal).
package savant

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Percentile struct {
	Key   string
	Label string
	Value int
}

type Result struct {
	OK          bool
	Season      int
	Percentiles []Percentile
}

// columns maps recognized CSV headers to display labels, in render order.
var columns = []struct{ Key, Label string }{
	{"xwoba", "xwOBA"}, {"xba", "xBA"}, {"xslg", "xSLG"}, {"xiso", "xISO"}, {"xobp", "xOBP"},
	{"brl_percent", "Barrel%"}, {"exit_velocity", "Exit Velo"}, {"max_ev", "Max EV"},
	{"hard_hit_percent", "Hard-Hit%"}, {"k_percent", "K%"}, {"bb_percent", "BB%"},
	{"whiff_percent", "Whiff%"}, {"chase_percent", "Chase%"}, {"arm_strength", "Arm"},
	{"sprint_speed", "Sprint Speed"}, {"oaa", "OAA"}, {"bat_speed", "Bat Speed"},
}

func rowToPercentiles(row map[string]string) []Percentile {
	var out []Percentile
	for _, c := range columns {
		raw, ok := row[c.Key]
		if !ok || raw == "" {
			continue
		}
		v, err := strconv.Atoi(strings.TrimSpace(raw))
		if err != nil {
			continue
		}
		out = append(out, Percentile{Key: c.Key, Label: c.Label, Value: v})
	}
	return out
}

func ParseCSV(data string, season int) Result {
	data = strings.TrimPrefix(data, "\ufeff")
	r := csv.NewReader(strings.NewReader(data))
	records, err := r.ReadAll()
	if err != nil || len(records) < 2 {
		return Result{OK: false}
	}
	headers := records[0]
	yearIdx := -1
	for i, h := range headers {
		if h == "year" {
			yearIdx = i
		}
	}
	if yearIdx == -1 {
		return Result{OK: false}
	}

	rows := make([]map[string]string, 0, len(records)-1)
	for _, rec := range records[1:] {
		m := make(map[string]string, len(headers))
		for i, h := range headers {
			if i < len(rec) {
				m[h] = rec[i]
			}
		}
		rows = append(rows, m)
	}

	var chosen map[string]string
	for _, m := range rows {
		if y, _ := strconv.Atoi(m["year"]); y == season && len(rowToPercentiles(m)) > 0 {
			chosen = m
			break
		}
	}
	if chosen == nil { // fallback: latest non-empty
		for i := len(rows) - 1; i >= 0; i-- {
			if len(rowToPercentiles(rows[i])) > 0 {
				chosen = rows[i]
				break
			}
		}
	}
	if chosen == nil {
		return Result{OK: false}
	}
	pct := rowToPercentiles(chosen)
	if len(pct) == 0 {
		return Result{OK: false}
	}
	yr, _ := strconv.Atoi(chosen["year"])
	return Result{OK: true, Season: yr, Percentiles: pct}
}

// Fetch never returns an error — any failure yields Result{OK:false}.
func Fetch(playerID int, kind string, season int) Result {
	if kind != "pitcher" {
		kind = "batter"
	}
	url := fmt.Sprintf(
		"https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=%s&player_id=%d&csv=true",
		kind, playerID,
	)
	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return Result{OK: false}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Result{OK: false}
	}
	var sb strings.Builder
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		sb.Write(buf[:n])
		if err != nil {
			break
		}
	}
	return ParseCSV(sb.String(), season)
}
