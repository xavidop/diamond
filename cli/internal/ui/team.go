package ui

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/espn"
	"github.com/xavidop/diamond/cli/internal/fav"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// GameResult is one final game from the perspective of a given team.
type GameResult struct {
	Win     bool
	For     int
	Against int
	OppAbbr string
	Home    bool
}

type teamsLoadedMsg struct{ teams []mlb.Team }

type teamDetailLoadedMsg struct {
	roster   []mlb.RosterPlayer
	hitting  map[string]interface{}
	pitching map[string]interface{}
}

type teamPlayerLoadedMsg struct {
	player *mlb.Player
	log    []mlb.StatSplit
	splits []mlb.SplitLine
}

type teamGameLogLoadedMsg struct{ games []GameResult }
type teamTxnsLoadedMsg struct{ txns []mlb.Transaction }
type teamNewsLoadedMsg struct{ news []espn.Article }

type teamViewState int

const (
	teamStateSearch teamViewState = iota
	teamStateDetail
	teamStatePlayer
)

var teamTabNames = []string{"Roster", "Hitting", "Pitching", "Depth", "Game Log", "Transactions", "News"}

type TeamModel struct {
	sport    mlb.Sport
	state    teamViewState
	search   SearchInput
	teams    []mlb.Team
	matches  []int
	cursor   int
	team     *mlb.Team
	roster   []mlb.RosterPlayer
	hitting  map[string]interface{}
	pitching map[string]interface{}
	tab      int
	loading  bool
	err      error
	client   *mlb.Client
	width    int

	// roster drill-down
	rosterOrder   []mlb.RosterPlayer // display order, for cursor navigation
	rosterCursor  int
	player        *mlb.Player
	gameLog       []mlb.StatSplit
	splits        []mlb.SplitLine
	playerLoading bool

	// depth chart animation
	depthEnteredAt int

	// game log tab
	teamGames        []GameResult
	teamGamesLoaded  bool
	gameLogEnteredAt int

	// transactions tab
	teamTxns       []mlb.Transaction
	teamTxnsLoaded bool

	// news tab
	teamNews       []espn.Article
	teamNewsLoaded bool
	newsCursor     int

	// in-app article reader (news tab)
	readingArticle bool
	reader         ArticleReader
	height         int
}

func NewTeamModel(sport mlb.Sport, query ...string) TeamModel {
	si := NewSearchInput("Search team…")
	if len(query) > 0 && query[0] != "" {
		si.SetValue(query[0])
	}
	m := TeamModel{
		sport:  sport,
		state:  teamStateSearch,
		search: si,
		client: mlb.DefaultClient(),
	}
	return m
}

func (m TeamModel) Init() tea.Cmd {
	c := m.client
	sport := m.sport
	return func() tea.Msg {
		teams, err := c.Teams(sport.ID)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return teamsLoadedMsg{teams: teams}
	}
}

// CapturesText reports whether the team search box is focused.
func (m TeamModel) CapturesText() bool { return m.state == teamStateSearch }

