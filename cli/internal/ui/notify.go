package ui

import (
	"fmt"

	"github.com/gen2brain/beeep"
)

func NotifyRun(away, home string, awayScore, homeScore int) {
	msg := fmt.Sprintf("%s %d, %s %d", away, awayScore, home, homeScore)
	_ = beeep.Notify("⚾ Run Scored", msg, "")
}

func NotifyFinal(away, home string, awayScore, homeScore int) {
	msg := fmt.Sprintf("Final: %s %d, %s %d", away, awayScore, home, homeScore)
	_ = beeep.Notify("⚾ Game Over", msg, "")
}
