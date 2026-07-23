package ui

import (
	"fmt"
	"sort"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/cache"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// formatGameTime returns the game start time in ET, appending local time when
// the user's timezone differs from Eastern. When the local time lands on a
// different calendar day than the Eastern game day, the local weekday is
// appended (e.g. a 6:40 PM ET game reads "6:40 PM ET · 12:40 AM GMT+2 · Fri") —
// a weekday avoids a "+1" colliding with a numeric GMT offset.
func formatGameTime(gameDate string) string {
	t, err := time.Parse(time.RFC3339, gameDate)
	if err != nil {
		return ""
	}
	et, _ := time.LoadLocation("America/New_York")
	etStr := t.In(et).Format("3:04 PM") + " ET"
	etZone, _ := t.In(et).Zone()
	localZone, _ := t.In(time.Local).Zone()
	if etZone == localZone {
		return etStr
	}
	local := t.In(time.Local).Format("3:04 PM MST")
	if t.In(et).Format("2006-01-02") != t.In(time.Local).Format("2006-01-02") {
		local += " · " + t.In(time.Local).Format("Mon")
	}
	return etStr + " · " + local
}

// centerIn centers a (possibly ANSI-styled) string within visual width w.
func centerIn(s string, w int) string {
	sw := lipgloss.Width(s)
	pad := (w - sw) / 2
	if pad < 0 {
		pad = 0
	}
	return strings.Repeat(" ", pad) + s
}

// teamAbbr returns the 2-3 char team abbreviation, falling back to initials.
func teamAbbr(ti mlb.TeamGameInfo) string {
	if ti.Team.Abbreviation != "" {
		return ti.Team.Abbreviation
	}
	words := strings.Fields(ti.Team.Name)
	var b strings.Builder
	for _, w := range words {
		if len(w) > 0 {
			b.WriteByte(w[0])
		}
	}
	s := strings.ToUpper(b.String())
	if len(s) > 3 {
		s = s[:3]
	}
	return s
}

// renderLinescore builds the inning-by-inning R/H/E table.
func renderLinescore(g mlb.Game) string {
	innings := g.Linescore.Innings
	if len(innings) == 0 {
		return ""
	}

	awayAbbr := teamAbbr(g.Teams.Away)
	homeAbbr := teamAbbr(g.Teams.Home)

	// Compute totals from innings
	var awayR, awayH, awayE, homeR, homeH, homeE int
	for _, inn := range innings {
		if inn.Away.Runs != nil {
			awayR += *inn.Away.Runs
		}
		if inn.Away.Hits != nil {
			awayH += *inn.Away.Hits
		}
		if inn.Away.Errors != nil {
			awayE += *inn.Away.Errors
		}
		if inn.Home.Runs != nil {
			homeR += *inn.Home.Runs
		}
		if inn.Home.Hits != nil {
			homeH += *inn.Home.Hits
		}
		if inn.Home.Errors != nil {
			homeE += *inn.Home.Errors
		}
	}

	// Header
	hdr := StyleDim.Render(fmt.Sprintf("%-3s", ""))
	for _, inn := range innings {
		hdr += StyleDim.Render(fmt.Sprintf(" %2d", inn.Num))
	}
	hdr += StyleDim.Render("   R  H  E")

	sep := StyleDim.Render(strings.Repeat("─", 4+len(innings)*3+10))

	// Away row — bold the total if winning
	awayRow := fmt.Sprintf("%-3s", awayAbbr)
	for _, inn := range innings {
		if inn.Away.Runs != nil {
			awayRow += fmt.Sprintf(" %2d", *inn.Away.Runs)
		} else {
			awayRow += "  ─"
		}
	}
	awayTotals := fmt.Sprintf("  %2d %2d %2d", awayR, awayH, awayE)
	if awayR > homeR {
		awayRow = StyleAccent.Bold(true).Render(awayRow) + StyleAccent.Bold(true).Render(awayTotals)
	} else {
		awayRow = awayRow + StyleDim.Render(awayTotals)
	}

	// Home row
	homeRow := fmt.Sprintf("%-3s", homeAbbr)
	for _, inn := range innings {
		if inn.Home.Runs != nil {
			homeRow += fmt.Sprintf(" %2d", *inn.Home.Runs)
		} else {
			homeRow += "  ─"
		}
	}
	homeTotals := fmt.Sprintf("  %2d %2d %2d", homeR, homeH, homeE)
	if homeR > awayR {
		homeRow = StyleAccent.Bold(true).Render(homeRow) + StyleAccent.Bold(true).Render(homeTotals)
	} else {
		homeRow = homeRow + StyleDim.Render(homeTotals)
	}

	return "  " + hdr + "\n  " + sep + "\n  " + awayRow + "\n  " + homeRow + "\n"
}

// ─────────────────────────────────────────────────────────────────────────────

type scoresLoadedMsg struct{ games []mlb.Game }

type scoresTick struct{}

type ScoresModel struct {
	sport      mlb.Sport
	date       time.Time
	games      []mlb.Game
	cursor     int
	scroll     int
	loading    bool
	err        error
	client     *mlb.Client
	cache      *cache.Cache
	notifySubs map[int]bool // GamePks with notifications enabled (shared with App)
	width      int
	height     int
}

func NewScoresModel(sport mlb.Sport) ScoresModel {
	return ScoresModel{
		sport:   sport,
		date:    time.Now(),
		client:  mlb.DefaultClient(),
		cache:   cache.New(),
		loading: true,
	}
}

func (m ScoresModel) Init() tea.Cmd { return m.fetchScores() }

// visibleCount returns how many game cards fit in the left panel.
func (m ScoresModel) visibleCount() int {
	// Each card = 3 lines (name, status, blank). Reserve lines for the app
	// header, panel border, date strip, game count, scroll hints and help bar.
	h := m.height - 14
	if h < 3 {
		h = 3
	}
	n := h / 3
	if n < 1 {
		n = 1
	}
	if m.height == 0 {
		n = 8 // sensible default before the first size message arrives
	}
	return n
}

func (m ScoresModel) fetchScores() tea.Cmd {
	sport := m.sport
	date := m.date.Format("2006-01-02")
	c := m.client
	ch := m.cache
	return func() tea.Msg {
		key := fmt.Sprintf("scores:%d:%s", sport.ID, date)
		if v, ok := ch.Get(key); ok {
			return scoresLoadedMsg{games: v.([]mlb.Game)}
		}
		// Games that fall on the selected local calendar day. A night game
		// filed under an adjacent US date is bucketed onto the day it's played
		// locally, so it appears on exactly one day (never two adjacent ones).
		games, err := c.LocalDaySchedule(date, sport.ID)
		if err != nil {
			return ErrMsg{Err: err}
		}
		// Live first, then upcoming, then final — each ordered by start time.
		sort.SliceStable(games, func(i, j int) bool {
			if ri, rj := statusRank(games[i]), statusRank(games[j]); ri != rj {
				return ri < rj
			}
			return games[i].GameDate < games[j].GameDate
		})
		ch.Set(key, games, 30*time.Second)
		return scoresLoadedMsg{games: games}
	}
}

func (m ScoresModel) Update(msg tea.Msg) (ScoresModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil

	case scoresLoadedMsg:
		m.loading = false
		m.err = nil
		m.games = msg.games
		if m.cursor >= len(m.games) {
			m.cursor = 0
		}
		return m, tea.Tick(30*time.Second, func(time.Time) tea.Msg { return scoresTick{} })

	case scoresTick:
		m.cache = cache.New()
		m.loading = true
		return m, m.fetchScores()

	case ErrMsg:
		m.loading = false
		m.err = msg.Err
		return m, nil

	case tea.KeyMsg:
		vis := m.visibleCount()
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
				if m.cursor < m.scroll {
					m.scroll = m.cursor
				}
			}
		case "down", "j":
			if m.cursor < len(m.games)-1 {
				m.cursor++
				if m.cursor >= m.scroll+vis {
					m.scroll = m.cursor - vis + 1
				}
			}
		case "enter":
			if len(m.games) > 0 {
				gk := m.games[m.cursor].GamePk
				return m, func() tea.Msg { return NavigateMsg{View: ViewGame, GamePk: gk} }
			}
		case "right", "l", "d":
			m.date = m.date.AddDate(0, 0, 1)
			m.loading, m.cursor, m.scroll = true, 0, 0
			return m, m.fetchScores()
		case "left", "h", "D":
			m.date = m.date.AddDate(0, 0, -1)
			m.loading, m.cursor, m.scroll = true, 0, 0
			return m, m.fetchScores()
		case "t":
			m.date = time.Now()
			m.loading, m.cursor, m.scroll = true, 0, 0
			return m, m.fetchScores()
		case "r":
			m.cache = cache.New()
			m.loading = true
			return m, m.fetchScores()
		case "n":
			if len(m.games) > 0 {
				gk := m.games[m.cursor].GamePk
				return m, func() tea.Msg { return ToggleNotifyMsg{GamePk: gk} }
			}
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		}
	}
	return m, nil
}

