package ui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/fav"
)

type FavoritesModel struct {
	cursor int
	width  int
}

func NewFavoritesModel() FavoritesModel { return FavoritesModel{} }

func (m FavoritesModel) Init() tea.Cmd { return nil }

func (m FavoritesModel) total() int { return len(fav.Teams()) + len(fav.Players()) }

func (m FavoritesModel) Update(msg tea.Msg) (FavoritesModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case tea.KeyMsg:
		teams, players := fav.Teams(), fav.Players()
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < m.total()-1 {
				m.cursor++
			}
		case "enter":
			if m.cursor < len(teams) {
				name := teams[m.cursor].Name
				return m, func() tea.Msg { return NavigateMsg{View: ViewTeam, Query: name} }
			}
			pi := m.cursor - len(teams)
			if pi < len(players) {
				name := players[pi].Name
				return m, func() tea.Msg { return NavigateMsg{View: ViewPlayer, Query: name} }
			}
		case "d", "x", "delete", "backspace":
			if m.cursor < len(teams) {
				fav.ToggleTeam(teams[m.cursor].ID, teams[m.cursor].Name)
			} else if pi := m.cursor - len(teams); pi < len(players) {
				fav.TogglePlayer(players[pi].ID, players[pi].Name)
			}
			if m.cursor >= m.total() && m.cursor > 0 {
				m.cursor--
			}
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		}
	}
	return m, nil
}

func (m FavoritesModel) View() string {
	teams, players := fav.Teams(), fav.Players()
	ts, te := headerColors()

	var sb strings.Builder
	sb.WriteString(PanelHeader("FAVORITES", m.width) + "\n\n")

	if m.total() == 0 {
		sb.WriteString(StyleDim.Render("  No favorites yet.") + "\n")
		sb.WriteString(StyleDim.Render("  Press ") + StyleAccent.Render("f") +
			StyleDim.Render(" on a team or player page to star it.") + "\n")
		return sb.String() + "\n" + HelpBar("esc back")
	}

	row := func(idx int, label string) string {
		if idx == m.cursor {
			return "  " + StyleAccent.Bold(true).Render("▸ ★ "+label)
		}
		return "    " + StyleAccent.Render("★ ") + StyleItemNormal.Render(label)
	}

	if len(teams) > 0 {
		sb.WriteString("  " + gradientText("TEAMS", ts, te) + "\n")
		for i, t := range teams {
			sb.WriteString(row(i, t.Name) + "\n")
		}
		sb.WriteString("\n")
	}
	if len(players) > 0 {
		sb.WriteString("  " + gradientText("PLAYERS", ts, te) + "\n")
		for i, p := range players {
			sb.WriteString(row(len(teams)+i, p.Name) + "\n")
		}
	}

	sb.WriteString("\n" + StyleDim.Render(fmt.Sprintf("  %d favorite", m.total())))
	if m.total() != 1 {
		sb.WriteString(StyleDim.Render("s"))
	}
	return sb.String() + "\n\n" + HelpBar("↑/↓ navigate", "Enter open", "d remove", "esc back")
}
