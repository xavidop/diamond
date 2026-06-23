package mlb

import "sort"

// RecentMeta accounts for a recent-plays fetch.
type RecentMeta struct {
	GamesRequested int
	GamesFetched   int
	Failures       int
}

// ArsenalPitch is a per-pitch-type rollup for a pitcher.
type ArsenalPitch struct {
	Type     string
	Count    int
	UsagePct float64
	AvgVelo  float64
	AvgSpin  float64
	WhiffPct float64
}

// FilterBatterPlays keeps plays where the batter is batterID.
func FilterBatterPlays(plays []PlayEvent, batterID int) []PlayEvent {
	var out []PlayEvent
	for _, p := range plays {
		if p.Matchup.Batter.ID == batterID {
			out = append(out, p)
		}
	}
	return out
}

// FilterPitcherPlays keeps plays where the pitcher is pitcherID.
func FilterPitcherPlays(plays []PlayEvent, pitcherID int) []PlayEvent {
	var out []PlayEvent
	for _, p := range plays {
		if p.Matchup.Pitcher.ID == pitcherID {
			out = append(out, p)
		}
	}
	return out
}

// swing/whiff classification by MLB playEvent details.code.
var whiffCodes = map[string]bool{"S": true, "W": true} // swinging strike (incl. blocked)
var swingCodes = map[string]bool{"S": true, "W": true, "F": true, "T": true, "X": true, "D": true, "E": true, "L": true}

// AggregateArsenal rolls a pitcher's pitches up by type: usage %, mean velo,
// mean spin, and whiff % (whiffs / swings). Sorted by count desc.
func AggregateArsenal(plays []PlayEvent, pitcherID int) []ArsenalPitch {
	type acc struct {
		count, swings, whiffs int
		veloSum, spinSum      float64
		veloN, spinN          int
	}
	m := map[string]*acc{}
	var order []string
	total := 0
	for _, p := range plays {
		if pitcherID != 0 && p.Matchup.Pitcher.ID != pitcherID {
			continue
		}
		for k := range p.PlayEvents {
			ev := p.PlayEvents[k]
			if !ev.IsPitch || ev.PitchData == nil {
				continue
			}
			typ := ev.Details.Type.Description
			if typ == "" {
				typ = "Unknown"
			}
			a := m[typ]
			if a == nil {
				a = &acc{}
				m[typ] = a
				order = append(order, typ)
			}
			a.count++
			total++
			if ev.PitchData.StartSpeed > 0 {
				a.veloSum += ev.PitchData.StartSpeed
				a.veloN++
			}
			if ev.PitchData.Breaks.SpinRate > 0 {
				a.spinSum += ev.PitchData.Breaks.SpinRate
				a.spinN++
			}
			if swingCodes[ev.Details.Code] {
				a.swings++
			}
			if whiffCodes[ev.Details.Code] {
				a.whiffs++
			}
		}
	}
	var out []ArsenalPitch
	for _, typ := range order {
		a := m[typ]
		ap := ArsenalPitch{Type: typ, Count: a.count}
		if total > 0 {
			ap.UsagePct = float64(a.count) / float64(total)
		}
		if a.veloN > 0 {
			ap.AvgVelo = a.veloSum / float64(a.veloN)
		}
		if a.spinN > 0 {
			ap.AvgSpin = a.spinSum / float64(a.spinN)
		}
		if a.swings > 0 {
			ap.WhiffPct = float64(a.whiffs) / float64(a.swings)
		}
		out = append(out, ap)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	return out
}

// recentGamePks returns the most recent n gamePks from a chronological game
// log (newest last), skipping zero ids.
func recentGamePks(log []StatSplit, n int) []int {
	var pks []int
	for _, sp := range log {
		if sp.Game.GamePk > 0 {
			pks = append(pks, sp.Game.GamePk)
		}
	}
	if len(pks) > n {
		pks = pks[len(pks)-n:]
	}
	return pks
}
