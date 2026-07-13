package ui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/fav"
	"github.com/xavidop/diamond/cli/internal/mlb"
	"github.com/xavidop/diamond/cli/internal/savant"
)

type recentPlaysMsg struct {
	plays []mlb.PlayEvent
	meta  mlb.RecentMeta
}

type playerSearchResultMsg struct{ results []mlb.SearchResult }
type playerDetailMsg struct {
	player      *mlb.Player
	log         []mlb.StatSplit
	splits      []mlb.SplitLine
	expected     *mlb.ExpectedStats
	percentiles  savant.Result
	trail        []mlb.TrailRow
	sabermetrics map[string]interface{}
	projections  map[string]interface{}
	fielding     []mlb.FieldingLine
	zones        []mlb.ZoneMetric
}
type vsSearchMsg struct{ results []mlb.SearchResult }
type vsLoadedMsg struct{ splits []mlb.StatSplit }

type playerViewState int

const (
	playerStateSearch playerViewState = iota
	playerStateDetail
)

type PlayerModel struct {
	sport   mlb.Sport
	state   playerViewState
	search  SearchInput
	results []mlb.SearchResult
	cursor  int
	player  *mlb.Player
	gameLog []mlb.StatSplit
	splits  []mlb.SplitLine
	loading bool
	err     error
	client  *mlb.Client
	width   int

	fromDrill    bool // opened via drill (by id); Esc goes back, not to search
	detailID     int  // player id to load in Init when opened by id
	tab          int  // active detail tab index
	tabEnteredAt int  // animFrame when current tab was entered

	// Statcast (Overview tab)
	expected     *mlb.ExpectedStats
	percentiles  savant.Result
	trail        []mlb.TrailRow
	sabermetrics map[string]interface{}
	projections  map[string]interface{}
	fielding     []mlb.FieldingLine
	zones        []mlb.ZoneMetric

	// Vs tab sub-state
	vsSearch   SearchInput
	vsResults  []mlb.SearchResult
	vsCursor   int
	vsOpponent *mlb.SearchResult
	vsSplits   []mlb.StatSplit
	vsLoading  bool

	// Recent plays (Spray / Zone / Arsenal tabs)
	recentWindow       int // games window: 5/15/30, default 15
	recentPlays        []mlb.PlayEvent
	recentMeta         mlb.RecentMeta
	recentLoading      bool
	recentLoadedWindow int // window the current recentPlays were fetched for; 0=none
}

// playerTabs returns the ordered tab labels for the player detail view.
// Hitter:  Overview / Statcast / Splits / Years / Spray / Zone / Heat / Path / Vs
// Pitcher: Overview / Statcast / Splits / Years / Arsenal / Zone / Heat / Path / Vs
func playerTabs(isPitcher bool) []string {
	if isPitcher {
		return []string{"Overview", "Statcast", "Splits", "Years", "Arsenal", "Zone", "Heat", "Path", "Vs"}
	}
	return []string{"Overview", "Statcast", "Splits", "Years", "Spray", "Zone", "Heat", "Path", "Vs"}
}

// vsTabIdx returns the index of the "Vs" tab for the given role.
func vsTabIdx(isPitcher bool) int {
	tabs := playerTabs(isPitcher)
	for i, name := range tabs {
		if name == "Vs" {
			return i
		}
	}
	return len(tabs) - 1
}

// isAggTab reports whether the given tab name is an aggregated-plays tab
// (Spray, Zone, or Arsenal) that needs recentPlays loaded.
func isAggTab(name string) bool {
	return name == "Spray" || name == "Zone" || name == "Heat" || name == "Arsenal"
}

func NewPlayerModel(sport mlb.Sport, query ...string) PlayerModel {
	si := NewSearchInput("Search player…")
	if len(query) > 0 && query[0] != "" {
		si.SetValue(query[0])
	}
	return PlayerModel{
		sport:        sport,
		state:        playerStateSearch,
		search:       si,
		vsSearch:     NewSearchInput("Search opponent…"),
		client:       mlb.DefaultClient(),
		recentWindow: 15,
	}
}

// NewPlayerModelByID opens straight to a player's detail (used by drill-downs).
func NewPlayerModelByID(sport mlb.Sport, id int) PlayerModel {
	return PlayerModel{
		sport:        sport,
		state:        playerStateDetail,
		search:       NewSearchInput("Search player…"),
		vsSearch:     NewSearchInput("Search opponent…"),
		client:       mlb.DefaultClient(),
		loading:      true,
		fromDrill:    true,
		detailID:     id,
		recentWindow: 15,
	}
}

func (m PlayerModel) doSearch(query string) tea.Cmd {
	m.loading = true
	c := m.client
	return func() tea.Msg {
		results, err := c.Search(query)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return playerSearchResultMsg{results: results}
	}
}

func (m PlayerModel) doVsSearch(query string) tea.Cmd {
	c := m.client
	return func() tea.Msg {
		results, err := c.Search(query)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return vsSearchMsg{results: results}
	}
}

// filterVsOpponents keeps only opponents whose role makes a head-to-head
// matchup meaningful: pitchers when the subject is a hitter, batters when the
// subject is a pitcher. vsPlayer stats are one-sided (batter-vs-pitcher), so a
// hitter-vs-hitter or pitcher-vs-pitcher pairing always has no data.
func filterVsOpponents(results []mlb.SearchResult, subjectIsPitcher bool) []mlb.SearchResult {
	out := make([]mlb.SearchResult, 0, len(results))
	for _, r := range results {
		oppIsPitcher := r.PrimaryPosition.Code == "1"
		if subjectIsPitcher != oppIsPitcher {
			out = append(out, r)
		}
	}
	return out
}

func (m PlayerModel) loadVsMatchup(playerID, opponentID int, isPitcher bool) tea.Cmd {
	c := m.client
	group := "hitting"
	if isPitcher {
		group = "pitching"
	}
	return func() tea.Msg {
		splits, err := c.PersonVsPlayer(playerID, opponentID, group)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return vsLoadedMsg{splits: splits}
	}
}

// loadDetail fetches a player's bio, game log, and splits by id.
func (m PlayerModel) loadDetail(id int) tea.Cmd {
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
		// Statcast (best-effort — a failure here never blocks the player view).
		expected, _ := c.PlayerExpectedStats(id, group, season)
		pctKind := "batter"
		if group == "pitching" {
			pctKind = "pitcher"
		}
		percentiles := savant.Fetch(id, pctKind, time.Now().Year())
		trail, _ := c.PlayerTrail(id, group)
		saber, _ := c.PlayerSabermetrics(id, group, season)
		proj, _ := c.PlayerProjections(id, group)
		fielding, _ := c.PlayerFielding(id, season)
		zones, _ := c.PlayerHotColdZones(id, group, season)
		return playerDetailMsg{
			player: p, log: log, splits: splits,
			expected: expected, percentiles: percentiles, trail: trail,
			sabermetrics: saber, projections: proj, fielding: fielding, zones: zones,
		}
	}
}

