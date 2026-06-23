package ui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

var txnTypes = []struct{ code, label string }{
	{"ALL", "All"}, {"TR", "Trade"}, {"SFA", "Signed FA"}, {"OPT", "Optioned"},
	{"CU", "Recalled"}, {"DES", "DFA"}, {"REL", "Released"}, {"SC", "Status"},
}

var txnWindows = []int{7, 14, 30, 60}

func txnTypeColor(code string) lipgloss.TerminalColor {
	switch code {
	case "TR":
		return colorGold
	case "SFA", "SGN":
		return colorGreen
	case "REL", "DES":
		return colorRed
	case "OPT", "CU":
		return colorCyan
	default:
		return colorMuted
	}
}

type transactionsLoadedMsg struct{ txns []mlb.Transaction }

type TransactionsModel struct {
	windowIdx int
	typeIdx   int
	txns      []mlb.Transaction
	scroll    int
	loading   bool
	err       error
	client    *mlb.Client
	width     int
}

func NewTransactionsModel() TransactionsModel {
	return TransactionsModel{windowIdx: 1, client: mlb.DefaultClient(), loading: true} // default 14 days
}

func (m TransactionsModel) Init() tea.Cmd { return m.fetch() }

func (m TransactionsModel) fetch() tea.Cmd {
	days := txnWindows[m.windowIdx]
	end := time.Now()
	start := end.AddDate(0, 0, -days)
	c := m.client
	ss, es := start.Format("2006-01-02"), end.Format("2006-01-02")
	return func() tea.Msg {
		ts, err := c.Transactions(ss, es)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return transactionsLoadedMsg{txns: ts}
	}
}

func (m TransactionsModel) Update(msg tea.Msg) (TransactionsModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case transactionsLoadedMsg:
		m.loading, m.txns, m.scroll = false, msg.txns, 0
		return m, nil
	case ErrMsg:
		m.loading, m.err = false, msg.Err
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			m.typeIdx = (m.typeIdx + 1) % len(txnTypes)
			m.scroll = 0
		case "shift+tab":
			m.typeIdx = (m.typeIdx - 1 + len(txnTypes)) % len(txnTypes)
			m.scroll = 0
		case "w":
			m.windowIdx = (m.windowIdx + 1) % len(txnWindows)
			m.loading, m.scroll = true, 0
			return m, m.fetch()
		case "down", "j":
			m.scroll++
		case "up", "k":
			if m.scroll > 0 {
				m.scroll--
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

func (m TransactionsModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}

	panelHdr := PanelHeader("TRANSACTIONS", m.width)
	sub := StyleDim.Render(fmt.Sprintf("  last %d days", txnWindows[m.windowIdx]))
	tabs := "  "
	for i, t := range txnTypes {
		if i == m.typeIdx {
			tabs += StyleActiveTab.Render(t.label)
		} else {
			tabs += StyleTab.Render(t.label)
		}
	}
	head := panelHdr + "\n" + sub + "\n" + tabs + "\n\n"
	help := HelpBar("Tab type", "w window", "j/k scroll", "r refresh", "esc back")

	if m.loading {
		return head + loadingView("Loading transactions…")
	}

	// Filter by type, then newest-first.
	filter := txnTypes[m.typeIdx].code
	var filtered []mlb.Transaction
	for _, t := range m.txns {
		if filter == "ALL" || t.TypeCode == filter {
			filtered = append(filtered, t)
		}
	}
	for i, j := 0, len(filtered)-1; i < j; i, j = i+1, j-1 {
		filtered[i], filtered[j] = filtered[j], filtered[i]
	}

	if len(filtered) == 0 {
		return head + StyleDim.Render("  No transactions in this window.") + "\n\n" + help
	}

	// Build display lines grouped by date.
	var lines []string
	lastDate := ""
	for _, t := range filtered {
		d := t.Date
		if len(d) >= 10 {
			d = d[:10]
		}
		if d != lastDate {
			if lastDate != "" {
				lines = append(lines, "")
			}
			lines = append(lines, "  "+StyleAccent.Bold(true).Render(prettyDate(d)))
			lastDate = d
		}
		pill := lipgloss.NewStyle().Foreground(txnTypeColor(t.TypeCode)).Render(fmt.Sprintf("%-4s", t.TypeCode))
		desc := t.Description
		if desc == "" {
			desc = t.Person.FullName
		}
		lines = append(lines, "  "+pill+" "+desc)
	}

	// Windowed scroll.
	maxLines := 30
	if m.width == 0 {
		maxLines = 30
	}
	start := m.scroll
	if start > len(lines)-1 {
		start = len(lines) - 1
	}
	if start < 0 {
		start = 0
	}
	visible := lines[start:]
	more := ""
	if len(visible) > maxLines {
		visible = visible[:maxLines]
		more = "\n  " + StyleDim.Render(fmt.Sprintf("↓ %d more — j to scroll", len(lines)-start-maxLines))
	}

	return head + strings.Join(visible, "\n") + more + "\n\n" + help
}

// prettyDate formats a YYYY-MM-DD string as "Mon Jan 2".
func prettyDate(d string) string {
	t, err := time.Parse("2006-01-02", d)
	if err != nil {
		return d
	}
	return t.Format("Mon Jan 2")
}
