package ui

import (
	"strings"
	"testing"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func rp(name, pos string) mlb.RosterPlayer {
	var p mlb.RosterPlayer
	p.Person.FullName = name
	p.Position.Abbreviation = pos
	return p
}

func TestGroupByPosition(t *testing.T) {
	roster := []mlb.RosterPlayer{
		rp("Catcher One", "C"), rp("Short One", "SS"),
		rp("Ace", "P"), rp("Closer", "P"), rp("Center", "CF"),
	}
	g := groupByPosition(roster)
	if len(g["C"]) != 1 || g["C"][0].Person.FullName != "Catcher One" {
		t.Fatalf("C should hold the catcher, got %+v", g["C"])
	}
	if len(g["P"]) != 2 {
		t.Fatalf("P should hold both pitchers, got %d", len(g["P"]))
	}
	if len(g["SS"]) != 1 || len(g["CF"]) != 1 {
		t.Fatalf("SS/CF mis-grouped: %+v", g)
	}
}

func TestRenderDepthChartContent(t *testing.T) {
	roster := []mlb.RosterPlayer{rp("Buster Posey", "C"), rp("Brandon Crawford", "SS")}
	out := ansiRe.ReplaceAllString(RenderDepthChart(roster, 100, 1.0), "")
	if !strings.Contains(out, "Posey") || !strings.Contains(out, "Crawford") {
		t.Fatalf("expected players placed on the field:\n%s", out)
	}
	if !strings.Contains(out, "SS") {
		t.Fatalf("expected the SS position label:\n%s", out)
	}
}

func TestRenderDepthChartAllPitchersFlat(t *testing.T) {
	// When the roster reports every pitcher as plain "P" (no SP/RP split), they
	// must be listed flat under PITCHERS — not mislabeled "Starters" with the
	// overflow dropped to a row cap (the bug behind "this chart is bullshit").
	roster := []mlb.RosterPlayer{
		rp("Catcher One", "C"),
		rp("Ace Pitcher", "P"), rp("Two Pitcher", "P"), rp("Three Pitcher", "P"),
		rp("Four Pitcher", "P"), rp("Five Pitcher", "P"), rp("Six Pitcher", "P"),
		rp("Craig Kimbrel", "P"), rp("Booser Reliever", "P"),
	}
	out := ansiRe.ReplaceAllString(RenderDepthChart(roster, 100, 1.0), "")
	if strings.Contains(out, "Starters") || strings.Contains(out, "Relievers") {
		t.Fatalf("all-P roster must not show Starters/Relievers sub-labels:\n%s", out)
	}
	for _, name := range []string{"Ace Pitcher", "Craig Kimbrel", "Booser Reliever"} {
		if !strings.Contains(out, name) {
			t.Fatalf("expected every pitcher listed (no row cap); missing %q:\n%s", name, out)
		}
	}
}

func TestRenderDepthChartSplitPitchers(t *testing.T) {
	// When the roster distinguishes SP from RP, both rows appear with their
	// position labels.
	roster := []mlb.RosterPlayer{rp("Starter One", "SP"), rp("Reliever One", "RP")}
	out := ansiRe.ReplaceAllString(RenderDepthChart(roster, 100, 1.0), "")
	if !strings.Contains(out, "SP") || !strings.Contains(out, "RP") {
		t.Fatalf("SP/RP roster should show SP and RP rows:\n%s", out)
	}
	if !strings.Contains(out, "Starter One") || !strings.Contains(out, "Reliever One") {
		t.Fatalf("expected both pitchers listed:\n%s", out)
	}
}
