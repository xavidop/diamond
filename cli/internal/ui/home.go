package ui

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

type homeLoadedMsg struct {
	games []mlb.Game
	hr    []mlb.Leader
	era   []mlb.Leader
}

type homeTickMsg struct{}
type homeGamesMsg struct{ games []mlb.Game }

// HomeModel is the default landing pane: today's games + quick leaders.
type HomeModel struct {
	games  []mlb.Game
	hr     []mlb.Leader
	era    []mlb.Leader
	loaded bool
	width  int
	client *mlb.Client
}

func NewHomeModel() HomeModel { return HomeModel{client: mlb.DefaultClient()} }

func (m HomeModel) Init() tea.Cmd { return tea.Batch(m.fetch(), homeTick()) }

// homeTick schedules the next background games refresh (keeps the games list
// and the always-visible sidebar live count current from any view).
func homeTick() tea.Cmd {
	return tea.Tick(30*time.Second, func(time.Time) tea.Msg { return homeTickMsg{} })
}

// fetchGames refreshes only the schedule, skipping the leaders (which change
// slowly), for the periodic background tick.
func (m HomeModel) fetchGames() tea.Cmd {
	c := m.client
	today := time.Now().Format("2006-01-02")
	return func() tea.Msg {
		// Bucket by the viewer's local day so tonight's US games (filed under
		// an adjacent US date) appear today and never on two days at once.
		games, _ := c.LocalDaySchedule(today, 1)
		return homeGamesMsg{games: games}
	}
}

// liveGames returns the number of currently-live games (for the sidebar footer).
func (m HomeModel) liveGames() int {
	n := 0
	for _, g := range m.games {
		if g.Status.AbstractGameState == "Live" {
			n++
		}
	}
	return n
}

func (m HomeModel) fetch() tea.Cmd {
	c := m.client
	today := time.Now().Format("2006-01-02")
	season := fmt.Sprintf("%d", time.Now().Year())
	return func() tea.Msg {
		var games []mlb.Game
		var hr, era []mlb.Leader
		var wg sync.WaitGroup
		wg.Add(3)
		go func() {
			defer wg.Done()
			// Bucket by the viewer's local day: a night game filed under an
			// adjacent US date still belongs to the day it's played locally, so
			// it shows today for any timezone and only on that one day.
			games, _ = c.LocalDaySchedule(today, 1)
		}()
		go func() { defer wg.Done(); hr, _ = c.Leaders("hitting", "homeRuns", 1, season) }()
		go func() { defer wg.Done(); era, _ = c.Leaders("pitching", "earnedRunAverage", 1, season) }()
		wg.Wait()
		return homeLoadedMsg{games: games, hr: hr, era: era}
	}
}

func (m HomeModel) Update(msg tea.Msg) (HomeModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case homeLoadedMsg:
		m.games, m.hr, m.era, m.loaded = msg.games, msg.hr, msg.era, true
		return m, nil
	case homeGamesMsg:
		m.games = msg.games
		return m, nil
	case homeTickMsg:
		return m, tea.Batch(m.fetchGames(), homeTick())
	case tea.KeyMsg:
		switch msg.String() {
		case "r":
			m.loaded = false
			return m, m.fetch()
		case "enter":
			return m, func() tea.Msg { return NavigateMsg{View: ViewScores} }
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		}
	}
	return m, nil
}

func (m HomeModel) View() string {
	ts, te := headerColors()
	hdr := PanelHeader("TODAY  "+time.Now().Format("Mon Jan 2"), m.width)
	if !m.loaded {
		return hdr + "\n\n" + loadingView("Loading today…")
	}

	var sb strings.Builder
	// DIAMOND banner when there's room; otherwise just the panel header.
	if m.width >= 60 {
		sb.WriteString("\n" + renderLogo(m.width) + "\n")
		sb.WriteString(centerBlock(StyleDim.Render("⚾  real-time MLB · "+time.Now().Format("Mon Jan 2")), m.width) + "\n\n")
	} else {
		sb.WriteString(hdr + "\n\n")
	}

	live := m.liveGames()
	count := StyleHeader.Render(fmt.Sprintf("%d games", len(m.games)))
	if live > 0 {
		count += "  " + pulseDot() + " " + StyleLiveBadge.Render(fmt.Sprintf("%d live", live))
	}
	sb.WriteString("  " + count + "\n\n")

	ordered := append([]mlb.Game{}, m.games...)
	sort.SliceStable(ordered, func(i, j int) bool { return statusRank(ordered[i]) < statusRank(ordered[j]) })

	if len(ordered) == 0 {
		sb.WriteString(StyleDim.Render("  No games scheduled today.") + "\n")
	} else {
		blocks := make([]string, 0, len(ordered))
		for _, g := range ordered {
			blocks = append(blocks, renderHomeGameBlock(g))
		}
		if m.width >= 80 && len(blocks) > 8 {
			half := (len(blocks) + 1) / 2
			left := lipgloss.NewStyle().Width(m.width/2 - 2).Render(strings.Join(blocks[:half], "\n"))
			sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, left, strings.Join(blocks[half:], "\n")) + "\n")
		} else {
			sb.WriteString(strings.Join(blocks, "\n") + "\n")
		}
	}

	sb.WriteString("\n")
	hrTop, eraTop := m.hr, m.era
	if len(hrTop) > 5 {
		hrTop = hrTop[:5]
	}
	if len(eraTop) > 5 {
		eraTop = eraTop[:5]
	}
	hrBlock := leaderBlock("HR LEADERS", hrTop, "HR", ts, te, -1)
	eraBlock := leaderBlock("ERA LEADERS", eraTop, "", ts, te, -1)
	sb.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, hrBlock, "    ", eraBlock))

	site := osc8("https://diamond.xavidop.me", StyleAccent.Underline(true).Render("diamond.xavidop.me"))
	author := osc8("https://github.com/xavidop", StyleAccent.Render("@xavidop"))
	credit := "  " + StyleDim.Render("↗ ") + site + StyleDim.Render("   ·   made by ") + author
	sb.WriteString("\n\n" + credit)

	return sb.String() + "\n\n" + HelpBar("Enter scores", "r refresh", "esc menu")
}

// renderHomeGameBlock renders one game entry for the home dashboard as a single
// compact line: each team shown as a colored "● ABBR" tag in its own colors,
// with the score (or start time) between them. Single-line blocks keep the
// two-column grid perfectly aligned.
func renderHomeGameBlock(g mlb.Game) string {
	awayID := g.Teams.Away.Team.ID
	homeID := g.Teams.Home.Team.ID
	away := teamTag(awayID, fmt.Sprintf("%-3s", teamAbbr(g.Teams.Away)))
	home := teamTag(homeID, fmt.Sprintf("%-3s", teamAbbr(g.Teams.Home)))

	switch g.Status.AbstractGameState {
	case "Live":
		score := StyleHeader.Render(fmt.Sprintf(" %2d-%-2d ", g.Teams.Away.Score, g.Teams.Home.Score))
		return "  " + away + score + home + "  " +
			pulseDot() + StyleLiveBadge.Render(g.Linescore.CurrentInningOrdinal) +
			"  " + StyleDim.Render(shortClock(g.GameDate))
	case "Final":
		score := StyleHeader.Render(fmt.Sprintf(" %2d-%-2d ", g.Teams.Away.Score, g.Teams.Home.Score))
		return "  " + away + score + home + "  " + StyleDim.Render("Final "+shortClock(g.GameDate))
	default:
		return "  " + away + StyleDim.Render("  @  ") + home + "  " + StyleDim.Render(shortClock(g.GameDate))
	}
}
