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

type postseasonLoadedMsg struct {
	games []mlb.PostseasonGame
}

var gameTypeOrder = map[string]int{
	"F": 0, // Wild Card
	"D": 1, // Division Series
	"L": 2, // LCS
	"W": 3, // World Series
	"C": 4,
}

var postseasonTabNames = []string{"Bracket", "Games"}

type PostseasonModel struct {
	season  string
	loading bool
	games   []mlb.PostseasonGame
	err     error
	client  *mlb.Client
	scroll  int
	tab     int
	cursor  int   // selected game in the Games tab
	gamePks []int // game ids in renderGamesList order (built on load)
	width   int
}

func NewPostseasonModel() PostseasonModel {
	season := fmt.Sprintf("%d", time.Now().Year()-1)
	return PostseasonModel{season: season, loading: true, client: mlb.DefaultClient()}
}

func (m PostseasonModel) Init() tea.Cmd { return m.fetch() }

func (m PostseasonModel) fetch() tea.Cmd {
	season, c := m.season, m.client
	return func() tea.Msg {
		games, err := c.PostseasonSchedule(season)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return postseasonLoadedMsg{games: games}
	}
}

func (m PostseasonModel) Update(msg tea.Msg) (PostseasonModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
	case postseasonLoadedMsg:
		m.loading, m.err, m.games, m.scroll = false, nil, msg.games, 0
		m.gamePks = orderedGamePks(msg.games)
		m.cursor = 0
	case ErrMsg:
		m.loading, m.err = false, msg.Err
	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			m.tab = (m.tab + 1) % 2
			m.scroll = 0
			m.cursor = 0
		case "j", "down":
			if m.tab == 1 {
				if m.cursor < len(m.gamePks)-1 {
					m.cursor++
				}
			} else {
				m.scroll++
			}
		case "k", "up":
			if m.tab == 1 {
				if m.cursor > 0 {
					m.cursor--
				}
			} else if m.scroll > 0 {
				m.scroll--
			}
		case "enter":
			if m.tab == 1 && m.cursor < len(m.gamePks) {
				gk := m.gamePks[m.cursor]
				return m, func() tea.Msg { return NavigateMsg{View: ViewGame, GamePk: gk} }
			}
		case "right", "l":
			y, _ := strconvAtoi(m.season)
			m.season = fmt.Sprintf("%d", y+1)
			m.loading, m.games, m.scroll = true, nil, 0
			m.gamePks, m.cursor = nil, 0
			return m, m.fetch()
		case "left", "h":
			y, _ := strconvAtoi(m.season)
			m.season = fmt.Sprintf("%d", y-1)
			m.loading, m.games, m.scroll = true, nil, 0
			m.gamePks, m.cursor = nil, 0
			return m, m.fetch()
		case "r":
			m.loading = true
			return m, m.fetch()
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		}
	}
	return m, nil
}

// ── data ──────────────────────────────────────────────────────────────────────

type psSeriesInfo struct {
	desc     string
	label    string // "DET vs HOU"
	league   string // "AL", "NL", "WS"
	gameType string
	order    int
	games    []mlb.PostseasonGame
}

type seriesStats struct {
	team1Name string
	team2Name string
	team1ID   int
	team2ID   int
	team1Wins int
	team2Wins int
	done      bool
}

func seriesKey(g mlb.PostseasonGame) string {
	a, h := g.Teams.Away.Team.ID, g.Teams.Home.Team.ID
	if a > h {
		a, h = h, a
	}
	return fmt.Sprintf("%s|%d-%d", g.SeriesDescription, a, h)
}

func teamLabel(ti mlb.PostseasonTeamInfo) string {
	if ti.Team.Abbreviation != "" {
		return ti.Team.Abbreviation
	}
	if ti.Team.Name != "" {
		return truncate(ti.Team.Name, 10)
	}
	return "???"
}

// getSeriesStats counts wins by score comparison (not isWinner, which the API
// sets for the series winner on every game, not per-game winner).
func getSeriesStats(si *psSeriesInfo) seriesStats {
	if len(si.games) == 0 {
		return seriesStats{}
	}
	g0 := si.games[0]
	ss := seriesStats{
		team1Name: teamLabel(g0.Teams.Away),
		team2Name: teamLabel(g0.Teams.Home),
		team1ID:   g0.Teams.Away.Team.ID,
		team2ID:   g0.Teams.Home.Team.ID,
		done:      allFinal(si.games),
	}
	for _, g := range si.games {
		if g.Status.AbstractGameState != "Final" {
			continue
		}
		var winnerID int
		if g.Teams.Away.Score > g.Teams.Home.Score {
			winnerID = g.Teams.Away.Team.ID
		} else if g.Teams.Home.Score > g.Teams.Away.Score {
			winnerID = g.Teams.Home.Team.ID
		}
		if winnerID == ss.team1ID {
			ss.team1Wins++
		} else if winnerID == ss.team2ID {
			ss.team2Wins++
		}
	}
	return ss
}

