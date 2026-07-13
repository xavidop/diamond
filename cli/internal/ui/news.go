package ui

import (
	"sort"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/espn"
	"github.com/xavidop/diamond/cli/internal/mlb"
)

type newsLoadedMsg struct{ news []espn.Article }

type NewsModel struct {
	sport      mlb.Sport
	news       []espn.Article
	cursor     int
	loading    bool
	err        error
	width      int
	height     int
	search     SearchInput
	typeFilter string // "All" or an ESPN article type
	// in-app article reader
	reading bool
	reader  ArticleReader
}

func NewNewsModel(sport mlb.Sport) NewsModel {
	return NewsModel{
		sport:      sport,
		loading:    true,
		search:     NewSearchInput("Filter headlines…"),
		typeFilter: "All",
	}
}

func (m NewsModel) Init() tea.Cmd { return m.fetch() }

// CapturesText routes free text to the filter box while browsing the list; the
// reader handles its own keys, so text capture is off there.
func (m NewsModel) CapturesText() bool { return !m.reading }

func (m NewsModel) fetch() tea.Cmd {
	mlbOnly := m.sport.ID == 1
	return func() tea.Msg {
		if !mlbOnly {
			return newsLoadedMsg{news: nil}
		}
		arts, err := espn.DefaultClient().News("", 40)
		if err != nil {
			return ErrMsg{Err: err}
		}
		return newsLoadedMsg{news: arts}
	}
}

func (m NewsModel) Update(msg tea.Msg) (NewsModel, tea.Cmd) {
	if sz, ok := msg.(tea.WindowSizeMsg); ok {
		m.width, m.height = sz.Width, sz.Height
	}
	// While reading an article, route everything to the reader.
	if m.reading {
		var cmd tea.Cmd
		m.reader, cmd = m.reader.Update(msg)
		if m.reader.done {
			m.reading = false
		}
		return m, cmd
	}
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		return m, nil
	case newsLoadedMsg:
		m.loading, m.news, m.cursor = false, msg.news, 0
		return m, nil
	case ErrMsg:
		m.loading, m.err = false, msg.Err
		return m, nil
	case tea.KeyMsg:
		filtered := filterNews(m.news, m.search.Value(), m.typeFilter)
		switch msg.String() {
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
		case "up":
			if m.cursor > 0 {
				m.cursor--
			}
			return m, nil
		case "down":
			if m.cursor < len(filtered)-1 {
				m.cursor++
			}
			return m, nil
		case "pgup":
			m.cursor -= m.newsRows()
			if m.cursor < 0 {
				m.cursor = 0
			}
			return m, nil
		case "pgdown":
			m.cursor += m.newsRows()
			if m.cursor > len(filtered)-1 {
				m.cursor = len(filtered) - 1
			}
			if m.cursor < 0 {
				m.cursor = 0
			}
			return m, nil
		case "tab":
			m.typeFilter = cycleType(newsTypeOptions(m.news), m.typeFilter, +1)
			m.cursor = 0
			return m, nil
		case "shift+tab":
			m.typeFilter = cycleType(newsTypeOptions(m.news), m.typeFilter, -1)
			m.cursor = 0
			return m, nil
		case "ctrl+r":
			m.loading = true
			return m, m.fetch()
		case "enter":
			if m.cursor >= 0 && m.cursor < len(filtered) {
				m.reader = NewArticleReader(filtered[m.cursor], m.width, m.height)
				m.reading = true
				return m, m.reader.Init()
			}
			return m, nil
		default:
			var cmd tea.Cmd
			m.search, cmd = m.search.Update(msg)
			m.cursor = 0
			return m, cmd
		}
	}
	return m, nil
}