func (m PlayerModel) Init() tea.Cmd {
	if m.state == playerStateDetail && m.detailID > 0 {
		return m.loadDetail(m.detailID)
	}
	if q := m.search.Value(); len(q) >= 2 {
		return m.doSearch(q)
	}
	return nil
}

// CapturesText reports whether the player search box is focused, or the Vs
// opponent search is active (no opponent chosen yet on the Vs tab).
func (m PlayerModel) CapturesText() bool {
	isPitcher := m.player != nil && m.player.PrimaryPosition.Code == "1"
	return m.state == playerStateSearch ||
		(m.state == playerStateDetail && m.tab == vsTabIdx(isPitcher) && m.vsOpponent == nil)
}

func (m PlayerModel) Update(msg tea.Msg) (PlayerModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case playerSearchResultMsg:
		m.loading = false
		m.results = msg.results
		m.cursor = 0
		return m, nil

	case playerDetailMsg:
		m.loading = false
		m.player = msg.player
		m.gameLog = msg.log
		m.splits = msg.splits
		m.expected = msg.expected
		m.percentiles = msg.percentiles
		m.trail = msg.trail
		m.sabermetrics = msg.sabermetrics
		m.projections = msg.projections
		m.fielding = msg.fielding
		m.zones = msg.zones
		return m, nil

	case vsSearchMsg:
		subjectIsPitcher := m.player != nil && m.player.PrimaryPosition.Code == "1"
		m.vsResults = filterVsOpponents(msg.results, subjectIsPitcher)
		m.vsCursor = 0
		return m, nil

	case vsLoadedMsg:
		m.vsLoading = false
		m.vsSplits = msg.splits
		return m, nil

	case ErrMsg:
		m.loading = false
		m.vsLoading = false
		m.err = msg.Err
		return m, nil

	case recentPlaysMsg:
		m.recentPlays = msg.plays
		m.recentMeta = msg.meta
		m.recentLoading = false
		m.recentLoadedWindow = m.recentWindow
		return m, nil

	case tea.KeyMsg:
		// Vs opponent search — active when on the Vs tab with no opponent chosen
		isPitcherForVs := m.player != nil && m.player.PrimaryPosition.Code == "1"
		if m.state == playerStateDetail && m.tab == vsTabIdx(isPitcherForVs) && m.vsOpponent == nil {
			isPitcher := isPitcherForVs
			switch msg.String() {
			case "tab":
				n := len(playerTabs(isPitcher))
				return m.switchTab((m.tab + 1) % n)
			case "shift+tab":
				n := len(playerTabs(isPitcher))
				return m.switchTab((m.tab - 1 + n) % n)
			case "esc":
				if m.vsSearch.Value() != "" || len(m.vsResults) > 0 {
					// Cancel Vs search: clear results and reset search input, stay on tab
					m.vsResults = nil
					m.vsCursor = 0
					m.vsSearch = NewSearchInput("Search opponent…")
					return m, nil
				}
				// Search already empty — fall through to normal back behavior
				if m.fromDrill {
					return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
				}
				m.state = playerStateSearch
				m.player = nil
				return m, nil
			case "up", "k":
				if m.vsCursor > 0 {
					m.vsCursor--
				}
				return m, nil
			case "down", "j":
				if m.vsCursor < len(m.vsResults)-1 {
					m.vsCursor++
				}
				return m, nil
			case "enter":
				if len(m.vsResults) > 0 && m.player != nil {
					opp := m.vsResults[m.vsCursor]
					m.vsOpponent = &opp
					m.vsLoading = true
					m.vsResults = nil
					return m, m.loadVsMatchup(m.player.ID, opp.ID, isPitcher)
				}
				return m, nil
			default:
				var cmd tea.Cmd
				m.vsSearch, cmd = m.vsSearch.Update(msg)
				query := m.vsSearch.Value()
				if len(query) >= 2 {
					return m, m.doVsSearch(query)
				}
				return m, cmd
			}
		}

		if m.state == playerStateSearch {
			switch msg.String() {
			case "up", "k":
				if m.cursor > 0 {
					m.cursor--
				}
			case "down", "j":
				if m.cursor < len(m.results)-1 {
					m.cursor++
				}
			case "enter":
				if len(m.results) > 0 {
					id := m.results[m.cursor].ID
					m.state = playerStateDetail
					m.loading = true
					return m, m.loadDetail(id)
				}
			case "esc":
				return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
			default:
				var cmd tea.Cmd
				m.search, cmd = m.search.Update(msg)
				query := m.search.Value()
				if len(query) >= 2 {
					return m, m.doSearch(query)
				}
				return m, cmd
			}
		} else {
			isPitcher := m.player != nil && m.player.PrimaryPosition.Code == "1"
			tabs := playerTabs(isPitcher)
			switch msg.String() {
			case "tab", "right", "l":
				return m.switchTab((m.tab + 1) % len(tabs))
			case "shift+tab", "left", "h":
				n := len(tabs)
				return m.switchTab((m.tab - 1 + n) % n)
			case "o", "/":
				// Re-pick the Vs opponent: drop the current matchup and reopen search.
				if m.tab == vsTabIdx(isPitcher) && m.vsOpponent != nil {
					m.vsOpponent = nil
					m.vsSplits = nil
					m.vsResults = nil
					m.vsCursor = 0
					m.vsLoading = false
					m.vsSearch = NewSearchInput("Search opponent…")
				}
				return m, nil
			case "w":
				if isAggTab(tabs[m.tab]) {
					switch m.recentWindow {
					case 5:
						m.recentWindow = 15
					case 15:
						m.recentWindow = 30
					default:
						m.recentWindow = 5
					}
					m.recentLoading = true
					return m, m.loadRecent()
				}
			case "f":
				if m.player != nil {
					fav.TogglePlayer(m.player.ID, m.player.FullName)
				}
			case "esc":
				if m.fromDrill {
					return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
				}
				m.state = playerStateSearch
				m.player = nil
			}
		}
	}
	return m, nil
}

// switchTab moves to tab index t, records the reveal frame, and triggers a
// recent-plays load if the new tab is an aggregated tab whose window isn't loaded.
func (m PlayerModel) switchTab(t int) (PlayerModel, tea.Cmd) {
	m.tab = t
	m.tabEnteredAt = animFrame
	isPitcher := m.player != nil && m.player.PrimaryPosition.Code == "1"
	if isAggTab(playerTabs(isPitcher)[m.tab]) && m.recentLoadedWindow != m.recentWindow {
		m.recentLoading = true
		return m, m.loadRecent()
	}
	return m, nil
}

// loadRecent triggers a concurrent fetch of recent plays for the current player/window.
func (m PlayerModel) loadRecent() tea.Cmd {
	if m.player == nil {
		return nil
	}
	c, id, win := m.client, m.player.ID, m.recentWindow
	role := "hitting"
	if m.player.PrimaryPosition.Code == "1" {
		role = "pitching"
	}
	return func() tea.Msg {
		plays, meta, err := c.PlayerRecentPlays(id, role, win)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return recentPlaysMsg{plays: plays, meta: meta}
	}
}

