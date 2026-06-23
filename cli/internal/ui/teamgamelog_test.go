package ui

import (
	"testing"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func finalGame(homeID, awayID, homeScore, awayScore int, homeAbbr, awayAbbr string) mlb.Game {
	var g mlb.Game
	g.Status.AbstractGameState = "Final"
	g.Teams.Home.Team.ID, g.Teams.Home.Score, g.Teams.Home.Team.Abbreviation = homeID, homeScore, homeAbbr
	g.Teams.Away.Team.ID, g.Teams.Away.Score, g.Teams.Away.Team.Abbreviation = awayID, awayScore, awayAbbr
	g.Teams.Home.IsWinner = homeScore > awayScore
	g.Teams.Away.IsWinner = awayScore > homeScore
	return g
}

func TestGameLogResults(t *testing.T) {
	const NYY = 147
	games := []mlb.Game{
		finalGame(NYY, 111, 5, 3, "NYY", "BOS"), // NYY home win
		finalGame(110, NYY, 7, 2, "BAL", "NYY"), // NYY away loss
	}
	res := gameLogResults(games, NYY)
	if len(res) != 2 {
		t.Fatalf("expected 2 results, got %d", len(res))
	}
	if !res[0].Win || res[0].OppAbbr != "BOS" || !res[0].Home {
		t.Fatalf("game 1 should be a home win vs BOS, got %+v", res[0])
	}
	if res[1].Win || res[1].OppAbbr != "BAL" || res[1].Home {
		t.Fatalf("game 2 should be an away loss vs BAL, got %+v", res[1])
	}
}