func buildSeriesMap(games []mlb.PostseasonGame) (map[string]*psSeriesInfo, []string) {
	smap := map[string]*psSeriesInfo{}
	var order []string
	for i := range games {
		g := games[i]
		key := seriesKey(g)
		if _, ok := smap[key]; !ok {
			ord := 99
			if o, ok2 := gameTypeOrder[g.GameType]; ok2 {
				ord = o
			}
			league := "WS"
			d := g.SeriesDescription
			if strings.HasPrefix(d, "AL ") {
				league = "AL"
			} else if strings.HasPrefix(d, "NL ") {
				league = "NL"
			}
			smap[key] = &psSeriesInfo{
				desc:     d,
				label:    teamLabel(g.Teams.Away) + " vs " + teamLabel(g.Teams.Home),
				league:   league,
				gameType: g.GameType,
				order:    ord,
			}
			order = append(order, key)
		}
		smap[key].games = append(smap[key].games, g)
	}
	sort.Slice(order, func(i, j int) bool {
		si, sj := smap[order[i]], smap[order[j]]
		if si.order != sj.order {
			return si.order < sj.order
		}
		if si.league != sj.league {
			return si.league < sj.league
		}
		return si.label < sj.label
	})
	return smap, order
}

// sortSeriesGames orders a series' games deterministically: by GameDate, then
// GamePk as a stable tiebreaker, so the cursor's id list (orderedGamePks) and
// the rendered rows (renderGamesList) always walk games in the same order.
func sortSeriesGames(games []mlb.PostseasonGame) {
	sort.Slice(games, func(i, j int) bool {
		if games[i].GameDate != games[j].GameDate {
			return games[i].GameDate < games[j].GameDate
		}
		return games[i].GamePk < games[j].GamePk
	})
}

// orderedGamePks returns game ids in the same order renderGamesList emits them.
func orderedGamePks(games []mlb.PostseasonGame) []int {
	smap, order := buildSeriesMap(games)
	var pks []int
	for _, key := range order {
		si := smap[key]
		sortSeriesGames(si.games)
		for _, g := range si.games {
			pks = append(pks, g.GamePk)
		}
	}
	return pks
}

func allFinal(games []mlb.PostseasonGame) bool {
	for _, g := range games {
		if g.Status.AbstractGameState != "Final" {
			return false
		}
	}
	return true
}

// seriesToWin returns the wins needed to clinch, by round (WC bo3, DS bo5, else bo7).
func seriesToWin(gameType string) int {
	switch gameType {
	case "F":
		return 2
	case "D":
		return 3
	default:
		return 4
	}
}

// seriesPips renders win progress as filled/empty dots, e.g. ●●●○.
func seriesPips(wins, toWin int) string {
	var b strings.Builder
	for i := 0; i < toWin; i++ {
		if i < wins {
			b.WriteString(StyleAccent.Render("●"))
		} else {
			b.WriteString(StyleDim.Render("○"))
		}
	}
	return b.String()
}

// seriesLine renders a compact series result: "TEX def BAL  3-1  ●●●○".
func seriesLine(si *psSeriesInfo) string {
	stats := getSeriesStats(si)
	t1, t2 := stats.team1Name, stats.team2Name
	total := stats.team1Wins + stats.team2Wins
	toWin := seriesToWin(si.gameType)

	if total == 0 {
		return StyleDim.Render(fmt.Sprintf("%-3s vs %-3s", t1, t2)) + "  " + seriesPips(0, toWin)
	}

	if stats.done {
		winner, loser := t1, t2
		winW, loseW := stats.team1Wins, stats.team2Wins
		if stats.team2Wins > stats.team1Wins {
			winner, loser = t2, t1
			winW, loseW = stats.team2Wins, stats.team1Wins
		}
		return StyleAccent.Bold(true).Render(fmt.Sprintf("%-3s", winner)) +
			StyleDim.Render(" def ") +
			fmt.Sprintf("%-3s", loser) +
			StyleDim.Render(fmt.Sprintf("  %d-%d  ", winW, loseW)) + seriesPips(winW, toWin)
	}

	// In progress: bold the leader, pips track the leader's wins.
	t1s := fmt.Sprintf("%-3s", t1)
	t2s := fmt.Sprintf("%-3s", t2)
	lead := stats.team1Wins
	if stats.team1Wins > stats.team2Wins {
		t1s = StyleAccent.Render(fmt.Sprintf("%-3s", t1))
	} else if stats.team2Wins > stats.team1Wins {
		t2s = StyleAccent.Render(fmt.Sprintf("%-3s", t2))
		lead = stats.team2Wins
	}
	return t1s + StyleDim.Render(" vs ") + t2s +
		StyleDim.Render(fmt.Sprintf("  %d-%d  ", stats.team1Wins, stats.team2Wins)) + seriesPips(lead, toWin)
}

