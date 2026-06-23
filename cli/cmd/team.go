package cmd

import (
	"github.com/spf13/cobra"
	"github.com/xavidop/diamond/cli/internal/ui"
)

var teamCmd = &cobra.Command{
	Use:   "team [name]",
	Short: "Team roster and stats",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		query := ""
		if len(args) > 0 {
			query = args[0]
		}
		return runTUI(ui.ViewTeam, 0, query)
	},
}
