package ui

import (
	"fmt"
	"math"
	"strings"

	"github.com/charmbracelet/lipgloss"
	colorful "github.com/lucasb-eyer/go-colorful"
)

// Adaptive colors — work in both light and dark terminals
var (
	colorGold   = lipgloss.AdaptiveColor{Light: "136", Dark: "220"}
	colorRed    = lipgloss.AdaptiveColor{Light: "124", Dark: "203"}
	colorText   = lipgloss.AdaptiveColor{Light: "235", Dark: "255"}
	colorDim    = lipgloss.AdaptiveColor{Light: "242", Dark: "243"}
	colorMuted  = lipgloss.AdaptiveColor{Light: "246", Dark: "246"}
	colorBorder = lipgloss.AdaptiveColor{Light: "136", Dark: "220"}
	colorCyan   = lipgloss.AdaptiveColor{Light: "6", Dark: "86"}
	colorGreen  = lipgloss.AdaptiveColor{Light: "2", Dark: "118"}
	colorBlue   = lipgloss.AdaptiveColor{Light: "4", Dark: "75"}
)

var (
	StyleTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorGold)

	StyleHeader = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorText)

	StyleDim = lipgloss.NewStyle().
			Foreground(colorDim)

	StyleMuted = lipgloss.NewStyle().
			Foreground(colorMuted)

	StyleAccent = lipgloss.NewStyle().
			Foreground(colorGold)

	StyleLiveBadge = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorRed)

	StyleFinalBadge = lipgloss.NewStyle().
			Foreground(colorMuted)

	StyleError = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorRed)

	// StyleItemSelected: gold left border + gold bold text (golazo style)
	StyleItemSelected = lipgloss.NewStyle().
				Bold(true).
				Foreground(colorGold).
				Border(lipgloss.Border{Left: "│"}, false, false, false, true).
				BorderForeground(colorGold).
				PaddingLeft(1)

	// StyleItemNormal: plain text, indented to align with selected item
	StyleItemNormal = lipgloss.NewStyle().
			Foreground(colorText)

	// StylePanel: gold border box for left panels only
	StylePanel = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(colorBorder).
			Padding(0, 1)

	// Tab styles
	StyleTab = lipgloss.NewStyle().
			Foreground(colorMuted).
			Padding(0, 1)

	StyleActiveTab = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorGold).
			Underline(true).
			Padding(0, 1)

	StyleCyan  = lipgloss.NewStyle().Foreground(colorCyan)
	StyleGreen = lipgloss.NewStyle().Foreground(colorGreen)
)

// gradientText renders text with a character-by-character Lab color gradient.
func gradientText(text, startHex, endHex string) string {
	start, _ := colorful.Hex(startHex)
	end, _ := colorful.Hex(endHex)
	runes := []rune(text)
	n := len(runes)
	if n == 0 {
		return ""
	}
	var sb strings.Builder
	for i, ch := range runes {
		var ratio float64
		if n > 1 {
			ratio = float64(i) / float64(n-1)
		}
		c := start.BlendLab(end, ratio)
		sb.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(c.Hex())).Render(string(ch)))
	}
	return sb.String()
}

// gradientShimmer renders text with a moving two-color sheen. phase in [0,1)
// shifts the color band across the text for a subtle animation; a triangle
// wave keeps the blend seamless as it wraps. Spaces are left uncolored.
func gradientShimmer(text, startHex, endHex string, phase float64) string {
	start, _ := colorful.Hex(startHex)
	end, _ := colorful.Hex(endHex)
	runes := []rune(text)
	n := len(runes)
	if n == 0 {
		return ""
	}
	var sb strings.Builder
	for i, ch := range runes {
		if ch == ' ' {
			sb.WriteByte(' ')
			continue
		}
		p := math.Mod(float64(i)/float64(n)+phase, 1.0)
		tri := p * 2
		if tri > 1 {
			tri = 2 - tri
		}
		c := start.BlendLab(end, tri)
		sb.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(c.Hex())).Render(string(ch)))
	}
	return sb.String()
}

// headerColors returns the gradient start/end hex for dark or light terminals.
func headerColors() (string, string) {
	if lipgloss.HasDarkBackground() {
		return "#D4AF37", "#FF6B6B" // gold → coral red
	}
	return "#8B6914", "#8B0000" // dark gold → dark red
}

