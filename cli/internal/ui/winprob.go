package ui

import (
	"fmt"
	"math"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// RenderWinProb draws a filled area chart of the home team's win probability
// over the course of the game, plus a current-state split bar for both teams.
// reveal in [0,1] wipes the chart in left-to-right for an entrance animation.
func RenderWinProb(probs []mlb.WinProbability, away, home string, reveal float64) string {
	if len(probs) == 0 {
		return StyleDim.Render("  Win probability data not available.")
	}

	chartW, chartH := 56, 12
	revealCols := int(reveal * float64(chartW))

	// Sample home win prob across the chart width.
	sampled := make([]float64, chartW)
	for i := 0; i < chartW; i++ {
		idx := int(float64(i) / float64(chartW) * float64(len(probs)))
		if idx >= len(probs) {
			idx = len(probs) - 1
		}
		sampled[i] = probs[idx].HomeTeamWinProbability
	}

	blocks := []rune{' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'}
	fill := lipgloss.NewStyle().Foreground(colorGold)
	awayCol := lipgloss.NewStyle().Foreground(colorBlue)
	dim := lipgloss.NewStyle().Foreground(colorDim)

	var sb strings.Builder
	sb.WriteString(StyleHeader.Render("  Win Probability") + StyleDim.Render("  · home team favored ▲") + "\n\n")

	for r := 0; r < chartH; r++ {
		// Y-axis label at top / mid / bottom.
		label := "     "
		switch r {
		case 0:
			label = "100% "
		case chartH / 2:
			label = " 50% "
		case chartH - 1:
			label = "  0% "
		}
		sb.WriteString(dim.Render(label + "│"))

		for c := 0; c < chartW; c++ {
			if c >= revealCols { // not yet wiped in
				if r == chartH/2 {
					sb.WriteString(dim.Render("·"))
				} else {
					sb.WriteByte(' ')
				}
				continue
			}
			totalE := int(math.Round(sampled[c] / 100.0 * float64(chartH) * 8))
			cellFromBottom := chartH - 1 - r
			e := totalE - cellFromBottom*8
			switch {
			case e >= 8:
				sb.WriteString(fill.Render("█"))
			case e > 0:
				sb.WriteString(fill.Render(string(blocks[e])))
			case r == chartH/2:
				sb.WriteString(dim.Render("·")) // 50% guideline
			default:
				sb.WriteByte(' ')
			}
		}
		sb.WriteRune('\n')
	}

	sb.WriteString(dim.Render("     └"+strings.Repeat("─", chartW)) + "\n")
	axis := "      first pitch" + strings.Repeat(" ", chartW-16) + "now"
	sb.WriteString(dim.Render(axis) + "\n\n")

	// Current-state split bars for both teams.
	last := probs[len(probs)-1]
	hp, ap := last.HomeTeamWinProbability, last.AwayTeamWinProbability
	barW := 30
	hfilled := int(math.Round(hp / 100.0 * float64(barW)))
	if hfilled > barW {
		hfilled = barW
	}
	afilled := barW - hfilled

	homeBar := fill.Render(strings.Repeat("█", hfilled)) + dim.Render(strings.Repeat("░", barW-hfilled))
	awayBar := awayCol.Render(strings.Repeat("█", afilled)) + dim.Render(strings.Repeat("░", barW-afilled))
	sb.WriteString(fmt.Sprintf("  %-18s %s %5.1f%%\n", truncate(home, 18), homeBar, hp))
	sb.WriteString(fmt.Sprintf("  %-18s %s %5.1f%%\n", truncate(away, 18), awayBar, ap))

	return sb.String()
}
