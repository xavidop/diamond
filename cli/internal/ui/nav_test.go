package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// minimal App for navigation unit tests (no network).
func navTestApp() App {
	a := App{view: ViewLeaders, focus: focusContent, width: 100, height: 40}
	return a
}

func TestNavigateDrillPushesAndPops(t *testing.T) {
	a := navTestApp()

	// Drill into a game (ViewGame + GamePk>0) pushes the source view.
	a, _ = a.navigate(NavigateMsg{View: ViewGame, GamePk: 12345})
	if a.view != ViewGame {
		t.Fatalf("after drill, view = %v, want ViewGame", a.view)
	}
	if len(a.navStack) != 1 || a.navStack[0] != ViewLeaders {
		t.Fatalf("navStack = %v, want [ViewLeaders]", a.navStack)
	}

	// Esc (ViewMenu) with a non-empty stack pops back to the source.
	a, _ = a.navigate(NavigateMsg{View: ViewMenu})
	if a.view != ViewLeaders {
		t.Fatalf("after back, view = %v, want ViewLeaders", a.view)
	}
	if a.focus != focusContent {
		t.Fatalf("after back, focus should be content")
	}
	if len(a.navStack) != 0 {
		t.Fatalf("navStack should be empty after pop, got %v", a.navStack)
	}
}

func TestNavigateBackAtRootDoesNotChangeView(t *testing.T) {
	a := navTestApp() // empty navStack
	a, _ = a.navigate(NavigateMsg{View: ViewMenu})
	// At root, ViewMenu focuses the sidebar; the content view is unchanged.
	if a.view != ViewLeaders {
		t.Fatalf("root back changed view to %v, want ViewLeaders", a.view)
	}
}

func TestNonDrillNavigationDoesNotPush(t *testing.T) {
	a := navTestApp()
	// A bare ViewPlayer (no PlayerID, e.g. sidebar "Players") is not a drill.
	a, _ = a.navigate(NavigateMsg{View: ViewPlayer})
	if len(a.navStack) != 0 {
		t.Fatalf("non-drill navigation pushed: %v", a.navStack)
	}
}

func TestGameEscPopsBackStack(t *testing.T) {
	// Game detail's Esc must emit ViewMenu so navigate pops the stack — not ViewScores.
	g := NewGameModel(123, mlb.Sport{ID: 1})
	_, cmd := g.Update(tea.KeyMsg{Type: tea.KeyEsc})
	if cmd == nil {
		t.Fatalf("game Esc produced no command")
	}
	nav, ok := cmd().(NavigateMsg)
	if !ok || nav.View != ViewMenu {
		t.Fatalf("game Esc should emit NavigateMsg{ViewMenu}, got %#v", cmd())
	}
	// Drilled from Postseason, Esc returns there and empties the stack.
	a := App{view: ViewGame, focus: focusContent, navStack: []ViewID{ViewPostseason}, width: 100, height: 40}
	a, _ = a.navigate(nav)
	if a.view != ViewPostseason || len(a.navStack) != 0 {
		t.Fatalf("after game Esc: view=%v stack=%v, want ViewPostseason / empty", a.view, a.navStack)
	}
}

func TestSidebarSelectClearsStack(t *testing.T) {
	a := navTestApp()
	a, _ = a.navigate(NavigateMsg{View: ViewGame, GamePk: 1}) // navStack=[ViewLeaders]
	a.focus = focusSidebar
	a.sidebar.cursor = navIndexFor(ViewStandings)
	m, _ := a.Update(tea.KeyMsg{Type: tea.KeyEnter})
	a = m.(App)
	if len(a.navStack) != 0 {
		t.Fatalf("sidebar select should clear navStack, got %v", a.navStack)
	}
	if a.view != ViewStandings {
		t.Fatalf("view = %v, want ViewStandings", a.view)
	}
}
