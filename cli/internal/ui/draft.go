package ui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

type draftLoadedMsg struct{ rounds []mlb.DraftRound }

type DraftModel struct {
	year     int
	rounds   []mlb.DraftRound
	roundIdx int
	cursor   int // selected pick within the current round
	loading  bool
	err      error
	client   *mlb.Client
	width    int
}

func NewDraftModel() DraftModel {
	return DraftModel{year: time.Now().Year() - 1, client: mlb.DefaultClient(), loading: true}
}

func (m DraftModel) Init() tea.Cmd { return m.fetch() }

func (m DraftModel) fetch() tea.Cmd {
	year := fmt.Sprintf("%d", m.year)
	c := m.client
	return func() tea.Msg {
		rs, err := c.Draft(year)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return draftLoadedMsg{rounds: rs}
	}
}

func (m DraftModel) Update(msg tea.Msg) (DraftModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case draftLoadedMsg:
		m.loading, m.rounds, m.roundIdx, m.cursor = false, msg.rounds, 0, 0
		return m, nil
	case ErrMsg:
		m.loading, m.err = false, msg.Err
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "left", "h":
			if m.year > 1965 {
				m.year--
				m.cursor = 0
				m.loading = true
				return m, m.fetch()
			}
		case "right", "l":
			if m.year < time.Now().Year() {
				m.year++
				m.cursor = 0
				m.loading = true
				return m, m.fetch()
			}
		case "tab":
			if len(m.rounds) > 0 {
				m.roundIdx = (m.roundIdx + 1) % len(m.rounds)
				m.cursor = 0
			}
		case "shift+tab":
			if len(m.rounds) > 0 {
				m.roundIdx = (m.roundIdx - 1 + len(m.rounds)) % len(m.rounds)
				m.cursor = 0
			}
		case "down", "j":
			if len(m.rounds) > 0 {
				n := len(m.rounds[m.roundIdx].Picks)
				if n > 0 && m.cursor < n-1 {
					m.cursor++
				}
			}
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "enter":
			if len(m.rounds) > 0 {
				picks := m.rounds[m.roundIdx].Picks
				if m.cursor < len(picks) {
					if id := picks[m.cursor].Person.ID; id > 0 {
						return m, func() tea.Msg { return NavigateMsg{View: ViewPlayer, PlayerID: id} }
					}
				}
			}
		case "r":
			m.loading = true
			return m, m.fetch()
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		}
	}
	return m, nil
}

func (m DraftModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}
	head := PanelHeader(fmt.Sprintf("DRAFT  %d", m.year), m.width) + "\n\n"
	help := HelpBar("◄/► year", "Tab round", "↑/↓ select", "Enter player", "esc back")

	if m.loading {
		return head + loadingView(fmt.Sprintf("Loading %d draft…", m.year))
	}
	if len(m.rounds) == 0 {
		return head + StyleDim.Render("  No draft data for this year.") + "\n\n" + help
	}

	round := m.rounds[m.roundIdx]
	roundLine := fmt.Sprintf("  %s   %s",
		StyleAccent.Bold(true).Render("Round "+round.Round),
		StyleDim.Render(fmt.Sprintf("(%d of %d)", m.roundIdx+1, len(m.rounds))))

	hdr := StyleHeader.Render(fmt.Sprintf("  %-4s %-22s %-20s %-18s %-4s %s", "Pick", "Player", "Team", "School", "Pos", "B/T"))
	sep := StyleDim.Render("  " + strings.Repeat("─", 74))

	var rows []string
	for i, p := range round.Picks {
		bt := fmt.Sprintf("%s/%s", orDash(p.Person.BatSide.Code), orDash(p.Person.PitchHand.Code))
		line := fmt.Sprintf("%-4d %-22s %-20s %-18s %-4s %s",
			p.PickNumber,
			truncate(p.Person.FullName, 22),
			truncate(p.Team.Name, 20),
			truncate(p.School.Name, 18),
			orDash(p.Person.PrimaryPosition.Abbreviation),
			bt)
		if i == m.cursor {
			rows = append(rows, StyleItemSelected.Render("▸ "+line))
		} else {
			rows = append(rows, "  "+line)
		}
	}

	maxRows := 26
	start := m.cursor - maxRows/2
	if start < 0 {
		start = 0
	}
	if start > len(rows)-maxRows {
		start = len(rows) - maxRows
	}
	if start < 0 {
		start = 0
	}
	end := start + maxRows
	if end > len(rows) {
		end = len(rows)
	}
	visible := rows[start:end]
	more := ""
	if end < len(rows) {
		more = "\n  " + StyleDim.Render(fmt.Sprintf("↓ %d more", len(rows)-end))
	}

	return head + roundLine + "\n\n" + hdr + "\n" + sep + "\n" + strings.Join(visible, "\n") + more + "\n\n" + help
}

func orDash(s string) string {
	if s == "" {
		return "—"
	}
	return s
}
