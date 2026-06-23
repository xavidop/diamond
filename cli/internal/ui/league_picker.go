package ui

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

type LeaguePickerModel struct {
	sports  []mlb.Sport
	cursor  int
	current mlb.Sport
}

func NewLeaguePickerModel(current mlb.Sport) LeaguePickerModel {
	cursor := 0
	for i, s := range mlb.AllSports {
		if s.ID == current.ID {
			cursor = i
			break
		}
	}
	return LeaguePickerModel{sports: mlb.AllSports, cursor: cursor, current: current}
}

func (m LeaguePickerModel) Update(msg tea.Msg) (LeaguePickerModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.sports)-1 {
				m.cursor++
			}
		case "enter":
			chosen := m.sports[m.cursor]
			return m, func() tea.Msg { return SportChangedMsg{Sport: chosen} }
		case "esc", "L":
			return m, func() tea.Msg { return SportChangedMsg{Sport: m.current} }
		}
	}
	return m, nil
}

func (m LeaguePickerModel) View() string {
	box := StylePanel.Width(40)
	title := StyleTitle.Render("Select League") + "\n\n"
	list := ""
	for i, s := range m.sports {
		if i == m.cursor {
			list += StyleItemSelected.Render(s.Name) + "\n"
		} else {
			list += "   " + StyleItemNormal.Render(s.Name) + "\n"
		}
	}
	footer := "\n" + HelpBar("Enter select", "Esc cancel")
	content := title + list + footer

	centered := lipgloss.Place(60, 30, lipgloss.Center, lipgloss.Center, box.Render(content))
	return centered
}
