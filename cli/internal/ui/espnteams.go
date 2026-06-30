package ui

import (
	_ "embed"
	"encoding/json"
	"strconv"
	"sync"
)

//go:embed espnteams.json
var espnTeamsJSON []byte

var (
	espnTeamsOnce sync.Once
	espnTeams     map[string]string
)

func loadEspnTeams() map[string]string {
	espnTeamsOnce.Do(func() {
		espnTeams = map[string]string{}
		_ = json.Unmarshal(espnTeamsJSON, &espnTeams)
	})
	return espnTeams
}

// espnTeamID maps an MLB team id to its ESPN team id (as a string), ok=false
// when the team has no mapping (e.g. non-MLB leagues).
func espnTeamID(mlbTeamID int) (string, bool) {
	id, ok := loadEspnTeams()[strconv.Itoa(mlbTeamID)]
	return id, ok
}
