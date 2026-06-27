package ui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

type gameLoadedMsg struct {
	feed  *mlb.LiveFeed
	probs []mlb.WinProbability
}

type gameTick struct{}

// GameTab identifies which tab is active in the game view.
type GameTab int

const (
	GameTabBoxscore GameTab = iota
	GameTabPlays
	GameTabPitching
	GameTabWinProb
	GameTabSpray
	GameTabPitchZone
	GameTabInfo
)

var gameTabs = []string{"Boxscore", "Plays", "Pitching", "Win%", "Spray", "Pitches", "Info"}

// GameModel holds state for the full game detail view.
type GameModel struct {
	gamePk  int
	sport   mlb.Sport
	feed    *mlb.LiveFeed
	probs   []mlb.WinProbability
	tab     GameTab
	tabAt   int // animFrame when the current tab was entered, for reveals
	scroll  int
	loading bool
	err     error
	client  *mlb.Client
	width   int
}

// NewGameModel constructs a GameModel ready to fetch.
func NewGameModel(gamePk int, sport mlb.Sport) GameModel {
	return GameModel{
		gamePk:  gamePk,
		sport:   sport,
		loading: true,
		client:  mlb.DefaultClient(),
	}
}

// Init fires the initial data fetch immediately.
func (m GameModel) Init() tea.Cmd {
	return m.fetch()
}

func (m GameModel) fetch() tea.Cmd {
	pk := m.gamePk
	c := m.client
	return func() tea.Msg {
		feed, err := c.LiveFeed(pk)
		if err != nil {
			return ErrMsg{Err: err}
		}
		probs, _ := c.WinProbability(pk)
		return gameLoadedMsg{feed: feed, probs: probs}
	}
}

// Update handles messages for the game view.
func (m GameModel) Update(msg tea.Msg) (GameModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil

	case gameLoadedMsg:
		m.loading = false
		m.err = nil
		m.scroll = 0
		m.feed = msg.feed
		m.probs = msg.probs
		if m.feed != nil && m.feed.GameData.Status.AbstractGameState == "Live" {
			return m, tea.Tick(20*time.Second, func(time.Time) tea.Msg { return gameTick{} })
		}
		return m, nil

	case gameTick:
		if !m.loading {
			m.loading = true
			return m, m.fetch()
		}
		return m, nil

	case ErrMsg:
		m.loading = false
		m.err = msg.Err
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			m.tab = (m.tab + 1) % GameTab(len(gameTabs))
			m.scroll = 0
			m.tabAt = animFrame
		case "shift+tab":
			if m.tab == 0 {
				m.tab = GameTab(len(gameTabs) - 1)
			} else {
				m.tab--
			}
			m.scroll = 0
			m.tabAt = animFrame
		case "j", "down":
			m.scroll++
		case "k", "up":
			if m.scroll > 0 {
				m.scroll--
			}
		case "r":
			m.err = nil
			m.loading = true
			return m, m.fetch()
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		}
	}
	return m, nil
}

