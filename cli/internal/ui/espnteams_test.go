package ui

import "testing"

func TestEspnTeamIDMap(t *testing.T) {
	if got, ok := espnTeamID(147); !ok || got != "10" { // Yankees
		t.Fatalf("147 -> want 10,true; got %q,%v", got, ok)
	}
	if got, ok := espnTeamID(137); !ok || got != "26" { // Giants
		t.Fatalf("137 -> want 26,true; got %q,%v", got, ok)
	}
	if _, ok := espnTeamID(99999); ok {
		t.Fatal("unknown team should be ok=false")
	}
}

func TestEspnTeamMapComplete(t *testing.T) {
	if n := len(loadEspnTeams()); n != 30 {
		t.Fatalf("want 30 mapped teams, got %d", n)
	}
}