func (m TeamModel) Update(msg tea.Msg) (TeamModel, tea.Cmd) {
	// While reading an article in the News tab, route everything to the reader.
	if m.readingArticle {
		if sz, ok := msg.(tea.WindowSizeMsg); ok {
			m.width, m.height = sz.Width, sz.Height
		}
		var cmd tea.Cmd
		m.reader, cmd = m.reader.Update(msg)
		if m.reader.done {
			m.readingArticle = false
		}
		return m, cmd
	}
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil
	case teamsLoadedMsg:
		m.teams = msg.teams
		m.updateMatches()
		return m, nil
	case teamDetailLoadedMsg:
		m.loading = false
		m.roster = msg.roster
		m.hitting = msg.hitting
		m.pitching = msg.pitching
		m.rosterOrder = orderRoster(msg.roster)
		m.rosterCursor = 0
		return m, nil
	case teamPlayerLoadedMsg:
		m.playerLoading = false
		m.player = msg.player
		m.gameLog = msg.log
		m.splits = msg.splits
		return m, nil
	case teamGameLogLoadedMsg:
		m.teamGames = msg.games
		m.teamGamesLoaded = true
		return m, nil
	case teamTxnsLoadedMsg:
		m.teamTxns = msg.txns
		m.teamTxnsLoaded = true
		return m, nil
	case teamNewsLoadedMsg:
		m.teamNews = msg.news
		m.teamNewsLoaded = true
		return m, nil
	case ErrMsg:
		m.loading = false
		m.playerLoading = false
		m.err = msg.Err
		return m, nil
	case tea.KeyMsg:
		switch m.state {
		case teamStateSearch:
			switch msg.String() {
			case "up", "k":
				if m.cursor > 0 {
					m.cursor--
				}
			case "down", "j":
				if m.cursor < len(m.matches)-1 {
					m.cursor++
				}
			case "enter":
				if len(m.matches) > 0 {
					t := m.teams[m.matches[m.cursor]]
					m.team = &t
					m.state = teamStateDetail
					m.tab = 0
					m.loading = true
					// reset per-team lazy caches so a newly selected team never shows the previous team's data
					m.teamGames, m.teamGamesLoaded = nil, false
					m.teamTxns, m.teamTxnsLoaded = nil, false
					m.teamNews, m.teamNewsLoaded, m.newsCursor = nil, false, 0
					return m, m.loadTeamDetail(t.ID)
				}
			case "esc":
				return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
			default:
				var cmd tea.Cmd
				m.search, cmd = m.search.Update(msg)
				m.updateMatches()
				m.cursor = 0
				return m, cmd
			}
		case teamStateDetail:
			switch msg.String() {
			case "f":
				if m.team != nil {
					fav.ToggleTeam(m.team.ID, m.team.Name)
				}
			case "tab", "right", "l":
				m.tab = (m.tab + 1) % len(teamTabNames)
				cmd := m.onTeamTabChange()
				return m, cmd
			case "shift+tab", "left", "h":
				m.tab = (m.tab - 1 + len(teamTabNames)) % len(teamTabNames)
				cmd := m.onTeamTabChange()
				return m, cmd
			case "up", "k":
				if m.tab == 0 && m.rosterCursor > 0 {
					m.rosterCursor--
				}
				if m.tab == 6 && m.newsCursor > 0 {
					m.newsCursor--
				}
			case "down", "j":
				if m.tab == 0 && m.rosterCursor < len(m.rosterOrder)-1 {
					m.rosterCursor++
				}
				if m.tab == 6 && m.newsCursor < len(m.teamNews)-1 {
					m.newsCursor++
				}
			case "enter":
				if m.tab == 0 && m.rosterCursor < len(m.rosterOrder) {
					m.state = teamStatePlayer
					m.playerLoading = true
					m.player = nil
					return m, m.loadPlayer(m.rosterOrder[m.rosterCursor].Person.ID)
				}
				if m.tab == 6 && m.newsCursor < len(m.teamNews) {
					m.reader = NewArticleReader(m.teamNews[m.newsCursor], m.width, m.height)
					m.readingArticle = true
					return m, m.reader.Init()
				}
			case "esc":
				m.state = teamStateSearch
				m.team = nil
				m.roster = nil
				m.hitting = nil
				m.pitching = nil
			}
		case teamStatePlayer:
			switch msg.String() {
			case "f":
				if m.player != nil {
					fav.TogglePlayer(m.player.ID, m.player.FullName)
				}
			case "up", "k":
				if m.rosterCursor > 0 {
					m.rosterCursor--
					m.playerLoading = true
					m.player = nil
					return m, m.loadPlayer(m.rosterOrder[m.rosterCursor].Person.ID)
				}
			case "down", "j":
				if m.rosterCursor < len(m.rosterOrder)-1 {
					m.rosterCursor++
					m.playerLoading = true
					m.player = nil
					return m, m.loadPlayer(m.rosterOrder[m.rosterCursor].Person.ID)
				}
			case "esc":
				m.state = teamStateDetail
				m.player = nil
				m.gameLog = nil
			}
		}
	}
	return m, nil
}

// loadTeamDetail fetches roster + season hitting/pitching stats concurrently.
func (m TeamModel) loadTeamDetail(teamID int) tea.Cmd {
	c := m.client
	season := fmt.Sprintf("%d", time.Now().Year())
	return func() tea.Msg {
		var (
			roster    []mlb.RosterPlayer
			hitting   map[string]interface{}
			pitching  map[string]interface{}
			rosterErr error
		)
		var mu sync.Mutex
		var wg sync.WaitGroup
		wg.Add(3)
		go func() {
			defer wg.Done()
			r, err := c.TeamRoster(teamID)
			mu.Lock()
			defer mu.Unlock()
			roster, rosterErr = r, err
		}()
		go func() {
			defer wg.Done()
			h, _ := c.TeamStats(teamID, "hitting", season)
			mu.Lock()
			defer mu.Unlock()
			hitting = h
		}()
		go func() {
			defer wg.Done()
			p, _ := c.TeamStats(teamID, "pitching", season)
			mu.Lock()
			defer mu.Unlock()
			pitching = p
		}()
		wg.Wait()
		if rosterErr != nil {
			return ErrMsg{Err: rosterErr}
		}
		return teamDetailLoadedMsg{roster: roster, hitting: hitting, pitching: pitching}
	}
}