// View renders the game detail screen.
func (m GameModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}
	if m.loading || m.feed == nil {
		return PanelHeader("GAME DETAIL", m.width) + "\n\n" + loadingView("Loading game…")
	}

	panelHdr := PanelHeader("GAME DETAIL", m.width)

	awayName := m.feed.GameData.Teams.Away.Name
	homeName := m.feed.GameData.Teams.Home.Name
	ls := m.feed.LiveData.Linescore

	awayRuns := m.feed.LiveData.Boxscore.Teams.Away.TeamStats.Batting.Runs
	homeRuns := m.feed.LiveData.Boxscore.Teams.Home.TeamStats.Batting.Runs

	stateStr := ""
	if m.feed.GameData.Status.AbstractGameState == "Live" {
		stateStr = pulseDot() + " " + StyleLiveBadge.Render(fmt.Sprintf("%s %s  B%d S%d O%d",
			ls.CurrentInningOrdinal, ls.InningState, ls.Balls, ls.Strikes, ls.Outs))
	} else if m.feed.GameData.Status.AbstractGameState == "Final" {
		stateStr = StyleMuted.Render("Final")
	}

	col := 24
	awayScore := StyleAccent.Bold(true).Render(fmt.Sprintf("%d", awayRuns))
	homeScore := StyleAccent.Bold(true).Render(fmt.Sprintf("%d", homeRuns))
	awayCell := teamHeadline(m.feed.GameData.Teams.Away.ID, fmt.Sprintf("%-*s", col, truncate(awayName, col)))
	homeCell := teamHeadline(m.feed.GameData.Teams.Home.ID, fmt.Sprintf("%-*s", col, truncate(homeName, col)))
	header := awayCell + "  " + awayScore + "     " + homeScore + "  " + homeCell
	if stateStr != "" {
		header += "\n" + stateStr
	}

	// Build tab bar.
	var tabParts []string
	for i, t := range gameTabs {
		if GameTab(i) == m.tab {
			tabParts = append(tabParts, StyleActiveTab.Render(t))
		} else {
			tabParts = append(tabParts, StyleTab.Render(t))
		}
	}
	tabs := strings.Join(tabParts, "")

	var body string
	switch m.tab {
	case GameTabBoxscore:
		body = m.renderBoxscore()
	case GameTabPlays:
		body = m.renderPlays()
	case GameTabPitching:
		body = m.renderPitching()
	case GameTabWinProb:
		body = RenderWinProb(m.probs, awayName, homeName, animProgress(m.tabAt, 14))
	case GameTabSpray:
		body = RenderSprayChart(m.feed.LiveData.Plays.AllPlays, animProgress(m.tabAt, 16))
	case GameTabPitchZone:
		body = RenderPitchZone(m.feed.LiveData.Plays.AllPlays)
	case GameTabInfo:
		body = m.renderGameInfo()
	}

	linescore := m.renderLinescore()
	count := m.renderCount()

	var gameInfo string
	if count != "" {
		gameInfo = linescore + "\n\n" + count + "\n"
	} else {
		gameInfo = linescore + "\n"
	}

	return panelHdr + "\n" + header + "\n\n" + gameInfo + "\n" + tabs + "\n\n" + body + "\n\n" +
		HelpBar("Tab next", "j/k scroll", "r refresh", "esc back")
}

func (m GameModel) renderBoxscore() string {
	bs := m.feed.LiveData.Boxscore
	col := func(team mlb.BoxscoreTeam) string {
		hdr := teamHeadline(team.Team.ID, fmt.Sprintf("%-20s", truncate(team.Team.Name, 20))) +
			StyleHeader.Render(fmt.Sprintf(" %3s %3s %3s %3s %3s %3s %4s",
				"AB", "R", "H", "RBI", "BB", "SO", "AVG"))
		lines := hdr + "\n" + strings.Repeat("─", 52) + "\n"
		for _, id := range team.Batters {
			key := fmt.Sprintf("ID%d", id)
			p, ok := team.Players[key]
			if !ok {
				continue
			}
			b := p.Stats.Batting
			lines += fmt.Sprintf("%-20s %3d %3d %3d %3d %3d %3d %4s\n",
				truncate(p.Person.FullName, 20),
				b.AtBats, b.Runs, b.Hits, b.Rbi, b.BaseOnBalls, b.StrikeOuts, b.Avg)
		}
		return lines
	}
	return col(bs.Teams.Away) + "\n" + col(bs.Teams.Home)
}