func (m PlayerModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("esc back")
	}

	if m.state == playerStateSearch {
		panelHdr := PanelHeader("PLAYERS", m.width)
		out := panelHdr + "\n\n" + m.search.View() + "\n\n"
		if m.loading {
			out += loadingView("Searching…")
		} else {
			for i, r := range m.results {
				if i == m.cursor {
					out += StyleItemSelected.Render(r.FullName) + "\n"
				} else {
					out += "   " + StyleItemNormal.Render(r.FullName) + "\n"
				}
			}
			if len(m.results) == 0 && m.search.Value() != "" {
				out += StyleDim.Render("No players found.")
			}
		}
		return out + "\n" + HelpBar("type to search", "↑/↓ navigate", "Enter select", "esc back")
	}

	if m.loading {
		return PanelHeader("PLAYERS", m.width) + "\n\n" + loadingView("Loading player…")
	}

	p := m.player
	if p == nil {
		return StyleDim.Render("No player selected.")
	}
	star := ""
	if fav.HasPlayer(p.ID) {
		star = StyleAccent.Render("★ ")
	}

	isPitcher := p.PrimaryPosition.Code == "1"
	tabs := playerTabs(isPitcher)
	tabBar := ""
	for i, name := range tabs {
		if i == m.tab {
			tabBar += StyleActiveTab.Render(name)
		} else {
			tabBar += StyleTab.Render(name)
		}
	}

	var body string
	tabName := tabs[m.tab]
	switch tabName {
	case "Overview":
		body = renderPlayerOverview(p, m.gameLog) + m.renderHonors()
	case "Statcast":
		body = strings.TrimLeft(
			m.renderStatcast()+m.renderSabermetrics()+m.renderZones()+
				m.renderFielding()+m.renderProjections(), "\n")
		if strings.TrimSpace(body) == "" {
			body = StyleDim.Render("  No Statcast data for this player.")
		}
	case "Path":
		body = strings.TrimLeft(m.renderTrail(), "\n")
		if strings.TrimSpace(body) == "" {
			body = StyleDim.Render("  No minor-league career path (MLB only).")
		}
	case "Splits":
		if s := renderSplits(m.splits, isPitcher); s != "" {
			body = StyleAccent.Bold(true).Render("  SPLITS") + "  " +
				StyleDim.Render(strings.Repeat("─", 52)) + "\n\n" + s
		} else {
			body = StyleDim.Render("  No splits.")
		}
	case "Years":
		body = renderPlayerYears(p, isPitcher, animProgress(m.tabEnteredAt, 14))
	case "Spray":
		if m.recentLoading {
			body = loadingView("Loading recent plays…")
		} else if len(m.recentPlays) == 0 {
			body = StyleDim.Render("  No recent plays in this window.")
		} else {
			body = RenderSprayChart(m.recentPlays, animProgress(m.tabEnteredAt, 16))
			body += "\n\n  " + StyleDim.Render(fmt.Sprintf("last %d games · %d fetched", m.recentMeta.GamesRequested, m.recentMeta.GamesFetched))
		}
	case "Zone":
		if m.recentLoading {
			body = loadingView("Loading recent plays…")
		} else {
			body = RenderPitchScatter(m.recentPlays, animProgress(m.tabEnteredAt, 16))
		}
	case "Heat":
		if m.recentLoading {
			body = loadingView("Loading recent plays…")
		} else {
			body = RenderPitchZone(m.recentPlays)
		}
	case "Arsenal":
		if m.recentLoading {
			body = loadingView("Loading recent plays…")
		} else {
			ars := mlb.AggregateArsenal(m.recentPlays, p.ID)
			body = renderArsenal(ars, animProgress(m.tabEnteredAt, 16))
			if radar := renderArsenalRadar(ars, animProgress(m.tabEnteredAt, 18)); radar != "" {
				body += "\n\n" + radar
			}
		}
	case "Vs":
		if m.vsOpponent == nil {
			// Show opponent search
			var sb strings.Builder
			sb.WriteString(StyleAccent.Bold(true).Render("  VS PLAYER") + "  " +
				StyleDim.Render(strings.Repeat("─", 51)) + "\n\n")
			sb.WriteString("  " + m.vsSearch.View() + "\n\n")
			if len(m.vsResults) > 0 {
				for i, r := range m.vsResults {
					if i == m.vsCursor {
						sb.WriteString(StyleItemSelected.Render(r.FullName) + "\n")
					} else {
						sb.WriteString("   " + StyleItemNormal.Render(r.FullName) + "\n")
					}
				}
			} else if m.vsSearch.Value() != "" {
				want := "pitchers"
				if isPitcher {
					want = "batters"
				}
				sb.WriteString(StyleDim.Render("  No " + want + " found."))
			} else {
				want := "a pitcher"
				if isPitcher {
					want = "a batter"
				}
				sb.WriteString(StyleDim.Render("  Type to search for " + want + " to face…"))
			}
			body = sb.String()
		} else if m.vsLoading {
			body = loadingView("Loading matchup…")
		} else {
			body = renderVsMatchup(m.vsSplits, p.FullName, m.vsOpponent.FullName, isPitcher, animProgress(m.tabEnteredAt, 14))
		}
	}

	helpExtras := []string{"Tab/⇧Tab view", "f favorite", "esc back"}
	if isAggTab(tabName) {
		helpExtras = append([]string{fmt.Sprintf("w window(%d)", m.recentWindow)}, helpExtras...)
	}
	if tabName == "Vs" && m.vsOpponent != nil {
		helpExtras = append([]string{"o re-pick"}, helpExtras...)
	}
	return PanelHeader("PLAYERS", m.width) + "\n" + star + tabBar + "\n\n" + body + "\n" + HelpBar(helpExtras...)
}

// renderPlayerOverview renders the name / bio / season-card / recent-games
// block (no splits, no panel header, no help bar). Used by the Overview tab
// renderStatcast renders the Overview-tab Statcast block: expected stats
// (official) plus Baseball Savant percentile bars (best-effort — absent when
// the player has no Statcast data or Savant is unavailable).
func (m PlayerModel) renderStatcast() string {
	var b strings.Builder
	if m.expected != nil {
		b.WriteString("\n\n  " + StyleAccent.Bold(true).Render("STATCAST — EXPECTED") + "  " +
			StyleDim.Render(strings.Repeat("─", 34)) + "\n")
		b.WriteString(fmt.Sprintf("  xBA %s   xSLG %s   xwOBA %s   xwOBACON %s\n",
			m.expected.XBA, m.expected.XSLG, m.expected.XwOBA, m.expected.XwOBACON))
	}
	if m.percentiles.OK && len(m.percentiles.Percentiles) > 0 {
		b.WriteString("\n  " + StyleAccent.Bold(true).Render("STATCAST — PERCENTILES") + "  " +
			StyleDim.Render(strings.Repeat("─", 31)) + "\n")
		for _, p := range m.percentiles.Percentiles {
			b.WriteString(fmt.Sprintf("  %-13s %s %3d\n", p.Label, percentileBar(p.Value), p.Value))
		}
	}
	return b.String()
}