// loadTeamGameLog fetches and reduces the team's season schedule to W/L results.
func (m TeamModel) loadTeamGameLog(teamID int) tea.Cmd {
	c := m.client
	season := fmt.Sprintf("%d", time.Now().Year())
	return func() tea.Msg {
		games, err := c.TeamSchedule(teamID, season)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return teamGameLogLoadedMsg{games: gameLogResults(games, teamID)}
	}
}

// onTeamTabChange fires the animation/lazy-load side effects for the tab the
// user just moved to. All loads are guarded on m.team to stay panic-safe.
func (m *TeamModel) onTeamTabChange() tea.Cmd {
	switch m.tab {
	case 3:
		m.depthEnteredAt = animFrame
	case 4:
		m.gameLogEnteredAt = animFrame
		if !m.teamGamesLoaded && m.team != nil {
			return m.loadTeamGameLog(m.team.ID)
		}
	case 5:
		if !m.teamTxnsLoaded && m.team != nil {
			return m.loadTeamTransactions(m.team.ID)
		}
	case 6:
		if !m.teamNewsLoaded && m.team != nil {
			return m.loadTeamNews(m.team.ID)
		}
	}
	return nil
}

// loadTeamTransactions fetches this team's roster moves for the season to date.
func (m TeamModel) loadTeamTransactions(teamID int) tea.Cmd {
	c := m.client
	year := time.Now().Year()
	start := fmt.Sprintf("%d-01-01", year)
	end := time.Now().Format("2006-01-02")
	return func() tea.Msg {
		ts, err := c.TeamTransactions(teamID, start, end)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return teamTxnsLoadedMsg{txns: ts}
	}
}

// loadTeamNews fetches ESPN news for this team (MLB only).
func (m TeamModel) loadTeamNews(teamID int) tea.Cmd {
	espnID, ok := espnTeamID(teamID)
	return func() tea.Msg {
		if !ok {
			return teamNewsLoadedMsg{news: nil}
		}
		arts, err := espn.DefaultClient().News(espnID, 20)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return teamNewsLoadedMsg{news: arts}
	}
}

// loadPlayer fetches one roster player's bio + season stats + game log.
func (m TeamModel) loadPlayer(id int) tea.Cmd {
	c := m.client
	season := fmt.Sprintf("%d", time.Now().Year())
	return func() tea.Msg {
		p, err := c.Person(id, season)
		if err != nil {
			return ErrMsg{Err: err}
		}
		group := "hitting"
		if p.PrimaryPosition.Code == "1" {
			group = "pitching"
		}
		log, _ := c.PersonGameLog(id, group, season)
		splits, _ := c.PersonSplits(id, group, season)
		return teamPlayerLoadedMsg{player: p, log: log, splits: splits}
	}
}

// orderRoster flattens the roster into display order (matching renderRoster)
// so the cursor moves through it predictably.
func orderRoster(roster []mlb.RosterPlayer) []mlb.RosterPlayer {
	groups := map[string][]mlb.RosterPlayer{}
	for _, p := range roster {
		cat := positionCategory(p.Position.Abbreviation)
		groups[cat] = append(groups[cat], p)
	}
	var out []mlb.RosterPlayer
	for _, g := range []string{"PITCHERS", "CATCHERS", "INFIELD", "OUTFIELD", "DH", "OTHER"} {
		out = append(out, groups[g]...)
	}
	return out
}

func (m *TeamModel) updateMatches() {
	names := make([]string, len(m.teams))
	for i, t := range m.teams {
		names[i] = t.Name
	}
	m.matches = Filter(names, m.search.Value())
}

func statInt(s map[string]interface{}, key string) int {
	if v, ok := s[key]; ok {
		if f, ok := v.(float64); ok {
			return int(f)
		}
	}
	return 0
}

// statFloat coerces a stat value (JSON number or string like ".320") to float64.
func statFloat(s map[string]interface{}, key string) float64 {
	v, ok := s[key]
	if !ok {
		return 0
	}
	switch x := v.(type) {
	case float64:
		return x
	case string:
		return parseStatFloat(x)
	}
	return 0
}

