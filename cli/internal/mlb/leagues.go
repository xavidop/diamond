package mlb

import (
	"fmt"
	"strconv"
	"time"
)

// League is the Stats API's sub-level under a sport:
//
//	sportId (1 = MLB, 17 = Winter Leagues, …) → leagueId (103 = AL, 131 = LIDOM, …)
//
// For MLB the two leagues are halves of one competition, so the CLI never
// filters by them. For sport 17 "Winter Leagues" (and a few others) every
// league is its own competition — LIDOM, LVBP, LMP, LBPRC, AFL, ABL and the
// Caribbean Series all run at once — so the CLI lets you pick one and tags each
// game with its league. The `leagueId` query param is accepted by /schedule,
// /standings, /teams and /stats/leaders; schedule payloads hydrated with `team`
// carry `team.league.{id,name}`.
type League struct {
	ID           int    `json:"id"`
	SportID      int    `json:"-"`
	Name         string `json:"name"`
	NameShort    string `json:"nameShort"`
	Abbreviation string `json:"abbreviation"`
	// Active is nil when unknown (static snapshot) and false for defunct
	// leagues the API still lists, e.g. Hawaii Winter Baseball.
	Active *bool `json:"active,omitempty"`
}

// IsAll reports whether this value means "every league under the sport".
func (l League) IsAll() bool { return l.ID == 0 }

// MultiLeagueSports are the sports whose leagues are independent competitions
// worth filtering by: 17 = Winter Leagues, 23 = Independent, 51 = International.
var MultiLeagueSports = map[int]bool{17: true, 23: true, 51: true}

// HasSubleagues reports whether the sport's leagues are separate competitions
// (Winter Leagues yes, MLB no).
func (s Sport) HasSubleagues() bool { return MultiLeagueSports[s.ID] }

// leagueAbbrOverrides replaces the API's abbreviations for a few winter leagues
// with the ones fans use (DWL → LIDOM, VWL → LVBP, PWL → LBPRC).
var leagueAbbrOverrides = map[int]string{
	131: "LIDOM",
	135: "LVBP",
	133: "LBPRC",
}

// WinterLeagues is a snapshot of /api/v1/league?sportId=17 so the picker renders
// instantly and still works offline; Client.Leagues refreshes it from the API.
var WinterLeagues = []League{
	{ID: 131, SportID: 17, Abbreviation: "LIDOM", Name: "Liga de Béisbol Dominicano", NameShort: "Dominican"},
	{ID: 135, SportID: 17, Abbreviation: "LVBP", Name: "Liga Venezolana de Béisbol Profesional", NameShort: "Venezuela"},
	{ID: 132, SportID: 17, Abbreviation: "LMP", Name: "Liga Mexicana del Pacífico", NameShort: "Mexican Pacific"},
	{ID: 133, SportID: 17, Abbreviation: "LBPRC", Name: "Liga de Béisbol Profesional Roberto Clemente", NameShort: "Puerto Rico"},
	{ID: 119, SportID: 17, Abbreviation: "AFL", Name: "Arizona Fall League", NameShort: "Arizona Fall"},
	{ID: 595, SportID: 17, Abbreviation: "ABL", Name: "Australian Baseball League", NameShort: "Australia"},
	{ID: 162, SportID: 17, Abbreviation: "CS", Name: "Caribbean Series", NameShort: "Serie del Caribe"},
}

// StaticLeagues returns the leagues known offline for a sport (nil when we rely
// on the API alone).
func StaticLeagues(sportID int) []League {
	if sportID == 17 {
		out := make([]League, len(WinterLeagues))
		copy(out, WinterLeagues)
		return out
	}
	return nil
}