func (m NewsModel) View() string {
	if m.reading {
		return m.reader.View()
	}
	head := PanelHeader("NEWS", m.width) + "\n\n"

	if m.err != nil {
		return StyleError.Render("Error: "+m.err.Error()) + "\n" + HelpBar("ctrl+r retry", "esc back")
	}
	if m.loading {
		return head + loadingView("Loading news…")
	}
	if m.sport.ID != 1 {
		return head + StyleDim.Render("  News is available for MLB only.") + "\n\n" +
			HelpBar("esc back")
	}

	help := HelpBar("type to filter", "↑/↓ select", "Tab type", "Enter read", "ctrl+r refresh", "esc back")
	searchLine := "  " + m.search.View()

	if len(m.news) == 0 {
		return head + searchLine + "\n\n" + StyleDim.Render("  No news right now.") + "\n\n" + help
	}

	pills := renderTypePills(newsTypeOptions(m.news), m.typeFilter)
	filtered := filterNews(m.news, m.search.Value(), m.typeFilter)

	count := StyleDim.Render("  " + itoa(len(filtered)) + " stories")
	if len(filtered) != len(m.news) {
		count = StyleDim.Render("  " + itoa(len(filtered)) + " of " + itoa(len(m.news)))
	}

	if len(filtered) == 0 {
		return head + searchLine + "\n" + pills + "\n\n" +
			StyleDim.Render("  No stories match.") + "\n\n" + help
	}

	// Clamp cursor to the filtered range, then window around it.
	cursor := m.cursor
	if cursor > len(filtered)-1 {
		cursor = len(filtered) - 1
	}
	if cursor < 0 {
		cursor = 0
	}
	maxRows := m.newsRows()
	start := cursor - maxRows/2
	if start < 0 {
		start = 0
	}
	end := start + maxRows
	if end > len(filtered) {
		end = len(filtered)
		start = end - maxRows
		if start < 0 {
			start = 0
		}
	}

	var b strings.Builder
	for i := start; i < end; i++ {
		a := filtered[i]
		badge := lipgloss.NewStyle().Foreground(colorCyan).Render(formatTypeBadge(a.Type))
		when := ""
		if !a.Published.IsZero() {
			when = StyleDim.Render("  " + a.Published.Format("Jan 2"))
		}
		maxW := m.width - 18
		if maxW < 1 {
			maxW = 80
		}
		headline := truncate(a.Headline, maxW)
		if i == cursor {
			b.WriteString(StyleAccent.Bold(true).Render("▸ ") + badge + " " +
				StyleAccent.Bold(true).Render(headline) + when + "\n")
		} else {
			b.WriteString("  " + badge + " " + StyleItemNormal.Render(headline) + when + "\n")
		}
	}
	return head + searchLine + "\n" + pills + count + "\n\n" +
		strings.TrimRight(b.String(), "\n") + "\n\n" + help
}

// newsRows is how many headline rows fit in the content area.
func (m NewsModel) newsRows() int {
	rows := m.height - 12
	if rows < 6 {
		rows = 6
	}
	if rows > 30 {
		rows = 30
	}
	return rows
}

// newsTypeOrder mirrors the web's preferred ordering of article-type filters;
// newsTypeLabels humanizes the noisier ESPN type names.
var newsTypeOrder = []string{"Preview", "Recap", "HeadlineNews", "Story", "Media", "News"}
var newsTypeLabels = map[string]string{"HeadlineNews": "Headlines"}

// newsTypeOptions returns "All" followed by the article types present in the
// feed, ordered by newsTypeOrder with any extras appended alphabetically.
func newsTypeOptions(arts []espn.Article) []string {
	present := map[string]bool{}
	for _, a := range arts {
		if a.Type != "" {
			present[a.Type] = true
		}
	}
	opts := []string{"All"}
	for _, t := range newsTypeOrder {
		if present[t] {
			opts = append(opts, t)
			delete(present, t)
		}
	}
	extras := make([]string, 0, len(present))
	for t := range present {
		extras = append(extras, t)
	}
	sort.Strings(extras)
	return append(opts, extras...)
}

// cycleType steps the active filter through opts by dir (+1 / -1), wrapping.
func cycleType(opts []string, cur string, dir int) string {
	if len(opts) == 0 {
		return "All"
	}
	idx := 0
	for i, t := range opts {
		if t == cur {
			idx = i
			break
		}
	}
	idx = (idx + dir + len(opts)) % len(opts)
	return opts[idx]
}

// filterNews keeps articles matching the type filter and a case-insensitive
// substring query over headline + description.
func filterNews(arts []espn.Article, query, typeFilter string) []espn.Article {
	q := strings.ToLower(strings.TrimSpace(query))
	out := make([]espn.Article, 0, len(arts))
	for _, a := range arts {
		if typeFilter != "" && typeFilter != "All" && a.Type != typeFilter {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(a.Headline+" "+a.Description), q) {
			continue
		}
		out = append(out, a)
	}
	return out
}

// renderTypePills renders the type-filter row, highlighting the active one.
func renderTypePills(opts []string, active string) string {
	var b strings.Builder
	b.WriteString("  ")
	for _, t := range opts {
		label := t
		if l, ok := newsTypeLabels[t]; ok {
			label = l
		}
		if t == active {
			b.WriteString(StyleActiveTab.Render(label))
		} else {
			b.WriteString(StyleTab.Render(label))
		}
	}
	return b.String()
}

func formatTypeBadge(t string) string {
	if t == "" {
		t = "Story"
	}
	if len(t) > 7 {
		t = t[:7]
	}
	return t + strings.Repeat(" ", 7-len(t))
}