// percentileBar renders a colored 0-100 percentile bar (red low → blue high).
func percentileBar(v int) string {
	const width = 20
	if v < 0 {
		v = 0
	}
	if v > 100 {
		v = 100
	}
	filled := v * width / 100
	col := lipgloss.Color("#cf1019")
	switch {
	case v >= 75:
		col = lipgloss.Color("#325aa8")
	case v >= 50:
		col = lipgloss.Color("#5a9e5a")
	case v >= 25:
		col = lipgloss.Color("#c9a227")
	}
	bar := strings.Repeat("█", filled) + strings.Repeat("░", width-filled)
	return lipgloss.NewStyle().Foreground(col).Render(bar)
}

// renderHonors renders major awards + schools on the Overview tab.
func (m PlayerModel) renderHonors() string {
	if m.player == nil {
		return ""
	}
	awards := mlb.FilterAwards(m.player.Awards, 10)
	var edu []string
	for _, c := range m.player.Education.Colleges {
		if c.Name != "" {
			edu = append(edu, c.Name)
		}
	}
	for _, h := range m.player.Education.Highschools {
		if h.Name != "" {
			edu = append(edu, h.Name)
		}
	}
	if len(awards) == 0 && len(edu) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n\n  " + StyleAccent.Bold(true).Render("HONORS") + "\n")
	for _, a := range awards {
		yr := ""
		if len(a.Season) >= 4 {
			yr = " " + StyleDim.Render("'"+a.Season[2:4])
		}
		b.WriteString("  • " + a.Name + yr + "\n")
	}
	if len(edu) > 0 {
		b.WriteString(StyleDim.Render("  School: ") + strings.Join(edu, " · ") + "\n")
	}
	return b.String()
}

// renderSabermetrics renders WAR/wRC+ (hitters) or WAR/FIP/xFIP (pitchers).
func (m PlayerModel) renderSabermetrics() string {
	if m.sabermetrics == nil {
		return ""
	}
	isPitcher := m.player != nil && m.player.PrimaryPosition.Code == "1"
	var b strings.Builder
	b.WriteString("\n\n  " + StyleAccent.Bold(true).Render("SABERMETRICS") + "\n")
	if isPitcher {
		b.WriteString(fmt.Sprintf("  WAR %s   FIP %s   xFIP %s   RA9-WAR %s\n",
			trailStr(m.sabermetrics, "war"), trailStr(m.sabermetrics, "fip"),
			trailStr(m.sabermetrics, "xfip"), trailStr(m.sabermetrics, "ra9War")))
	} else {
		b.WriteString(fmt.Sprintf("  WAR %s   wRC+ %s   wRAA %s   wOBA %s\n",
			trailStr(m.sabermetrics, "war"), trailStr(m.sabermetrics, "wRcPlus"),
			trailStr(m.sabermetrics, "wRaa"), trailStr(m.sabermetrics, "woba")))
	}
	return b.String()
}

// renderProjections renders the ZiPS rest-of-season projection line.
func (m PlayerModel) renderProjections() string {
	if m.projections == nil {
		return ""
	}
	isPitcher := m.player != nil && m.player.PrimaryPosition.Code == "1"
	var b strings.Builder
	b.WriteString("\n  " + StyleAccent.Bold(true).Render("PROJECTED (ROS)") + "  " +
		StyleDim.Render("ZiPS") + "\n")
	if isPitcher {
		b.WriteString(fmt.Sprintf("  W %s   ERA %s   IP %s   SO %s   WHIP %s\n",
			trailStr(m.projections, "wins"), trailStr(m.projections, "era"),
			trailStr(m.projections, "inningsPitched"), trailStr(m.projections, "strikeOuts"),
			trailStr(m.projections, "whip")))
	} else {
		b.WriteString(fmt.Sprintf("  HR %s   R %s   AVG %s   OBP %s   SLG %s   OPS %s\n",
			trailStr(m.projections, "homeRuns"), trailStr(m.projections, "runs"),
			trailStr(m.projections, "avg"), trailStr(m.projections, "obp"),
			trailStr(m.projections, "slg"), trailStr(m.projections, "ops")))
	}
	return b.String()
}

// renderFielding renders a by-position fielding table.
func (m PlayerModel) renderFielding() string {
	if len(m.fielding) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n  " + StyleAccent.Bold(true).Render("FIELDING") + "\n")
	b.WriteString(StyleHeader.Render(fmt.Sprintf("  %-4s %-4s %-6s %-4s %-4s %-4s %-4s",
		"POS", "G", "FPCT", "PO", "A", "E", "DP")) + "\n")
	for _, f := range m.fielding {
		b.WriteString(fmt.Sprintf("  %-4s %-4d %-6s %-4d %-4d %-4d %-4d\n",
			f.Pos, f.G, f.FPct, f.PO, f.A, f.E, f.DP))
	}
	return b.String()
}

// renderZones renders a 3×3 hot/cold strike-zone heat map (catcher's view) for
// the batting-average metric (or the first available), colored by temperature.
func (m PlayerModel) renderZones() string {
	if len(m.zones) == 0 {
		return ""
	}
	metric := m.zones[0]
	for _, z := range m.zones {
		if z.Name == "battingAverage" {
			metric = z
			break
		}
	}
	inner, _ := mlb.ZoneGrid(metric.Zones)
	var b strings.Builder
	b.WriteString("\n  " + StyleAccent.Bold(true).Render("HOT / COLD ZONES") + "  " +
		StyleDim.Render(zoneMetricLabel(metric.Name)) + "\n")
	for row := 0; row < 3; row++ {
		b.WriteString("  ")
		for col := 0; col < 3; col++ {
			z := inner[row*3+col]
			if z == nil {
				b.WriteString(StyleDim.Render("  --  "))
				continue
			}
			cell := fmt.Sprintf(" %-5s", z.Value)
			b.WriteString(lipgloss.NewStyle().
				Background(zoneTempColor(z.Temp)).
				Foreground(lipgloss.Color("#000")).Render(cell))
		}
		b.WriteString("\n")
	}
	b.WriteString(StyleDim.Render("  catcher's view · red hot / blue cold") + "\n")
	return b.String()
}

func zoneMetricLabel(name string) string {
	switch name {
	case "battingAverage":
		return "AVG"
	case "onBasePercentage":
		return "OBP"
	case "sluggingPercentage":
		return "SLG"
	case "onBasePlusSlugging":
		return "OPS"
	case "exitVelocity":
		return "Exit Velo"
	}
	return name
}

func zoneTempColor(temp string) lipgloss.Color {
	switch temp {
	case "hot":
		return lipgloss.Color("#e0392b")
	case "warm":
		return lipgloss.Color("#e8804a")
	case "cool":
		return lipgloss.Color("#5aa9e0")
	case "cold":
		return lipgloss.Color("#3a6fd8")
	default:
		return lipgloss.Color("#8a8a8a")
	}
}

