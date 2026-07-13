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

type standingsLoadedMsg struct {
	records   []mlb.StandingsRecord
	wcRecords []mlb.StandingsRecord
}

var divisionShort = map[string]string{
	"American League East":    "AL East",
	"American League Central": "AL Central",
	"American League West":    "AL West",
	"National League East":    "NL East",
	"National League Central": "NL Central",
	"National League West":    "NL West",
}

type StandingsModel struct {
	sport     mlb.Sport
	records   []mlb.StandingsRecord
	wcRecords []mlb.StandingsRecord
	tab       int
	rowCursor int
	enteredAt int
	loading   bool
	err       error
	client    *mlb.Client
	season    string
	width     int
}

// runDiffRow holds a single team's run differential data.
type runDiffRow struct {
	Name   string
	RS, RA int
	Diff   int
}

// runDiffRows flattens every team across all divisions, sorted by run
// differential (RS-RA) descending.
func runDiffRows(records []mlb.StandingsRecord) []runDiffRow {
	var rows []runDiffRow
	for _, rec := range records {
		for _, tr := range rec.TeamRecords {
			rows = append(rows, runDiffRow{
				Name: tr.Team.Name, RS: tr.RunsScored, RA: tr.RunsAllowed,
				Diff: tr.RunsScored - tr.RunsAllowed,
			})
		}
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Diff > rows[j].Diff })
	return rows
}

func NewStandingsModel(sport mlb.Sport) StandingsModel {
	return StandingsModel{
		sport:   sport,
		season:  fmt.Sprintf("%d", time.Now().Year()),
		client:  mlb.DefaultClient(),
		loading: true,
	}
}

func (m StandingsModel) Init() tea.Cmd {
	return m.fetch()
}

func (m StandingsModel) fetch() tea.Cmd {
	season := m.season
	c := m.client
	return func() tea.Msg {
		var records, wcRecords []mlb.StandingsRecord
		var err1, err2 error
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			records, err1 = c.Standings(m.sport.ID, season)
		}()
		go func() {
			defer wg.Done()
			wcRecords, err2 = c.WildCardStandings(m.sport.ID, season)
		}()
		wg.Wait()
		if err1 != nil {
			return ErrMsg{Err: err1}
		}
		if err2 != nil {
			return ErrMsg{Err: err2}
		}
		return standingsLoadedMsg{records: records, wcRecords: wcRecords}
	}
}

// Three views replace the old tab-per-division layout.
const (
	tabDivisions = 0
	tabWildCard  = 1
	tabRunDiff   = 2
)

var standingsTabNames = []string{"Divisions", "Wild Card", "Run Diff"}

// divRank orders divisions East → Central → West.
func divRank(name string) int {
	switch {
	case strings.Contains(name, "East"):
		return 0
	case strings.Contains(name, "Central"):
		return 1
	default:
		return 2
	}
}

// orderedDivisions returns the division records ordered AL East→Central→West,
// then NL East→Central→West (League 103 = AL, 104 = NL).
func orderedDivisions(records []mlb.StandingsRecord) []mlb.StandingsRecord {
	out := append([]mlb.StandingsRecord{}, records...)
	sort.SliceStable(out, func(i, j int) bool {
		iNL, jNL := out[i].League.ID == 104, out[j].League.ID == 104
		if iNL != jNL {
			return !iNL
		}
		return divRank(out[i].Division.Name) < divRank(out[j].Division.Name)
	})
	return out
}

// orderedWildCard returns the wild-card records with AL before NL.
func orderedWildCard(records []mlb.StandingsRecord) []mlb.StandingsRecord {
	out := append([]mlb.StandingsRecord{}, records...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].League.ID < out[j].League.ID })
	return out
}

// flatTeams returns every team on the current view in display order (AL then
// NL), used for cursor navigation and selection.
func (m StandingsModel) flatTeams() []mlb.Standing {
	var out []mlb.Standing
	switch m.tab {
	case tabDivisions:
		for _, rec := range orderedDivisions(m.records) {
			out = append(out, rec.TeamRecords...)
		}
	case tabWildCard:
		for _, rec := range orderedWildCard(m.wcRecords) {
			out = append(out, rec.TeamRecords...)
		}
	}
	return out
}

// rowCount is how many navigable rows the current view has.
func (m StandingsModel) rowCount() int {
	if m.tab == tabRunDiff {
		return len(runDiffRows(m.records))
	}
	return len(m.flatTeams())
}

