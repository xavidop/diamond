package ui

import (
	"context"
	"errors"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/glamour/styles"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/diamondgpt"
)

// renderMarkdown renders an assistant reply as styled terminal markdown.
func renderMarkdown(md string, width int) string {
	if width < 20 {
		width = 20
	}
	// Glamour's stock dark theme renders H2-H6 with literal "## "/"### "
	// prefixes, which show up as broken markdown in the chat. Strip them.
	st := styles.DarkStyleConfig
	st.H2.Prefix, st.H3.Prefix, st.H4.Prefix, st.H5.Prefix, st.H6.Prefix = "", "", "", "", ""
	r, err := glamour.NewTermRenderer(glamour.WithStyles(st), glamour.WithWordWrap(width))
	if err != nil {
		return md
	}
	out, err := r.Render(md)
	if err != nil {
		return md
	}
	return strings.Trim(out, "\n")
}

type gptState int

const (
	gptProvider gptState = iota
	gptKey
	gptChat
)

type gptReadyMsg struct{ client *diamondgpt.Client }
type gptReplyMsg struct{ text string }
type gptErrMsg struct{ err error }

type chatTurn struct {
	user     bool
	text     string
	rendered string // markdown-rendered (assistant turns only)
}

type DiamondGPTModel struct {
	state      gptState
	pcursor    int
	provider   diamondgpt.Provider
	keyInput   SearchInput
	input      SearchInput
	client     *diamondgpt.Client
	turns      []chatTurn
	thinking   bool
	connecting bool
	err        error
	width      int
	height     int
	scroll     int // lines scrolled up from the bottom; 0 = pinned to latest
}

func NewDiamondGPTModel() DiamondGPTModel {
	return DiamondGPTModel{
		state:    gptProvider,
		keyInput: NewSearchInput("Paste your API key…"),
		input:    NewSearchInput("Ask DiamondGPT…"),
	}
}

func (m DiamondGPTModel) Init() tea.Cmd { return nil }

// CapturesText reports whether the view is in a free-text state, so the app
// should route every key (except Esc) into it instead of firing shortcuts.
func (m DiamondGPTModel) CapturesText() bool {
	return m.state == gptChat || m.state == gptKey
}

func connectCmd(p diamondgpt.Provider, key string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		cl, err := diamondgpt.New(ctx, p, key)
		if err != nil {
			return gptErrMsg{err}
		}
		return gptReadyMsg{client: cl}
	}
}

func askCmd(cl *diamondgpt.Client, q string) tea.Cmd {
	return func() tea.Msg {
		// Hard cap so a slow/stuck model can never freeze the chat. Anthropic's
		// tool-calling latency is high and API-load dependent (single calls can
		// run 30s+), so allow generous headroom before giving up.
		ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
		defer cancel()
		reply, err := cl.Ask(ctx, q)
		if err != nil {
			if errors.Is(err, context.DeadlineExceeded) || ctx.Err() != nil {
				err = errors.New("timed out — this provider can be slow with live-data tools; try Gemini or OpenAI for faster answers")
			}
			return gptErrMsg{err}
		}
		return gptReplyMsg{text: reply}
	}
}

