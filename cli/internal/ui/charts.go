package ui

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// clampi clamps v to [lo, hi].
func clampi(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// parseIP converts MLB innings-pitched notation to a float: the fractional part
// counts outs in thirds ("6.1" = 6⅓, "6.2" = 6⅔), not tenths.
func parseIP(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	parts := strings.SplitN(s, ".", 2)
	whole, _ := strconv.ParseFloat(parts[0], 64)
	if len(parts) == 2 && parts[1] != "" {
		outs, _ := strconv.ParseFloat(parts[1], 64)
		return whole + outs/3.0
	}
	return whole
}

// rollingSeries computes a rolling-window stat across a chronological game log
// (oldest first): rolling ERA for pitchers (earnedRuns·9 / IP) or rolling AVG
// for hitters (hits / atBats), each point covering the prior `window` games.
func rollingSeries(log []mlb.StatSplit, isPitcher bool, window int) []float64 {
	if window < 1 {
		window = 1
	}
	out := make([]float64, 0, len(log))
	for i := range log {
		lo := i - window + 1
		if lo < 0 {
			lo = 0
		}
		var num, den float64
		for j := lo; j <= i; j++ {
			st := log[j].Stat
			if isPitcher {
				num += statFloat(st, "earnedRuns") * 9
				den += parseIP(statVal(st, "inningsPitched"))
			} else {
				num += statFloat(st, "hits")
				den += statFloat(st, "atBats")
			}
		}
		if den > 0 {
			out = append(out, num/den)
		} else {
			out = append(out, 0)
		}
	}
	return out
}

// sparkline renders a one-line ▁▂▃▄▅▆▇█ sparkline of the series.
func sparkline(series []float64) string {
	if len(series) == 0 {
		return ""
	}
	blocks := []rune{'▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'}
	min, max := series[0], series[0]
	for _, v := range series {
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}
	span := max - min
	if span == 0 {
		span = 1
	}
	var sb strings.Builder
	for _, v := range series {
		idx := clampi(int((v-min)/span*float64(len(blocks)-1)+0.5), 0, len(blocks)-1)
		sb.WriteRune(blocks[idx])
	}
	return sb.String()
}

// renderLineChart draws a connected line chart of series, with min/max y-axis
// labels (formatted by fmtY) and first/last x-axis labels. reveal in [0,1] wipes
// it in left-to-right. Returns "" for fewer than 2 points.
func renderLineChart(series []float64, xLabels []string, fmtY func(float64) string, color lipgloss.TerminalColor, reveal float64) string {
	n := len(series)
	if n < 2 {
		return ""
	}
	const chartH = 9
	chartW := (n-1)*6 + 1
	if chartW > 58 {
		chartW = 58
	}
	if chartW < 12 {
		chartW = 12
	}

	min, max := series[0], series[0]
	for _, v := range series {
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}
	span := max - min
	if span == 0 {
		span = 1
	}
	rowOf := func(v float64) int {
		return clampi(int(math.Round((1-(v-min)/span)*float64(chartH-1))), 0, chartH-1)
	}
	valAt := func(c int) float64 {
		t := float64(c) / float64(chartW-1) * float64(n-1)
		i0 := int(math.Floor(t))
		if i0 >= n-1 {
			return series[n-1]
		}
		f := t - float64(i0)
		return series[i0]*(1-f) + series[i0+1]*f
	}

	isPoint := make([]bool, chartW)
	for i := 0; i < n; i++ {
		isPoint[clampi(int(math.Round(float64(i)/float64(n-1)*float64(chartW-1))), 0, chartW-1)] = true
	}

	grid := make([][]rune, chartH)
	for r := range grid {
		grid[r] = make([]rune, chartW)
		for c := range grid[r] {
			grid[r][c] = ' '
		}
	}
	revealCols := chartW
	if reveal < 1 {
		revealCols = int(reveal * float64(chartW))
	}
	prevRow := rowOf(valAt(0))
	for c := 0; c < chartW && c < revealCols; c++ {
		row := rowOf(valAt(c))
		if c > 0 && row != prevRow { // vertical connector
			lo, hi := row, prevRow
			if lo > hi {
				lo, hi = hi, lo
			}
			for r := lo; r <= hi; r++ {
				grid[r][c] = '│'
			}
		}
		if isPoint[c] {
			grid[row][c] = '●'
		} else {
			grid[row][c] = '─'
		}
		prevRow = row
	}

	line := lipgloss.NewStyle().Foreground(color)
	point := lipgloss.NewStyle().Foreground(color).Bold(true)
	var sb strings.Builder
	for r := 0; r < chartH; r++ {
		label := strings.Repeat(" ", 7)
		switch r {
		case 0:
			label = fmt.Sprintf("%6s ", fmtY(max))
		case chartH - 1:
			label = fmt.Sprintf("%6s ", fmtY(min))
		}
		sb.WriteString(StyleDim.Render(label + "│"))
		for c := 0; c < chartW; c++ {
			switch grid[r][c] {
			case ' ':
				sb.WriteByte(' ')
			case '●':
				sb.WriteString(point.Render("●"))
			default:
				sb.WriteString(line.Render(string(grid[r][c])))
			}
		}
		sb.WriteByte('\n')
	}
	sb.WriteString(StyleDim.Render("       └"+strings.Repeat("─", chartW)) + "\n")
	if len(xLabels) >= 2 {
		first, last := xLabels[0], xLabels[len(xLabels)-1]
		pad := chartW - len(first) - len(last)
		if pad < 1 {
			pad = 1
		}
		sb.WriteString(StyleDim.Render("        " + first + strings.Repeat(" ", pad) + last))
	}
	return sb.String()
}

// renderArea draws a compact filled area chart (min-value baseline) of the
// series at the given height, with max/min y-axis labels on the left (formatted
// by fmtY; pass nil to omit). reveal in [0,1] wipes it in left-to-right.
func renderArea(series []float64, height int, color lipgloss.TerminalColor, reveal float64, fmtY func(float64) string) string {
	n := len(series)
	if n < 2 {
		return ""
	}
	chartW := n
	if chartW > 58 {
		chartW = 58
	}
	sampled := make([]float64, chartW)
	for i := 0; i < chartW; i++ {
		idx := clampi(int(float64(i)/float64(chartW)*float64(n)), 0, n-1)
		sampled[i] = series[idx]
	}
	min, max := series[0], series[0]
	for _, v := range series {
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}
	span := max - min
	if span == 0 {
		span = 1
	}
	blocks := []rune{' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'}
	fill := lipgloss.NewStyle().Foreground(color)
	revealCols := chartW
	if reveal < 1 {
		revealCols = int(reveal * float64(chartW))
	}
	var sb strings.Builder
	for r := 0; r < height; r++ {
		label := strings.Repeat(" ", 7)
		if fmtY != nil {
			switch r {
			case 0:
				label = fmt.Sprintf("%6s ", fmtY(max))
			case height - 1:
				label = fmt.Sprintf("%6s ", fmtY(min))
			}
		}
		sb.WriteString(StyleDim.Render(label + "│"))
		for c := 0; c < chartW; c++ {
			if c >= revealCols {
				sb.WriteByte(' ')
				continue
			}
			totalE := int(math.Round((sampled[c] - min) / span * float64(height) * 8))
			e := totalE - (height-1-r)*8
			switch {
			case e >= 8:
				sb.WriteString(fill.Render("█"))
			case e > 0:
				sb.WriteString(fill.Render(string(blocks[e])))
			default:
				sb.WriteByte(' ')
			}
		}
		sb.WriteByte('\n')
	}
	return strings.TrimRight(sb.String(), "\n")
}

// pitchOutcome maps an MLB playEvent details.code to a display color + label,
// matching the web's Ball/Strike/In play/HBP coloring. ok is false for codes
// that aren't a plottable pitch outcome.
func pitchOutcome(code string) (col lipgloss.TerminalColor, label string, ok bool) {
	switch code {
	case "H":
		return colorRed, "HBP", true
	case "D", "E", "X":
		return colorGold, "In play", true
	case "B", "*B", "I", "P", "V", "VP", "PO":
		return colorBlue, "Ball", true
	case "C", "S", "W", "F", "T", "L", "O", "Q", "M", "R", "Z":
		return colorGreen, "Strike", true
	}
	return colorMuted, "", false
}

// RenderPitchScatter plots every pitch on a catcher's-view strike-zone grid,
// colored by outcome, with the rule-book zone drawn as a rectangle. reveal in
// [0,1] pops the pitches in progressively.
func RenderPitchScatter(plays []mlb.PlayEvent, reveal float64) string {
	const w, h = 34, 17
	grid := make([][]rune, h)
	gcol := make([][]lipgloss.TerminalColor, h)
	for r := range grid {
		grid[r] = make([]rune, w)
		gcol[r] = make([]lipgloss.TerminalColor, w)
		for c := range grid[r] {
			grid[r][c] = ' '
			gcol[r][c] = colorDim
		}
	}
	put := func(r, c int, ch rune, col lipgloss.TerminalColor) {
		if r >= 0 && r < h && c >= 0 && c < w {
			grid[r][c] = ch
			gcol[r][c] = col
		}
	}
	const minX, maxX = -2.0, 2.0
	const minZ, maxZ = 0.0, 4.5
	colOf := func(px float64) int { return clampi(int((px-minX)/(maxX-minX)*float64(w-1)), 0, w-1) }
	rowOf := func(pz float64) int { return clampi(int((maxZ-pz)/(maxZ-minZ)*float64(h-1)), 0, h-1) }

	// Strike-zone rectangle: PX ±0.83 ft, PZ 1.5–3.5 ft.
	l, rr := colOf(-0.83), colOf(0.83)
	t, b := rowOf(3.5), rowOf(1.5)
	for c := l; c <= rr; c++ {
		put(t, c, '─', colorMuted)
		put(b, c, '─', colorMuted)
	}
	for r := t; r <= b; r++ {
		put(r, l, '│', colorMuted)
		put(r, rr, '│', colorMuted)
	}
	put(t, l, '┌', colorMuted)
	put(t, rr, '┐', colorMuted)
	put(b, l, '└', colorMuted)
	put(b, rr, '┘', colorMuted)

	type pt struct {
		r, c int
		col  lipgloss.TerminalColor
	}
	var pts []pt
	counts := map[string]int{}
	for _, play := range plays {
		for k := range play.PlayEvents {
			ev := play.PlayEvents[k]
			if !ev.IsPitch || ev.PitchData == nil {
				continue
			}
			px, pz := ev.PitchData.Coordinates.PX, ev.PitchData.Coordinates.PZ
			if px == 0 && pz == 0 {
				continue
			}
			col, label, ok := pitchOutcome(ev.Details.Code)
			if !ok {
				continue
			}
			counts[label]++
			pts = append(pts, pt{rowOf(pz), colOf(px), col})
		}
	}
	if len(pts) == 0 {
		return StyleDim.Render("  No pitch data available.")
	}
	shown := len(pts)
	if reveal < 1 {
		shown = clampi(int(reveal*float64(len(pts))), 0, len(pts))
	}
	for _, p := range pts[:shown] {
		put(p.r, p.c, '●', p.col)
	}

	var sb strings.Builder
	sb.WriteString(StyleHeader.Render("  Strike Zone") +
		StyleDim.Render(fmt.Sprintf("   %d pitches · catcher's view", len(pts))) + "\n\n")
	for r := 0; r < h; r++ {
		sb.WriteString("  ")
		for c := 0; c < w; c++ {
			if grid[r][c] == ' ' {
				sb.WriteByte(' ')
			} else {
				sb.WriteString(lipgloss.NewStyle().Foreground(gcol[r][c]).Render(string(grid[r][c])))
			}
		}
		sb.WriteByte('\n')
	}
	dot := func(c lipgloss.TerminalColor) string { return lipgloss.NewStyle().Foreground(c).Render("●") }
	sb.WriteString("\n  " + fmt.Sprintf("%s Ball   %s Strike   %s In play   %s HBP",
		dot(colorBlue), dot(colorGreen), dot(colorGold), dot(colorRed)))
	return sb.String()
}

// pitchAbbrev returns a short 2-letter code for a pitch-type description.
func pitchAbbrev(desc string) string {
	switch desc {
	case "Four-Seam Fastball":
		return "FF"
	case "Cutter":
		return "FC"
	case "Sinker", "Two-Seam Fastball":
		return "SI"
	case "Curveball":
		return "CU"
	case "Slider":
		return "SL"
	case "Changeup":
		return "CH"
	case "Splitter":
		return "FS"
	case "Sweeper":
		return "SW"
	case "Slurve":
		return "SV"
	case "Knuckle Curve":
		return "KC"
	case "Knuckleball":
		return "KN"
	case "Forkball":
		return "FO"
	case "Eephus":
		return "EP"
	}
	r := []rune(strings.ToUpper(desc))
	if len(r) >= 2 {
		return string(r[:2])
	}
	if len(r) == 1 {
		return string(r)
	}
	return "?"
}

// renderArsenalRadar draws a compact usage radar (one axis per pitch type,
// radius = usage relative to the most-used pitch) with a legend. Returns ""
// for fewer than 3 pitch types (a radar needs ≥3 axes to read).
func renderArsenalRadar(pitches []mlb.ArsenalPitch, reveal float64) string {
	n := len(pitches)
	if n < 3 {
		return ""
	}
	if n > 6 {
		n = 6
	}
	axes := pitches[:n]
	maxUse := 0.0
	for _, a := range axes {
		if a.UsagePct > maxUse {
			maxUse = a.UsagePct
		}
	}
	if maxUse == 0 {
		return ""
	}

	const w, h = 27, 13
	cx, cy := float64(w-1)/2, float64(h-1)/2
	rx, ry := cx-1, cy-1
	grid := make([][]rune, h)
	gcol := make([][]lipgloss.TerminalColor, h)
	for r := range grid {
		grid[r] = make([]rune, w)
		gcol[r] = make([]lipgloss.TerminalColor, w)
		for c := range grid[r] {
			grid[r][c] = ' '
			gcol[r][c] = colorDim
		}
	}
	put := func(r, c int, ch rune, col lipgloss.TerminalColor) {
		if r >= 0 && r < h && c >= 0 && c < w {
			grid[r][c] = ch
			gcol[r][c] = col
		}
	}

	type p2 struct{ r, c int }
	verts := make([]p2, n)
	for i, a := range axes {
		ang := -math.Pi/2 + 2*math.Pi*float64(i)/float64(n)
		// rim spoke marker
		put(int(math.Round(cy-math.Sin(ang)*ry)), int(math.Round(cx+math.Cos(ang)*rx)), '·', colorDim)
		vfrac := (a.UsagePct / maxUse) * reveal
		verts[i] = p2{
			int(math.Round(cy - math.Sin(ang)*ry*vfrac)),
			int(math.Round(cx + math.Cos(ang)*rx*vfrac)),
		}
	}
	// Connect vertices into a polygon.
	for i := 0; i < n; i++ {
		a, b := verts[i], verts[(i+1)%n]
		steps := int(math.Max(math.Abs(float64(a.r-b.r)), math.Abs(float64(a.c-b.c))))
		if steps < 1 {
			steps = 1
		}
		for s := 0; s <= steps; s++ {
			tt := float64(s) / float64(steps)
			put(int(math.Round(float64(a.r)+(float64(b.r-a.r))*tt)),
				int(math.Round(float64(a.c)+(float64(b.c-a.c))*tt)), '·', colorGold)
		}
	}
	put(int(math.Round(cy)), int(math.Round(cx)), '+', colorDim)
	for _, v := range verts {
		put(v.r, v.c, '◆', colorGold)
	}

	var sb strings.Builder
	sb.WriteString(StyleAccent.Bold(true).Render("  USAGE RADAR") + "\n\n")
	for r := 0; r < h; r++ {
		sb.WriteString("  ")
		for c := 0; c < w; c++ {
			if grid[r][c] == ' ' {
				sb.WriteByte(' ')
			} else {
				sb.WriteString(lipgloss.NewStyle().Foreground(gcol[r][c]).Render(string(grid[r][c])))
			}
		}
		sb.WriteByte('\n')
	}
	parts := make([]string, n)
	for i, a := range axes {
		parts[i] = StyleAccent.Render(pitchAbbrev(a.Type)) + StyleDim.Render(fmt.Sprintf(" %.0f%%", a.UsagePct*100))
	}
	sb.WriteString("  " + strings.Join(parts, "   "))
	return sb.String()
}