// ── left panel: game list ─────────────────────────────────────────────────────

func (m ScoresModel) renderGameList() string {
	// Date navigation strip
	prev := StyleDim.Render("‹ " + m.date.AddDate(0, 0, -1).Format("Jan 2"))
	curr := StyleAccent.Bold(true).Render(m.date.Format("Mon Jan 2"))
	next := StyleDim.Render(m.date.AddDate(0, 0, 1).Format("Jan 2") + " ›")
	dateStrip := "  " + prev + "   " + curr + "   " + next + "\n\n"

	if m.loading {
		return dateStrip + loadingView("Loading scores…")
	}
	if len(m.games) == 0 {
		return dateStrip + StyleDim.Render("  No games scheduled.")
	}

	live := 0
	for _, g := range m.games {
		if g.Status.AbstractGameState == "Live" {
			live++
		}
	}
	countStr := fmt.Sprintf("  %d game", len(m.games))
	if len(m.games) != 1 {
		countStr += "s"
	}
	if live > 0 {
		countStr += "  " + pulseDot() + " " + StyleLiveBadge.Render(fmt.Sprintf("%d live", live))
	}

	var sb strings.Builder
	sb.WriteString(dateStrip)
	sb.WriteString(StyleDim.Render(countStr) + "\n\n")

	vis := m.visibleCount()
	start := m.scroll
	end := start + vis
	if end > len(m.games) {
		end = len(m.games)
	}

	// Up indicator
	if start > 0 {
		sb.WriteString(StyleDim.Render(fmt.Sprintf("  ↑ %d more", start)) + "\n")
	}

	for i := start; i < end; i++ {
		g := m.games[i]
		away := g.Teams.Away
		home := g.Teams.Home

		var line1, line2 string

		switch g.Status.AbstractGameState {
		case "Live":
			inning := g.Linescore.CurrentInningOrdinal
			half := "▲"
			if strings.EqualFold(g.Linescore.InningState, "bottom") || strings.EqualFold(g.Linescore.InningState, "bot") {
				half = "▼"
			}
			aStr := fmt.Sprintf("%d", away.Score)
			hStr := fmt.Sprintf("%d", home.Score)
			if away.Score > home.Score {
				aStr = StyleAccent.Bold(true).Render(aStr)
			} else if home.Score > away.Score {
				hStr = StyleAccent.Bold(true).Render(hStr)
			}
			line1 = teamText(away.Team.ID, truncate(away.Team.Name, 18)) + "  " + aStr + "  ─  " + hStr + "  " + teamText(home.Team.ID, truncate(home.Team.Name, 18))
			line2 = pulseDot() + " " + StyleLiveBadge.Render(inning+" "+half) + "  " + StyleDim.Render(formatGameTime(g.GameDate))

		case "Final":
			aStr := fmt.Sprintf("%d", away.Score)
			hStr := fmt.Sprintf("%d", home.Score)
			if away.Score > home.Score {
				aStr = StyleAccent.Bold(true).Render(aStr)
			} else if home.Score > away.Score {
				hStr = StyleAccent.Bold(true).Render(hStr)
			}
			line1 = teamText(away.Team.ID, truncate(away.Team.Name, 18)) + "  " + aStr + "  ─  " + hStr + "  " + teamText(home.Team.ID, truncate(home.Team.Name, 18))
			line2 = StyleMuted.Render("Final") + "  " + StyleDim.Render(formatGameTime(g.GameDate))

		default:
			line1 = teamText(away.Team.ID, truncate(away.Team.Name, 18)) + "  vs  " + teamText(home.Team.ID, truncate(home.Team.Name, 18))
			line2 = StyleDim.Render(formatGameTime(g.GameDate))
		}

		if m.notifySubs[g.GamePk] {
			line2 += "  " + StyleAccent.Render("🔔")
		}

		if i == m.cursor {
			sb.WriteString(StyleItemSelected.Render(line1) + "\n")
			sb.WriteString(StyleItemSelected.Render(line2) + "\n")
		} else {
			sb.WriteString("   " + line1 + "\n")
			sb.WriteString("   " + line2 + "\n")
		}
		sb.WriteString("\n")
	}

	// Down indicator
	if end < len(m.games) {
		sb.WriteString(StyleDim.Render(fmt.Sprintf("  ↓ %d more", len(m.games)-end)) + "\n")
	}

	return sb.String()
}

