package ui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

// GlossaryTerm is one stat/standings definition.
type GlossaryTerm struct{ Abbr, Name, Def string }

// glossaryTerms is the ported glossary (hitting, pitching, standings).
var glossaryTerms = []GlossaryTerm{
	// Hitting
	{"AVG", "Batting Average", "Hits divided by at-bats."},
	{"OBP", "On-Base Percentage", "Times reaching base (H+BB+HBP) divided by plate appearances."},
	{"SLG", "Slugging Percentage", "Total bases divided by at-bats."},
	{"OPS", "On-Base Plus Slugging", "OBP plus SLG; a quick all-round offense gauge."},
	{"ISO", "Isolated Power", "SLG minus AVG; extra-base power only."},
	{"BABIP", "Batting Avg on Balls In Play", "Hits on balls in play divided by balls in play."},
	{"wRC+", "Weighted Runs Created Plus", "Park- and league-adjusted offense; 100 is league average."},
	{"HR", "Home Runs", "Fair balls hit out of play scoring the batter."},
	{"RBI", "Runs Batted In", "Runs that score on the batter's plate appearance."},
	{"SB", "Stolen Bases", "Bases taken without the ball being put in play."},
	{"R", "Runs", "Times the player crossed home plate."},
	{"H", "Hits", "Times the batter safely reached on a fair ball."},
	// Pitching
	{"ERA", "Earned Run Average", "Earned runs allowed per nine innings."},
	{"WHIP", "Walks + Hits per IP", "(Walks + hits) divided by innings pitched."},
	{"FIP", "Fielding Independent Pitching", "ERA-scaled estimate from K, BB, HBP, HR only."},
	{"ERA+", "Adjusted ERA", "Park- and league-adjusted ERA; 100 is league average."},
	{"K", "Strikeouts", "Batters retired on strikes."},
	{"K/9", "Strikeouts per 9", "Strikeouts per nine innings."},
	{"BB", "Walks", "Bases on balls (four balls)."},
	{"BB/9", "Walks per 9", "Walks per nine innings."},
	{"IP", "Innings Pitched", "Outs recorded divided by three."},
	{"ER", "Earned Runs", "Runs scored without the aid of an error."},
	{"W", "Wins", "Credited to the pitcher of record on a winning team."},
	{"L", "Losses", "Charged to the pitcher of record on a losing team."},
	{"SV", "Saves", "Credited for finishing a close win under save rules."},
	{"HLD", "Holds", "A reliever protecting a lead without finishing the game."},
	{"SO", "Strikeouts", "Same as K; batters retired on strikes."},
	// Standings
	{"PCT", "Winning Percentage", "Wins divided by games played."},
	{"GB", "Games Back", "Games behind the division leader."},
	{"WCGB", "Wild Card Games Back", "Games behind the final wild-card spot."},
	{"M#", "Magic Number", "Wins + opponent losses needed to clinch."},
	{"RS", "Runs Scored", "Total runs scored on the season."},
	{"RA", "Runs Allowed", "Total runs allowed on the season."},
	{"DIFF", "Run Differential", "Runs scored minus runs allowed."},
	{"PYTHW", "Pythagorean Wins", "Expected wins from runs scored/allowed."},
	{"L10", "Last Ten", "Win-loss record over the last ten games."},
	{"STRK", "Streak", "Current win (W) or loss (L) streak length."},
	// Statcast & advanced
	{"WAR", "Wins Above Replacement", "Total value vs a replacement-level player, in wins."},
	{"wOBA", "Weighted On-Base Average", "One rate weighting each way of reaching base by run value."},
	{"wRAA", "Weighted Runs Above Average", "Batting runs above league average."},
	{"xBA", "Expected Batting Average", "AVG expected from each ball's exit velocity + launch angle."},
	{"xSLG", "Expected Slugging", "SLG expected from contact quality."},
	{"xwOBA", "Expected wOBA", "wOBA expected from contact quality (plus strikeouts and walks)."},
	{"xwOBACON", "Expected wOBA on Contact", "xwOBA on batted balls only."},
	{"Barrel%", "Barrel Rate", "Share of batted balls with the ideal exit-velo + launch-angle combo."},
	{"EV", "Exit Velocity", "How hard the ball leaves the bat, in mph."},
	{"Max EV", "Max Exit Velocity", "The batter's hardest-hit ball of the season."},
	{"Hard-Hit%", "Hard-Hit Rate", "Share of batted balls hit 95+ mph."},
	{"LA", "Launch Angle", "Vertical angle of the ball off the bat, in degrees."},
	{"Sprint", "Sprint Speed", "Feet per second in a player's fastest one-second window."},
	{"Bat Speed", "Bat Speed", "Average speed of the bat head through the zone, in mph."},
	{"Whiff%", "Whiff Rate", "Swings and misses as a share of total swings."},
	{"Chase%", "Chase Rate", "Swings at pitches outside the strike zone."},
	{"OAA", "Outs Above Average", "Statcast range-based fielding runs saved."},
	{"xFIP", "Expected FIP", "FIP with home runs normalized to a league fly-ball rate."},
	{"Pctl", "Percentile", "A player's Statcast rank vs the league, 0 (worst) to 100 (best)."},
	{"Zones", "Hot/Cold Zones", "A batter's results by pitch location in the strike zone."},
}