// padRight pads a (possibly ANSI-styled) string to visual width w.
func padRight(s string, w int) string {
	vis := lipgloss.Width(s)
	if vis >= w {
		return s
	}
	return s + strings.Repeat(" ", w-vis)
}

// ── bracket view ──────────────────────────────────────────────────────────────

func (m PostseasonModel) renderBracket() string {
	smap, _ := buildSeriesMap(m.games)

	type rlKey struct{ gt, league string }
	groups := map[rlKey][]*psSeriesInfo{}
	for _, si := range smap {
		rk := rlKey{si.gameType, si.league}
		groups[rk] = append(groups[rk], si)
	}
	for rk := range groups {
		sort.Slice(groups[rk], func(i, j int) bool {
			return groups[rk][i].label < groups[rk][j].label
		})
	}

	// Each round is a horizontal row; AL and NL shown side by side.
	colW := 36
	if m.width > 0 {
		colW = m.width/2 - 2
		if colW > 44 {
			colW = 44
		}
		if colW < 24 {
			colW = 24
		}
	}
	totalW := colW * 2

	rounds := []struct {
		gt   string
		name string
	}{
		{"F", "WILD CARD"},
		{"D", "DIVISION SERIES"},
		{"L", "CHAMP SERIES"},
	}

	var lines []string

	for _, round := range rounds {
		alS := groups[rlKey{round.gt, "AL"}]
		nlS := groups[rlKey{round.gt, "NL"}]
		if len(alS) == 0 && len(nlS) == 0 {
			continue
		}

		// Round section header spanning full width
		dashLen := totalW - len(round.name) - 4
		if dashLen < 4 {
			dashLen = 4
		}
		lines = append(lines,
			StyleAccent.Bold(true).Render("── "+round.name+" ")+
				StyleDim.Render(strings.Repeat("─", dashLen)))

		// AL and NL sub-labels on first data row
		rows := len(alS)
		if len(nlS) > rows {
			rows = len(nlS)
		}
		for i := 0; i < rows; i++ {
			alCell, nlCell := "", ""
			alPfx, nlPfx := "     ", "     "
			if i == 0 {
				alPfx = StyleDim.Render("  AL ")
				nlPfx = StyleDim.Render("  NL ")
			}
			if i < len(alS) {
				alCell = alPfx + seriesLine(alS[i])
			}
			if i < len(nlS) {
				nlCell = nlPfx + seriesLine(nlS[i])
			}
			lines = append(lines, padRight(alCell, colW)+"  "+nlCell)
		}
		lines = append(lines, "")
	}

	// World Series — full width, centred
	var wsSeries []*psSeriesInfo
	for gt := range gameTypeOrder {
		if s := groups[rlKey{gt, "WS"}]; len(s) > 0 {
			wsSeries = append(wsSeries, s...)
		}
	}
	if len(wsSeries) > 0 {
		wsLabel := "── WORLD SERIES "
		fill := strings.Repeat("─", totalW-len(wsLabel))
		lines = append(lines, StyleAccent.Bold(true).Render(wsLabel)+StyleDim.Render(fill))
		for _, si := range wsSeries {
			lines = append(lines, "  "+seriesLine(si))
		}
	}

	// Apply scroll
	start := m.scroll
	if start >= len(lines) {
		start = 0
	}
	visible := lines[start:]
	if len(visible) > 30 {
		visible = visible[:30]
	}
	return strings.Join(visible, "\n")
}

// ── games list view ───────────────────────────────────────────────────────────

