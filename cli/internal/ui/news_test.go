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
