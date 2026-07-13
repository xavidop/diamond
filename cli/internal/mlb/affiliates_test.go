package mlb

import "testing"

func TestFilterAffiliates(t *testing.T) {
	mk := func(id, sportID int, name string) Team {
		var tm Team
		tm.ID = id
		tm.Name = name
		tm.Sport.ID = sportID
		return tm
	}
	in := []Team{
		mk(1, 1, "MLB Club"),
		mk(2, 16, "Rookie Club"),
		mk(3, 11, "AAA Club"),
		mk(4, 21, "Org Pseudo"),
		mk(5, 12, "AA Club"),
	}
	out := FilterAffiliates(in)
	var got []string
	for _, x := range out {
		got = append(got, x.Name)
	}
	want := []string{"AAA Club", "AA Club", "Rookie Club"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("order: got %v, want %v", got, want)
		}
	}
}
