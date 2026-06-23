package ui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// animFrame is the global animation clock, advanced ~11×/sec by the App's
// ticker. Bubble Tea runs Update/View on a single goroutine, so a package
// global is safe and lets every view read the frame without plumbing it
// through each model. Bubble Tea also skips repaints when a frame's rendered
// output is unchanged, so static screens cost nothing despite the ticker.
var animFrame int

type animTickMsg struct{}

func animTick() tea.Cmd {
	return tea.Tick(90*time.Millisecond, func(time.Time) tea.Msg { return animTickMsg{} })
}

// animProgress returns eased 0→1 progress over dur frames since startFrame,
// for transient "play once then settle" animations (fill-ins, reveals).
func animProgress(startFrame, dur int) float64 {
	if dur <= 0 {
		return 1
	}
	p := float64(animFrame-startFrame) / float64(dur)
	if p <= 0 {
		return 0
	}
	if p >= 1 {
		return 1
	}
	// ease-out cubic for a snappy, decelerating feel
	inv := 1 - p
	return 1 - inv*inv*inv
}

var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// spinnerGlyph returns the current braille spinner frame in the accent color.
func spinnerGlyph() string {
	return StyleAccent.Render(spinnerFrames[animFrame%len(spinnerFrames)])
}

// loadingView renders an animated spinner followed by a dim label.
func loadingView(label string) string {
	return "  " + spinnerGlyph() + "  " + StyleDim.Render(label)
}

var colorRedDim = lipgloss.AdaptiveColor{Light: "131", Dark: "131"}

// pulseDot returns a live-game dot that gently pulses between bright and dim
// on a ~1s cycle.
func pulseDot() string {
	c := colorRed
	if (animFrame/5)%2 == 1 {
		c = colorRedDim
	}
	return lipgloss.NewStyle().Foreground(c).Render("●")
}
