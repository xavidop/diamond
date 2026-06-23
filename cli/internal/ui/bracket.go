package ui

import (
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// A character canvas with per-cell color + bold, used to draw the postseason
// bracket tree (boxes + connector lines) with precise alignment.
type pbCanvas struct {
	w, h int
	ch   [][]rune
	col  [][]lipgloss.TerminalColor
	bold [][]bool
}

func newPBCanvas(w, h int) *pbCanvas {
	c := &pbCanvas{w: w, h: h}
	c.ch = make([][]rune, h)
	c.col = make([][]lipgloss.TerminalColor, h)
	c.bold = make([][]bool, h)
	for r := 0; r < h; r++ {
		c.ch[r] = make([]rune, w)
		c.col[r] = make([]lipgloss.TerminalColor, w)
		c.bold[r] = make([]bool, w)
		for x := 0; x < w; x++ {
			c.ch[r][x] = ' '
			c.col[r][x] = colorDim
		}
	}
	return c
}

func (c *pbCanvas) set(r, x int, ch rune, col lipgloss.TerminalColor, bold bool) {
	if r < 0 || r >= c.h || x < 0 || x >= c.w {
		return
	}
	c.ch[r][x] = ch
	c.col[r][x] = col
	c.bold[r][x] = bold
}

func (c *pbCanvas) text(r, x int, s string, col lipgloss.TerminalColor, bold bool) {
	for i, ch := range s {
		c.set(r, x+i, ch, col, bold)
	}
}

func (c *pbCanvas) hline(r, x1, x2 int, col lipgloss.TerminalColor) {
	for x := x1; x <= x2; x++ {
		c.set(r, x, '─', col, false)
	}
}

func (c *pbCanvas) String() string {
	var sb strings.Builder
	for r := 0; r < c.h; r++ {
		// trim trailing spaces
		last := -1
		for x := 0; x < c.w; x++ {
			if c.ch[r][x] != ' ' {
				last = x
			}
		}
		for x := 0; x <= last; x++ {
			if c.ch[r][x] == ' ' {
				sb.WriteByte(' ')
				continue
			}
			st := lipgloss.NewStyle().Foreground(c.col[r][x])
			if c.bold[r][x] {
				st = st.Bold(true)
			}
			sb.WriteString(st.Render(string(c.ch[r][x])))
		}
		sb.WriteByte('\n')
	}
	return strings.TrimRight(sb.String(), "\n")
}

const pbBoxW = 9 // box width incl. borders; inner content 7

// pbBox draws a rounded series box (2 teams) at rows top..top+3.
// The winner's row is bold + gold; the loser dim.
func (c *pbCanvas) pbBox(top, left int, si *psSeriesInfo, border lipgloss.TerminalColor) {
	st := getSeriesStats(si)
	w1, w2 := st.team1Wins, st.team2Wins
	win1 := w1 > w2
	win2 := w2 > w1

	// borders
	c.set(top, left, '╭', border, false)
	c.set(top, left+pbBoxW-1, '╮', border, false)
	c.set(top+3, left, '╰', border, false)
	c.set(top+3, left+pbBoxW-1, '╯', border, false)
	for x := left + 1; x < left+pbBoxW-1; x++ {
		c.set(top, x, '─', border, false)
		c.set(top+3, x, '─', border, false)
	}
	c.set(top+1, left, '│', border, false)
	c.set(top+1, left+pbBoxW-1, '│', border, false)
	c.set(top+2, left, '│', border, false)
	c.set(top+2, left+pbBoxW-1, '│', border, false)

	row := func(r int, name string, wins int, winner bool) {
		col := colorText
		bold := false
		switch {
		case winner:
			col, bold = colorGold, true
		case win1 || win2: // series decided, this team lost
			col = colorDim
		}
		c.text(r, left+1, name, col, bold)
		// games-won digit right-aligned in the inner field
		c.set(r, left+pbBoxW-2, rune('0'+wins), col, bold)
	}
	row(top+1, st.team1Name, w1, win1)
	row(top+2, st.team2Name, w2, win2)
}

// attachRow is the connector attach row for a box at the given top.
func attachRow(top int) int { return top + 2 }

// pbMerge draws a bracket merge: two source boxes (at rTop/rBot, right edge
// xSrc) joining into a target to the right at row rTgt (left edge xDst).
func (c *pbCanvas) pbMerge(xSrc, rTop, rBot, xDst, rTgt int, col lipgloss.TerminalColor) {
	xmid := (xSrc + xDst) / 2
	c.hline(rTop, xSrc, xmid, col)
	c.hline(rBot, xSrc, xmid, col)
	c.set(rTop, xmid, '╮', col, false)
	c.set(rBot, xmid, '╯', col, false)
	for r := rTop + 1; r < rBot; r++ {
		c.set(r, xmid, '│', col, false)
	}
	c.set(rTgt, xmid, '├', col, false)
	c.hline(rTgt, xmid+1, xDst, col)
}

// pbMergeLeft mirrors pbMerge for the NL side (target to the left).
func (c *pbCanvas) pbMergeLeft(xSrc, rTop, rBot, xDst, rTgt int, col lipgloss.TerminalColor) {
	xmid := (xSrc + xDst) / 2
	c.hline(rTop, xmid, xSrc, col)
	c.hline(rBot, xmid, xSrc, col)
	c.set(rTop, xmid, '╭', col, false)
	c.set(rBot, xmid, '╰', col, false)
	for r := rTop + 1; r < rBot; r++ {
		c.set(r, xmid, '│', col, false)
	}
	c.set(rTgt, xmid, '┤', col, false)
	c.hline(rTgt, xDst, xmid-1, col)
}

func seriesWinnerAbbr(si *psSeriesInfo) string {
	st := getSeriesStats(si)
	if st.team1Wins > st.team2Wins {
		return st.team1Name
	}
	if st.team2Wins > st.team1Wins {
		return st.team2Name
	}
	return ""
}

// dsForWinner returns the next-round series fed by the given winner abbr.
func dsForWinner(winner string, list []*psSeriesInfo) *psSeriesInfo {
	if winner == "" {
		return nil
	}
	for _, s := range list {
		st := getSeriesStats(s)
		if st.team1Name == winner || st.team2Name == winner {
			return s
		}
	}
	return nil
}

func fullNameFor(games []mlb.PostseasonGame, abbr string) string {
	for _, g := range games {
		if g.Teams.Away.Team.Abbreviation == abbr {
			return g.Teams.Away.Team.Name
		}
		if g.Teams.Home.Team.Abbreviation == abbr {
			return g.Teams.Home.Team.Name
		}
	}
	return abbr
}

// renderBracketTree draws the full converging tournament bracket. Returns ""
// when the data doesn't fit the standard format so the caller can fall back.
func (m PostseasonModel) renderBracketTree() string {
	smap, _ := buildSeriesMap(m.games)

	type rk struct{ league, gt string }
	by := map[rk][]*psSeriesInfo{}
	for _, si := range smap {
		by[rk{si.league, si.gameType}] = append(by[rk{si.league, si.gameType}], si)
	}
	for k := range by {
		sort.Slice(by[k], func(i, j int) bool { return by[k][i].label < by[k][j].label })
	}

	alWC, alDS, alCS := by[rk{"AL", "F"}], by[rk{"AL", "D"}], by[rk{"AL", "L"}]
	nlWC, nlDS, nlCS := by[rk{"NL", "F"}], by[rk{"NL", "D"}], by[rk{"NL", "L"}]
	wsList := by[rk{"WS", "W"}]
	if len(alWC) != 2 || len(alDS) != 2 || len(alCS) != 1 ||
		len(nlWC) != 2 || len(nlDS) != 2 || len(nlCS) != 1 || len(wsList) != 1 {
		return "" // not the standard 12-team format → fall back
	}

	alColor := colorRed
	nlColor := colorBlue

	// X columns.
	const (
		xWC1 = 0
		xDS1 = 15
		xCS1 = 30
		xWS  = 45
		xCS2 = 60
		xDS2 = 75
		xWC2 = 90
	)
	cv := newPBCanvas(xWC2+pbBoxW+1, 12)

	// Order DS to align with the WC whose winner feeds it.
	alDSord := []*psSeriesInfo{dsForWinner(seriesWinnerAbbr(alWC[0]), alDS), dsForWinner(seriesWinnerAbbr(alWC[1]), alDS)}
	nlDSord := []*psSeriesInfo{dsForWinner(seriesWinnerAbbr(nlWC[0]), nlDS), dsForWinner(seriesWinnerAbbr(nlWC[1]), nlDS)}
	// Fall back to natural order if matching failed.
	if alDSord[0] == nil || alDSord[1] == nil || alDSord[0] == alDSord[1] {
		alDSord = alDS
	}
	if nlDSord[0] == nil || nlDSord[1] == nil || nlDSord[0] == nlDSord[1] {
		nlDSord = nlDS
	}

	// AL boxes
	cv.pbBox(0, xWC1, alWC[0], alColor)
	cv.pbBox(8, xWC1, alWC[1], alColor)
	cv.pbBox(0, xDS1, alDSord[0], alColor)
	cv.pbBox(8, xDS1, alDSord[1], alColor)
	cv.pbBox(4, xCS1, alCS[0], alColor)
	// NL boxes
	cv.pbBox(0, xWC2, nlWC[0], nlColor)
	cv.pbBox(8, xWC2, nlWC[1], nlColor)
	cv.pbBox(0, xDS2, nlDSord[0], nlColor)
	cv.pbBox(8, xDS2, nlDSord[1], nlColor)
	cv.pbBox(4, xCS2, nlCS[0], nlColor)
	// World Series (center)
	cv.pbBox(4, xWS, wsList[0], colorGold)

	// AL connectors
	cv.hline(attachRow(0), xWC1+pbBoxW, xDS1-1, alColor) // WC1→DS1
	cv.hline(attachRow(8), xWC1+pbBoxW, xDS1-1, alColor) // WC2→DS2
	cv.pbMerge(xDS1+pbBoxW, attachRow(0), attachRow(8), xCS1-1, attachRow(4), alColor)
	cv.hline(attachRow(4), xCS1+pbBoxW, xWS-1, alColor) // CS→WS
	// NL connectors (mirrored)
	cv.hline(attachRow(0), xDS2+pbBoxW, xWC2-1, nlColor)
	cv.hline(attachRow(8), xDS2+pbBoxW, xWC2-1, nlColor)
	cv.pbMergeLeft(xDS2-1, attachRow(0), attachRow(8), xCS2+pbBoxW, attachRow(4), nlColor)
	cv.hline(attachRow(4), xWS+pbBoxW, xCS2-1, nlColor)

	body := cv.String()

	// Header row of round labels.
	// Center each label over its column (box center = left+4).
	header := newPBCanvas(xWC2+pbBoxW+1, 1)
	lbl := func(left int, s string, col lipgloss.TerminalColor, bold bool) {
		header.text(0, left+4-len([]rune(s))/2, s, col, bold)
	}
	lbl(xWC1, "WILD CARD", colorMuted, false)
	lbl(xDS1, "ALDS", alColor, true)
	lbl(xCS1, "ALCS", alColor, true)
	lbl(xWS, "WS", colorGold, true)
	lbl(xCS2, "NLCS", nlColor, true)
	lbl(xDS2, "NLDS", nlColor, true)
	lbl(xWC2, "WILD CARD", colorMuted, false)

	// Champion banner (only when the World Series is decided).
	ts, te := headerColors()
	ws := wsList[0]
	block := header.String() + "\n" + body
	if champ := seriesWinnerAbbr(ws); champ != "" && getSeriesStats(ws).done {
		name := fullNameFor(m.games, champ)
		banner := "🏆  " + gradientText("WORLD SERIES CHAMPIONS", ts, te) + "  🏆\n" +
			StyleAccent.Bold(true).Render(name)
		block = centerBlock(banner, cv.w) + "\n\n" + block
	}

	return centerBlock(block, m.width)
}