func (m PostseasonModel) renderGamesList() string {
	smap, order := buildSeriesMap(m.games)
	var lines []string

	gi := 0         // running game index across all series
	cursorLine := 0 // display-line index of the selected game
	for _, key := range order {
		si := smap[key]
		title := si.desc + ": " + si.label
		fillLen := 44 - len(title)
		if fillLen < 2 {
			fillLen = 2
		}
		lines = append(lines,
			StyleAccent.Bold(true).Render("── "+title+" ")+StyleDim.Render(strings.Repeat("─", fillLen)))

		sortSeriesGames(si.games)

		for gameNum, g := range si.games {
			away, home := g.Teams.Away, g.Teams.Home
			awayL, homeL := teamLabel(away), teamLabel(home)
			var statusStr string
			switch g.Status.AbstractGameState {
			case "Final":
				statusStr = StyleMuted.Render("Final")
				// use scores (not isWinner) to determine game winner
				if away.Score > home.Score {
					awayL = StyleAccent.Bold(true).Render(awayL)
				} else if home.Score > away.Score {
					homeL = StyleAccent.Bold(true).Render(homeL)
				}
			case "Live":
				statusStr = pulseDot() + " " + StyleLiveBadge.Render("Live")
			default:
				if gt, err := time.Parse(time.RFC3339, g.GameDate); err == nil {
					et, _ := time.LoadLocation("America/New_York")
					dateStr := gt.In(et).Format("Jan 2")
					statusStr = StyleDim.Render(dateStr + "  " + formatGameTime(g.GameDate))
				} else {
					statusStr = StyleDim.Render(g.Status.DetailedState)
				}
			}
			var row string
			if g.Status.AbstractGameState == "Final" || g.Status.AbstractGameState == "Live" {
				row = fmt.Sprintf("  %s %2d  %s %2d  %s  %s",
					awayL, away.Score, homeL, home.Score, statusStr,
					StyleDim.Render(fmt.Sprintf("(G%d)", gameNum+1)))
			} else {
				row = fmt.Sprintf("  %s  —   %s  —   %s  %s",
					awayL, homeL, statusStr,
					StyleDim.Render(fmt.Sprintf("(G%d)", gameNum+1)))
			}
			if gi == m.cursor {
				cursorLine = len(lines)
				row = StyleItemSelected.Render("▸" + strings.TrimPrefix(row, " "))
			}
			lines = append(lines, row)
			gi++
		}

		stats := getSeriesStats(si)
		if stats.done && (stats.team1Wins+stats.team2Wins) > 0 {
			winner, winW, loseW := stats.team1Name, stats.team1Wins, stats.team2Wins
			if stats.team2Wins > stats.team1Wins {
				winner, winW, loseW = stats.team2Name, stats.team2Wins, stats.team1Wins
			}
			lines = append(lines, "  "+StyleAccent.Render(fmt.Sprintf("%s wins %d-%d", winner, winW, loseW)))
		}
		lines = append(lines, "")
	}

	// Window around the selected game.
	maxLines := 35
	start := cursorLine - maxLines/2
	if start < 0 {
		start = 0
	}
	if start > len(lines)-maxLines {
		start = len(lines) - maxLines
	}
	if start < 0 {
		start = 0
	}
	end := start + maxLines
	if end > len(lines) {
		end = len(lines)
	}
	return strings.Join(lines[start:end], "\n")
}

// ── View ─────────────────────────────────────────────────────────────────────

func (m PostseasonModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}

	panelHdr := PanelHeader("POSTSEASON", m.width)

	if m.loading {
		return panelHdr + "\n\n" + loadingView("Loading "+m.season+" postseason…")
	}
	if len(m.games) == 0 {
		return panelHdr + "\n\n" + StyleDim.Render("  No postseason data for "+m.season+".") +
			"\n\n" + HelpBar("◄/► year", "esc back")
	}

	tabs := ""
	for i, n := range postseasonTabNames {
		if i == m.tab {
			tabs += StyleActiveTab.Render(n)
		} else {
			tabs += StyleTab.Render(n)
		}
	}
	// Year is shown prominently beside the tabs (visible on both Bracket and
	// Games) with ◄/► signaling it can be changed.
	tabs += "    " + StyleAccent.Bold(true).Render("◄ "+m.season+" ►")

	var body string
	if m.tab == 0 {
		// Wide terminals get the converging tree bracket; narrow ones (or
		// non-standard formats) fall back to the tiered list.
		if m.width >= 102 {
			if tree := m.renderBracketTree(); tree != "" {
				body = tree
			} else {
				body = m.renderBracket()
			}
		} else {
			body = m.renderBracket()
		}
	} else {
		body = m.renderGamesList()
	}

	return panelHdr + "\n" + tabs + "\n\n" + body + "\n\n" +
		HelpBar("◄/► year", "Tab bracket/games", "↑/↓ select", "Enter game", "r refresh", "esc back")
}
