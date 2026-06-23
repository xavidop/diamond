package cmd

import (
	"fmt"
	"strconv"

	"github.com/spf13/cobra"
	"github.com/xavidop/diamond/cli/internal/ui"
)

var gameCmd = &cobra.Command{
	Use:   "game <gamePk>",
	Short: "Live game detail",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		pk, err := strconv.Atoi(args[0])
		if err != nil {
			return fmt.Errorf("gamePk must be a number: %w", err)
		}
		return runTUI(ui.ViewGame, pk)
	},
}
