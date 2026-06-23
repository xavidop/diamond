package ui

import (
	"math"
	"testing"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestParseIP(t *testing.T) {
	cases := map[string]float64{
		"6.0": 6, "6.1": 6 + 1.0/3, "6.2": 6 + 2.0/3, "7": 7, "": 0, "0.2": 2.0 / 3,
	}
	for in, want := range cases {
		if got := parseIP(in); math.Abs(got-want) > 1e-9 {
			t.Errorf("parseIP(%q) = %v, want %v", in, got, want)
		}
	}
}

func hitGame(hits, ab float64) mlb.StatSplit {
	return mlb.StatSplit{Stat: map[string]interface{}{"hits": hits, "atBats": ab}}
}
func pitchGame(er float64, ip string) mlb.StatSplit {
	return mlb.StatSplit{Stat: map[string]interface{}{"earnedRuns": er, "inningsPitched": ip}}
}

func TestRollingSeriesHitter(t *testing.T) {
	log := []mlb.StatSplit{hitGame(1, 4), hitGame(2, 4), hitGame(0, 3)}
	got := rollingSeries(log, false, 2)
	want := []float64{0.25, 3.0 / 8, 2.0 / 7}
	if len(got) != len(want) {
		t.Fatalf("len = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if math.Abs(got[i]-want[i]) > 1e-9 {
			t.Errorf("rolling[%d] = %v, want %v", i, got[i], want[i])
		}
	}
}

func TestRollingSeriesPitcher(t *testing.T) {
	log := []mlb.StatSplit{pitchGame(1, "6.0"), pitchGame(3, "6.0")}
	got := rollingSeries(log, true, 2)
	want := []float64{1.5, 3.0} // ERA = ER*9/IP
	for i := range want {
		if math.Abs(got[i]-want[i]) > 1e-9 {
			t.Errorf("rolling[%d] = %v, want %v", i, got[i], want[i])
		}
	}
}

func TestSparklineLengthAndOrder(t *testing.T) {
	s := sparkline([]float64{1, 2, 3, 4})
	r := []rune(s)
	if len(r) != 4 {
		t.Fatalf("sparkline len = %d, want 4", len(r))
	}
	// strictly increasing input → non-decreasing block heights
	for i := 1; i < len(r); i++ {
		if r[i] < r[i-1] {
			t.Errorf("sparkline not monotonic at %d: %q", i, s)
		}
	}
}

func TestPitchOutcome(t *testing.T) {
	cases := []struct {
		code  string
		label string
		ok    bool
	}{
		{"B", "Ball", true},
		{"C", "Strike", true},
		{"S", "Strike", true},
		{"X", "In play", true},
		{"H", "HBP", true},
		{"???", "", false},
		{"", "", false},
	}
	for _, c := range cases {
		_, label, ok := pitchOutcome(c.code)
		if ok != c.ok || label != c.label {
			t.Errorf("pitchOutcome(%q) = (%q,%v), want (%q,%v)", c.code, label, ok, c.label, c.ok)
		}
	}
}

func TestRenderLineChartGuards(t *testing.T) {
	if renderLineChart(nil, nil, func(float64) string { return "" }, colorGold, 1) != "" {
		t.Error("nil series should render empty")
	}
	if renderLineChart([]float64{1}, []string{"x"}, func(float64) string { return "" }, colorGold, 1) != "" {
		t.Error("single point should render empty")
	}
}

func TestRenderArsenalRadarGuards(t *testing.T) {
	if renderArsenalRadar([]mlb.ArsenalPitch{{UsagePct: 1}, {UsagePct: 0.5}}, 1) != "" {
		t.Error("<3 pitch types should render empty")
	}
}