// renderTrail renders the Overview-tab "Career Path" — a player's climb across
// levels (Rookie→MLB). Shown only when the player has minor-league rows;
// MLB-only players are already covered by the Years tab.
func (m PlayerModel) renderTrail() string {
	if !mlb.HasMinors(m.trail) {
		return ""
	}
	isPitcher := m.player != nil && m.player.PrimaryPosition.Code == "1"
	var b strings.Builder
	b.WriteString("\n\n  " + StyleAccent.Bold(true).Render("CAREER PATH") + "  " +
		StyleDim.Render("Rookie → MLB") + "\n")
	if isPitcher {
		b.WriteString(StyleHeader.Render(fmt.Sprintf("  %-6s %-7s %-20s %-4s %-6s %-5s %-6s",
			"SEASON", "LEVEL", "TEAM", "G", "ERA", "SO", "WHIP")) + "\n")
	} else {
		b.WriteString(StyleHeader.Render(fmt.Sprintf("  %-6s %-7s %-20s %-4s %-6s %-4s %-6s",
			"SEASON", "LEVEL", "TEAM", "G", "AVG", "HR", "OPS")) + "\n")
	}
	for _, r := range m.trail {
		team := truncate(r.Team, 20)
		if isPitcher {
			b.WriteString(fmt.Sprintf("  %-6s %-7s %-20s %-4s %-6s %-5s %-6s\n",
				r.Season, r.Level, team,
				trailStr(r.Stat, "gamesPlayed"), trailStr(r.Stat, "era"),
				trailStr(r.Stat, "strikeOuts"), trailStr(r.Stat, "whip")))
		} else {
			b.WriteString(fmt.Sprintf("  %-6s %-7s %-20s %-4s %-6s %-4s %-6s\n",
				r.Season, r.Level, team,
				trailStr(r.Stat, "gamesPlayed"), trailStr(r.Stat, "avg"),
				trailStr(r.Stat, "homeRuns"), trailStr(r.Stat, "ops")))
		}
	}
	return b.String()
}

// trailStr coerces a stat value (JSON string or number) to a display string.
func trailStr(s map[string]interface{}, key string) string {
	v, ok := s[key]
	if !ok {
		return "—"
	}
	switch x := v.(type) {
	case string:
		return x
	case float64:
		if x == float64(int64(x)) {
			return fmt.Sprintf("%d", int64(x))
		}
		return fmt.Sprintf("%.3f", x)
	}
	return "—"
}

// renderPlayerOverview renders the name / bio / season-card / recent-games
// block (no splits, no panel header, no help bar). Used by the Overview tab
// and by renderPlayerBody for the team roster drill-down.
func renderPlayerOverview(p *mlb.Player, gameLog []mlb.StatSplit) string {
	ts, te := headerColors()
	posAb := p.PrimaryPosition.Abbreviation

	nameLine := gradientText(p.FullName, ts, te)
	if posAb != "" {
		nameLine += "  " + lipgloss.NewStyle().Bold(true).Foreground(positionColor(posAb)).Render(posAb)
	}
	num := ""
	if p.PrimaryNumber != "" {
		num = "#" + p.PrimaryNumber + " · "
	}
	bioLine := fmt.Sprintf("%s%s · B/T %s/%s · %s, %dlb",
		num, p.PrimaryPosition.Name, p.BatSide.Code, p.PitchHand.Code, p.Height, p.Weight)
	birthLine := fmt.Sprintf("%s, %s", p.BirthCity, p.BirthCountry)
	if p.CurrentTeam.Name != "" {
		birthLine += " · " + p.CurrentTeam.Name
	}

	isPitcher := p.PrimaryPosition.Code == "1"
	group := "hitting"
	if isPitcher {
		group = "pitching"
	}
	s := seasonStat(p, group)

	var sb strings.Builder
	sb.WriteString(nameLine + "\n")
	sb.WriteString(StyleDim.Render(bioLine) + "\n")
	sb.WriteString(StyleDim.Render(birthLine) + "\n\n")

	if s != nil {
		sb.WriteString(StyleAccent.Bold(true).Render("  SEASON") + "  " +
			StyleDim.Render(strings.Repeat("─", 56)) + "\n\n")
		var cards [][2]string
		if isPitcher {
			cards = [][2]string{
				{"ERA", statVal(s, "era")}, {"W-L", statVal(s, "wins") + "-" + statVal(s, "losses")},
				{"K", statVal(s, "strikeOuts")}, {"SV", statVal(s, "saves")},
				{"WHIP", statVal(s, "whip")}, {"IP", statVal(s, "inningsPitched")},
			}
		} else {
			cards = [][2]string{
				{"AVG", statVal(s, "avg")}, {"HR", statVal(s, "homeRuns")}, {"RBI", statVal(s, "rbi")},
				{"OPS", statVal(s, "ops")}, {"R", statVal(s, "runs")}, {"SB", statVal(s, "stolenBases")},
			}
		}
		sb.WriteString(statCards(cards, 11) + "\n\n")
	}

	// Rolling form: 10-game rolling ERA (pitchers) / AVG (hitters).
	if len(gameLog) >= 2 {
		series := rollingSeries(gameLog, isPitcher, 10)
		label := "ROLLING 10-GAME AVG"
		fmtCur := func(v float64) string { return strings.TrimPrefix(fmt.Sprintf("%.3f", v), "0") }
		if isPitcher {
			label = "ROLLING 10-GAME ERA"
			fmtCur = func(v float64) string { return fmt.Sprintf("%.2f", v) }
		}
		if area := renderArea(series, 5, colorGold, 1, fmtCur); area != "" {
			cur := series[len(series)-1]
			var lo, hi float64 = series[0], series[0]
			for _, v := range series {
				if v < lo {
					lo = v
				}
				if v > hi {
					hi = v
				}
			}
			sb.WriteString(StyleAccent.Bold(true).Render("  "+label) + "  " +
				StyleDim.Render("now ") + StyleHeader.Render(fmtCur(cur)) + "  " +
				StyleDim.Render(fmt.Sprintf("· peak %s · low %s", fmtCur(hi), fmtCur(lo))) + "\n\n")
			sb.WriteString(area + "\n\n")
		}
	}

	if len(gameLog) > 0 {
		sb.WriteString(StyleAccent.Bold(true).Render("  RECENT GAMES") + "  " +
			StyleDim.Render(strings.Repeat("─", 48)) + "\n\n")
		shown := gameLog
		if len(shown) > 8 {
			shown = shown[len(shown)-8:]
		}
		if isPitcher {
			sb.WriteString(StyleHeader.Render(fmt.Sprintf("  %-6s %-13s %5s %3s %3s %3s %3s", "DATE", "OPP", "IP", "H", "ER", "BB", "K")) + "\n")
			for _, sp := range shown {
				sb.WriteString(fmt.Sprintf("  %-6s %s %5s %3s %3s %3s %3s\n",
					logDate(sp), logOpp(sp), statVal(sp.Stat, "inningsPitched"), statVal(sp.Stat, "hits"),
					statVal(sp.Stat, "earnedRuns"), statVal(sp.Stat, "baseOnBalls"), statVal(sp.Stat, "strikeOuts")))
			}
		} else {
			sb.WriteString(StyleHeader.Render(fmt.Sprintf("  %-6s %-13s %3s %3s %3s %3s %3s %6s", "DATE", "OPP", "AB", "R", "H", "HR", "RBI", "AVG")) + "\n")
			for _, sp := range shown {
				sb.WriteString(fmt.Sprintf("  %-6s %s %3s %3s %3s %3s %3s %6s\n",
					logDate(sp), logOpp(sp), statVal(sp.Stat, "atBats"), statVal(sp.Stat, "runs"), statVal(sp.Stat, "hits"),
					statVal(sp.Stat, "homeRuns"), statVal(sp.Stat, "rbi"), statVal(sp.Stat, "avg")))
			}
		}
	}

	return strings.TrimRight(sb.String(), "\n")
}

