/** Which of a game's three lives we're looking at. */
export type GameKind = "live" | "final" | "preview";

/**
 * Section ordering for the game detail page, by what matters most for the
 * game's current state:
 *  - live → the gamecast, then the live game flow
 *  - finished → results (boxscore, highlights, recap)
 *  - upcoming → the gamecast's pre-game view, then the matchup; everything else
 *    has no data yet, so skip it
 *
 * The Ribbie gamecast leads both live and upcoming games: live it's the game
 * itself, and before first pitch it counts down and shows both lineups. It's
 * left off finished games, where a moving picture of a settled result would
 * just be a slower box score.
 */
export function gameSectionOrder(kind: GameKind): string[] {
  switch (kind) {
    case "final":
      return [
        "linescore",
        "boxscore",
        "highlights",
        "playByPlay",
        "winProb",
        "strikeZone",
        "sprayChart",
        "statcast",
        "headToHead",
        "recentForm",
        "gameInfo",
      ];
    case "live":
      return [
        "ribbie",
        "linescore",
        "winProb",
        "playByPlay",
        "boxscore",
        "headToHead",
        "recentForm",
        "strikeZone",
        "sprayChart",
        "statcast",
        "highlights",
        "gameInfo",
      ];
    case "preview":
      return ["ribbie", "headToHead", "recentForm", "gameInfo"];
  }
}
