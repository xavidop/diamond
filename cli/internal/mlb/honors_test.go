package mlb

import "testing"

func TestFilterAwards(t *testing.T) {
	awards := []Award{
		{Name: "SAL Mid-Season All-Star", Season: "2014"},
		{Name: "AL MVP", Season: "2022"},
		{Name: "AFL Player of the Week", Season: "2014"},
		{Name: "AL MVP", Season: "2024"},
	}
	out := FilterAwards(awards, 10)
	if len(out) != 3 { // MVP x2 + All-Star; weekly award filtered out
		t.Fatalf("got %d awards, want 3: %+v", len(out), out)
	}
	if out[0].Season != "2024" {
		t.Fatalf("most recent first expected, got %+v", out[0])
	}
	for _, a := range out {
		if a.Name == "AFL Player of the Week" {
			t.Fatal("weekly award should be filtered out")
		}
	}

	// Fallback: no major awards → return all (capped).
	only := FilterAwards([]Award{{Name: "Local Award", Season: "2020"}}, 10)
	if len(only) != 1 {
		t.Fatalf("fallback expected 1, got %d", len(only))
	}
}
