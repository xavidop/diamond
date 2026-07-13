package savant

import "testing"

const sampleCSV = "\ufeff\"player_name\",\"player_id\",\"year\",\"xwoba\",\"xba\",\"brl_percent\",\"sprint_speed\"\n" +
	"\"Judge, Aaron\",\"592450\",\"2023\",\"98\",\"81\",\"97\",\"74\"\n" +
	"\"Judge, Aaron\",\"592450\",\"2024\",\"100\",\"89\",\"100\",\"75\"\n"

func TestParseCSV(t *testing.T) {
	r := ParseCSV(sampleCSV, 2024)
	if !r.OK {
		t.Fatal("expected OK")
	}
	if r.Season != 2024 {
		t.Fatalf("season = %d", r.Season)
	}
	var xwoba *Percentile
	for i := range r.Percentiles {
		if r.Percentiles[i].Key == "xwoba" {
			xwoba = &r.Percentiles[i]
		}
	}
	if xwoba == nil || xwoba.Value != 100 || xwoba.Label != "xwOBA" {
		t.Fatalf("xwoba = %+v", xwoba)
	}
}

func TestParseCSVFallbackAndGarbage(t *testing.T) {
	if r := ParseCSV(sampleCSV, 1999); !r.OK || r.Season != 2024 {
		t.Fatalf("fallback failed: %+v", r)
	}
	if ParseCSV("nonsense", 2024).OK {
		t.Fatal("garbage should be !OK")
	}
	if ParseCSV("", 2024).OK {
		t.Fatal("empty should be !OK")
	}
}