func statStr(s map[string]interface{}, key string) string {
	if v, ok := s[key]; ok {
		if str, ok := v.(string); ok {
			return str
		}
	}
	return "—"
}

func (m TeamModel) View() string {
	if m.readingArticle {
		return m.reader.View()
	}
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("esc back")
	}

	if m.state == teamStateSearch {
		panelHdr := PanelHeader("TEAMS", m.width)
		out := panelHdr + "\n\n" + m.search.View() + "\n\n"
		for i, idx := range m.matches {
			t := m.teams[idx]
			if i == m.cursor {
				out += StyleItemSelected.Render(t.Name) + "\n"
			} else {
				out += "   " + StyleItemNormal.Render(t.Name) + "\n"
			}
		}
		return out + "\n" + HelpBar("↑/↓ navigate", "Enter select", "esc back")
	}

	if m.state == teamStatePlayer {
		ts, te := headerColors()
		crumb := PanelHeader("TEAMS", m.width) + "\n" +
			gradientText(m.team.Name, ts, te) + StyleDim.Render("  ·  roster")
		if m.playerLoading || m.player == nil {
			return crumb + "\n\n" + loadingView("Loading player…")
		}
		star := ""
		if fav.HasPlayer(m.player.ID) {
			star = StyleAccent.Render("★ ")
		}
		pos := StyleDim.Render(fmt.Sprintf("   %d / %d", m.rosterCursor+1, len(m.rosterOrder)))
		return crumb + "\n" + star + renderPlayerBody(m.player, m.gameLog, m.splits) + "\n" +
			HelpBar("↑/↓ prev/next player", "f favorite", "esc back to roster") + pos
	}

	if m.loading {
		return PanelHeader("TEAMS", m.width) + "\n\n" + loadingView("Loading team data…")
	}

	team := m.team
	tabs := ""
	for i, n := range teamTabNames {
		if i == m.tab {
			tabs += StyleActiveTab.Render(n)
		} else {
			tabs += StyleTab.Render(n)
		}
	}

	ts, te := headerColors()
	panelHdr := PanelHeader("TEAMS", m.width)
	star := ""
	if fav.HasTeam(team.ID) {
		star = StyleAccent.Render("★ ")
	}
	titleLine := star + gradientText(team.Name, ts, te) + "  " + StyleDim.Render(team.Division.Name)
	titleLine = lipgloss.JoinHorizontal(lipgloss.Center, teamBadge(*team), "  ", titleLine)
	header := panelHdr + "\n" + titleLine

	var body string
	switch m.tab {
	case 0:
		body = m.renderRoster()
	case 1:
		body = m.renderHitting()
	case 2:
		body = m.renderPitching()
	case 3:
		body = RenderDepthChart(m.roster, m.width, animProgress(m.depthEnteredAt, 12))
	case 4:
		if !m.teamGamesLoaded {
			body = loadingView("Loading game log…")
		} else {
			body = RenderGameLogStrip(m.teamGames, animProgress(m.gameLogEnteredAt, 16))
		}
	case 5:
		body = m.renderTeamTransactions()
	case 6:
		body = m.renderTeamNews()
	}

	help := HelpBar("Tab/⇧Tab change view", "f favorite", "esc back")
	if m.tab == 0 {
		help = HelpBar("↑/↓ select player", "Enter stats", "Tab/⇧Tab change view", "f favorite", "esc back")
	}
	if m.tab == 6 {
		help = HelpBar("↑/↓ select", "Enter read", "Tab/⇧Tab change view", "esc back")
	}
	return header + "\n" + tabs + "\n\n" + body + "\n" + help
}

// positionCategory buckets a position abbreviation into a roster group.
func positionCategory(pos string) string {
	switch pos {
	case "P", "SP", "RP", "LHP", "RHP":
		return "PITCHERS"
	case "C":
		return "CATCHERS"
	case "1B", "2B", "3B", "SS", "IF":
		return "INFIELD"
	case "LF", "CF", "RF", "OF":
		return "OUTFIELD"
	case "DH":
		return "DH"
	default:
		return "OTHER"
	}
}