// renderPlayerBody renders the name / bio / season-card / game-log / splits
// block (no panel header or help bar) so the team roster drill-down can reuse it.
func renderPlayerBody(p *mlb.Player, gameLog []mlb.StatSplit, splits []mlb.SplitLine) string {
	body := renderPlayerOverview(p, gameLog)
	if s := renderSplits(splits, p.PrimaryPosition.Code == "1"); s != "" {
		body += "\n\n" + StyleAccent.Bold(true).Render("  SPLITS") + "  " +
			StyleDim.Render(strings.Repeat("─", 52)) + "\n\n" + s
	}
	return strings.TrimRight(body, "\n")
}

var splitOrder = []struct{ code, label string }{
	{"vl", "vs LHP"}, {"vr", "vs RHP"}, {"h", "Home"}, {"a", "Away"},
	{"d", "Day"}, {"n", "Night"}, {"g", "Grass"}, {"t", "Turf"},
	{"risp", "RISP"}, {"loaded", "Loaded"},
}

// renderSplits renders a compact situational-splits table.
func renderSplits(splits []mlb.SplitLine, isPitcher bool) string {
	if len(splits) == 0 {
		return ""
	}
	byCode := map[string]mlb.SplitLine{}
	for _, s := range splits {
		byCode[s.Split.Code] = s
	}

	var sb strings.Builder
	if isPitcher {
		sb.WriteString(StyleHeader.Render(fmt.Sprintf("  %-8s %6s %6s %5s %6s", "SPLIT", "ERA", "WHIP", "K", "IP")) + "\n")
	} else {
		sb.WriteString(StyleHeader.Render(fmt.Sprintf("  %-8s %6s %6s %5s %5s", "SPLIT", "AVG", "OPS", "HR", "AB")) + "\n")
	}
	for _, o := range splitOrder {
		s, ok := byCode[o.code]
		if !ok {
			continue
		}
		lab := StyleAccent.Render(fmt.Sprintf("%-8s", o.label)) // pad before styling for alignment
		if isPitcher {
			sb.WriteString("  " + lab + fmt.Sprintf(" %6s %6s %5s %6s\n",
				statVal(s.Stat, "era"), statVal(s.Stat, "whip"), statVal(s.Stat, "strikeOuts"), statVal(s.Stat, "inningsPitched")))
		} else {
			sb.WriteString("  " + lab + fmt.Sprintf(" %6s %6s %5s %5s\n",
				statVal(s.Stat, "avg"), statVal(s.Stat, "ops"), statVal(s.Stat, "homeRuns"), statVal(s.Stat, "atBats")))
		}
	}
	return sb.String()
}

// logDate renders a game-log split's date as MM/DD.
func logDate(sp mlb.StatSplit) string {
	if len(sp.Date) == 10 {
		return sp.Date[5:7] + "/" + sp.Date[8:10]
	}
	if sp.Date != "" {
		return sp.Date
	}
	return sp.Season
}

// logOpp renders the opponent column ("vs NYY" / "@  BOS") padded to width 13.
func logOpp(sp mlb.StatSplit) string {
	prefix := "vs"
	if !sp.IsHome {
		prefix = "@ "
	}
	return fmt.Sprintf("%-13s", prefix+" "+truncate(sp.Opponent.Name, 10))
}

// seasonStat returns the season-level stat map for the given group, falling
// back to any season split if the exact group is absent.
func seasonStat(p *mlb.Player, group string) map[string]interface{} {
	for _, sg := range p.Stats {
		if sg.Type.DisplayName == "season" && sg.Group.DisplayName == group && len(sg.Splits) > 0 {
			return sg.Splits[0].Stat
		}
	}
	for _, sg := range p.Stats {
		if sg.Type.DisplayName == "season" && len(sg.Splits) > 0 {
			return sg.Splits[0].Stat
		}
	}
	return nil
}

func statVal(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok {
		return "—"
	}
	return strings.TrimSpace(fmt.Sprintf("%v", v))
}

// YearLine is one season's stat line from a player's year-by-year stats.
type YearLine struct {
	Season string
	Team   string
	Stat   map[string]interface{}
}

// ParseYearByYear extracts per-season stat lines for the given group
// ("hitting"/"pitching") from a player's hydrated yearByYear stats.
func ParseYearByYear(p *mlb.Player, group string) []YearLine {
	var out []YearLine
	for _, sg := range p.Stats {
		if sg.Type.DisplayName != "yearByYear" || sg.Group.DisplayName != group {
			continue
		}
		for _, sp := range sg.Splits {
			out = append(out, YearLine{Season: sp.Season, Team: sp.Team.Name, Stat: sp.Stat})
		}
	}
	return out
}

