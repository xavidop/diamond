package ui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/espn"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

type newsLoadedMsg struct{ news []espn.Article }

type NewsModel struct {
	sport   mlb.Sport
	news    []espn.Article
	cursor  int
	loading bool
	err     error
	width   int
}

func NewNewsModel(sport mlb.Sport) NewsModel {
	return NewsModel{sport: sport, loading: true}
}

func (m NewsModel) Init() tea.Cmd { return m.fetch() }

func (m NewsModel) fetch() tea.Cmd {
	mlbOnly := m.sport.ID == 1
	return func() tea.Msg {
		if !mlbOnly {
			return newsLoadedMsg{news: nil}
		}
		arts, err := espn.DefaultClient().News("", 40)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return newsLoadedMsg{news: arts}
	}
}

func (m NewsModel) Update(msg tea.Msg) (NewsModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case newsLoadedMsg:
		m.loading, m.news, m.cursor = false, msg.news, 0
		return m, nil
	case ErrMsg:
		m.loading, m.err = false, msg.Err
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "down", "j":
			if m.cursor < len(m.news)-1 {
				m.cursor++
			}
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "enter":
			if m.cursor < len(m.news) {
				return m, openURL(m.news[m.cursor].WebURL)
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

func (m NewsModel) View() string {
	head := PanelHeader("NEWS", m.width) + "\n\n"
	help := HelpBar("↑/↓ select", "Enter open in browser", "r refresh", "esc back")

	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}
	if m.loading {
		return head + loadingView("Loading news…")
	}
	if m.sport.ID != 1 {
		return head + StyleDim.Render("  News is available for MLB only.") + "\n\n" + help
	}
	if len(m.news) == 0 {
		return head + StyleDim.Render("  No news right now.") + "\n\n" + help
	}

	// Window around the cursor so long feeds stay navigable.
	const maxRows = 24
	start := m.cursor - maxRows/2
	if start < 0 {
		start = 0
	}
	end := start + maxRows
	if end > len(m.news) {
		end = len(m.news)
		start = end - maxRows
		if start < 0 {
			start = 0
		}
	}

	var b strings.Builder
	for i := start; i < end; i++ {
		a := m.news[i]
		badge := lipgloss.NewStyle().Foreground(colorCyan).Render(formatTypeBadge(a.Type))
		when := ""
		if !a.Published.IsZero() {
			when = StyleDim.Render("  " + a.Published.Format("Jan 2"))
		}
		maxW := m.width - 18
		if maxW < 1 {
			maxW = 80
		}
		headline := truncate(a.Headline, maxW)
		if i == m.cursor {
			b.WriteString(StyleAccent.Bold(true).Render("▸ ") + badge + " " +
				StyleAccent.Bold(true).Render(headline) + when + "\n")
		} else {
			b.WriteString("  " + badge + " " + StyleItemNormal.Render(headline) + when + "\n")
		}
	}
	return head + strings.TrimRight(b.String(), "\n") + "\n\n" + help
}

func formatTypeBadge(t string) string {
	if t == "" {
		t = "Story"
	}
	if len(t) > 7 {
		t = t[:7]
	}
	return t + strings.Repeat(" ", 7-len(t))
}