func renderRosterGroup(title string, players []mlb.RosterPlayer, w, selID int) string {
	var b strings.Builder
	b.WriteString("  " + StyleAccent.Bold(true).Render(title) +
		StyleDim.Render(fmt.Sprintf("  (%d)", len(players))) + "\n")
	for _, p := range players {
		pos := lipgloss.NewStyle().Foreground(positionColor(p.Position.Abbreviation)).
			Render(fmt.Sprintf("%-3s", p.Position.Abbreviation))
		nameTxt := truncate(p.Person.FullName, w-10)
		if p.Person.ID == selID {
			num := StyleAccent.Render(fmt.Sprintf("%2s", p.JerseyNumber))
			b.WriteString(StyleAccent.Bold(true).Render("▸ ") + num + " " + pos + " " +
				StyleAccent.Bold(true).Render(nameTxt) + "\n")
		} else {
			num := StyleDim.Render(fmt.Sprintf("%2s", p.JerseyNumber))
			b.WriteString("  " + num + " " + pos + " " + StyleItemNormal.Render(nameTxt) + "\n")
		}
	}
	return lipgloss.NewStyle().Width(w).Render(strings.TrimRight(b.String(), "\n"))
}

// renderRoster groups players by position, pitchers in the left column and
// position players stacked in the right column.
func (m TeamModel) renderRoster() string {
	if len(m.roster) == 0 {
		return StyleDim.Render("  No roster data.")
	}
	groups := map[string][]mlb.RosterPlayer{}
	for _, p := range m.roster {
		cat := positionCategory(p.Position.Abbreviation)
		groups[cat] = append(groups[cat], p)
	}

	colW := 26
	if m.width > 0 {
		colW = (m.width - 6) / 2
		if colW < 20 {
			colW = 20
		}
		if colW > 34 {
			colW = 34
		}
	}

	selID := 0
	if m.rosterCursor < len(m.rosterOrder) {
		selID = m.rosterOrder[m.rosterCursor].Person.ID
	}

	left := renderRosterGroup("PITCHERS", groups["PITCHERS"], colW, selID)

	var rightParts []string
	for _, g := range []string{"CATCHERS", "INFIELD", "OUTFIELD", "DH", "OTHER"} {
		if len(groups[g]) > 0 {
			rightParts = append(rightParts, renderRosterGroup(g, groups[g], colW, selID))
		}
	}
	right := strings.Join(rightParts, "\n\n")

	return lipgloss.JoinHorizontal(lipgloss.Top, left, "   ", right)
}

func (m TeamModel) renderHitting() string {
	s := m.hitting
	if s == nil {
		return StyleDim.Render("No hitting stats available.")
	}
	season := fmt.Sprintf("%d", time.Now().Year())

	hdr := StyleHeader.Render(fmt.Sprintf(
		"  %-4s %-5s %-5s %-5s %-4s %-4s %-4s %-4s %-4s %-6s %-6s %-6s %-6s",
		"G", "AB", "R", "H", "2B", "3B", "HR", "RBI", "SB", "AVG", "OBP", "SLG", "OPS"))
	sep := StyleDim.Render(strings.Repeat("─", 78))
	row := fmt.Sprintf(
		"  %-4d %-5d %-5d %-5d %-4d %-4d %-4d %-4d %-4d %-6s %-6s %-6s %-6s",
		statInt(s, "gamesPlayed"),
		statInt(s, "atBats"),
		statInt(s, "runs"),
		statInt(s, "hits"),
		statInt(s, "doubles"),
		statInt(s, "triples"),
		statInt(s, "homeRuns"),
		statInt(s, "rbi"),
		statInt(s, "stolenBases"),
		statStr(s, "avg"),
		statStr(s, "obp"),
		statStr(s, "slg"),
		statStr(s, "ops"),
	)

	cards := statCards([][2]string{
		{"AVG", statStr(s, "avg")},
		{"HR", fmt.Sprintf("%d", statInt(s, "homeRuns"))},
		{"R", fmt.Sprintf("%d", statInt(s, "runs"))},
		{"RBI", fmt.Sprintf("%d", statInt(s, "rbi"))},
		{"OPS", statStr(s, "ops")},
		{"SB", fmt.Sprintf("%d", statInt(s, "stolenBases"))},
	}, 11)

	title := StyleDim.Render("  Season Hitting — " + season)
	return title + "\n\n" + cards + "\n\n" + hdr + "\n" + sep + "\n" + row + "\n\n" +
		StyleDim.Render(fmt.Sprintf("  K: %d   BB: %d",
			statInt(s, "strikeOuts"), statInt(s, "baseOnBalls")))
}

