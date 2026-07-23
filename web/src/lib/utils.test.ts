import { describe, it, expect } from "vitest";
import { gamesForDay, type DatedGame } from "./utils";

function game(gamePk: number, state: string, hoursFromBase = 0): DatedGame {
  const base = new Date("2026-06-27T18:00:00Z").getTime();
  return {
    gamePk,
    status: { abstractGameState: state },
    gameDate: new Date(base + hoursFromBase * 3600_000).toISOString(),
  };
}

describe("gamesForDay", () => {
  it("returns the day's slate as-is, de-duped and ordered by start time", () => {
    const slate = [game(2, "Final", 3), game(1, "Final", 1), game(1, "Final", 1)];
    const out = gamesForDay(slate, [], false);
    expect(out.map((g) => g.gamePk)).toEqual([1, 2]);
  });

  it("folds a currently-live neighbor into today, but not finished/upcoming ones", () => {
    const slate = [game(1, "Preview", 5)];
    const neighbors = [
      game(2, "Live", -2), // active in another timezone → shown today
      game(3, "Final", -6), // finished yesterday → stays on its own day
      game(4, "Preview", 20), // tomorrow's game → stays on its own day
    ];
    const out = gamesForDay(slate, neighbors, true);
    expect(out.map((g) => g.gamePk).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("ignores neighbors entirely when the date is not today", () => {
    const slate = [game(1, "Final", 0)];
    const neighbors = [game(2, "Live", -2)];
    expect(gamesForDay(slate, neighbors, false).map((g) => g.gamePk)).toEqual([1]);
  });

  it("does not duplicate a live game already in the slate", () => {
    const slate = [game(1, "Live", 0)];
    const neighbors = [game(1, "Live", 0)];
    expect(gamesForDay(slate, neighbors, true).map((g) => g.gamePk)).toEqual([1]);
  });
});