// PanelHeader renders "TITLE ╱╱╱╱╱╱╱╱╱╱╱╱" at the given total width,
// with the title text rendered as a gradient.
func PanelHeader(title string, width int) string {
	start, end := headerColors()
	titleStr := " " + title + " "
	gradTitle := gradientText(titleStr, start, end)
	fillLen := width - len([]rune(titleStr))
	if fillLen < 0 {
		fillLen = 0
	}
	return gradTitle + StyleDim.Render(strings.Repeat("╱", fillLen))
}

// HelpBar renders a single dim help string — no per-word styling.
func HelpBar(hints ...string) string {
	return StyleDim.Render(strings.Join(hints, "  ·  "))
}

// Medal colors for leaderboards.
var (
	colorSilver = lipgloss.AdaptiveColor{Light: "245", Dark: "252"}
	colorBronze = lipgloss.AdaptiveColor{Light: "130", Dark: "173"}
)

// osc8 wraps text in an OSC 8 terminal hyperlink so supporting terminals make it
// clickable (cmd/ctrl-click). Terminals without OSC 8 support just show the text.
func osc8(url, text string) string {
	return "\x1b]8;;" + url + "\x1b\\" + text + "\x1b]8;;\x1b\\"
}

// RenderBar renders a proportional magnitude bar of the given visual width.
func RenderBar(frac float64, width int, fg lipgloss.TerminalColor) string {
	if frac < 0 {
		frac = 0
	}
	if frac > 1 {
		frac = 1
	}
	fill := int(math.Round(frac * float64(width)))
	if fill > width {
		fill = width
	}
	return lipgloss.NewStyle().Foreground(fg).Render(strings.Repeat("█", fill)) +
		StyleDim.Render(strings.Repeat("░", width-fill))
}

// rankStyle returns a medal-colored bold style for ranks 1-3, else plain text.
func rankStyle(rank int) lipgloss.Style {
	switch rank {
	case 1:
		return lipgloss.NewStyle().Bold(true).Foreground(colorGold)
	case 2:
		return lipgloss.NewStyle().Bold(true).Foreground(colorSilver)
	case 3:
		return lipgloss.NewStyle().Bold(true).Foreground(colorBronze)
	}
	return StyleItemNormal
}

// rankColor returns the medal color for ranks 1-3, else the dim color.
func rankColor(rank int) lipgloss.TerminalColor {
	switch rank {
	case 1:
		return colorGold
	case 2:
		return colorSilver
	case 3:
		return colorBronze
	}
	return colorDim
}

// statCards lays out a horizontal row of value-over-label cards, each centered
// in cellW columns. The value is emphasized in the accent color.
func statCards(pairs [][2]string, cellW int) string {
	cells := make([]string, 0, len(pairs))
	for _, p := range pairs {
		card := lipgloss.NewStyle().Width(cellW).Align(lipgloss.Center).Render(
			StyleAccent.Bold(true).Render(p[1]) + "\n" + StyleDim.Render(p[0]))
		cells = append(cells, card)
	}
	return lipgloss.JoinHorizontal(lipgloss.Top, cells...)
}

// positionColor maps a position abbreviation to a palette color.
func positionColor(pos string) lipgloss.TerminalColor {
	switch pos {
	case "P", "SP", "RP", "LHP", "RHP":
		return colorCyan
	case "C":
		return colorRed
	case "1B", "2B", "3B", "SS", "IF":
		return colorGold
	case "LF", "CF", "RF", "OF":
		return colorGreen
	default:
		return colorMuted
	}
}

// RenderStatBar renders a two-sided comparison bar:
//
//	label
//	LA  lv ████████░░░░  rv RA
func RenderStatBar(label, la, ra string, lv, rv, barW int) string {
	total := lv + rv
	var fill int
	if total > 0 {
		fill = int(float64(barW) * float64(lv) / float64(total))
	} else {
		fill = barW / 2
	}
	if fill > barW {
		fill = barW
	}
	empty := barW - fill

	labelLine := "  " + StyleDim.Render(label) + "\n"
	bar := StyleAccent.Render(strings.Repeat("█", fill)) +
		StyleDim.Render(strings.Repeat("░", empty))
	barLine := fmt.Sprintf("  %-4s %2d %s %2d %-4s\n", la, lv, bar, rv, ra)
	return labelLine + barLine
}
