package ui

import (
	"fmt"
	"sort"
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

// matchupLoadedMsg carries both teams' season schedules, used to derive the
// head-to-head series and each side's last-10 form.
type matchupLoadedMsg struct {
	away []mlb.Game
	home []mlb.Game
}

type gameTick struct{}

// contentLoadedMsg carries a game's highlight clips + recap.
type contentLoadedMsg struct{ content *mlb.GameContent }

// GameTab identifies which tab is active in the game view.
type GameTab int

const (
	GameTabBoxscore GameTab = iota
	GameTabPlays
	GameTabPitching
	GameTabMatchup
	GameTabWinProb
	GameTabSpray
	GameTabPitchZone
	GameTabHighlights
	GameTabInfo
)

var gameTabs = []string{"Boxscore", "Plays", "Pitching", "Matchup", "Win%", "Spray", "Pitches", "Highlights", "Info"}

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

	// Matchup tab data (both teams' season schedules), fetched once.
	awayGames        []mlb.Game
	homeGames        []mlb.Game
	matchupRequested bool
	matchupLoaded    bool

	// Highlights tab data, fetched once when first opened.
	content          *mlb.GameContent
	contentRequested bool
	hlCursor         int
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

// fetchMatchup pulls both teams' full-season schedules so the Matchup tab can
// derive the head-to-head series and each team's last-10 form.
func (m GameModel) fetchMatchup(awayID, homeID int, season string) tea.Cmd {
	c := m.client
	return func() tea.Msg {
		away, _ := c.TeamSchedule(awayID, season)
		home, _ := c.TeamSchedule(homeID, season)
		return matchupLoadedMsg{away: away, home: home}
	}
}

// fetchContent pulls highlight clips + recap once, lazily on first tab open.
func (m GameModel) fetchContent() tea.Cmd {
	pk := m.gamePk
	c := m.client
	return func() tea.Msg {
		content, err := c.Content(pk)
		if err != nil {
			return contentLoadedMsg{content: &mlb.GameContent{}}
		}
		return contentLoadedMsg{content: content}
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
		var cmds []tea.Cmd
		// Kick off the matchup fetch once, after we know the teams + season.
		if m.feed != nil && !m.matchupRequested {
			awayID := m.feed.GameData.Teams.Away.ID
			homeID := m.feed.GameData.Teams.Home.ID
			season := ""
			if d := m.feed.GameData.Datetime.OfficialDate; len(d) >= 4 {
				season = d[:4]
			}
			if season != "" && awayID != 0 && homeID != 0 {
				m.matchupRequested = true
				cmds = append(cmds, m.fetchMatchup(awayID, homeID, season))
			}
		}
		if m.feed != nil && m.feed.GameData.Status.AbstractGameState == "Live" {
			cmds = append(cmds, tea.Tick(20*time.Second, func(time.Time) tea.Msg { return gameTick{} }))
		}
		return m, tea.Batch(cmds...)

	case matchupLoadedMsg:
		m.awayGames = msg.away
		m.homeGames = msg.home
		m.matchupLoaded = true
		return m, nil

	case contentLoadedMsg:
		m.content = msg.content
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
			if m.tab == GameTabHighlights && m.content != nil {
				if m.hlCursor < len(m.content.Highlights)-1 {
					m.hlCursor++
				}
			} else {
				m.scroll++
			}
		case "k", "up":
			if m.tab == GameTabHighlights && m.content != nil {
				if m.hlCursor > 0 {
					m.hlCursor--
				}
			} else if m.scroll > 0 {
				m.scroll--
			}
		case "enter":
			if m.tab == GameTabHighlights && m.content != nil {
				clips := m.content.Highlights
				if m.hlCursor >= 0 && m.hlCursor < len(clips) {
					if u := clips[m.hlCursor].VideoURL(); u != "" {
						return m, openURL(u)
					}
				}
			}
		case "r":
			m.err = nil
			m.loading = true
			return m, m.fetch()
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		}
	}
	// Lazily fetch highlight content the first time the tab is opened.
	if m.tab == GameTabHighlights && !m.contentRequested {
		m.contentRequested = true
		return m, m.fetchContent()
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
	case GameTabMatchup:
		body = m.renderMatchup()
	case GameTabWinProb:
		body = RenderWinProb(m.probs, awayName, homeName, animProgress(m.tabAt, 14))
	case GameTabSpray:
		body = m.renderStatcastSummary() + RenderSprayChart(m.feed.LiveData.Plays.AllPlays, animProgress(m.tabAt, 16))
	case GameTabPitchZone:
		body = RenderPitchZone(m.feed.LiveData.Plays.AllPlays)
	case GameTabHighlights:
		body = m.renderHighlights()
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

// renderStatcastSummary shows the game's hardest-hit / longest balls in play,
// derived from the batted-ball data already in the live feed.
func (m GameModel) renderStatcastSummary() string {
	balls := mlb.BattedBalls(m.feed)
	if len(balls) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString(StyleHeader.Render("STATCAST") + "\n")
	if h := mlb.HardestHit(balls); h != nil {
		b.WriteString(fmt.Sprintf("  Hardest hit: %.1f mph (%.0f°)  %s\n", h.EV, h.Angle, truncate(h.Result, 44)))
	}
	if l := mlb.Longest(balls); l != nil {
		b.WriteString(fmt.Sprintf("  Longest:     %.0f ft%s%s\n", l.Distance, strings.Repeat(" ", 12), truncate(l.Result, 44)))
	}
	b.WriteString(StyleDim.Render(fmt.Sprintf("  %d balls in play", len(balls))) + "\n\n")
	return b.String()
}

// renderHighlights lists the game's highlight clips; enter opens the selected
// clip in the browser (terminals can't play video).
func (m GameModel) renderHighlights() string {
	if m.content == nil {
		return loadingView("Loading highlights…")
	}
	clips := m.content.Highlights
	if len(clips) == 0 {
		return StyleDim.Render("No highlights yet for this game.")
	}
	const window = 16
	start := 0
	if m.hlCursor >= window {
		start = m.hlCursor - window + 1
	}
	end := start + window
	if end > len(clips) {
		end = len(clips)
	}
	var b strings.Builder
	if start > 0 {
		b.WriteString(StyleDim.Render("  ↑ more") + "\n")
	}
	for i := start; i < end; i++ {
		c := clips[i]
		dur := c.DurationSeconds()
		label := fmt.Sprintf("%s · %d:%02d", truncate(c.Title, 60), dur/60, dur%60)
		if i == m.hlCursor {
			b.WriteString(StyleActiveTab.Render("▸ "+label) + "\n")
		} else {
			b.WriteString("  " + label + "\n")
		}
	}
	if end < len(clips) {
		b.WriteString(StyleDim.Render("  ↓ more") + "\n")
	}
	b.WriteString("\n" + StyleDim.Render("j/k select · enter open in browser"))
	return b.String()
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

// renderMatchup shows the season head-to-head series and each team's last-10
// form, both excluding the game currently being viewed.
func (m GameModel) renderMatchup() string {
	if !m.matchupLoaded {
		return StyleDim.Render("  Loading matchup…")
	}

	awayID := m.feed.GameData.Teams.Away.ID
	homeID := m.feed.GameData.Teams.Home.ID
	awayName := m.feed.GameData.Teams.Away.Name
	homeName := m.feed.GameData.Teams.Home.Name

	section := func(title string) string {
		return StyleAccent.Bold(true).Render("  "+title) + "  " +
			StyleDim.Render(strings.Repeat("─", 44)) + "\n"
	}

	var sb strings.Builder

	// ── Head-to-head ──
	sb.WriteString(section("HEAD-TO-HEAD"))
	h2h := headToHeadGames(m.awayGames, awayID, homeID, m.gamePk)
	if len(h2h) == 0 {
		sb.WriteString(StyleDim.Render("  No completed meetings this season yet.") + "\n")
	} else {
		aWins, hWins := 0, 0
		for _, g := range h2h {
			winID := g.Teams.Away.Team.ID
			if g.Teams.Home.IsWinner {
				winID = g.Teams.Home.Team.ID
			}
			if winID == awayID {
				aWins++
			} else if winID == homeID {
				hWins++
			}
		}
		var lead string
		switch {
		case aWins > hWins:
			lead = fmt.Sprintf("%s lead the series %d-%d", awayName, aWins, hWins)
		case hWins > aWins:
			lead = fmt.Sprintf("%s lead the series %d-%d", homeName, hWins, aWins)
		default:
			lead = fmt.Sprintf("Series tied %d-%d", aWins, hWins)
		}
		sb.WriteString("  " + StyleHeader.Bold(true).Render(lead) + "  " +
			StyleDim.Render(fmt.Sprintf("(%d games)", len(h2h))) + "\n\n")

		shown := h2h
		if len(shown) > 5 {
			shown = shown[:5]
		}
		for _, g := range shown {
			a, h := g.Teams.Away, g.Teams.Home
			date := g.GameDate
			if t, err := time.Parse(time.RFC3339, g.GameDate); err == nil {
				date = t.In(time.Local).Format("Jan 02")
			}
			aStr := fmt.Sprintf("%3s %2d", a.Team.Abbreviation, a.Score)
			hStr := fmt.Sprintf("%2d %-3s", h.Score, h.Team.Abbreviation)
			if a.IsWinner {
				aStr = StyleAccent.Bold(true).Render(aStr)
			} else {
				aStr = StyleDim.Render(aStr)
			}
			if h.IsWinner {
				hStr = StyleAccent.Bold(true).Render(hStr)
			} else {
				hStr = StyleDim.Render(hStr)
			}
			winAbbr := a.Team.Abbreviation
			if h.IsWinner {
				winAbbr = h.Team.Abbreviation
			}
			sb.WriteString(fmt.Sprintf("  %-7s %s %s %s   %s\n",
				date, aStr, StyleDim.Render("-"), hStr, StyleDim.Render(winAbbr+" W")))
		}
	}

	// ── Last 10 form per team ──
	sb.WriteString("\n" + section("LAST 10 GAMES"))
	sb.WriteString(m.renderTeamForm(awayID, awayName, m.awayGames))
	sb.WriteString("\n")
	sb.WriteString(m.renderTeamForm(homeID, homeName, m.homeGames))

	return sb.String()
}

// headToHeadGames returns completed games between awayID and homeID (from the
// away team's season schedule), newest first, excluding the current game.
func headToHeadGames(awayTeamGames []mlb.Game, awayID, homeID, excludePk int) []mlb.Game {
	var out []mlb.Game
	for _, g := range awayTeamGames {
		if g.Status.AbstractGameState != "Final" || g.GamePk == excludePk {
			continue
		}
		a, h := g.Teams.Away.Team.ID, g.Teams.Home.Team.ID
		if (a == awayID && h == homeID) || (a == homeID && h == awayID) {
			out = append(out, g)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].GameDate > out[j].GameDate })
	return out
}

// renderTeamForm renders one team's last-10 record, W/L heat strip, and
// runs-for/against averages, excluding the current game.
func (m GameModel) renderTeamForm(teamID int, name string, games []mlb.Game) string {
	filtered := make([]mlb.Game, 0, len(games))
	for _, g := range games {
		if g.GamePk != m.gamePk {
			filtered = append(filtered, g)
		}
	}
	sort.Slice(filtered, func(i, j int) bool { return filtered[i].GameDate < filtered[j].GameDate })
	res := gameLogResults(filtered, teamID)
	if len(res) > 10 {
		res = res[len(res)-10:]
	}
	if len(res) == 0 {
		return "  " + teamHeadline(teamID, name) + "  " + StyleDim.Render("no recent games") + "\n"
	}

	winColor := lipgloss.Color("#22c55e")
	lossColor := lipgloss.Color("#ef4444")
	// Each game is drawn as a wide segment so 10 games read as a long bar
	// rather than a thin 10-char strip.
	const blocksPerGame = 4
	block := strings.Repeat("█", blocksPerGame)
	wins, losses, rf, ra := 0, 0, 0, 0
	var strip strings.Builder
	for _, r := range res {
		if r.Win {
			wins++
			strip.WriteString(lipgloss.NewStyle().Foreground(winColor).Render(block))
		} else {
			losses++
			strip.WriteString(lipgloss.NewStyle().Foreground(lossColor).Render(block))
		}
		rf += r.For
		ra += r.Against
	}
	n := float64(len(res))
	rfg, rag := float64(rf)/n, float64(ra)/n
	diff := rfg - rag
	diffStr := fmt.Sprintf("%+.1f", diff)
	diffStyled := lipgloss.NewStyle().Foreground(winColor).Render(diffStr)
	if diff < 0 {
		diffStyled = lipgloss.NewStyle().Foreground(lossColor).Render(diffStr)
	}

	var sb strings.Builder
	sb.WriteString("  " + teamHeadline(teamID, name) + "  " +
		StyleAccent.Bold(true).Render(fmt.Sprintf("%d-%d", wins, losses)) + "  " +
		StyleDim.Render(fmt.Sprintf("last %d", len(res))) + "\n")
	sb.WriteString("  " + strip.String() + "\n")
	sb.WriteString("  " + StyleDim.Render(fmt.Sprintf("RF %.1f/g   RA %.1f/g   DIFF ", rfg, rag)) + diffStyled + "\n")
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