func (m TeamModel) renderPitching() string {
	s := m.pitching
	if s == nil {
		return StyleDim.Render("No pitching stats available.")
	}
	season := fmt.Sprintf("%d", time.Now().Year())

	hdr := StyleHeader.Render(fmt.Sprintf(
		"  %-4s %-4s %-6s %-4s %-7s %-5s %-5s %-5s %-5s %-5s %-4s %-6s",
		"W", "L", "ERA", "G", "IP", "H", "R", "ER", "BB", "K", "SV", "WHIP"))
	sep := StyleDim.Render(strings.Repeat("─", 72))
	row := fmt.Sprintf(
		"  %-4d %-4d %-6s %-4d %-7s %-5d %-5d %-5d %-5d %-5d %-4d %-6s",
		statInt(s, "wins"),
		statInt(s, "losses"),
		statStr(s, "era"),
		statInt(s, "gamesPlayed"),
		statStr(s, "inningsPitched"),
		statInt(s, "hits"),
		statInt(s, "runs"),
		statInt(s, "earnedRuns"),
		statInt(s, "baseOnBalls"),
		statInt(s, "strikeOuts"),
		statInt(s, "saves"),
		statStr(s, "whip"),
	)

	cards := statCards([][2]string{
		{"ERA", statStr(s, "era")},
		{"W-L", fmt.Sprintf("%d-%d", statInt(s, "wins"), statInt(s, "losses"))},
		{"K", fmt.Sprintf("%d", statInt(s, "strikeOuts"))},
		{"SV", fmt.Sprintf("%d", statInt(s, "saves"))},
		{"WHIP", statStr(s, "whip")},
		{"IP", statStr(s, "inningsPitched")},
	}, 11)

	title := StyleDim.Render("  Season Pitching — " + season)
	return title + "\n\n" + cards + "\n\n" + hdr + "\n" + sep + "\n" + row
}

// renderTeamTransactions lists this team's season transactions, newest first,
// grouped by date — mirroring the global Transactions screen's styling.
func (m TeamModel) renderTeamTransactions() string {
	if !m.teamTxnsLoaded {
		return loadingView("Loading transactions…")
	}
	if len(m.teamTxns) == 0 {
		return StyleDim.Render("  No transactions this season.")
	}
	txns := make([]mlb.Transaction, len(m.teamTxns))
	copy(txns, m.teamTxns)
	for i, j := 0, len(txns)-1; i < j; i, j = i+1, j-1 {
		txns[i], txns[j] = txns[j], txns[i]
	}
	var lines []string
	lastDate := ""
	for _, t := range txns {
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
		lines = append(lines, "  "+pill+" "+truncate(desc, m.width-10))
	}
	if len(lines) > 28 {
		lines = lines[:28]
		lines = append(lines, "  "+StyleDim.Render("… more on the Transactions screen"))
	}
	return strings.Join(lines, "\n")
}

// renderTeamNews lists this team's latest ESPN headlines; the cursor row is
// highlighted and Enter opens the story in the in-app reader.
func (m TeamModel) renderTeamNews() string {
	if m.team == nil {
		return StyleDim.Render("  News not available for this team.")
	}
	if !m.teamNewsLoaded {
		return loadingView("Loading news…")
	}
	if _, ok := espnTeamID(m.team.ID); !ok {
		return StyleDim.Render("  News not available for this team.")
	}
	if len(m.teamNews) == 0 {
		return StyleDim.Render("  No news right now.")
	}
	var b strings.Builder
	for i, a := range m.teamNews {
		badge := lipgloss.NewStyle().Foreground(colorCyan).Render(fmt.Sprintf("%-7s", a.Type))
		when := ""
		if !a.Published.IsZero() {
			when = StyleDim.Render("  " + a.Published.Format("Jan 2"))
		}
		headline := truncate(a.Headline, m.width-16)
		if i == m.newsCursor {
			b.WriteString(StyleAccent.Bold(true).Render("▸ ") + badge + " " +
				StyleAccent.Bold(true).Render(headline) + when + "\n")
		} else {
			b.WriteString("  " + badge + " " + StyleItemNormal.Render(headline) + when + "\n")
		}
	}
	return strings.TrimRight(b.String(), "\n")
}

