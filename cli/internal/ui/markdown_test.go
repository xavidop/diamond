package ui

import (
	"regexp"
	"strings"
	"testing"
)

var ansiRe = regexp.MustCompile("\x1b\\[[0-9;]*m")

// TestRenderMarkdownHeadings reproduces the DiamondGPT report rendering to see
// whether glamour strips ATX heading markers (### ...). Diagnostic.
func TestRenderMarkdownHeadings(t *testing.T) {
	md := "Here is your MLB weekend roundup for June 20-21, 2026:\n\n" +
		"### Orioles Blow Past Dodgers in LA\n\n" +
		"The Orioles made a statement at Dodger Stadium.\n\n" +
		"- **Sunday (BAL 12, LAD 1)**: Brandon Young dominated.\n" +
		"- **Saturday (BAL 3, LAD 2)**: Trevor Rogers outdueled Yamamoto.\n\n" +
		"### Phillies Dominate NL East Rival Mets\n\n" +
		"The Phillies put on a clinic.\n"

	for _, w := range []int{80, 60} {
		out := renderMarkdown(md, w)
		plain := ansiRe.ReplaceAllString(out, "")
		t.Logf("=== width %d, ANSI-stripped ===\n%s", w, plain)
		if strings.Contains(plain, "###") {
			t.Errorf("width %d: heading markers NOT stripped (### survives)", w)
		}
	}
}
