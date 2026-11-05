package ui

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// leaguesLoadedMsg carries the leagues fetched for the sport the user just
// picked in the league picker.
type leaguesLoadedMsg struct {
	sportID int
	leagues []mlb.League
}

// LeaguePickerModel is a two-level picker: first the sport (MLB, AAA, Winter
// Leagues…), then — for sports whose leagues are separate competitions, like
// the winter leagues — the league within it (All, LIDOM, LVBP, LMP…).
type LeaguePickerModel struct {
	sports  []mlb.Sport
	cursor  int
	current mlb.Sport
	league  mlb.League // current league filter (ID 0 = all)

	// Level 2 (league list) state.
	inLeagues bool
	pending   mlb.Sport // sport chosen at level 1, awaiting a league choice
	leagues   []mlb.League
	lcursor   int // 0 = "All leagues", i+1 = leagues[i]
	loading   bool
	client    *mlb.Client
}

func NewLeaguePickerModel(current mlb.Sport, league ...mlb.League) LeaguePickerModel {
	cursor := 0
	for i, s := range mlb.AllSports {
		if s.ID == current.ID {
			cursor = i
			break
		}
	}
	m := LeaguePickerModel{sports: mlb.AllSports, cursor: cursor, current: current, client: mlb.DefaultClient()}
	if len(league) > 0 {
		m.league = league[0]
	}
	return m
}

// enterLeagues switches to the league list for sport s, showing the offline
// snapshot immediately and refreshing it from the API.
func (m LeaguePickerModel) enterLeagues(s mlb.Sport) (LeaguePickerModel, tea.Cmd) {
	m.inLeagues, m.pending = true, s
	m.leagues = mlb.StaticLeagues(s.ID)
	m.lcursor = 0
	if s.ID == m.current.ID {
		m.lcursor = m.leagueCursorFor(m.league.ID)
	}
	m.loading = len(m.leagues) == 0
	c := m.client
	sportID := s.ID
	return m, func() tea.Msg {
		leagues, err := c.Leagues(sportID)
		if err != nil {
			leagues = mlb.StaticLeagues(sportID)
		}
		return leaguesLoadedMsg{sportID: sportID, leagues: leagues}
	}
}

func (m LeaguePickerModel) leagueCursorFor(leagueID int) int {
	for i, l := range m.leagues {
		if l.ID == leagueID {
			return i + 1
		}
	}
	return 0
}

func (m LeaguePickerModel) Update(msg tea.Msg) (LeaguePickerModel, tea.Cmd) {
	switch msg := msg.(type) {
	case leaguesLoadedMsg:
		if !m.inLeagues || msg.sportID != m.pending.ID {
			return m, nil
		}
		selected := 0
		if m.lcursor > 0 && m.lcursor-1 < len(m.leagues) {
			selected = m.leagues[m.lcursor-1].ID
		}
		m.leagues = msg.leagues
		m.loading = false
		m.lcursor = m.leagueCursorFor(selected)
		return m, nil

	case tea.KeyMsg:
		if m.inLeagues {
			return m.updateLeagues(msg)
		}
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.sports)-1 {
				m.cursor++
			}
		case "enter", "right", "l":
			chosen := m.sports[m.cursor]
			if chosen.HasSubleagues() {
				return m.enterLeagues(chosen)
			}
			return m, func() tea.Msg { return SportChangedMsg{Sport: chosen} }
		case "esc", "L":
			cur, lg := m.current, m.league
			return m, func() tea.Msg { return SportChangedMsg{Sport: cur, League: lg} }
		}
	}
	return m, nil
}

func (m LeaguePickerModel) updateLeagues(msg tea.KeyMsg) (LeaguePickerModel, tea.Cmd) {
	switch msg.String() {
	case "up", "k":
		if m.lcursor > 0 {
			m.lcursor--
		}
	case "down", "j":
		if m.lcursor < len(m.leagues) {
			m.lcursor++
		}
	case "enter":
		sport := m.pending
		var league mlb.League
		if m.lcursor > 0 && m.lcursor-1 < len(m.leagues) {
			league = m.leagues[m.lcursor-1]
		}
		return m, func() tea.Msg { return SportChangedMsg{Sport: sport, League: league} }
	case "esc", "left", "h", "backspace":
		m.inLeagues, m.loading = false, false
	case "L":
		cur, lg := m.current, m.league
		return m, func() tea.Msg { return SportChangedMsg{Sport: cur, League: lg} }
	}
	return m, nil
}

func (m LeaguePickerModel) View() string {
	if m.inLeagues {
		return m.viewLeagues()
	}
	box := StylePanel.Width(40)
	title := StyleTitle.Render("Select League") + "\n\n"
	list := ""
	for i, s := range m.sports {
		label := s.Name
		if s.HasSubleagues() {
			label += StyleDim.Render("  ›")
		}
		if i == m.cursor {
			list += StyleItemSelected.Render(label) + "\n"
		} else {
			list += "   " + StyleItemNormal.Render(label) + "\n"
		}
	}
	footer := "\n" + HelpBar("Enter select", "› sub-leagues", "Esc cancel")
	content := title + list + footer

	centered := lipgloss.Place(60, 30, lipgloss.Center, lipgloss.Center, box.Render(content))
	return centered
}

func (m LeaguePickerModel) viewLeagues() string {
	box := StylePanel.Width(56)
	title := StyleTitle.Render(m.pending.Name) + "\n" +
		StyleDim.Render("Pick a league, or all of them") + "\n\n"

	row := func(i int, abbr, name string) string {
		label := fmt.Sprintf("%-6s %s", abbr, name)
		if i == m.lcursor {
			return StyleItemSelected.Render(label) + "\n"
		}
		return "   " + StyleItemNormal.Render(label) + "\n"
	}
	list := row(0, "ALL", "Every league under "+m.pending.Abbreviation)
	for i, l := range m.leagues {
		name := l.Name
		if l.NameShort != "" && l.NameShort != l.Abbreviation {
			name += StyleDim.Render("  · " + l.NameShort)
		}
		list += row(i+1, l.Abbreviation, name)
	}
	if m.loading {
		list += "\n" + StyleDim.Render("   Loading leagues…") + "\n"
	}
	footer := "\n" + HelpBar("Enter select", "← back", "Esc cancel")
	content := title + list + footer
	return lipgloss.Place(76, 30, lipgloss.Center, lipgloss.Center, box.Render(content))
}
