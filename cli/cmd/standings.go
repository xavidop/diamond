package cmd

import (
	"github.com/spf13/cobra"
	"github.com/xavidop/diamond/cli/internal/ui"
)

var standingsSeason string

var standingsCmd = &cobra.Command{
	Use:   "standings",
	Short: "Division standings",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runTUI(ui.ViewStandings, 0, standingsSeason)
	},
}

func init() {
	standingsCmd.Flags().StringVar(&standingsSeason, "season", "", "Season year (YYYY)")
}