// normalizeLeague shapes a raw API league, applying the abbreviation overrides
// and filling gaps from the static snapshot.
func normalizeLeague(raw League, sportID int) League {
	l := League{ID: raw.ID, SportID: sportID, Name: raw.Name, NameShort: raw.NameShort, Abbreviation: raw.Abbreviation}
	var snap *League
	for i := range WinterLeagues {
		if sportID == 17 && WinterLeagues[i].ID == raw.ID {
			snap = &WinterLeagues[i]
			break
		}
	}
	if o, ok := leagueAbbrOverrides[l.ID]; ok {
		l.Abbreviation = o
	} else if l.Abbreviation == "" && snap != nil {
		l.Abbreviation = snap.Abbreviation
	}
	if l.Abbreviation == "" {
		l.Abbreviation = l.NameShort
	}
	if l.Abbreviation == "" {
		l.Abbreviation = strconv.Itoa(l.ID)
	}
	if snap != nil {
		l.Name = snap.Name // accented, fan-facing spelling
		if l.NameShort == "" {
			l.NameShort = snap.NameShort
		}
	}
	if l.Name == "" {
		l.Name = l.Abbreviation
	}
	return l
}

// MergeLeagues merges API leagues over the static snapshot: API order wins and
// the snapshot back-fills anything the API omitted (e.g. a league whose season
// has not started yet). Duplicate and zero ids are dropped.
func MergeLeagues(api []League, sportID int) []League {
	var out []League
	seen := map[int]bool{}
	for _, raw := range api {
		if raw.ID == 0 || seen[raw.ID] || (raw.Active != nil && !*raw.Active) {
			continue
		}
		seen[raw.ID] = true
		out = append(out, normalizeLeague(raw, sportID))
	}
	for _, l := range StaticLeagues(sportID) {
		if !seen[l.ID] {
			seen[l.ID] = true
			out = append(out, l)
		}
	}
	return out
}

// Leagues lists the leagues under a sport, API first with the static snapshot
// as fallback so Winter Leagues always resolve even offline.
func (c *Client) Leagues(sportID int) ([]League, error) {
	endpoint := fmt.Sprintf("%s/league?sportId=%d&season=%d", c.v1, sportID, time.Now().Year())
	var resp struct {
		Leagues []League `json:"leagues"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		if static := StaticLeagues(sportID); len(static) > 0 {
			return static, nil
		}
		return nil, err
	}
	return MergeLeagues(resp.Leagues, sportID), nil
}

// GameLeagueID returns the league a game belongs to (home team's league, else
// away's), or 0 when the schedule was not hydrated with team.
func GameLeagueID(g Game) int {
	if id := g.Teams.Home.Team.League.ID; id != 0 {
		return id
	}
	return g.Teams.Away.Team.League.ID
}

// FilterGamesByLeague keeps the games in the given league; leagueID 0 means all.
func FilterGamesByLeague(games []Game, leagueID int) []Game {
	if leagueID == 0 {
		return games
	}
	out := make([]Game, 0, len(games))
	for _, g := range games {
		if GameLeagueID(g) == leagueID {
			out = append(out, g)
		}
	}
	return out
}

// LeagueAbbr resolves a league id to its abbreviation from the list, then the
// overrides/snapshot, then the fallback (usually the API's league name).
func LeagueAbbr(leagues []League, leagueID int, fallback string) string {
	if leagueID == 0 {
		return ""
	}
	for _, l := range leagues {
		if l.ID == leagueID {
			return l.Abbreviation
		}
	}
	if o, ok := leagueAbbrOverrides[leagueID]; ok {
		return o
	}
	for _, l := range WinterLeagues {
		if l.ID == leagueID {
			return l.Abbreviation
		}
	}
	return fallback
}

// GameLeagueAbbr is LeagueAbbr for a game, falling back to the hydrated league name.
func GameLeagueAbbr(leagues []League, g Game) string {
	name := g.Teams.Home.Team.League.Name
	if name == "" {
		name = g.Teams.Away.Team.League.Name
	}
	return LeagueAbbr(leagues, GameLeagueID(g), name)
}
