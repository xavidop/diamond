package ui

import (
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
	"github.com/xavidop/diamond/cli/internal/version"
)

type navItem struct {
	label string
	view  ViewID
}

var navItems = []navItem{
	{"Home", ViewHome},
	{"Scores", ViewScores},
	{"Standings", ViewStandings},
	{"Leaders", ViewLeaders},
	{"Streaks", ViewStreaks},
	{"Compare", ViewCompare},
	{"Team Compare", ViewTeamCompare},
	{"Teams", ViewTeam},
	{"Players", ViewPlayer},
	{"Postseason", ViewPostseason},
	{"Awards", ViewAwards},
	{"Transactions", ViewTransactions},
	{"History", ViewHistory},
	{"Draft", ViewDraft},
	{"Venues", ViewVenues},
	{"Favorites", ViewFavorites},
	{"Glossary", ViewGlossary},
	{"DiamondGPT ✨", ViewDiamondGPT},
}

const sidebarWidth = 22 // total column width incl. border

// navIndexFor returns the sidebar index of a content view (Home if unknown).
func navIndexFor(v ViewID) int {
	for i, n := range navItems {
		if n.view == v {
			return i
		}
	}
	return 0
}

// Sidebar is the always-visible left navigation panel.
type Sidebar struct {
	cursor int
	height int
}

func NewSidebar() Sidebar { return Sidebar{} }

// View renders the sidebar. focused dims/highlights the border + shows the
// cursor; active is the content view currently shown (rendered in gold).
func (s Sidebar) View(focused bool, sport mlb.Sport, active ViewID, games []mlb.Game) string {
	start, end := headerColors()
	phase := float64(animFrame) * 0.018

	var b strings.Builder
	// Brand
	b.WriteString(StyleAccent.Render("⚾ ") + gradientShimmer("DIAMOND", start, end, phase) + "\n")
	b.WriteString(StyleDim.Render("["+sport.Abbreviation+" ▾]  "+version.Short()) + "\n")
	b.WriteString(StyleDim.Render(strings.Repeat("─", 18)) + "\n")

	activeIdx := navIndexFor(active)

	// Window the list to fit height if needed (cursor-follow). Reserve rows for
	// the brand header and the live/upcoming footer.
	avail := s.height - 12
	if avail < 4 {
		avail = 4
	}
	start0, end0 := 0, len(navItems)
	if len(navItems) > avail {
		start0 = s.cursor - avail/2
		if start0 < 0 {
			start0 = 0
		}
		end0 = start0 + avail
		if end0 > len(navItems) {
			end0 = len(navItems)
			start0 = end0 - avail
		}
	}

	for i := start0; i < end0; i++ {
		it := navItems[i]
		pointer := "  "
		if focused && i == s.cursor {
			pointer = StyleAccent.Bold(true).Render("▸ ")
		}
		label := it.label
		switch {
		case i == activeIdx:
			label = StyleAccent.Bold(true).Render(label)
		case focused && i == s.cursor:
			label = lipgloss.NewStyle().Foreground(colorText).Bold(true).Render(label)
		default:
			label = StyleItemNormal.Render(label)
		}
		b.WriteString(pointer + label + "\n")
	}

	// Footer: live games, or — when none are live — today's upcoming games.
	b.WriteString(StyleDim.Render(strings.Repeat("─", 18)) + "\n")
	b.WriteString(sidebarFooter(games))

	border := colorBorder
	if !focused {
		border = colorDim
	}
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(border).
		Padding(0, 1).
		Width(sidebarWidth - 2).
		Height(s.height - 1).
		Render(strings.TrimRight(b.String(), "\n"))
}

// sidebarFooter shows live games (with a pulsing badge), or — when none are
// live — the day's upcoming games with start times.
func sidebarFooter(games []mlb.Game) string {
	var live, upcoming []mlb.Game
	for _, g := range games {
		switch g.Status.AbstractGameState {
		case "Live":
			live = append(live, g)
		case "Preview":
			upcoming = append(upcoming, g)
		}
	}

	var b strings.Builder
	if len(live) > 0 {
		b.WriteString(pulseDot() + " " + StyleLiveBadge.Render(fmt.Sprintf("%d live", len(live))) + "\n")
		for i, g := range live {
			if i >= 4 {
				b.WriteString(StyleDim.Render(fmt.Sprintf("+%d more", len(live)-i)))
				break
			}
			b.WriteString(sidebarGameLine(g, true) + "\n")
		}
		return strings.TrimRight(b.String(), "\n")
	}

	if len(upcoming) == 0 {
		return StyleDim.Render("no games today")
	}
	sort.SliceStable(upcoming, func(i, j int) bool { return upcoming[i].GameDate < upcoming[j].GameDate })
	b.WriteString(StyleDim.Render("upcoming") + "\n")
	for i, g := range upcoming {
		if i >= 5 {
			b.WriteString(StyleDim.Render(fmt.Sprintf("+%d more", len(upcoming)-i)))
			break
		}
		b.WriteString(sidebarGameLine(g, false) + "\n")
	}
	return strings.TrimRight(b.String(), "\n")
}

// sidebarGameLine renders one compact game line (fits the narrow column).
// Upcoming lines right-align the away abbr so every "@" lines up, and
// right-align the clock so every AM/PM lines up — a clean two-column read.
func sidebarGameLine(g mlb.Game, live bool) string {
	a, h := teamAbbr(g.Teams.Away), teamAbbr(g.Teams.Home)
	awayID, homeID := g.Teams.Away.Team.ID, g.Teams.Home.Team.ID
	if live {
		return teamText(awayID, fmt.Sprintf("%-3s", a)) +
			StyleItemNormal.Render(fmt.Sprintf(" %d-%d ", g.Teams.Away.Score, g.Teams.Home.Score)) +
			teamText(homeID, fmt.Sprintf("%-3s", h))
	}
	return teamText(awayID, fmt.Sprintf("%3s", a)) +
		StyleDim.Render("@") +
		teamText(homeID, fmt.Sprintf("%-3s", h)) +
		StyleDim.Render(fmt.Sprintf(" %7s", shortClock(g.GameDate)))
}
