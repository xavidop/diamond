package ui

import (
	"strings"
	"testing"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestPlayerTabsRoleAdaptive(t *testing.T) {
	hit := playerTabs(false)
	pit := playerTabs(true)
	has := func(tabs []string, name string) bool {
		for _, t2 := range tabs {
			if t2 == name {
				return true
			}
		}
		return false
	}
	if !has(hit, "Spray") || has(hit, "Arsenal") {
		t.Fatalf("hitter tabs should have Spray, not Arsenal: %v", hit)
	}
	if !has(pit, "Arsenal") || has(pit, "Spray") {
		t.Fatalf("pitcher tabs should have Arsenal, not Spray: %v", pit)
	}
	if !has(hit, "Zone") || !has(pit, "Zone") {
		t.Fatalf("both roles should have Zone")
	}
}

func TestRenderArsenalContent(t *testing.T) {
	pitches := []mlb.ArsenalPitch{
		{Type: "Four-Seam Fastball", Count: 30, UsagePct: 0.6, AvgVelo: 96.2, WhiffPct: 0.25},
		{Type: "Slider", Count: 20, UsagePct: 0.4, AvgVelo: 86.1, WhiffPct: 0.40},
	}
	out := ansiRe.ReplaceAllString(renderArsenal(pitches, 1.0), "")
	if !strings.Contains(out, "Four-Seam") || !strings.Contains(out, "Slider") {
		t.Fatalf("expected both pitch types:\n%s", out)
	}
	if !strings.Contains(out, "96") { // velocity rendered
		t.Fatalf("expected velocity rendered:\n%s", out)
	}
}