func (m DiamondGPTModel) Update(msg tea.Msg) (DiamondGPTModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil
	case gptReadyMsg:
		m.connecting, m.client, m.state, m.err = false, msg.client, gptChat, nil
		return m, nil
	case gptReplyMsg:
		m.thinking = false
		m.turns = append(m.turns, chatTurn{user: false, text: msg.text, rendered: renderMarkdown(msg.text, m.chatWidth())})
		m.scroll = 0 // jump to the newest message
		return m, nil
	case gptErrMsg:
		m.connecting, m.thinking, m.err = false, false, msg.err
		if m.client == nil {
			m.state = gptProvider // connection failed → back to picker
		}
		return m, nil
	case tea.KeyMsg:
		switch m.state {
		case gptProvider:
			switch msg.String() {
			case "up", "k":
				if m.pcursor > 0 {
					m.pcursor--
				}
			case "down", "j":
				if m.pcursor < len(diamondgpt.Providers)-1 {
					m.pcursor++
				}
			case "enter", " ":
				m.provider, m.err = diamondgpt.Providers[m.pcursor], nil
				if m.provider.HasKey() {
					m.connecting = true
					return m, connectCmd(m.provider, "")
				}
				m.state = gptKey
				m.keyInput.SetValue("")
			case "esc":
				if m.client != nil {
					// Opened mid-chat via Ctrl+P — go back to the conversation.
					m.state, m.err = gptChat, nil
					return m, nil
				}
				return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
			}
		case gptKey:
			switch msg.String() {
			case "enter":
				key := strings.TrimSpace(m.keyInput.Value())
				if key == "" {
					return m, nil
				}
				m.connecting = true
				return m, connectCmd(m.provider, key)
			case "esc":
				m.state, m.err = gptProvider, nil
			default:
				var cmd tea.Cmd
				m.keyInput, cmd = m.keyInput.Update(msg)
				return m, cmd
			}
		case gptChat:
			switch msg.String() {
			case "enter":
				q := strings.TrimSpace(m.input.Value())
				if q == "" || m.thinking {
					return m, nil
				}
				// Slash command: switch AI provider without leaving the chat. A
				// typed command works in a free-text field where a Ctrl-key
				// shortcut would be swallowed by the terminal.
				switch strings.ToLower(q) {
				case "/model", "/provider", "/switch":
					for i, p := range diamondgpt.Providers {
						if p.Label == m.provider.Label {
							m.pcursor = i
							break
						}
					}
					m.input.SetValue("")
					m.state, m.err = gptProvider, nil
					return m, nil
				}
				m.turns = append(m.turns, chatTurn{user: true, text: q})
				m.input.SetValue("")
				m.thinking, m.err = true, nil
				m.scroll = 0 // follow the new exchange to the bottom
				return m, askCmd(m.client, q)
			case "esc":
				return m, func() tea.Msg { return NavigateMsg{View: ViewMenu} }
			case "pgup":
				m.scroll += m.chatAvail() - 1
				if mx := m.maxScroll(); m.scroll > mx {
					m.scroll = mx
				}
				return m, nil
			case "pgdown":
				m.scroll -= m.chatAvail() - 1
				if m.scroll < 0 {
					m.scroll = 0
				}
				return m, nil
			case "up":
				if m.scroll < m.maxScroll() {
					m.scroll++
				}
				return m, nil
			case "down":
				if m.scroll > 0 {
					m.scroll--
				}
				return m, nil
			default:
				var cmd tea.Cmd
				m.input, cmd = m.input.Update(msg)
				return m, cmd
			}
		}
	}
	return m, nil
}

func (m DiamondGPTModel) View() string {
	hdr := PanelHeader("DiamondGPT", m.width)
	switch m.state {
	case gptProvider:
		return m.viewProvider(hdr)
	case gptKey:
		return m.viewKey(hdr)
	default:
		return m.viewChat(hdr)
	}
}

func (m DiamondGPTModel) viewProvider(hdr string) string {
	var b strings.Builder
	b.WriteString(hdr + "\n\n")
	b.WriteString("  " + StyleHeader.Render("Pick an AI provider") + "\n\n")
	for i, p := range diamondgpt.Providers {
		badge := StyleDim.Render("key missing")
		if p.HasKey() {
			badge = StyleGreen.Render("key set ✓")
		}
		capTag := StyleCyan.Render("live data")
		if !p.Tools {
			capTag = StyleDim.Render("knowledge only")
		}
		if i == m.pcursor {
			b.WriteString("  " + StyleAccent.Bold(true).Render("▸ "+p.Label))
		} else {
			b.WriteString("    " + StyleItemNormal.Render(p.Label))
		}
		b.WriteString(StyleDim.Render("  ("+p.EnvVar+")  ") + badge + StyleDim.Render("  ·  ") + capTag + "\n")
	}
	if m.connecting {
		b.WriteString("\n" + loadingView("connecting…"))
	}
	if m.err != nil {
		b.WriteString("\n  " + StyleError.Render(truncate(m.err.Error(), 80)))
	}
	return b.String() + "\n\n" + HelpBar("↑/↓ select", "Enter choose", "esc back")
}

