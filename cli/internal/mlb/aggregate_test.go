package mlb

import "testing"

// pitch builds a pitch playEvent with type/code/velo/spin.
func pitch(typ, code string, velo, spin float64) PlayEventDetail {
	var e PlayEventDetail
	e.IsPitch = true
	e.Details.Type.Description = typ
	e.Details.Code = code
	e.PitchData = &PitchData{StartSpeed: velo}
	e.PitchData.Breaks.SpinRate = spin
	return e
}

func playBy(batterID, pitcherID int, events ...PlayEventDetail) PlayEvent {
	var p PlayEvent
	p.Matchup.Batter.ID = batterID
	p.Matchup.Pitcher.ID = pitcherID
	p.PlayEvents = events
	return p
}

func TestFilterByRole(t *testing.T) {
	plays := []PlayEvent{
		playBy(100, 200), playBy(101, 200), playBy(100, 201),
	}
	if got := FilterBatterPlays(plays, 100); len(got) != 2 {
		t.Fatalf("FilterBatterPlays(100) = %d plays, want 2", len(got))
	}
	if got := FilterPitcherPlays(plays, 200); len(got) != 2 {
		t.Fatalf("FilterPitcherPlays(200) = %d plays, want 2", len(got))
	}
}

func TestAggregateArsenal(t *testing.T) {
	// pitcher 200 throws 3 four-seamers (1 whiff) + 1 slider.
	plays := []PlayEvent{
		playBy(100, 200, pitch("Four-Seam Fastball", "S", 96, 2300),
			pitch("Four-Seam Fastball", "C", 95, 2250),
			pitch("Slider", "X", 86, 2500)),
		playBy(101, 200, pitch("Four-Seam Fastball", "B", 97, 2350)),
	}
	ars := AggregateArsenal(plays, 200)
	if len(ars) != 2 {
		t.Fatalf("expected 2 pitch types, got %d", len(ars))
	}
	// sorted by count desc → Four-Seam first (3), Slider (1)
	ff := ars[0]
	if ff.Type != "Four-Seam Fastball" || ff.Count != 3 {
		t.Fatalf("top pitch = %+v, want Four-Seam x3", ff)
	}
	if ff.AvgVelo < 95.9 || ff.AvgVelo > 96.1 { // (96+95+97)/3 = 96
		t.Fatalf("avg velo = %.2f, want ~96", ff.AvgVelo)
	}
	// usage 3/4 = 0.75
	if ff.UsagePct < 0.74 || ff.UsagePct > 0.76 {
		t.Fatalf("usage = %.2f, want ~0.75", ff.UsagePct)
	}
	// whiff pct: 1 whiff (S) / 1 swing (S, X are swings; C, B are not)
	if ff.WhiffPct < 0.99 || ff.WhiffPct > 1.01 {
		t.Fatalf("Four-Seam WhiffPct = %.4f, want ~1.0", ff.WhiffPct)
	}
	// avg spin: (2300+2250+2350)/3 = 2300
	if ff.AvgSpin < 2299 || ff.AvgSpin > 2301 {
		t.Fatalf("Four-Seam AvgSpin = %.1f, want ~2300", ff.AvgSpin)
	}
	// Slider: no whiffs (X is swing but not whiff) / 1 swing
	sl := ars[1]
	if sl.WhiffPct < -0.01 || sl.WhiffPct > 0.01 {
		t.Fatalf("Slider WhiffPct = %.4f, want ~0.0", sl.WhiffPct)
	}
}

func TestRecentGamePks(t *testing.T) {
	var log []StatSplit
	for _, pk := range []int{1, 2, 3, 4, 5} {
		var s StatSplit
		s.Game.GamePk = pk
		log = append(log, s)
	}
	// most recent N = the tail (gamelog is chronological, newest last)
	got := recentGamePks(log, 3)
	if len(got) != 3 || got[0] != 3 || got[2] != 5 {
		t.Fatalf("recentGamePks(3) = %v, want [3 4 5]", got)
	}
	// fewer games than N → all
	if got := recentGamePks(log, 10); len(got) != 5 {
		t.Fatalf("recentGamePks(10) = %d, want 5", len(got))
	}
}