// renderPlayerYears renders the year-by-year / career tab for the player detail view.
func renderPlayerYears(p *mlb.Player, isPitcher bool, reveal float64) string {
	group := "hitting"
	if isPitcher {
		group = "pitching"
	}
	seasons := ParseYearByYear(p, group)
	if len(seasons) == 0 {
		return StyleDim.Render("  No year-by-year data.")
	}

	// Determine headline stat key and find max for bar scaling.
	headlineKey := "homeRuns"
	if isPitcher {
		headlineKey = "strikeOuts"
	}
	var maxVal float64
	for _, y := range seasons {
		if v := statFloat(y.Stat, headlineKey); v > maxVal {
			maxVal = v
		}
	}

	const barW = 12

	var sb strings.Builder
	// Section header.
	sb.WriteString(StyleAccent.Bold(true).Render("  YEAR-BY-YEAR") + "  " +
		StyleDim.Render(strings.Repeat("─", 48)) + "\n\n")

	// Trend line above the table: AVG (hitters) / ERA (pitchers) across seasons.
	{
		trendKey, trendLabel := "avg", "AVG"
		fmtY := func(v float64) string { return strings.TrimPrefix(fmt.Sprintf("%.3f", v), "0") }
		if isPitcher {
			trendKey, trendLabel = "era", "ERA"
			fmtY = func(v float64) string { return fmt.Sprintf("%.2f", v) }
		}
		series := make([]float64, len(seasons))
		labels := make([]string, len(seasons))
		for i, y := range seasons {
			series[i] = statFloat(y.Stat, trendKey)
			labels[i] = y.Season
		}
		if chart := renderLineChart(series, labels, fmtY, colorGold, reveal); chart != "" {
			sb.WriteString(StyleDim.Render("  "+trendLabel+" by season") + "\n" + chart + "\n\n")
		}
	}

	// Column headers.
	if isPitcher {
		sb.WriteString(StyleHeader.Render(fmt.Sprintf("  %-4s %-18s %4s %7s %5s %4s %5s", "YEAR", "TEAM", "G", "W-L", "ERA", "K", "WHIP")) + "\n")
	} else {
		sb.WriteString(StyleHeader.Render(fmt.Sprintf("  %-4s %-18s %4s %5s %4s %4s %5s", "YEAR", "TEAM", "G", "AVG", "HR", "RBI", "OPS")) + "\n")
	}

	// Per-season rows with staggered animated bar.
	// Bounded-stagger: at reveal==1.0 every row reaches rowReveal==1.0.
	const staggerSpan = 0.6
	staggerWindow := 1.0 - staggerSpan
	staggerDenom := float64(len(seasons) - 1)
	if staggerDenom < 1 {
		staggerDenom = 1
	}
	for i, y := range seasons {
		offset := staggerSpan * float64(i) / staggerDenom
		rowReveal := (reveal - offset) / staggerWindow
		if rowReveal < 0 {
			rowReveal = 0
		}
		if rowReveal > 1 {
			rowReveal = 1
		}

		var frac float64
		if maxVal > 0 {
			frac = statFloat(y.Stat, headlineKey) / maxVal
		}
		bar := RenderBar(frac*rowReveal, barW, colorBlue)

		year := fmt.Sprintf("%-4s", y.Season)
		team := fmt.Sprintf("%-18s", truncate(y.Team, 18))

		if isPitcher {
			wl := statVal(y.Stat, "wins") + "-" + statVal(y.Stat, "losses")
			line := fmt.Sprintf("  %s %s %4s %7s %5s %4s %5s",
				year, team,
				statVal(y.Stat, "gamesPlayed"),
				wl,
				statVal(y.Stat, "era"),
				statVal(y.Stat, "strikeOuts"),
				statVal(y.Stat, "whip"),
			)
			sb.WriteString(line + "  " + bar + "\n")
		} else {
			line := fmt.Sprintf("  %s %s %4s %5s %4s %4s %5s",
				year, team,
				statVal(y.Stat, "gamesPlayed"),
				statVal(y.Stat, "avg"),
				statVal(y.Stat, "homeRuns"),
				statVal(y.Stat, "rbi"),
				statVal(y.Stat, "ops"),
			)
			sb.WriteString(line + "  " + bar + "\n")
		}
	}

	// Career line.
	if cs := careerStat(p, group); len(cs) > 0 {
		sb.WriteString("\n" + StyleDim.Render(strings.Repeat("─", 68)) + "\n")
		if isPitcher {
			wl := statVal(cs, "wins") + "-" + statVal(cs, "losses")
			line := fmt.Sprintf("  %-4s %-18s %4s %7s %5s %4s %5s",
				"CAR", "",
				statVal(cs, "gamesPlayed"),
				wl,
				statVal(cs, "era"),
				statVal(cs, "strikeOuts"),
				statVal(cs, "whip"),
			)
			sb.WriteString(StyleAccent.Bold(true).Render(line) + "\n")
		} else {
			line := fmt.Sprintf("  %-4s %-18s %4s %5s %4s %4s %5s",
				"CAR", "",
				statVal(cs, "gamesPlayed"),
				statVal(cs, "avg"),
				statVal(cs, "homeRuns"),
				statVal(cs, "rbi"),
				statVal(cs, "ops"),
			)
			sb.WriteString(StyleAccent.Bold(true).Render(line) + "\n")
		}
	}

	return strings.TrimRight(sb.String(), "\n")
}

// renderVsMatchup renders the head-to-head matchup between subject and opponent.
// isPitcher indicates the subject is a pitcher (so we show pitching stats).
// reveal animates the stat-card cascade (0→1).
// vsCount coerces a stat value (JSON number, int literal, or string) to an int.
func vsCount(m map[string]interface{}, key string) int {
	switch x := m[key].(type) {
	case float64:
		return int(x)
	case int:
		return x
	case string:
		return int(parseStatFloat(x))
	}
	return 0
}

// barSeg is one colored run of an outcome bar, sized by n cells.
type barSeg struct {
	n  int
	st lipgloss.Style
}

// segBar renders a width-cell bar split into colored segments proportional to
// each seg's n, revealed left-to-right by reveal (0→1). Unfilled cells are dim.
func segBar(width int, reveal float64, segs []barSeg) string {
	styles := make([]lipgloss.Style, width)
	for i := range styles {
		styles[i] = StyleDim
	}
	total := 0
	for _, s := range segs {
		total += s.n
	}
	if total > 0 {
		idx := 0
		for si, s := range segs {
			c := s.n * width / total
			if si == len(segs)-1 {
				c = width - idx
			}
			for k := 0; k < c && idx < width; k++ {
				styles[idx] = s.st
				idx++
			}
		}
	}
	shown := int(float64(width)*reveal + 0.5)
	var b strings.Builder
	for i := 0; i < width; i++ {
		if i < shown {
			b.WriteString(styles[i].Render("█"))
		} else {
			b.WriteString(StyleDim.Render("░"))
		}
	}
	return b.String()
}

// vsCards renders rate stats as a row of bordered value-over-label cards,
// revealing left-to-right as reveal advances.
func vsCards(pairs [][2]string, reveal float64) string {
	nShow := len(pairs)
	if reveal < 1.0 {
		nShow = int(float64(len(pairs)) * reveal)
	}
	cells := make([]string, 0, nShow)
	for i := 0; i < nShow && i < len(pairs); i++ {
		inner := lipgloss.NewStyle().Width(7).Align(lipgloss.Center).
			Render(StyleAccent.Bold(true).Render(pairs[i][1]) + "\n" + StyleDim.Render(pairs[i][0]))
		card := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(colorBorder).Render(inner)
		cells = append(cells, card)
	}
	if len(cells) == 0 {
		return ""
	}
	return lipgloss.JoinHorizontal(lipgloss.Top, cells...)
}

// vsStatLine renders "HR 2 · RBI 5 · BB 0 · K 0" with dim labels, bright values.
func vsStatLine(pairs [][2]string) string {
	parts := make([]string, 0, len(pairs))
	for _, p := range pairs {
		parts = append(parts, StyleDim.Render(p[0]+" ")+StyleItemNormal.Render(p[1]))
	}
	return strings.Join(parts, StyleDim.Render("  ·  "))
}

