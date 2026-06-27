package ui

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

// teamColorsJSON maps MLB team ID (string) to that team's dominant brand color
// as "#RRGGBB". Generated once from the official team logos.
//
//go:embed teamcolors.json
var teamColorsJSON []byte

var (
	teamColorsOnce sync.Once
	teamColors     map[string]string
)

func loadTeamColors() map[string]string {
	teamColorsOnce.Do(func() {
		teamColors = map[string]string{}
		_ = json.Unmarshal(teamColorsJSON, &teamColors)
	})
	return teamColors
}

// hexToRGB parses "#RRGGBB" into 0-255 components; unparseable input yields white.
func hexToRGB(hex string) (int, int, int) {
	hex = strings.TrimPrefix(hex, "#")
	if len(hex) != 6 {
		return 255, 255, 255
	}
	r, e1 := strconv.ParseInt(hex[0:2], 16, 0)
	g, e2 := strconv.ParseInt(hex[2:4], 16, 0)
	b, e3 := strconv.ParseInt(hex[4:6], 16, 0)
	if e1 != nil || e2 != nil || e3 != nil {
		return 255, 255, 255
	}
	return int(r), int(g), int(b)
}

func clampByte(v int) int {
	switch {
	case v < 0:
		return 0
	case v > 255:
		return 255
	default:
		return v
	}
}

// adaptForBackground shifts a color toward legibility for the current terminal
// background, preserving hue: on a dark background very dark colors (navy,
// black) are lightened to a luminance floor; on a light background very light
// colors (white) are darkened to a luminance ceiling. Mid-tones pass through.
// The shift is additive so pure black/white become a neutral gray rather than
// staying invisible.
func adaptForBackground(r, g, b int) (int, int, int) {
	lum := (299*r + 587*g + 114*b) / 1000
	if lipgloss.HasDarkBackground() {
		const minLum = 120
		if lum < minLum {
			d := minLum - lum
			return clampByte(r + d), clampByte(g + d), clampByte(b + d)
		}
	} else {
		const maxLum = 140
		if lum > maxLum {
			d := lum - maxLum
			return clampByte(r - d), clampByte(g - d), clampByte(b - d)
		}
	}
	return r, g, b
}

// teamDisplayColor returns a legible terminal color for a team's brand color,
// adapted to the current terminal background. Returns ok=false when the team
// has no color data.
func teamDisplayColor(teamID int) (lipgloss.Color, bool) {
	hex, ok := loadTeamColors()[strconv.Itoa(teamID)]
	if !ok {
		return lipgloss.Color(""), false
	}
	r, g, b := adaptForBackground(hexToRGB(hex))
	return lipgloss.Color(fmt.Sprintf("#%02x%02x%02x", r, g, b)), true
}

// teamDot returns a solid "●" marker in the team's (legible) color, or "" when
// the team has no color data. Always one display column wide.
func teamDot(teamID int) string {
	c, ok := teamDisplayColor(teamID)
	if !ok {
		return ""
	}
	return lipgloss.NewStyle().Foreground(c).Render("●")
}

// teamTag renders "● ABBR" in the team's color: a solid marker plus the
// (already-padded) abbreviation in bold team color. Falls back to a plain
// header-styled abbreviation when no color data exists.
func teamTag(teamID int, abbr string) string {
	c, ok := teamDisplayColor(teamID)
	if !ok {
		return StyleHeader.Render(abbr)
	}
	st := lipgloss.NewStyle().Foreground(c)
	return st.Render("●") + " " + st.Bold(true).Render(abbr)
}

// teamText renders text in the team's (legible) color without forcing bold,
// for list and sidebar contexts. Returns the text unstyled when no color data
// exists, so the caller's surrounding style still applies.
func teamText(teamID int, text string) string {
	c, ok := teamDisplayColor(teamID)
	if !ok {
		return text
	}
	return lipgloss.NewStyle().Foreground(c).Render(text)
}

// teamHeadline renders text bold in the team's color, for matchup headers.
// Falls back to the standard bold header style when no color data exists.
func teamHeadline(teamID int, text string) string {
	c, ok := teamDisplayColor(teamID)
	if !ok {
		return StyleHeader.Bold(true).Render(text)
	}
	return lipgloss.NewStyle().Foreground(c).Bold(true).Render(text)
}

// teamAbbrev returns a team's abbreviation, falling back to up-to-3 initials
// derived from the team name when the API supplies none.
func teamAbbrev(t mlb.Team) string {
	if t.Abbreviation != "" {
		return t.Abbreviation
	}
	var b strings.Builder
	for _, w := range strings.Fields(t.Name) {
		if len(w) > 0 {
			b.WriteByte(w[0])
		}
	}
	s := strings.ToUpper(b.String())
	if len(s) > 3 {
		s = s[:3]
	}
	return s
}

// teamBadge renders a crisp, always-legible wordmark for a team: the
// abbreviation in a rounded border, both tinted in the team's (background-
// adapted) color. Falls back to the gold accent when no color data exists.
func teamBadge(t mlb.Team) string {
	style := lipgloss.NewStyle().Bold(true).Padding(0, 1).Border(lipgloss.RoundedBorder())
	if c, ok := teamDisplayColor(t.ID); ok {
		style = style.Foreground(c).BorderForeground(c)
	} else {
		style = style.Foreground(colorGold).BorderForeground(colorGold)
	}
	return style.Render(teamAbbrev(t))
}