// gameLogResults reduces a team's schedule to final-game W/L results.
func gameLogResults(games []mlb.Game, teamID int) []GameResult {
	var out []GameResult
	for _, g := range games {
		if g.Status.AbstractGameState != "Final" {
			continue
		}
		home := g.Teams.Home.Team.ID == teamID
		me, opp := g.Teams.Away, g.Teams.Home
		if home {
			me, opp = g.Teams.Home, g.Teams.Away
		}
		out = append(out, GameResult{
			Win: me.IsWinner, For: me.Score, Against: opp.Score,
			OppAbbr: opp.Team.Abbreviation, Home: home,
		})
	}
	return out
}

// RenderGameLogStrip draws a W/L heat strip — one block per game (█ green for
// a win, red for a loss) revealed left-to-right as reveal goes 0→1 — followed
// by the running record and a recent-games list.
func RenderGameLogStrip(results []GameResult, reveal float64) string {
	if len(results) == 0 {
		return StyleDim.Render("  No game results yet.")
	}

	n := len(results)
	shown := int(reveal * float64(n))
	if shown > n {
		shown = n
	}

	winColor := lipgloss.Color("#22c55e")
	lossColor := lipgloss.Color("#ef4444")

	// Build the heat strip.
	var strip strings.Builder
	wins, losses := 0, 0
	for i := 0; i < shown; i++ {
		r := results[i]
		if r.Win {
			strip.WriteString(lipgloss.NewStyle().Foreground(winColor).Render("█"))
			wins++
		} else {
			strip.WriteString(lipgloss.NewStyle().Foreground(lossColor).Render("█"))
			losses++
		}
	}
	// Placeholder blocks for not-yet-revealed games.
	for i := shown; i < n; i++ {
		strip.WriteString(StyleDim.Render("░"))
	}

	record := StyleAccent.Bold(true).Render(fmt.Sprintf("  %d-%d", wins, losses))

	// Recent form: last up to 10 revealed games.
	recentStart := shown - 10
	if recentStart < 0 {
		recentStart = 0
	}
	var formBlocks strings.Builder
	for i := recentStart; i < shown; i++ {
		if i > recentStart {
			formBlocks.WriteString(" ")
		}
		if results[i].Win {
			formBlocks.WriteString(lipgloss.NewStyle().Foreground(winColor).Bold(true).Render("W"))
		} else {
			formBlocks.WriteString(lipgloss.NewStyle().Foreground(lossColor).Bold(true).Render("L"))
		}
	}
	recentLabel := StyleDim.Render("  Last 10: ") + formBlocks.String()

	// Recent games list (last up to 10 revealed).
	var gameLines strings.Builder
	gameLines.WriteString("\n\n" + StyleHeader.Render(fmt.Sprintf("  %-4s %-5s %-6s", "W/L", "OPP", "SCORE")) + "\n")
	gameLines.WriteString(StyleDim.Render("  "+strings.Repeat("─", 20)) + "\n")
	listStart := shown - 10
	if listStart < 0 {
		listStart = 0
	}
	for i := shown - 1; i >= listStart; i-- {
		r := results[i]
		wl := lipgloss.NewStyle().Foreground(lossColor).Render("L")
		if r.Win {
			wl = lipgloss.NewStyle().Foreground(winColor).Render("W")
		}
		loc := "@"
		if r.Home {
			loc = "vs"
		}
		score := fmt.Sprintf("%d-%d", r.For, r.Against)
		gameLines.WriteString(fmt.Sprintf("  %s    %s %-4s  %s\n", wl, loc, r.OppAbbr, StyleDim.Render(score)))
	}

	title := StyleAccent.Bold(true).Render("  GAME LOG")
	return title + "\n\n" +
		"  " + strip.String() + "\n" +
		record + recentLabel + "\n" +
		gameLines.String()
}

// groupByPosition buckets roster players by their position abbreviation.
func groupByPosition(roster []mlb.RosterPlayer) map[string][]mlb.RosterPlayer {
	g := map[string][]mlb.RosterPlayer{}
	for _, p := range roster {
		g[p.Position.Abbreviation] = append(g[p.Position.Abbreviation], p)
	}
	return g
}