// selectedTeamName returns the team under the row cursor on the current view.
func (m StandingsModel) selectedTeamName() string {
	if m.tab == tabRunDiff {
		rows := runDiffRows(m.records)
		if m.rowCursor >= 0 && m.rowCursor < len(rows) {
			return rows[m.rowCursor].Name
		}
		return ""
	}
	teams := m.flatTeams()
	if m.rowCursor >= 0 && m.rowCursor < len(teams) {
		return teams[m.rowCursor].Team.Name
	}
	return ""
}

func (m StandingsModel) Update(msg tea.Msg) (StandingsModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case standingsLoadedMsg:
		m.loading = false
		m.records = msg.records
		m.wcRecords = msg.wcRecords
		return m, nil
	case ErrMsg:
		m.loading = false
		m.err = msg.Err
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "tab", "right", "l":
			if m.tab < len(standingsTabNames)-1 {
				m.tab++
				m.rowCursor = 0
				if m.tab == tabRunDiff {
					m.enteredAt = animFrame
				}
			}
		case "shift+tab", "left", "h":
			if m.tab > 0 {
				m.tab--
				m.rowCursor = 0
				if m.tab == tabRunDiff {
					m.enteredAt = animFrame
				}
			}
		case "up", "k":
			if m.rowCursor > 0 {
				m.rowCursor--
			}
		case "down", "j":
			if m.rowCursor < m.rowCount()-1 {
				m.rowCursor++
			}
		case "enter":
			if name := m.selectedTeamName(); name != "" {
				return m, func() tea.Msg { return NavigateMsg{View: ViewTeam, Query: name} }
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

func inWildCard(wcgb string) bool {
	return strings.HasPrefix(wcgb, "+") || wcgb == "-"
}

// gbDash normalizes an empty games-back string to "-".
func gbDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

// divBlock renders one division as a compact block (colored header + a row per
// team), marking the team whose global index equals the cursor and starring the
// division leader. Returns the lines and the team count.
func (m StandingsModel) divBlock(rec mlb.StandingsRecord, baseIdx, colW int) ([]string, int) {
	name := divisionShort[rec.Division.Name]
	if name == "" {
		name = rec.Division.Name
	}
	nameW := colW - 17
	if nameW > 20 {
		nameW = 20
	}
	if nameW < 10 {
		nameW = 10
	}
	lines := []string{StyleHeader.Render(name)}
	for i, tr := range rec.TeamRecords {
		marker, ns := "  ", StyleItemNormal
		switch {
		case baseIdx+i == m.rowCursor:
			marker, ns = StyleAccent.Bold(true).Render("▸ "), StyleAccent.Bold(true)
		case i == 0:
			marker, ns = StyleAccent.Render("★ "), StyleAccent.Bold(true)
		}
		// Micro glyph: 1 visible col + 1 space = 2 display cols.
		// Pad team name to (nameW-2) so that glyph+space+name = nameW total visible cols.
		// When no glyph, pad to nameW as before.
		var nm string
		if dot := teamDot(tr.Team.ID); dot != "" {
			nm = dot + " " + ns.Render(fmt.Sprintf("%-*s", nameW-2, truncate(tr.Team.Name, nameW-2)))
		} else {
			nm = ns.Render(fmt.Sprintf("%-*s", nameW, truncate(tr.Team.Name, nameW)))
		}
		stats := StyleItemNormal.Render(fmt.Sprintf("%3d-%-3d %5s %5s", tr.Wins, tr.Losses, tr.WinningPercentage, gbDash(tr.GamesBack)))
		lines = append(lines, marker+nm+" "+stats)
	}
	return lines, len(rec.TeamRecords)
}

// wcBlock renders one league's wild-card race, with a cutoff rule after the last
// team currently holding a spot.
func (m StandingsModel) wcBlock(rec mlb.StandingsRecord, baseIdx, colW int) ([]string, int) {
	title := "WILD CARD"
	switch rec.League.ID {
	case 103:
		title = "AL WILD CARD"
	case 104:
		title = "NL WILD CARD"
	}
	nameW := colW - 17
	if nameW > 20 {
		nameW = 20
	}
	if nameW < 10 {
		nameW = 10
	}
	lines := []string{StyleHeader.Render(title)}
	for i, tr := range rec.TeamRecords {
		if i > 0 && inWildCard(rec.TeamRecords[i-1].WildCardGamesBack) && !inWildCard(tr.WildCardGamesBack) {
			lines = append(lines, StyleDim.Render(strings.Repeat("╌", colW-2)+" cutoff"))
		}
		marker, ns := "  ", StyleItemNormal
		switch {
		case baseIdx+i == m.rowCursor:
			marker, ns = StyleAccent.Bold(true).Render("▸ "), StyleAccent.Bold(true)
		case inWildCard(tr.WildCardGamesBack):
			ns = StyleAccent
		}
		// Micro glyph: 1 visible col + 1 space = 2 display cols.
		// Pad team name to (nameW-2) so that glyph+space+name = nameW total visible cols.
		// When no glyph, pad to nameW as before.
		var nm string
		if dot := teamDot(tr.Team.ID); dot != "" {
			nm = dot + " " + ns.Render(fmt.Sprintf("%-*s", nameW-2, truncate(tr.Team.Name, nameW-2)))
		} else {
			nm = ns.Render(fmt.Sprintf("%-*s", nameW, truncate(tr.Team.Name, nameW)))
		}
		stats := StyleItemNormal.Render(fmt.Sprintf("%3d-%-3d %5s %5s", tr.Wins, tr.Losses, tr.WinningPercentage, gbDash(tr.WildCardGamesBack)))
		lines = append(lines, marker+nm+" "+stats)
	}
	return lines, len(rec.TeamRecords)
}

// joinColumns lays two line-blocks side by side, padding each left line to colW
// visible columns.
func joinColumns(left, right []string, colW int) string {
	n := len(left)
	if len(right) > n {
		n = len(right)
	}
	var b strings.Builder
	for i := 0; i < n; i++ {
		var l, r string
		if i < len(left) {
			l = left[i]
		}
		if i < len(right) {
			r = right[i]
		}
		pad := colW - lipgloss.Width(l)
		if pad < 0 {
			pad = 0
		}
		b.WriteString("  " + l + strings.Repeat(" ", pad) + "  " + r + "\n")
	}
	return strings.TrimRight(b.String(), "\n")
}

// stackBlocks renders line-blocks in one column, a blank line between each.
func stackBlocks(blocks [][]string) string {
	var b strings.Builder
	for bi, blk := range blocks {
		if bi > 0 {
			b.WriteString("\n")
		}
		for _, ln := range blk {
			b.WriteString("  " + ln + "\n")
		}
	}
	return strings.TrimRight(b.String(), "\n")
}

// renderDivisionsView shows all six divisions at once — AL and NL side by side
// on a wide terminal, otherwise stacked in one column.
func (m StandingsModel) renderDivisionsView() string {
	divs := orderedDivisions(m.records)
	if len(divs) == 0 {
		return StyleDim.Render("  No standings.")
	}
	cw := m.width - 4
	if cw <= 0 {
		cw = 96
	}
	twoCol := cw >= 96
	colW := cw
	if twoCol {
		colW = 44 // compact column so the two leagues sit close, not edge-to-edge
	}

	var al, nl []mlb.StandingsRecord
	for _, d := range divs {
		if d.League.ID == 104 {
			nl = append(nl, d)
		} else {
			al = append(al, d)
		}
	}

	idx := 0
	column := func(recs []mlb.StandingsRecord) []string {
		var lines []string
		for k, rec := range recs {
			if k > 0 {
				lines = append(lines, "")
			}
			blk, n := m.divBlock(rec, idx, colW)
			idx += n
			lines = append(lines, blk...)
		}
		return lines
	}

	if twoCol {
		left := column(al)
		right := column(nl)
		return joinColumns(left, right, colW)
	}
	return stackBlocks([][]string{column(al), column(nl)})
}

// renderWildCardView shows both leagues' wild-card races, side by side or stacked.
func (m StandingsModel) renderWildCardView() string {
	wc := orderedWildCard(m.wcRecords)
	if len(wc) == 0 {
		return StyleDim.Render("  No wild card data.")
	}
	cw := m.width - 4
	if cw <= 0 {
		cw = 96
	}
	twoCol := cw >= 96
	colW := cw
	if twoCol {
		colW = 44 // compact column so the two leagues sit close, not edge-to-edge
	}

	idx := 0
	var blocks [][]string
	for _, rec := range wc {
		blk, n := m.wcBlock(rec, idx, colW)
		idx += n
		blocks = append(blocks, blk)
	}
	if twoCol && len(blocks) == 2 {
		return joinColumns(blocks[0], blocks[1], colW)
	}
	return stackBlocks(blocks)
}

func (m StandingsModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("r retry", "esc back")
	}
	if m.loading || len(m.records) == 0 {
		return PanelHeader("STANDINGS", m.width) + "\n\n" + loadingView("Loading standings…")
	}

	panelHdr := PanelHeader("STANDINGS", m.width)

	tabs := ""
	for i, n := range standingsTabNames {
		if i == m.tab {
			tabs += StyleActiveTab.Render(n)
		} else {
			tabs += StyleTab.Render(n)
		}
	}

	var body string
	switch m.tab {
	case tabWildCard:
		body = m.renderWildCardView()
	case tabRunDiff:
		body = m.renderRunDiff(animProgress(m.enteredAt, 14))
	default:
		body = m.renderDivisionsView()
	}

	return panelHdr + "\n" + tabs + "\n\n" + body + "\n" + HelpBar("Tab/←/→ tab", "↑/↓ navigate", "Enter team", "r refresh", "esc back")
}

// renderRunDiff draws a diverging bar chart of all teams sorted by run
// differential (RS−RA). Labels (name, RS-RA, signed diff) are always present;
// only the bar fill animates with reveal (0→1).
func (m StandingsModel) renderRunDiff(reveal float64) string {
	rows := runDiffRows(m.records)
	if len(rows) == 0 {
		return StyleDim.Render("No data")
	}

	// Find max |Diff| for scaling.
	maxAbs := 1
	for _, r := range rows {
		d := r.Diff
		if d < 0 {
			d = -d
		}
		if d > maxAbs {
			maxAbs = d
		}
	}

	// Bar half-width: half the available panel minus label columns.
	// Layout per row: "  NAME  ±DIFF  RS-RA  [left bar][center][right bar]"
	// The signed diff sits next to the name (not at the far edge) for legibility;
	// the rest of the width is the diverging bar.
	panelW := m.width
	if panelW <= 0 {
		panelW = 100
	}
	barTotal := panelW - 44
	if barTotal < 10 {
		barTotal = 10
	}
	halfBar := barTotal / 2

	var b strings.Builder
	b.WriteString(StyleHeader.Render("RUN DIFFERENTIAL") + "\n")
	b.WriteString(StyleDim.Render(strings.Repeat("─", min(panelW-2, 72))) + "\n")

	const staggerSpan = 0.6 // rows start spread over the first 60% of the reveal
	window := 1.0 - staggerSpan
	denom := float64(len(rows) - 1)
	if denom < 1 {
		denom = 1
	}

	for i, row := range rows {
		// Bounded-stagger cascade: each row has a fixed offset within staggerSpan.
		// At reveal==1.0 every row's rowReveal==1.0 (last row: (1-0.6)/0.4 = 1.0).
		offset := staggerSpan * float64(i) / denom
		rowReveal := (reveal - offset) / window
		if rowReveal < 0 {
			rowReveal = 0
		}
		if rowReveal > 1 {
			rowReveal = 1
		}

		frac := float64(row.Diff) / float64(maxAbs) // −1..+1
		if frac < 0 {
			frac = -frac
		}
		animFrac := frac * rowReveal

		// Left (red) or right (green) bar.
		var leftBar, rightBar string
		if row.Diff >= 0 {
			leftBar = strings.Repeat(" ", halfBar)
			rightBar = RenderBar(animFrac, halfBar, colorGreen)
		} else {
			// Red bar grows leftward — render filled chars right-padded.
			filled := int(float64(halfBar) * animFrac)
			if filled > halfBar {
				filled = halfBar
			}
			leftPad := halfBar - filled
			leftBar = strings.Repeat(" ", leftPad) + StyleError.Render(strings.Repeat("█", filled))
			rightBar = strings.Repeat(" ", halfBar)
		}

		// Signed diff — bold and color-coded (green +, red −, gold even), placed
		// right after the name so it reads with the team instead of at the far edge.
		sign := "+"
		if row.Diff < 0 {
			sign = ""
		}
		diffStr := fmt.Sprintf("%5s", fmt.Sprintf("%s%d", sign, row.Diff))
		diffStyle := lipgloss.NewStyle().Bold(true).Foreground(colorGold)
		if row.Diff > 0 {
			diffStyle = lipgloss.NewStyle().Bold(true).Foreground(colorGreen)
		} else if row.Diff < 0 {
			diffStyle = lipgloss.NewStyle().Bold(true).Foreground(colorRed)
		}
		diffStyled := diffStyle.Render(diffStr)

		// Cursor marker + name.
		marker := "  "
		name := fmt.Sprintf("%-20s", truncate(row.Name, 20))
		var nameStr string
		if i == m.rowCursor {
			marker = StyleAccent.Bold(true).Render("▸ ")
			nameStr = StyleAccent.Bold(true).Render(name)
		} else {
			nameStr = StyleItemNormal.Render(name)
		}
		rsra := StyleDim.Render(fmt.Sprintf("%4d-%-4d", row.RS, row.RA))

		b.WriteString(marker + nameStr + " " + diffStyled + " " + rsra + "  " +
			leftBar + StyleDim.Render("┃") + rightBar + "\n")
	}
	return b.String()
}
