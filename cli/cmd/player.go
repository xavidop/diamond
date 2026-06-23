package cmd

import (
	"github.com/spf13/cobra"
	"github.com/xavidop/diamond/cli/internal/ui"
)

var playerCmd = &cobra.Command{
	Use:   "player [name]",
	Short: "Player profile and stats",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		query := ""
		if len(args) > 0 {
			query = args[0]
		}
		return runTUI(ui.ViewPlayer, 0, query)
	},
}
