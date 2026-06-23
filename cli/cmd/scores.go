package cmd

import (
	"github.com/spf13/cobra"
	"github.com/xavidop/diamond/cli/internal/ui"
)

var scoresDate string

var scoresCmd = &cobra.Command{
	Use:   "scores",
	Short: "Today's scoreboard",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runTUI(ui.ViewScores, 0, scoresDate)
	},
}

func init() {
	scoresCmd.Flags().StringVar(&scoresDate, "date", "", "Date to show scores for (YYYY-MM-DD)")
}