func (m GameModel) renderPlays() string {
	plays := m.feed.LiveData.Plays.AllPlays
	var lines []string
	for i := len(plays) - 1; i >= 0; i-- {
		p := plays[i]
		if !p.About.IsComplete || p.Result.Description == "" {
			continue
		}
		half := "▲"
		if p.About.HalfInning == "bottom" {
			half = "▼"
		}
		prefix := StyleDim.Render(fmt.Sprintf("Inn %d%s", p.About.Inning, half))
		lines = append(lines, prefix+"  "+p.Result.Description)
	}
	if len(lines) == 0 {
		return StyleDim.Render("No plays yet.")
	}
	start := m.scroll
	if start >= len(lines) {
		start = len(lines) - 1
	}
	visible := lines[start:]
	if len(visible) > 20 {
		visible = visible[:20]
	}
	return strings.Join(visible, "\n")
}

func (m GameModel) renderPitching() string {
	bs := m.feed.LiveData.Boxscore
	col := func(team mlb.BoxscoreTeam) string {
		hdr := teamHeadline(team.Team.ID, fmt.Sprintf("%-20s", truncate(team.Team.Name, 20))) +
			StyleHeader.Render(fmt.Sprintf(" %5s %3s %3s %3s %3s %3s %3s",
				"IP", "H", "R", "ER", "BB", "K", "NP"))
		lines := hdr + "\n" + StyleDim.Render(strings.Repeat("─", 49)) + "\n"
		for _, id := range team.Pitchers {
			key := fmt.Sprintf("ID%d", id)
			p, ok := team.Players[key]
			if !ok {
				continue
			}
			pi := p.Stats.Pitching
			ip := pi.InningsPitched
			if ip == "" {
				ip = "0.0"
			}
			lines += fmt.Sprintf("%-20s %5s %3d %3d %3d %3d %3d %3d\n",
				truncate(p.Person.FullName, 20),
				ip, pi.Hits, pi.Runs, pi.EarnedRuns, pi.BaseOnBalls, pi.StrikeOuts, pi.NumberOfPitches)
		}
		return lines
	}
	return col(bs.Teams.Away) + "\n" + col(bs.Teams.Home)
}

func (m GameModel) renderLinescore() string {
	ls := m.feed.LiveData.Linescore
	bs := m.feed.LiveData.Boxscore

	numCols := 9
	if len(ls.Innings) > numCols {
		numCols = len(ls.Innings)
	}

	awayRunMap := map[int]*int{}
	homeRunMap := map[int]*int{}
	for _, inn := range ls.Innings {
		r := inn.Away.Runs
		awayRunMap[inn.Num] = r
		r2 := inn.Home.Runs
		homeRunMap[inn.Num] = r2
	}

	hdr := fmt.Sprintf("%-18s", "")
	for i := 1; i <= numCols; i++ {
		if i == ls.CurrentInning && m.feed.GameData.Status.AbstractGameState == "Live" {
			hdr += StyleAccent.Bold(true).Render(fmt.Sprintf("%3d", i))
		} else {
			hdr += StyleDim.Render(fmt.Sprintf("%3d", i))
		}
	}
	hdr += StyleHeader.Bold(true).Render("   R   H   E")

	buildRow := func(name string, runMap map[int]*int, r, h, e int) string {
		row := fmt.Sprintf("%-18s", truncate(name, 18))
		for i := 1; i <= numCols; i++ {
			if runs, ok := runMap[i]; ok && runs != nil {
				row += StyleHeader.Render(fmt.Sprintf("%3d", *runs))
			} else {
				row += StyleDim.Render("  —")
			}
		}
		row += StyleHeader.Render(fmt.Sprintf("  %3d %3d %3d", r, h, e))
		return row
	}

	awayBat := bs.Teams.Away.TeamStats.Batting
	homeBat := bs.Teams.Home.TeamStats.Batting
	awayRow := buildRow(m.feed.GameData.Teams.Away.Name, awayRunMap, awayBat.Runs, awayBat.Hits, awayBat.Errors)
	homeRow := buildRow(m.feed.GameData.Teams.Home.Name, homeRunMap, homeBat.Runs, homeBat.Hits, homeBat.Errors)
	sep := StyleDim.Render(strings.Repeat("─", 18+numCols*3+14))

	return hdr + "\n" + sep + "\n" + awayRow + "\n" + homeRow
}

