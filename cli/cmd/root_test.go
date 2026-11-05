package cmd

import (
	"strings"
	"testing"
)

func TestResolveSelection(t *testing.T) {
	s, l, err := resolveSelection("", "")
	if err != nil || s.ID != 1 || !l.IsAll() {
		t.Fatalf("defaults = %+v, %+v, %v; want MLB, all", s, l, err)
	}

	s, l, err = resolveSelection("win", "lidom")
	if err != nil || s.ID != 17 || l.ID != 131 {
		t.Fatalf("win/lidom = %+v, %+v, %v", s, l, err)
	}

	s, l, err = resolveSelection("WIN", "")
	if err != nil || s.ID != 17 || !l.IsAll() {
		t.Fatalf("WIN alone should mean every winter league, got %+v, %+v, %v", s, l, err)
	}

	if _, _, err = resolveSelection("mlb", "lidom"); err == nil || !strings.Contains(err.Error(), "multi-league") {
		t.Fatalf("--league on MLB should explain itself, got %v", err)
	}
	if _, _, err = resolveSelection("cricket", ""); err == nil || !strings.Contains(err.Error(), "unknown sport") {
		t.Fatalf("unknown sport should error, got %v", err)
	}
}