func renderVsMatchup(splits []mlb.StatSplit, subject, opponent string, isPitcher bool, reveal float64) string {
	ts, te := headerColors()

	var sb strings.Builder
	sb.WriteString(StyleAccent.Bold(true).Render("  VS PLAYER") + "  " +
		StyleDim.Render(strings.Repeat("─", 51)) + "\n\n")

	header := gradientText(subject, ts, te) + StyleDim.Render("  vs  ") + gradientText(opponent, ts, te)
	sb.WriteString("  " + header + "\n")

	matchupKind := "batter vs pitcher"
	if isPitcher {
		matchupKind = "pitcher vs batter"
	}

	if len(splits) == 0 {
		sb.WriteString("  " + StyleDim.Render(matchupKind+" · career") + "\n\n")
		sb.WriteString("  " + StyleDim.Render("They haven't faced each other — no head-to-head data yet."))
		return strings.TrimRight(sb.String(), "\n")
	}

	s := splits[0].Stat

	var rateCards [][2]string
	var hero, counting, bar, legend string

	if isPitcher {
		green := lipgloss.NewStyle().Foreground(colorGreen)
		dimGreen := lipgloss.NewStyle().Foreground(lipgloss.Color("#3f7d4f"))
		gold := lipgloss.NewStyle().Foreground(colorGold)
		red := lipgloss.NewStyle().Foreground(colorRed)

		bf, h, bb, k := vsCount(s, "battersFaced"), vsCount(s, "hits"), vsCount(s, "baseOnBalls"), vsCount(s, "strikeOuts")
		outs := bf - h - bb - k
		if outs < 0 {
			outs = 0
		}
		for _, c := range [][2]string{{"ERA", statVal(s, "era")}, {"AVG", statVal(s, "avg")}, {"OPS", statVal(s, "ops")}} {
			if c[1] != "—" {
				rateCards = append(rateCards, c)
			}
		}
		hero = StyleAccent.Bold(true).Render(statVal(s, "inningsPitched")+" IP") +
			StyleDim.Render("  ·  ") + StyleAccent.Bold(true).Render(fmt.Sprintf("%d K", k)) +
			StyleDim.Render(fmt.Sprintf("   (%d batters faced)", bf))
		counting = vsStatLine([][2]string{{"H", fmt.Sprint(h)}, {"HR", statVal(s, "homeRuns")}, {"BB", fmt.Sprint(bb)}, {"ERA", statVal(s, "era")}})
		bar = segBar(36, reveal, []barSeg{{k, green}, {outs, dimGreen}, {bb, gold}, {h, red}})
		legend = StyleDim.Render(fmt.Sprintf("K %d · out %d · BB %d · H %d", k, outs, bb, h))
	} else {
		green := lipgloss.NewStyle().Foreground(colorGreen)
		cyan := lipgloss.NewStyle().Foreground(colorCyan)

		pa, ab, h := vsCount(s, "plateAppearances"), vsCount(s, "atBats"), vsCount(s, "hits")
		bb, k := vsCount(s, "baseOnBalls"), vsCount(s, "strikeOuts")
		outs := pa - h - bb
		if outs < 0 {
			outs = 0
		}
		for _, c := range [][2]string{{"AVG", statVal(s, "avg")}, {"OBP", statVal(s, "obp")}, {"SLG", statVal(s, "slg")}, {"OPS", statVal(s, "ops")}} {
			if c[1] != "—" {
				rateCards = append(rateCards, c)
			}
		}
		hero = StyleAccent.Bold(true).Render(fmt.Sprintf("%d-for-%d", h, ab)) +
			StyleDim.Render(fmt.Sprintf("   (%d PA)", pa))
		counting = vsStatLine([][2]string{{"HR", statVal(s, "homeRuns")}, {"RBI", statVal(s, "rbi")}, {"BB", fmt.Sprint(bb)}, {"K", fmt.Sprint(k)}})
		bar = segBar(36, reveal, []barSeg{{h, green}, {bb, cyan}, {outs, StyleDim}})
		legend = StyleDim.Render(fmt.Sprintf("H %d · BB %d · out %d", h, bb, outs))
	}

	sample := vsCount(s, "plateAppearances")
	if isPitcher {
		sample = vsCount(s, "battersFaced")
	}
	sub := matchupKind + " · career"
	if sample > 0 && sample < 10 {
		sub += " · small sample"
	}
	sb.WriteString("  " + StyleDim.Render(sub) + "\n\n")

	if cards := vsCards(rateCards, reveal); cards != "" {
		sb.WriteString(strings.Join(indentBlock(cards, "  "), "\n") + "\n\n")
	}
	sb.WriteString("  " + hero + "\n")
	sb.WriteString("  " + counting + "\n\n")
	sb.WriteString("  " + bar + "   " + legend + "\n")

	return strings.TrimRight(sb.String(), "\n")
}

// renderArsenal renders a per-pitch-type arsenal breakdown with animated usage bars.
// Each row: TYPE  usage%  velo  spin  whiff% | bar (animates with reveal cascade).
// Labels are always present; only the bar fill grows with reveal.
func renderArsenal(pitches []mlb.ArsenalPitch, reveal float64) string {
	if len(pitches) == 0 {
		return StyleDim.Render("  No pitch data in this window.")
	}

	pitchColors := []lipgloss.TerminalColor{colorBlue, colorCyan, colorGold, colorGreen, colorRed, colorMuted}

	var sb strings.Builder
	sb.WriteString(StyleAccent.Bold(true).Render("  ARSENAL") + "  " +
		StyleDim.Render(strings.Repeat("─", 53)) + "\n\n")
	sb.WriteString(StyleHeader.Render(fmt.Sprintf("  %-22s %6s %6s %6s %7s", "PITCH TYPE", "USE%", "VELO", "SPIN", "WHIFF%")) + "\n\n")

	const barW = 16
	const staggerSpan = 0.5
	staggerWindow := 1.0 - staggerSpan
	staggerDenom := float64(len(pitches) - 1)
	if staggerDenom < 1 {
		staggerDenom = 1
	}

	for i, ap := range pitches {
		offset := staggerSpan * float64(i) / staggerDenom
		rowReveal := (reveal - offset) / staggerWindow
		if rowReveal < 0 {
			rowReveal = 0
		}
		if rowReveal > 1 {
			rowReveal = 1
		}

		col := pitchColors[i%len(pitchColors)]
		bar := RenderBar(ap.UsagePct*rowReveal, barW, col)

		veloStr := "—"
		if ap.AvgVelo > 0 {
			veloStr = fmt.Sprintf("%.1f", ap.AvgVelo)
		}
		spinStr := "—"
		if ap.AvgSpin > 0 {
			spinStr = fmt.Sprintf("%.0f", ap.AvgSpin)
		}
		whiffStr := "—"
		if ap.WhiffPct > 0 {
			whiffStr = fmt.Sprintf("%.0f%%", ap.WhiffPct*100)
		}

		typeLabel := lipgloss.NewStyle().Foreground(col).Render(fmt.Sprintf("%-22s", truncate(ap.Type, 22)))
		line := fmt.Sprintf("  %s %6s %6s %6s %7s  %s",
			typeLabel,
			fmt.Sprintf("%.0f%%", ap.UsagePct*100),
			veloStr,
			spinStr,
			whiffStr,
			bar,
		)
		sb.WriteString(line + "\n")
	}

	return strings.TrimRight(sb.String(), "\n")
}