// wrapJoin packs items into lines joined by sep, keeping each line within width
// columns. Always returns at least one (possibly empty) line.
func wrapJoin(items []string, sep string, width int) []string {
	var lines []string
	cur := ""
	for _, it := range items {
		switch {
		case cur == "":
			cur = it
		case len(cur)+len(sep)+len(it) > width:
			lines = append(lines, cur)
			cur = it
		default:
			cur += sep + it
		}
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	if len(lines) == 0 {
		lines = []string{""}
	}
	return lines
}

// styleNames re-styles a " · "-joined line: names in normal text, dots dimmed.
func styleNames(line string) string {
	parts := strings.Split(line, " · ")
	for i := range parts {
		parts[i] = StyleItemNormal.Render(parts[i])
	}
	return strings.Join(parts, StyleDim.Render(" · "))
}

// depthGroupBlock renders one depth row: a colored position label, then that
// position's players joined by " · " and wrapped to contentW, with continuation
// lines aligned under the first name.
func depthGroupBlock(pos string, players []mlb.RosterPlayer, contentW int) string {
	label := lipgloss.NewStyle().Bold(true).Foreground(positionColor(pos)).Render(fmt.Sprintf("%-3s", pos))
	indent := strings.Repeat(" ", 6) // 2 margin + 3 label + 1 space
	namesW := contentW - 4
	if namesW < 16 {
		namesW = 16
	}
	names := make([]string, 0, len(players))
	for _, p := range players {
		names = append(names, p.Person.FullName)
	}
	var b strings.Builder
	for i, ln := range wrapJoin(names, " · ", namesW) {
		if i == 0 {
			b.WriteString("  " + label + " " + styleNames(ln) + "\n")
		} else {
			b.WriteString(indent + styleNames(ln) + "\n")
		}
	}
	return b.String()
}

// RenderDepthChart renders team depth as a clean position-grouped table: each
// position lists every player at that spot, with pitchers split into SP/RP when
// the roster distinguishes them (otherwise a single P group). Rows cascade in
// top-to-bottom as reveal advances 0→1. Works at any width.
func RenderDepthChart(roster []mlb.RosterPlayer, width int, reveal float64) string {
	if len(roster) == 0 {
		return StyleDim.Render("  No roster data.")
	}
	g := groupByPosition(roster)

	contentW := width - 4
	if contentW > 60 {
		contentW = 60
	}
	if contentW < 24 {
		contentW = 24
	}

	type grp struct {
		pos     string
		players []mlb.RosterPlayer
	}

	// Standard fielding order first, then any non-standard positions the roster
	// reports, so no player is silently dropped.
	fielderOrder := []string{"C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"}
	known := map[string]bool{"P": true, "SP": true, "RP": true}
	for _, pos := range fielderOrder {
		known[pos] = true
	}
	var fielders []grp
	for _, pos := range fielderOrder {
		if len(g[pos]) > 0 {
			fielders = append(fielders, grp{pos, g[pos]})
		}
	}
	var extra []string
	for pos := range g {
		if !known[pos] && len(g[pos]) > 0 {
			extra = append(extra, pos)
		}
	}
	sort.Strings(extra)
	for _, pos := range extra {
		fielders = append(fielders, grp{pos, g[pos]})
	}

	// Pitchers: SP/RP when distinguished, otherwise a single P group.
	var pitchers []grp
	if len(g["SP"]) > 0 || len(g["RP"]) > 0 {
		if len(g["SP"]) > 0 {
			pitchers = append(pitchers, grp{"SP", g["SP"]})
		}
		if len(g["RP"]) > 0 {
			pitchers = append(pitchers, grp{"RP", g["RP"]})
		}
	} else if len(g["P"]) > 0 {
		pitchers = append(pitchers, grp{"P", g["P"]})
	}

	// Reveal cascade: rows appear top-to-bottom as reveal advances.
	total := len(fielders) + len(pitchers)
	if total < 1 {
		total = 1
	}
	shown := total
	if reveal < 1.0 {
		shown = int(reveal*float64(total)) + 1
	}

	rule := "  " + StyleDim.Render(strings.Repeat("─", contentW)) + "\n"
	var b strings.Builder
	b.WriteString(StyleAccent.Bold(true).Render("  DEPTH CHART") + "\n")

	idx := 0
	if len(fielders) > 0 {
		b.WriteString("\n  " + StyleHeader.Render("POSITION PLAYERS") + "\n" + rule)
		for _, gr := range fielders {
			if idx >= shown {
				break
			}
			b.WriteString(depthGroupBlock(gr.pos, gr.players, contentW))
			idx++
		}
	}
	if len(pitchers) > 0 && idx < shown {
		b.WriteString("\n  " + StyleHeader.Render("PITCHERS") + "\n" + rule)
		for _, gr := range pitchers {
			if idx >= shown {
				break
			}
			b.WriteString(depthGroupBlock(gr.pos, gr.players, contentW))
			idx++
		}
	}

	return b.String()
}