// filterGlossary returns terms whose abbreviation or definition contains q
// (case-insensitive). Empty q returns all.
func filterGlossary(terms []GlossaryTerm, q string) []GlossaryTerm {
	q = strings.ToLower(strings.TrimSpace(q))
	if q == "" {
		return terms
	}
	var out []GlossaryTerm
	for _, t := range terms {
		if strings.Contains(strings.ToLower(t.Abbr), q) ||
			strings.Contains(strings.ToLower(t.Name), q) ||
			strings.Contains(strings.ToLower(t.Def), q) {
			out = append(out, t)
		}
	}
	return out
}

type GlossaryModel struct {
	search    SearchInput
	scroll    int
	enteredAt int
	width     int
	height    int
}

func NewGlossaryModel() GlossaryModel {
	return GlossaryModel{search: NewSearchInput("Filter terms…"), enteredAt: animFrame}
}

func (m GlossaryModel) Init() tea.Cmd { return nil }

// CapturesText routes free text to the filter box (app suppresses shortcuts).
func (m GlossaryModel) CapturesText() bool { return true }

func (m GlossaryModel) Update(msg tea.Msg) (GlossaryModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		case "down":
			m.scroll++
		case "pgdown":
			pageRows := m.height - 9
			if pageRows < 2 {
				pageRows = 2
			}
			m.scroll += pageRows
		case "up":
			if m.scroll > 0 {
				m.scroll--
			}
		case "pgup":
			pageRows := m.height - 9
			if pageRows < 2 {
				pageRows = 2
			}
			m.scroll -= pageRows
			if m.scroll < 0 {
				m.scroll = 0
			}
		default:
			var cmd tea.Cmd
			m.search, cmd = m.search.Update(msg)
			m.scroll = 0
			return m, cmd
		}
		// Clamp scroll so it can't exceed the filtered list.
		filtered := filterGlossary(glossaryTerms, m.search.Value())
		const linesPerTerm = 2
		rowsAvail := m.height - 9
		if rowsAvail < 4 {
			rowsAvail = 4
		}
		maxTerms := rowsAvail / linesPerTerm
		if maxTerms < 1 {
			maxTerms = 1
		}
		maxScroll := len(filtered) - maxTerms
		if maxScroll < 0 {
			maxScroll = 0
		}
		if m.scroll > maxScroll {
			m.scroll = maxScroll
		}
	}
	return m, nil
}

func (m GlossaryModel) View() string {
	ts, te := headerColors()

	var sb strings.Builder

	// Gradient header
	sb.WriteString("  " + gradientText("GLOSSARY", ts, te) + "\n\n")

	// Filter box
	sb.WriteString("  " + m.search.View() + "\n\n")

	// Matching terms
	matched := filterGlossary(glossaryTerms, m.search.Value())

	if len(matched) == 0 {
		sb.WriteString(StyleDim.Render("  no matching terms") + "\n")
		return sb.String() + "\n" + HelpBar("type to filter", "↑/↓ scroll", "esc back")
	}

	// Staggered reveal: animate in terms over 10 frames
	reveal := animProgress(m.enteredAt, 10)
	visibleCount := int(reveal * float64(len(matched)))
	if visibleCount < 1 {
		visibleCount = 1
	}
	if visibleCount > len(matched) {
		visibleCount = len(matched)
	}

	// Window: how many terms fit in the content area, accounting for 2 lines per term.
	const linesPerTerm = 2
	rowsAvail := m.height - 9
	if rowsAvail < 4 {
		rowsAvail = 4
	}
	maxTerms := rowsAvail / linesPerTerm
	if maxTerms < 1 {
		maxTerms = 1
	}

	// Clamp scroll (View can't mutate, so derive a local display offset).
	maxScroll := len(matched) - maxTerms
	if maxScroll < 0 {
		maxScroll = 0
	}
	scrollOff := m.scroll
	if scrollOff > maxScroll {
		scrollOff = maxScroll
	}

	end := scrollOff + maxTerms
	if end > len(matched) {
		end = len(matched)
	}

	for i := scrollOff; i < end; i++ {
		t := matched[i]
		if i >= visibleCount {
			// Not yet revealed — render a dim placeholder to hold layout space
			sb.WriteString(StyleDim.Render("  …") + "\n")
			continue
		}
		abbr := StyleAccent.Bold(true).Render(fmt.Sprintf("%-5s", t.Abbr))
		name := StyleAccent.Render(t.Name)
		def := StyleDim.Render(t.Def)
		sb.WriteString("  " + abbr + " " + name + "\n")
		sb.WriteString("        " + def + "\n")
	}

	// Scroll hints
	if scrollOff > 0 {
		sb.WriteString(StyleDim.Render(fmt.Sprintf("  ↑ %d more", scrollOff)) + "\n")
	}
	if end < len(matched) {
		sb.WriteString(StyleDim.Render(fmt.Sprintf("  ↓ %d more", len(matched)-end)) + "\n")
	}

	return sb.String() + "\n" + HelpBar("type to filter", "↑/↓ scroll", "esc back")
}
