package ui

import (
	"strings"
	"testing"
)

func TestHtmlToMarkdown(t *testing.T) {
	in := `<p>The <a data-x="1" href="https://x/y">Phillies</a> ace said ` +
		`he felt <strong>disrespected</strong>.</p>` +
		`<h3>Reaction</h3>` +
		`<ul><li>First</li><li>Second</li></ul>` +
		`<p>Line one<br/>line two &amp; done.</p>` +
		`<aside>ad</aside>`
	got := htmlToMarkdown(in)

	for _, want := range []string{
		"The Phillies ace said", // link text kept, URL dropped
		"**disrespected**",
		"## Reaction",
		"- First",
		"- Second",
		"line two & done.",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in:\n%s", want, got)
		}
	}
	if strings.Contains(got, "https://x/y") {
		t.Errorf("link URL should be dropped:\n%s", got)
	}
	if strings.Contains(got, "<") || strings.Contains(got, ">") {
		t.Errorf("html tags survived:\n%s", got)
	}
}

func TestHtmlToMarkdownDeindents(t *testing.T) {
	// ESPN indents paragraph text; leading whitespace must be stripped so
	// glamour doesn't treat lines as code blocks (leaving markdown unrendered).
	in := "<p>        Chicago took two of three from the Reds.</p>"
	got := htmlToMarkdown(in)
	for _, ln := range strings.Split(got, "\n") {
		if strings.HasPrefix(ln, " ") || strings.HasPrefix(ln, "\t") {
			t.Errorf("line still indented: %q", ln)
		}
	}
}

func TestHtmlToMarkdownEmpty(t *testing.T) {
	if got := htmlToMarkdown(""); got != "" {
		t.Fatalf("want empty, got %q", got)
	}
}
