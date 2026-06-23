package ui

import (
	"fmt"
	"strings"
	"testing"

	"github.com/xavidop/diamond/cli/internal/diamondgpt"
)

// TestChatScroll verifies the DiamondGPT chat windows long conversations and
// lets the scroll offset page back to earlier content (regression guard for the
// "scroll doesn't work" bug, where the view was hard-pinned to the bottom).
func TestChatScroll(t *testing.T) {
	m := NewDiamondGPTModel()
	m.state = gptChat
	m.provider = diamondgpt.Provider{Label: "Test", Tools: true}
	m.width, m.height = 80, 20 // chatAvail() == 11 rows

	for i := 0; i < 20; i++ {
		m.turns = append(m.turns,
			chatTurn{user: true, text: fmt.Sprintf("question number %d", i)},
			chatTurn{user: false, text: "a", rendered: fmt.Sprintf("answer number %d", i)})
	}

	if m.maxScroll() <= 0 {
		t.Fatalf("expected a scrollable conversation, maxScroll()=%d", m.maxScroll())
	}

	strip := func(s string) string { return ansiRe.ReplaceAllString(s, "") }

	// Pinned to bottom: newest visible, oldest off-screen.
	m.scroll = 0
	bottom := strip(m.viewChat("HDR"))
	if !strings.Contains(bottom, "answer number 19") {
		t.Errorf("at bottom, expected newest answer visible")
	}
	if strings.Contains(bottom, "question number 0") {
		t.Errorf("at bottom, oldest question should be off-screen")
	}

	// Scrolled fully back: oldest content now visible.
	m.scroll = m.maxScroll()
	top := strip(m.viewChat("HDR"))
	if !strings.Contains(top, "question number 0") {
		t.Errorf("scrolled to top, expected oldest question visible; got:\n%s", top)
	}
}
