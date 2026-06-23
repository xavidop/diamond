package cmd

import (
	"github.com/spf13/cobra"
	"github.com/xavidop/diamond/cli/internal/ui"
)

var leadersGroup string

var leadersCmd = &cobra.Command{
	Use:   "leaders",
	Short: "Stat leaders",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runTUI(ui.ViewLeaders, 0, leadersGroup)
	},
}

func init() {
	leadersCmd.Flags().StringVar(&leadersGroup, "group", "", "Stat group: hitting or pitching")
}
