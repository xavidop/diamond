package ui

import "testing"

func TestPlayerTabsContainsOverviewSplitsYearsVs(t *testing.T) {
	for _, isP := range []bool{true, false} {
		tabs := playerTabs(isP)
		want := []string{"Overview", "Splits", "Years", "Vs"}
		for _, w := range want {
			found := false
			for _, t2 := range tabs {
				if t2 == w {
					found = true
				}
			}
			if !found {
				t.Fatalf("playerTabs(isPitcher=%v) missing %q: %v", isP, w, tabs)
			}
		}
	}
}