// ── right panel: game detail ──────────────────────────────────────────────────

func (m ScoresModel) renderDetail(w int) string {
	if m.loading {
		return loadingView("loading…")
	}
	if len(m.games) == 0 || m.cursor >= len(m.games) {
		return ""
	}

	g := m.games[m.cursor]
	away := g.Teams.Away
	home := g.Teams.Home

	sectionHdr := func(title string) string {
		fill := w - len(title) - 3
		if fill < 2 {
			fill = 2
		}
		return "\n" + StyleAccent.Bold(true).Render(title) + "  " + StyleDim.Render(strings.Repeat("─", fill)) + "\n\n"
	}

	var sb strings.Builder

	switch g.Status.AbstractGameState {
	case "Live", "Final":
		// Status line
		var statusStr string
		if g.Status.AbstractGameState == "Live" {
			half := "▲"
			if strings.EqualFold(g.Linescore.InningState, "bottom") {
				half = "▼"
			}
			statusStr = pulseDot() + " " + StyleLiveBadge.Render(g.Linescore.CurrentInningOrdinal+" "+half)
			if g.Linescore.Balls > 0 || g.Linescore.Strikes > 0 || g.Linescore.Outs > 0 {
				bso := StyleDim.Render(fmt.Sprintf("  B%d S%d O%d",
					g.Linescore.Balls, g.Linescore.Strikes, g.Linescore.Outs))
				statusStr += bso
			}
		} else {
			statusStr = StyleMuted.Render("Final")
		}
		sb.WriteString(centerIn(statusStr, w) + "\n\n")

		// Team names in each team's colors, with a colored marker.
		awayID := away.Team.ID
		homeID := home.Team.ID
		awayNameStr := teamDot(awayID) + " " + teamHeadline(awayID, truncate(away.Team.Name, 22))
		homeNameStr := teamDot(homeID) + " " + teamHeadline(homeID, truncate(home.Team.Name, 22))
		nameRow := lipgloss.JoinHorizontal(lipgloss.Center,
			awayNameStr,
			StyleDim.Render("  vs  "),
			homeNameStr,
		)
		sb.WriteString(centerIn(nameRow, w) + "\n\n")

		// Big score
		gradStart, gradEnd := headerColors()
		aScoreStr := lipgloss.NewStyle().Bold(true).Render(
			gradientText(fmt.Sprintf("%d", away.Score), gradStart, gradEnd))
		hScoreStr := lipgloss.NewStyle().Bold(true).Render(
			gradientText(fmt.Sprintf("%d", home.Score), gradStart, gradEnd))
		scoreStr := aScoreStr + StyleDim.Render("  ─  ") + hScoreStr
		sb.WriteString(centerIn(scoreStr, w) + "\n")

		// Venue
		if g.Venue.Name != "" {
			sb.WriteString(centerIn(StyleDim.Render(g.Venue.Name), w) + "\n")
		}

		// Linescore
		ls := renderLinescore(g)
		if ls != "" {
			sb.WriteString(sectionHdr("LINESCORE"))
			sb.WriteString(ls)
		}

		// Stats comparison bars (hits, errors from linescore)
		innings := g.Linescore.Innings
		if len(innings) > 0 {
			var awayH, awayE, homeH, homeE int
			for _, inn := range innings {
				if inn.Away.Hits != nil {
					awayH += *inn.Away.Hits
				}
				if inn.Away.Errors != nil {
					awayE += *inn.Away.Errors
				}
				if inn.Home.Hits != nil {
					homeH += *inn.Home.Hits
				}
				if inn.Home.Errors != nil {
					homeE += *inn.Home.Errors
				}
			}
			awayAbbr := teamAbbr(away)
			homeAbbr := teamAbbr(home)
			barW := w - 20
			if barW < 10 {
				barW = 10
			}
			if barW > 32 {
				barW = 32
			}
			sb.WriteString(sectionHdr("STATS"))
			sb.WriteString(RenderStatBar("Hits", awayAbbr, homeAbbr, awayH, homeH, barW))
			sb.WriteString("\n")
			if awayE+homeE > 0 {
				sb.WriteString(RenderStatBar("Errors", awayAbbr, homeAbbr, awayE, homeE, barW))
				sb.WriteString("\n")
			}
		}

	default: // Scheduled
		sb.WriteString("\n")
		awaySchedID := away.Team.ID
		homeSchedID := home.Team.ID
		awaySchedLabel := teamDot(awaySchedID) + " " + teamHeadline(awaySchedID, truncate(away.Team.Name, 26))
		homeSchedLabel := teamDot(homeSchedID) + " " + teamHeadline(homeSchedID, truncate(home.Team.Name, 26))
		sb.WriteString(centerIn(awaySchedLabel, w) + "\n")
		sb.WriteString(centerIn(StyleDim.Render("vs"), w) + "\n")
		sb.WriteString(centerIn(homeSchedLabel, w) + "\n\n")

		sb.WriteString(centerIn(StyleAccent.Render(formatGameTime(g.GameDate)), w) + "\n")
		if g.Venue.Name != "" {
			sb.WriteString(centerIn(StyleDim.Render(g.Venue.Name), w) + "\n")
		}

		// Probable pitchers
		aPP := away.ProbablePitcher
		hPP := home.ProbablePitcher
		if aPP != nil || hPP != nil {
			sb.WriteString(sectionHdr("PROBABLE PITCHERS"))
			aName, hName := "TBD", "TBD"
			if aPP != nil {
				aName = aPP.FullName
			}
			if hPP != nil {
				hName = hPP.FullName
			}
			half := (w - 2) / 2
			sb.WriteString(fmt.Sprintf("  %-*s  %-*s\n",
				half, truncate(aName, half),
				half, truncate(hName, half)))
			sb.WriteString(StyleDim.Render(fmt.Sprintf("  %-*s  %-*s\n",
				half, truncate(away.Team.Name, half),
				half, truncate(home.Team.Name, half))))
		}
	}

	return sb.String()
}

