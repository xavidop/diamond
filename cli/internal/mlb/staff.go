package mlb

import (
	"fmt"
	"strings"
)

// Coach is one member of a team's coaching staff.
type Coach struct {
	Job    string `json:"job"`
	Title  string `json:"title"`
	Jersey string `json:"jerseyNumber"`
	Person struct {
		FullName string `json:"fullName"`
	} `json:"person"`
}

// TeamCoaches returns a club's coaching staff for the season.
func (c *Client) TeamCoaches(teamID int, season string) ([]Coach, error) {
	url := fmt.Sprintf("%s/teams/%d/coaches?season=%s", c.v1, teamID, season)
	var resp struct {
		Roster []Coach `json:"roster"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	return resp.Roster, nil
}

// TeamLeaderEntry is one ranked player within a leader category.
type TeamLeaderEntry struct {
	Rank     int
	Value    string
	Name     string
	PersonID int
}

// TeamLeaderCat groups the top players for a single category (e.g. HR).
type TeamLeaderCat struct {
	Label   string
	Leaders []TeamLeaderEntry
}

type leaderCatDef struct{ Key, Label string }

var hittingLeaderCats = []leaderCatDef{
	{"homeRuns", "HR"}, {"battingAverage", "AVG"}, {"runsBattedIn", "RBI"},
	{"onBasePlusSlugging", "OPS"}, {"stolenBases", "SB"},
}
var pitchingLeaderCats = []leaderCatDef{
	{"earnedRunAverage", "ERA"}, {"wins", "W"}, {"strikeouts", "SO"},
	{"saves", "SV"}, {"walksAndHitsPerInningPitched", "WHIP"},
}

func leaderCatParam() string {
	var keys []string
	for _, c := range hittingLeaderCats {
		keys = append(keys, c.Key)
	}
	for _, c := range pitchingLeaderCats {
		keys = append(keys, c.Key)
	}
	return strings.Join(keys, ",")
}

// TeamLeaders returns per-category hitting + pitching leaders (filtered to the
// intended stat group so e.g. `strikeouts` maps to pitcher Ks, not batter Ks).
func (c *Client) TeamLeaders(teamID int, season string) (hitting, pitching []TeamLeaderCat, err error) {
	url := fmt.Sprintf("%s/teams/%d/leaders?leaderCategories=%s&season=%s&limit=3",
		c.v1, teamID, leaderCatParam(), season)
	var resp struct {
		TeamLeaders []struct {
			LeaderCategory string `json:"leaderCategory"`
			StatGroup      string `json:"statGroup"`
			Leaders        []struct {
				Rank   int    `json:"rank"`
				Value  string `json:"value"`
				Person struct {
					ID       int    `json:"id"`
					FullName string `json:"fullName"`
				} `json:"person"`
			} `json:"leaders"`
		} `json:"teamLeaders"`
	}
	if err = c.get(url, &resp); err != nil {
		return nil, nil, err
	}
	find := func(defs []leaderCatDef, group string) []TeamLeaderCat {
		var out []TeamLeaderCat
		for _, d := range defs {
			for _, g := range resp.TeamLeaders {
				if g.LeaderCategory != d.Key || g.StatGroup != group || len(g.Leaders) == 0 {
					continue
				}
				var entries []TeamLeaderEntry
				for _, l := range g.Leaders {
					entries = append(entries, TeamLeaderEntry{
						Rank: l.Rank, Value: l.Value, Name: l.Person.FullName, PersonID: l.Person.ID,
					})
				}
				out = append(out, TeamLeaderCat{Label: d.Label, Leaders: entries})
				break
			}
		}
		return out
	}
	return find(hittingLeaderCats, "hitting"), find(pitchingLeaderCats, "pitching"), nil
}
