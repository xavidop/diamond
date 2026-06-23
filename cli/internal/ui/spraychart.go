package ui

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// Spray chart drawn from the catcher's view: home plate at bottom-center,
// foul lines fanning up-left / up-right, outfield arc across the top.
const sprayW, sprayH = 52, 22

func RenderSprayChart(plays []mlb.PlayEvent, reveal float64) string {
	grid := make([][]rune, sprayH)
	gcol := make([][]lipgloss.TerminalColor, sprayH)
	for i := range grid {
		grid[i] = make([]rune, sprayW)
		gcol[i] = make([]lipgloss.TerminalColor, sprayW)
		for j := range grid[i] {
			grid[i][j] = ' '
			gcol[i][j] = colorDim
		}
	}
	put := func(r, c int, ch rune, col lipgloss.TerminalColor) {
		if r >= 0 && r < sprayH && c >= 0 && c < sprayW {
			grid[r][c] = ch
			gcol[r][c] = col
		}
	}

	hr, hc := sprayH-1, sprayW/2

	// Foul lines (aspect-corrected ~45°).
	for i := 0; ; i++ {
		r := hr - i
		off := int(math.Round(float64(i) * 1.35))
		put(r, hc-off, '·', colorDim)
		put(r, hc+off, '·', colorDim)
		if r <= 0 || (hc-off < 0 && hc+off >= sprayW) {
			break
		}
	}
	// Outfield arc connecting the foul-line tops (quadratic, peaks at center).
	topRow := hr - int(float64(hc)/1.35)
	if topRow < 1 {
		topRow = 1
	}
	for c := 0; c < sprayW; c++ {
		d := float64(c-hc) / float64(hc) // -1..1
		row := topRow - int(math.Round(2*(1-d*d)))
		put(row, c, '·', colorDim)
	}
	// Infield diamond + bases.
	put(hr-7, hc, '◇', colorMuted)     // 2nd
	put(hr-4, hc-5, '◇', colorMuted)   // 3rd
	put(hr-4, hc+5, '◇', colorMuted)   // 1st
	put(hr, hc, '⌂', colorText)        // home plate

	// Collect batted balls from playEvents (hitData lives there, not on the play).
	type hit struct {
		r, c, pri int
		ch        rune
		col       lipgloss.TerminalColor
	}
	var hits []hit
	inPlay := 0
	for _, play := range plays {
		var hd *mlb.HitData
		for k := range play.PlayEvents {
			if play.PlayEvents[k].HitData != nil {
				hd = play.PlayEvents[k].HitData
			}
		}
		if hd == nil {
			continue
		}
		x, y := hd.Coordinates.CoordX, hd.Coordinates.CoordY
		if x == 0 && y == 0 {
			continue
		}
		inPlay++
		c := int(x / 250.0 * float64(sprayW-1))
		r := int(y / 210.0 * float64(sprayH-1))
		event := strings.ToLower(play.Result.Event)
		var ch rune
		var col lipgloss.TerminalColor
		var pri int
		switch {
		case strings.Contains(event, "home run"):
			ch, col, pri = '★', colorRed, 4
		case strings.Contains(event, "triple"):
			ch, col, pri = '▲', colorCyan, 3
		case strings.Contains(event, "double"):
			ch, col, pri = '◆', colorGold, 2
		case strings.Contains(event, "single"):
			ch, col, pri = '●', colorGreen, 1
		default:
			ch, col, pri = '×', colorDim, 0
		}
		hits = append(hits, hit{r, c, pri, ch, col})
	}
	// Draw hits low-priority first so HRs/XBH land on top, revealing them
	// progressively for a pop-in animation (outs first, highlights last).
	sort.SliceStable(hits, func(i, j int) bool { return hits[i].pri < hits[j].pri })
	shown := int(reveal * float64(len(hits)))
	if shown > len(hits) {
		shown = len(hits)
	}
	for _, h := range hits[:shown] {
		put(h.r, h.c, h.ch, h.col)
	}

	if inPlay == 0 {
		return StyleDim.Render("  No batted-ball data available yet.")
	}

	var sb strings.Builder
	sb.WriteString(StyleHeader.Render("  Spray Chart") +
		StyleDim.Render(fmt.Sprintf("   %d balls in play", inPlay)) + "\n\n")
	for r := 0; r < sprayH; r++ {
		sb.WriteString(" ")
		for c := 0; c < sprayW; c++ {
			if grid[r][c] == ' ' {
				sb.WriteByte(' ')
			} else {
				sb.WriteString(lipgloss.NewStyle().Foreground(gcol[r][c]).Render(string(grid[r][c])))
			}
		}
		sb.WriteRune('\n')
	}

	legend := fmt.Sprintf("  %s HR   %s 3B   %s 2B   %s 1B   %s Out",
		lipgloss.NewStyle().Foreground(colorRed).Render("★"),
		lipgloss.NewStyle().Foreground(colorCyan).Render("▲"),
		lipgloss.NewStyle().Foreground(colorGold).Render("◆"),
		lipgloss.NewStyle().Foreground(colorGreen).Render("●"),
		StyleDim.Render("×"),
	)
	return sb.String() + "\n" + legend
}