// ── View ──────────────────────────────────────────────────────────────────────

func (m ScoresModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n\n" + HelpBar("r retry", "esc back")
	}

	leftWidth := 56
	if m.width > 0 && m.width/2 > 56 {
		leftWidth = m.width / 2
		if leftWidth > 68 {
			leftWidth = 68
		}
	}
	rightWidth := m.width - leftWidth - 5
	if rightWidth < 30 {
		rightWidth = 30
	}
	if m.width == 0 {
		rightWidth = 60
	}

	// Left panel — framed in a gold border box like Golazo's match list
	leftHeader := PanelHeader("SCORES  "+m.date.Format("Mon Jan 2"), leftWidth)
	innerLeft := leftWidth - 4
	leftPanel := StylePanel.Width(innerLeft).Render(leftHeader + "\n" + m.renderGameList())

	// Right panel — borderless header + detail sections
	rightHeader := PanelHeader("GAME DETAIL", rightWidth)
	rightPanel := lipgloss.NewStyle().Width(rightWidth).Render(rightHeader + "\n" + m.renderDetail(rightWidth))

	split := lipgloss.JoinHorizontal(lipgloss.Top, leftPanel, "  ", rightPanel)

	notifyLabel := "n notify"
	if w := len(m.notifySubs); w > 0 {
		notifyLabel = StyleAccent.Render(fmt.Sprintf("n notify(%d)", w))
	}
	return split + "\n\n" + HelpBar("↑/↓ select", "←/→ day", "t today", "Enter game", "r refresh", notifyLabel, "esc back")
}
