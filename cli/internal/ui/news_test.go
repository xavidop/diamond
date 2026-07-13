package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/espn"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestNewsModelScrolls(t *testing.T) {
	m := NewNewsModel(mlb.Sport{ID: 1, Abbreviation: "MLB"})
	m.news = []espn.Article{
		{Headline: "One", Type: "Story"},
		{Headline: "Two", Type: "Recap"},
	}
	m.loading = false
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyDown})
	if m.cursor != 1 {
		t.Fatalf("down should move cursor to 1, got %d", m.cursor)
	}
	if v := m.View(); v == "" {
		t.Fatal("view should render")
	}
}

func TestNewsSidebarEntryExists(t *testing.T) {
	found := false
	for _, n := range navItems {
		if n.view == ViewNews {
			found = true
		}
	}
	if !found {
		t.Fatal("expected a sidebar nav item for ViewNews")
	}
}

func TestFilterNews(t *testing.T) {
	arts := []espn.Article{
		{Headline: "Yankees rally late", Description: "recap", Type: "Recap"},
		{Headline: "Preview: Sox at Rays", Description: "matchup", Type: "Preview"},
		{Headline: "Trade deadline buzz", Description: "Yankees linked", Type: "Story"},
	}
	// type filter only
	if got := filterNews(arts, "", "Recap"); len(got) != 1 || got[0].Type != "Recap" {
		t.Fatalf("type filter: got %+v", got)
	}
	// query matches headline or description (case-insensitive)
	got := filterNews(arts, "yankees", "All")
	if len(got) != 2 {
		t.Fatalf("query should match 2, got %d", len(got))
	}
	// query + type
	if got := filterNews(arts, "yankees", "Story"); len(got) != 1 {
		t.Fatalf("query+type should match 1, got %d", len(got))
	}
}

func TestNewsTypeOptionsAndCycle(t *testing.T) {
	arts := []espn.Article{
		{Type: "Story"}, {Type: "Recap"}, {Type: "Preview"}, {Type: "Zebra"},
	}
	opts := newsTypeOptions(arts)
	// "All" first, known types in preferred order, extras appended
	if opts[0] != "All" || opts[1] != "Preview" || opts[2] != "Recap" || opts[3] != "Story" {
		t.Fatalf("bad ordering: %v", opts)
	}
	if opts[len(opts)-1] != "Zebra" {
		t.Fatalf("extra type should be last: %v", opts)
	}
	// cycling wraps in both directions
	if next := cycleType(opts, "All", +1); next != "Preview" {
		t.Fatalf("cycle +1 from All: %q", next)
	}
	if prev := cycleType(opts, "All", -1); prev != "Zebra" {
		t.Fatalf("cycle -1 from All should wrap to last: %q", prev)
	}
}

func TestNewsTabCyclesTypeFilter(t *testing.T) {
	m := NewNewsModel(mlb.Sport{ID: 1, Abbreviation: "MLB"})
	m.news = []espn.Article{{Type: "Preview"}, {Type: "Recap"}}
	m.loading = false
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
	if m.typeFilter != "Preview" {
		t.Fatalf("Tab should select first type, got %q", m.typeFilter)
	}
}