func (m GameModel) renderCount() string {
	ls := m.feed.LiveData.Linescore
	if m.feed.GameData.Status.AbstractGameState != "Live" {
		return ""
	}

	dot := func(filled bool, style lipgloss.Style) string {
		if filled {
			return style.Render("●")
		}
		return StyleDim.Render("○")
	}

	ballStyle := lipgloss.NewStyle().Foreground(lipgloss.AdaptiveColor{Light: "28", Dark: "76"})
	strikeStyle := lipgloss.NewStyle().Foreground(lipgloss.AdaptiveColor{Light: "124", Dark: "203"})
	outStyle := lipgloss.NewStyle().Foreground(lipgloss.AdaptiveColor{Light: "136", Dark: "220"})

	balls := ""
	for i := 0; i < 4; i++ {
		balls += dot(i < ls.Balls, ballStyle) + " "
	}
	strikes := ""
	for i := 0; i < 3; i++ {
		strikes += dot(i < ls.Strikes, strikeStyle) + " "
	}
	outs := ""
	for i := 0; i < 3; i++ {
		outs += dot(i < ls.Outs, outStyle) + " "
	}

	return fmt.Sprintf("B %s  S %s  O %s", strings.TrimSpace(balls), strings.TrimSpace(strikes), strings.TrimSpace(outs))
}

func (m GameModel) renderGameInfo() string {
	g := m.feed.GameData
	bs := m.feed.LiveData.Boxscore

	section := func(title string) string {
		return "\n" + StyleAccent.Bold(true).Render("  "+title) + "  " +
			StyleDim.Render(strings.Repeat("─", 44)) + "\n"
	}
	kv := func(k, v string) string {
		if v == "" {
			return ""
		}
		return "  " + StyleDim.Render(fmt.Sprintf("%-14s", k)) + " " + v + "\n"
	}

	var sb strings.Builder
	if g.Weather.Condition != "" || g.Weather.Temp != "" {
		sb.WriteString(section("WEATHER"))
		sb.WriteString(kv("Conditions", g.Weather.Condition))
		if g.Weather.Temp != "" {
			sb.WriteString(kv("Temp", g.Weather.Temp+"°"))
		}
		sb.WriteString(kv("Wind", g.Weather.Wind))
	}

	sb.WriteString(section("GAME"))
	sb.WriteString(kv("Venue", g.Venue.Name))
	if g.GameInfo.Attendance > 0 {
		sb.WriteString(kv("Attendance", commaInt(g.GameInfo.Attendance)))
	}
	if fp := g.GameInfo.FirstPitch; fp != "" {
		if t, err := time.Parse(time.RFC3339, fp); err == nil {
			sb.WriteString(kv("First pitch", t.In(time.Local).Format("3:04 PM MST")))
		}
	}
	if g.GameInfo.GameDurationMinutes > 0 {
		sb.WriteString(kv("Length", fmt.Sprintf("%d min", g.GameInfo.GameDurationMinutes)))
	}

	if len(bs.Officials) > 0 {
		sb.WriteString(section("UMPIRES"))
		for _, o := range bs.Officials {
			sb.WriteString(kv(o.OfficialType, o.Official.FullName))
		}
	}

	if len(bs.Info) > 0 {
		sb.WriteString(section("NOTES"))
		notes := bs.Info
		if len(notes) > 8 {
			notes = notes[:8]
		}
		for _, info := range notes {
			sb.WriteString(kv(info.Label, info.Value))
		}
	}

	if strings.TrimSpace(sb.String()) == "" {
		return StyleDim.Render("  No game info available yet.")
	}
	return sb.String()
}

// truncate shortens s to at most n runes, appending "." when truncated.
// Uses ASCII "." (1 byte) instead of "…" (3 bytes) so fmt.Sprintf width
// specifiers (which count bytes) keep columns aligned correctly.
func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n-1]) + "."
}
