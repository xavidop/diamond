package cmd

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/spf13/cobra"
	"github.com/xavidop/diamond/cli/internal/mlb"
	"github.com/xavidop/diamond/cli/internal/ui"
	"github.com/xavidop/diamond/cli/internal/version"
)

var noUpdateNotifier bool

var rootCmd = &cobra.Command{
	Use:   "diamond",
	Short: "⚾ MLB stats in your terminal",
	Long: "Diamond — the beautiful game of baseball, in your terminal.\n\n" +
		"Website: https://diamond.xavidop.me\n" +
		"Made by Xavier Portilla Edo (https://github.com/xavidop)",
	Version: fmt.Sprintf("%s (commit %s, built %s)", version.Version, version.Commit, version.Date),
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		ui.SuppressUpdateCheck = noUpdateNotifier || os.Getenv("DIAMOND_NO_UPDATE_NOTIFIER") != ""
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runTUI(ui.ViewMenu, 0)
	},
}

func runTUI(view ui.ViewID, gamePk int, query ...string) error {
	sport := mlb.AllSports[0] // default to MLB
	q := ""
	if len(query) > 0 {
		q = query[0]
	}
	app := ui.NewApp(view, gamePk, sport, q)
	p := tea.NewProgram(app, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().BoolVar(&noUpdateNotifier, "no-update-notifier", false, "suppress new version notifications")
	rootCmd.AddCommand(scoresCmd, gameCmd, standingsCmd, leadersCmd, teamCmd, playerCmd, mcpCmd)
}