func (m DiamondGPTModel) viewKey(hdr string) string {
	var b strings.Builder
	b.WriteString(hdr + "\n\n")
	b.WriteString("  " + StyleHeader.Render(m.provider.Label) +
		StyleDim.Render("  needs "+m.provider.EnvVar) + "\n\n")
	b.WriteString("  " + m.keyInput.View() + "\n\n")
	b.WriteString("  " + StyleDim.Render("Used only for this session (exported to "+m.provider.EnvVar+")."))
	if m.connecting {
		b.WriteString("\n\n" + loadingView("connecting…"))
	}
	if m.err != nil {
		b.WriteString("\n  " + StyleError.Render(truncate(m.err.Error(), 80)))
	}
	return b.String() + "\n\n" + HelpBar("Enter connect", "esc back")
}

// chatWidth is the wrap width for rendered chat content.
func (m DiamondGPTModel) chatWidth() int {
	w := m.width - 4
	if w < 24 {
		w = 24
	}
	return w
}

// chatAvail is the number of body rows available for the conversation, between
// the header/hint above and the prompt/help bar below.
func (m DiamondGPTModel) chatAvail() int {
	avail := m.height - 9
	if avail < 3 {
		avail = 3
	}
	return avail
}

// chatLines renders the full (unwindowed) conversation as display lines.
func (m DiamondGPTModel) chatLines() []string {
	w := m.chatWidth()
	var sb strings.Builder
	if len(m.turns) == 0 {
		if m.provider.Tools {
			sb.WriteString(StyleDim.Render("  Ask me anything about MLB — live scores, standings, player & team stats,") + "\n")
			sb.WriteString(StyleDim.Render("  leaders, splits, draft, venues, or recent transactions. I pull real data via tools.") + "\n")
		} else {
			sb.WriteString(StyleDim.Render("  "+m.provider.Label+" runs without live-data tools (Genkit limitation),") + "\n")
			sb.WriteString(StyleDim.Render("  so I answer from baseball knowledge. For live data, pick Gemini or OpenAI.") + "\n")
		}
	}
	for _, t := range m.turns {
		if t.user {
			sb.WriteString(StyleCyan.Bold(true).Render("You") + "\n")
			sb.WriteString(lipgloss.NewStyle().Width(w).Render(strings.TrimSpace(t.text)) + "\n\n")
			continue
		}
		sb.WriteString(StyleAccent.Bold(true).Render("DiamondGPT") + "\n")
		body := t.rendered // markdown-rendered
		if body == "" {
			body = lipgloss.NewStyle().Width(w).Render(strings.TrimSpace(t.text))
		}
		sb.WriteString(body + "\n\n")
	}
	if m.thinking {
		sb.WriteString(spinnerGlyph() + " " + StyleDim.Render("thinking…"))
	}
	if m.err != nil {
		sb.WriteString(StyleError.Render(truncate(m.err.Error(), w)))
	}
	return strings.Split(strings.TrimRight(sb.String(), "\n"), "\n")
}

// maxScroll is the furthest (in lines) the conversation can scroll back.
func (m DiamondGPTModel) maxScroll() int {
	if n := len(m.chatLines()) - m.chatAvail(); n > 0 {
		return n
	}
	return 0
}

func (m DiamondGPTModel) viewChat(hdr string) string {
	all := m.chatLines()
	avail := m.chatAvail()
	maxOff := len(all) - avail
	if maxOff < 0 {
		maxOff = 0
	}
	sc := m.scroll
	if sc > maxOff {
		sc = maxOff
	}
	if sc < 0 {
		sc = 0
	}
	start := len(all) - avail - sc
	if start < 0 {
		start = 0
	}
	end := start + avail
	if end > len(all) {
		end = len(all)
	}
	body := strings.Join(all[start:end], "\n")

	// Scroll affordance: arrows show which directions hold more content.
	scrollHint := ""
	if maxOff > 0 {
		arrows := ""
		if sc < maxOff {
			arrows += "▲"
		}
		if sc > 0 {
			arrows += "▼"
		}
		scrollHint = StyleDim.Render("  " + arrows + " more")
	}
	hint := StyleDim.Render("  "+m.provider.Label+"  ·  /model to switch  ·  Esc to leave") + scrollHint
	prompt := StyleAccent.Render("❯ ") + m.input.View()
	return hdr + hint + "\n\n" + body + "\n\n  " + prompt + "\n\n" +
		HelpBar("Enter send", "/model provider", "PgUp/PgDn scroll", "esc menu")
}
