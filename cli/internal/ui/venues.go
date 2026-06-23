package ui

import (
	"fmt"
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

type venuesState int

const (
	venuesStateList venuesState = iota
	venuesStateDetail
)

type venuesLoadedMsg struct{ venues []mlb.Venue }
type venueDetailMsg struct{ venue *mlb.Venue }

type VenuesModel struct {
	state         venuesState
	search        SearchInput
	venues        []mlb.Venue
	matches       []int
	cursor        int
	detail        *mlb.Venue
	loading       bool
	detailLoading bool
	err           error
	client        *mlb.Client
	width         int
}

func NewVenuesModel() VenuesModel {
	return VenuesModel{
		state:   venuesStateList,
		search:  NewSearchInput("Filter ballparks…"),
		client:  mlb.DefaultClient(),
		loading: true,
	}
}

func (m VenuesModel) Init() tea.Cmd {
	c := m.client
	return func() tea.Msg {
		vs, err := c.Venues()
		if err != nil {
			return ErrMsg{Err: err}
		}
		return venuesLoadedMsg{venues: vs}
	}
}

// CapturesText reports whether the venue filter box is focused (list state).
func (m VenuesModel) CapturesText() bool { return m.state == venuesStateList }

func (m *VenuesModel) updateMatches() {
	q := strings.ToLower(m.search.Value())
	m.matches = nil
	for i, v := range m.venues {
		if v.Active != nil && !*v.Active {
			continue
		}
		hay := strings.ToLower(v.Name + " " + v.Location.City + " " + v.Location.Country)
		if q == "" || strings.Contains(hay, q) {
			m.matches = append(m.matches, i)
		}
	}
	sort.Slice(m.matches, func(i, j int) bool {
		return m.venues[m.matches[i]].Name < m.venues[m.matches[j]].Name
	})
}

func (m VenuesModel) loadDetail(id int) tea.Cmd {
	c := m.client
	return func() tea.Msg {
		v, err := c.Venue(id)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return venueDetailMsg{venue: v}
	}
}

func (m VenuesModel) Update(msg tea.Msg) (VenuesModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case venuesLoadedMsg:
		m.loading, m.venues = false, msg.venues
		m.updateMatches()
		return m, nil
	case venueDetailMsg:
		m.detailLoading, m.detail = false, msg.venue
		return m, nil
	case ErrMsg:
		m.loading, m.detailLoading, m.err = false, false, msg.Err
		return m, nil
	case tea.KeyMsg:
		if m.state == venuesStateDetail {
			switch msg.String() {
			case "esc":
				m.state = venuesStateList
				m.detail = nil
			}
			return m, nil
		}
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.matches)-1 {
				m.cursor++
			}
		case "enter":
			if len(m.matches) > 0 {
				id := m.venues[m.matches[m.cursor]].ID
				m.state = venuesStateDetail
				m.detailLoading, m.detail = true, nil
				return m, m.loadDetail(id)
			}
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		default:
			var cmd tea.Cmd
			m.search, cmd = m.search.Update(msg)
			m.updateMatches()
			m.cursor = 0
			return m, cmd
		}
	}
	return m, nil
}

func (m VenuesModel) View() string {
	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("esc back")
	}

	if m.state == venuesStateDetail {
		return m.viewDetail()
	}

	var sb strings.Builder
	sb.WriteString(PanelHeader("VENUES", m.width) + "\n\n")
	if m.loading {
		return sb.String() + loadingView("Loading ballparks…")
	}
	sb.WriteString("  " + m.search.View() + "\n")
	sb.WriteString(StyleDim.Render(fmt.Sprintf("  %d ballparks", len(m.matches))) + "\n\n")

	vis := 18
	start := 0
	if m.cursor >= vis {
		start = m.cursor - vis + 1
	}
	end := start + vis
	if end > len(m.matches) {
		end = len(m.matches)
	}
	for i := start; i < end; i++ {
		v := m.venues[m.matches[i]]
		loc := v.Location.City
		if v.Location.StateAbbrev != "" {
			loc += ", " + v.Location.StateAbbrev
		}
		if i == m.cursor {
			sb.WriteString("  " + StyleAccent.Bold(true).Render("▸ "+v.Name) + StyleDim.Render("  "+loc) + "\n")
		} else {
			sb.WriteString("    " + StyleItemNormal.Render(v.Name) + StyleDim.Render("  "+loc) + "\n")
		}
	}
	return sb.String() + "\n" + HelpBar("type to filter", "↑/↓ navigate", "Enter detail", "esc back")
}

func (m VenuesModel) viewDetail() string {
	ts, te := headerColors()
	var sb strings.Builder
	sb.WriteString(PanelHeader("VENUES", m.width) + "\n")
	if m.detailLoading || m.detail == nil {
		return sb.String() + "\n" + loadingView("Loading ballpark…")
	}
	v := m.detail
	sb.WriteString(gradientText(v.Name, ts, te) + "\n")

	loc := v.Location.City
	if v.Location.StateAbbrev != "" {
		loc += ", " + v.Location.StateAbbrev
	}
	if v.Location.Country != "" {
		loc += " · " + v.Location.Country
	}
	sb.WriteString(StyleDim.Render(loc))
	if v.TimeZone.ID != "" {
		sb.WriteString(StyleDim.Render("  ·  " + v.TimeZone.ID))
	}
	sb.WriteString("\n\n")

	f := v.FieldInfo
	cards := statCards([][2]string{
		{"CAP", commaInt(f.Capacity)},
		{"TURF", orDash(f.TurfType)},
		{"ROOF", orDash(f.RoofType)},
	}, 12)
	sb.WriteString(cards + "\n\n")

	sb.WriteString(StyleAccent.Bold(true).Render("  DIMENSIONS") + "  " + StyleDim.Render(strings.Repeat("─", 40)) + "\n\n")
	dims := statCards([][2]string{
		{"LF", ft(f.LeftLine)}, {"LF-CF", ft(f.LeftCenter)}, {"CF", ft(f.Center)},
		{"RF-CF", ft(f.RightCenter)}, {"RF", ft(f.RightLine)},
	}, 10)
	sb.WriteString(dims + "\n")

	return sb.String() + "\n" + HelpBar("esc back to list")
}

func ft(n int) string {
	if n == 0 {
		return "—"
	}
	return fmt.Sprintf("%d'", n)
}

func commaInt(n int) string {
	if n == 0 {
		return "—"
	}
	s := fmt.Sprintf("%d", n)
	var out []byte
	for i, c := range []byte(s) {
		if i > 0 && (len(s)-i)%3 == 0 {
			out = append(out, ',')
		}
		out = append(out, c)
	}
	return string(out)
}
