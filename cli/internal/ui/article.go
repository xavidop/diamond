package ui

import (
	"html"
	"regexp"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/xavidop/diamond/cli/internal/espn"
)

type articleContentMsg struct{ content espn.ArticleContent }
type articleErrMsg struct{ err error }

// ArticleReader is an in-app reader for a single ESPN story. It fetches the
// article body and renders it as scrollable, styled terminal markdown so the
// user never has to leave the app. It is embedded by the news view and the
// team News tab.
type ArticleReader struct {
	art     espn.Article
	byline  string
	rawMD   string
	lines   []string
	loading bool
	err     error
	scroll  int
	width   int
	height  int
	// done signals the parent to leave the reader and return to the list.
	done bool
}

// NewArticleReader builds a reader for art sized to the current terminal.
func NewArticleReader(art espn.Article, width, height int) ArticleReader {
	return ArticleReader{art: art, loading: true, width: width, height: height}
}

// Init fetches the full story body for the article.
func (r ArticleReader) Init() tea.Cmd {
	apiURL := r.art.APIURL
	return func() tea.Msg {
		content, err := espn.DefaultClient().ArticleContent(apiURL)
		if err != nil {
			return articleErrMsg{err: err}
		}
		return articleContentMsg{content: content}
	}
}

func (r ArticleReader) Update(msg tea.Msg) (ArticleReader, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		r.width, r.height = msg.Width, msg.Height
		r.reflow()
	case articleContentMsg:
		r.loading = false
		r.byline = msg.content.Byline
		story := htmlToMarkdown(msg.content.StoryHTML)
		if strings.TrimSpace(story) == "" {
			story = noBodyFallback(r.art)
		}
		r.rawMD = story
		r.reflow()
	case articleErrMsg:
		r.loading = false
		// Some items (video highlights, previews) have no readable story body.
		// Degrade gracefully to the summary instead of a hard error.
		if body := noBodyFallback(r.art); strings.TrimSpace(r.art.Description) != "" {
			r.rawMD = body
			r.reflow()
		} else {
			r.err = msg.err
		}
	case tea.KeyMsg:
		switch msg.String() {
		case "esc", "backspace":
			r.done = true
		case "o":
			return r, openURL(r.art.WebURL)
		case "up", "k":
			if r.scroll > 0 {
				r.scroll--
			}
		case "down", "j":
			r.scroll++
		case "pgup":
			r.scroll -= r.pageRows()
		case "pgdown":
			r.scroll += r.pageRows()
		case "home", "g":
			r.scroll = 0
		case "end", "G":
			r.scroll = r.maxScroll()
		case "r":
			r.loading, r.err, r.scroll = true, nil, 0
			return r, r.Init()
		}
		r.clampScroll()
	}
	return r, nil
}

// reflow re-renders the story markdown to the current width.
func (r *ArticleReader) reflow() {
	if r.rawMD == "" {
		r.lines = nil
		return
	}
	rendered := renderMarkdown(r.rawMD, r.bodyWidth())
	r.lines = strings.Split(rendered, "\n")
	r.clampScroll()
}

func (r *ArticleReader) clampScroll() {
	if r.scroll > r.maxScroll() {
		r.scroll = r.maxScroll()
	}
	if r.scroll < 0 {
		r.scroll = 0
	}
}

func (r ArticleReader) bodyWidth() int {
	w := r.width - 2
	if w < 20 {
		w = 20
	}
	return w
}

// pageRows is the number of body lines visible at once (terminal height minus
// the header block and help bar).
func (r ArticleReader) pageRows() int {
	rows := r.height - 8
	if rows < 3 {
		rows = 3
	}
	return rows
}

func (r ArticleReader) maxScroll() int {
	m := len(r.lines) - r.pageRows()
	if m < 0 {
		m = 0
	}
	return m
}

