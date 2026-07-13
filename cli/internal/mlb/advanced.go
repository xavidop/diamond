package mlb

import "fmt"

// Zone is one strike-zone cell in a hot/cold-zones metric.
type Zone struct {
	Zone  string `json:"zone"`
	Color string `json:"color"`
	Temp  string `json:"temp"`
	Value string `json:"value"`
}

// ZoneMetric is one hot/cold metric (e.g. battingAverage) over the 13 zones.
type ZoneMetric struct {
	Name  string
	Zones []Zone
}

// FieldingLine is one position's fielding stat line.
type FieldingLine struct {
	Pos  string
	G    int
	FPct string
	PO   int
	A    int
	E    int
	DP   int
}

// ZoneGrid splits the 13 zones into the 3×3 strike zone (codes 01–09, row-major)
// and the four out-of-zone quadrants (11–14). Codes may be zero-padded or not.
func ZoneGrid(zones []Zone) (inner [9]*Zone, outside [4]*Zone) {
	by := map[string]*Zone{}
	for i := range zones {
		code := zones[i].Zone
		if len(code) == 1 {
			code = "0" + code
		}
		by[code] = &zones[i]
	}
	for i, c := range []string{"01", "02", "03", "04", "05", "06", "07", "08", "09"} {
		inner[i] = by[c]
	}
	for i, c := range []string{"11", "12", "13", "14"} {
		outside[i] = by[c]
	}
	return
}

// PlayerSabermetrics fetches advanced value metrics (WAR/wRC+/FIP/…).
func (c *Client) PlayerSabermetrics(personID int, group, season string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/people/%d/stats?stats=sabermetrics&group=%s&season=%s", c.v1, personID, group, season)
	return c.singleStatMap(url)
}

// PlayerProjections fetches ZiPS rest-of-season projections.
func (c *Client) PlayerProjections(personID int, group string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/people/%d/stats?stats=projectedRos&group=%s", c.v1, personID, group)
	return c.singleStatMap(url)
}

func (c *Client) singleStatMap(url string) (map[string]interface{}, error) {
	var resp struct {
		Stats []struct {
			Splits []struct {
				Stat map[string]interface{} `json:"stat"`
			} `json:"splits"`
		} `json:"stats"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	if len(resp.Stats) == 0 || len(resp.Stats[0].Splits) == 0 {
		return nil, fmt.Errorf("no stat")
	}
	return resp.Stats[0].Splits[0].Stat, nil
}

// PlayerFielding fetches season fielding lines by position (DH / no-activity rows dropped).
func (c *Client) PlayerFielding(personID int, season string) ([]FieldingLine, error) {
	url := fmt.Sprintf("%s/people/%d/stats?stats=season&group=fielding&season=%s", c.v1, personID, season)
	var resp struct {
		Stats []struct {
			Splits []struct {
				Stat struct {
					Position struct {
						Abbreviation string `json:"abbreviation"`
					} `json:"position"`
					GamesPlayed int    `json:"gamesPlayed"`
					Fielding    string `json:"fielding"`
					PutOuts     int    `json:"putOuts"`
					Assists     int    `json:"assists"`
					Errors      int    `json:"errors"`
					DoublePlays int    `json:"doublePlays"`
				} `json:"stat"`
			} `json:"splits"`
		} `json:"stats"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	var out []FieldingLine
	if len(resp.Stats) == 0 {
		return out, nil
	}
	for _, s := range resp.Stats[0].Splits {
		st := s.Stat
		if st.Position.Abbreviation == "DH" {
			continue
		}
		if st.GamesPlayed == 0 && st.PutOuts == 0 && st.Assists == 0 {
			continue
		}
		out = append(out, FieldingLine{
			Pos: st.Position.Abbreviation, G: st.GamesPlayed, FPct: st.Fielding,
			PO: st.PutOuts, A: st.Assists, E: st.Errors, DP: st.DoublePlays,
		})
	}
	return out, nil
}

// PlayerHotColdZones fetches the hot/cold-zone metrics (each over the 13 zones).
func (c *Client) PlayerHotColdZones(personID int, group, season string) ([]ZoneMetric, error) {
	url := fmt.Sprintf("%s/people/%d/stats?stats=hotColdZones&group=%s&season=%s", c.v1, personID, group, season)
	var resp struct {
		Stats []struct {
			Splits []struct {
				Stat struct {
					Name  string `json:"name"`
					Zones []Zone `json:"zones"`
				} `json:"stat"`
			} `json:"splits"`
		} `json:"stats"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	var out []ZoneMetric
	if len(resp.Stats) == 0 {
		return out, nil
	}
	for _, s := range resp.Stats[0].Splits {
		if s.Stat.Name == "" || len(s.Stat.Zones) == 0 {
			continue
		}
		out = append(out, ZoneMetric{Name: s.Stat.Name, Zones: s.Stat.Zones})
	}
	return out, nil
}
