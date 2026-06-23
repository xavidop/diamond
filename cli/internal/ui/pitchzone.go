package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// Strike zone: 3×3 grid. pX in [-0.85, 0.85], pZ in [1.5, 3.5].
// We map to cell (col 0-2, row 0-2).

func RenderPitchZone(plays []mlb.PlayEvent) string {
	counts := [3][3]int{}
	total := 0

	for _, play := range plays {
		for k := range play.PlayEvents {
			pd := play.PlayEvents[k].PitchData
			if pd == nil {
				continue
			}
			px := pd.Coordinates.PX
			pz := pd.Coordinates.PZ
			if px == 0 && pz == 0 {
				continue
			}

			col := int((px + 0.85) / (1.70 / 3.0))
			row := 2 - int((pz-1.5)/(2.0/3.0))
			if col < 0 {
				col = 0
			}
			if col > 2 {
				col = 2
			}
			if row < 0 {
				row = 0
			}
			if row > 2 {
				row = 2
			}
			counts[row][col]++
			total++
		}
	}

	if total == 0 {
		return StyleDim.Render("No pitch data available.")
	}

	// Color scale: 0→#1a1a2e (dark), max→#FF4444 (red)
	heatColors := []string{"#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560", "#FF4444"}

	var sb strings.Builder
	sb.WriteString(StyleHeader.Render("  Pitch Zone Heatmap") + "\n\n")

	// Top border
	sb.WriteString("  ┌─────┬─────┬─────┐\n")
	for r := 0; r < 3; r++ {
		sb.WriteString("  │")
		for c := 0; c < 3; c++ {
			cnt := counts[r][c]
			pct := 0.0
			if total > 0 {
				pct = float64(cnt) / float64(total)
			}
			colorIdx := int(pct * float64(len(heatColors)-1))
			if colorIdx >= len(heatColors) {
				colorIdx = len(heatColors) - 1
			}
			cell := lipgloss.NewStyle().
				Background(lipgloss.Color(heatColors[colorIdx])).
				Foreground(colorText).
				Width(5).Align(lipgloss.Center).
				Render(fmt.Sprintf("%d", cnt))
			sb.WriteString(cell + "│")
		}
		sb.WriteRune('\n')
		if r < 2 {
			sb.WriteString("  ├─────┼─────┼─────┤\n")
		}
	}
	sb.WriteString("  └─────┴─────┴─────┘\n")

	sb.WriteString("\n  " + StyleDim.Render(fmt.Sprintf("Total pitches: %d", total)))

	legend := "\n\n  " + strings.Join([]string{
		lipgloss.NewStyle().Background(lipgloss.Color(heatColors[0])).Render("  ") + " Low",
		lipgloss.NewStyle().Background(lipgloss.Color(heatColors[3])).Render("  ") + " Med",
		lipgloss.NewStyle().Background(lipgloss.Color(heatColors[5])).Render("  ") + " High",
	}, "   ")
	sb.WriteString(legend)

	return sb.String()
}