func (r ArticleReader) View() string {
	head := PanelHeader("NEWS", r.width) + "\n"
	headline := StyleAccent.Bold(true).Render(truncate(r.art.Headline, r.bodyWidth()))
	meta := formatTypeBadge(r.art.Type)
	if r.byline != "" {
		meta += " · " + r.byline
	}
	if !r.art.Published.IsZero() {
		meta += " · " + r.art.Published.Format("Jan 2, 2006")
	}
	header := head + headline + "\n" + StyleDim.Render(strings.TrimSpace(meta)) + "\n\n"
	help := HelpBar("↑/↓ scroll", "o open in browser", "r refresh", "esc back")

	if r.err != nil {
		return header + StyleError.Render("Could not load article: "+r.err.Error()) + "\n\n" +
			HelpBar("o open in browser", "r retry", "esc back")
	}
	if r.loading {
		return header + loadingView("Loading article…")
	}
	if len(r.lines) == 0 {
		return header + StyleDim.Render("  No article text available.") + "\n\n" + help
	}

	end := r.scroll + r.pageRows()
	if end > len(r.lines) {
		end = len(r.lines)
	}
	body := strings.Join(r.lines[r.scroll:end], "\n")
	scrollHint := ""
	if r.maxScroll() > 0 {
		pct := 100
		if r.maxScroll() > 0 {
			pct = r.scroll * 100 / r.maxScroll()
		}
		scrollHint = StyleDim.Render("  " + itoa(pct) + "%")
	}
	return header + body + "\n\n" + help + scrollHint
}

// itoa is a tiny int-to-string helper to avoid importing strconv here.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [12]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

var (
	reLink    = regexp.MustCompile(`(?is)<a\b[^>]*>(.*?)</a>`)
	reBold    = regexp.MustCompile(`(?is)</?(strong|b)>`)
	reItalic  = regexp.MustCompile(`(?is)</?(em|i)>`)
	reHeading = regexp.MustCompile(`(?is)<h[1-6][^>]*>(.*?)</h[1-6]>`)
	reListEnd = regexp.MustCompile(`(?is)</(ul|ol)>`)
	reListIt  = regexp.MustCompile(`(?is)<li[^>]*>(.*?)</li>`)
	reBreak   = regexp.MustCompile(`(?is)<br\s*/?>`)
	reParaEnd = regexp.MustCompile(`(?is)</(p|div)>`)
	reTag     = regexp.MustCompile(`(?is)<[^>]+>`)
	reBlanks  = regexp.MustCompile(`\n{3,}`)
	reSpaces  = regexp.MustCompile(`[ \t]{2,}`)
)

// htmlToMarkdown converts ESPN's story HTML into markdown suitable for the
// terminal renderer. It keeps link text (dropping the noisy inline URLs — the
// user can press "o" to open the original), preserves emphasis, headings and
// lists, strips everything else, and de-indents each line so ESPN's indented
// paragraphs aren't mistaken for markdown code blocks.
func htmlToMarkdown(s string) string {
	if s == "" {
		return ""
	}
	s = reLink.ReplaceAllString(s, "$1")
	s = reHeading.ReplaceAllString(s, "\n\n## $1\n\n")
	s = reListIt.ReplaceAllString(s, "\n- $1")
	s = reListEnd.ReplaceAllString(s, "\n\n")
	s = reBold.ReplaceAllString(s, "**")
	s = reItalic.ReplaceAllString(s, "*")
	s = reBreak.ReplaceAllString(s, "\n")
	s = reParaEnd.ReplaceAllString(s, "\n\n")
	s = reTag.ReplaceAllString(s, "")
	s = html.UnescapeString(s)

	// De-indent every line: leading whitespace makes glamour treat a line as a
	// code block, which leaves markdown (links, emphasis) unrendered. Also
	// collapse internal whitespace runs.
	lines := strings.Split(s, "\n")
	for i, ln := range lines {
		ln = strings.TrimSpace(ln)
		ln = reSpaces.ReplaceAllString(ln, " ")
		lines[i] = ln
	}
	s = strings.Join(lines, "\n")

	s = reBlanks.ReplaceAllString(s, "\n\n")
	return strings.TrimSpace(s)
}

// noBodyFallback returns readable text for items without a story body (video
// highlights, some previews): the summary plus a hint to open the original.
func noBodyFallback(art espn.Article) string {
	desc := strings.TrimSpace(art.Description)
	if desc == "" {
		return "*No article text is available for this item.*\n\nPress **o** to open it in your browser."
	}
	return desc + "\n\n*Full story not available here — press **o** to open the original.*"
}
