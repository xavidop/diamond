package ui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// Shared layout helpers used by the Home dashboard and the postseason bracket.

// centerBlock centers a (possibly multi-line, possibly ANSI-styled) block
// horizontally within visual width w by padding every line equally.
func centerBlock(s string, w int) string {
	lines := strings.Split(s, "\n")
	maxw := 0
	for _, ln := range lines {
		if lw := lipgloss.Width(ln); lw > maxw {
			maxw = lw
		}
	}
	pad := (w - maxw) / 2
	if pad < 0 {
		pad = 0
	}
	prefix := strings.Repeat(" ", pad)
	for i := range lines {
		lines[i] = prefix + lines[i]
	}
	return strings.Join(lines, "\n")
}

// statusRank orders live games first, then upcoming, then finished.
func statusRank(g mlb.Game) int {
	switch g.Status.AbstractGameState {
	case "Live":
		return 0
	case "Final":
		return 2
	default:
		return 1
	}
}

// formatTodayGame renders one game as a compact one-liner for the dashboard.
func formatTodayGame(g mlb.Game) string {
	a := teamAbbr(g.Teams.Away)
	h := teamAbbr(g.Teams.Home)
	switch g.Status.AbstractGameState {
	case "Live":
		aStr := fmt.Sprintf("%d", g.Teams.Away.Score)
		hStr := fmt.Sprintf("%d", g.Teams.Home.Score)
		return fmt.Sprintf("%-3s %2s-%-2s %-3s ", a, aStr, hStr, h) +
			pulseDot() + StyleLiveBadge.Render(g.Linescore.CurrentInningOrdinal)
	case "Final":
		return fmt.Sprintf("%-3s %2d-%-2d %-3s ", a, g.Teams.Away.Score, g.Teams.Home.Score, h) +
			StyleDim.Render("Final")
	default:
		return fmt.Sprintf("%-3s  @  %-3s ", a, h) + StyleDim.Render(shortClock(g.GameDate))
	}
}

func shortClock(gameDate string) string {
	t, err := time.Parse(time.RFC3339, gameDate)
	if err != nil {
		return ""
	}
	return t.In(time.Local).Format("3:04PM")
}
