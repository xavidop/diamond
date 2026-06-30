// cli/internal/ui/openurl.go
package ui

import (
	"os/exec"
	"runtime"

	tea "github.com/charmbracelet/bubbletea"
)

// openURL opens url in the user's default browser. Returns a tea.Cmd so it can
// be fired from Update; failures surface as an ErrMsg.
func openURL(url string) tea.Cmd {
	return func() tea.Msg {
		if url == "" {
			return nil
		}
		var cmd *exec.Cmd
		switch runtime.GOOS {
		case "darwin":
			cmd = exec.Command("open", url)
		case "windows":
			cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
		default: // linux, *bsd
			cmd = exec.Command("xdg-open", url)
		}
		if err := cmd.Start(); err != nil {
			return ErrMsg{Err: err}
		}
		return nil
	}
}
