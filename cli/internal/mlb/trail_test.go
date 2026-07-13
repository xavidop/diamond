package mlb

import "testing"

func TestSortTrailAndHasMinors(t *testing.T) {
	rows := []TrailRow{
		{Season: "2024", Level: "MLB", Order: 0},
		{Season: "2024", Level: "AAA", Order: 1},
		{Season: "2023", Level: "AA", Order: 2},
	}
	SortTrail(rows)
	var got []string
	for _, r := range rows {
		got = append(got, r.Season+"-"+r.Level)
	}
	want := []string{"2023-AA", "2024-AAA", "2024-MLB"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("SortTrail = %v, want %v", got, want)
		}
	}

	if !HasMinors(rows) {
		t.Fatal("expected HasMinors=true")
	}
	if HasMinors([]TrailRow{{Season: "2024", Level: "MLB", Order: 0}}) {
		t.Fatal("MLB-only should be HasMinors=false")
	}
}
