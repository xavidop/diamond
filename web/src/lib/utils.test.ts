import { describe, it, expect } from "vitest";
import { localDateOf, bucketDay, gamesForDay, type DatedGame } from "./utils";

const BASE = new Date("2026-06-27T12:00:00Z");
const DAY = localDateOf(BASE);
// +48h / -48h are always two local days away regardless of the runner's zone.
const NEXT = localDateOf(new Date(BASE.getTime() + 48 * 3600_000));
const PREV = localDateOf(new Date(BASE.getTime() - 48 * 3600_000));

function game(
  gamePk: number,
  state: string,
  offsetH = 0,
  detailedState?: string,
): DatedGame {
  return {
    gamePk,
    status: { abstractGameState: state, detailedState },
    gameDate: new Date(BASE.getTime() + offsetH * 3600_000).toISOString(),
  };
}

describe("localDateOf", () => {
  it("returns the local calendar date of an instant", () => {
    const expected = new Date(BASE.getTime() - BASE.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
    expect(localDateOf(BASE)).toBe(expected);
    expect(localDateOf(BASE.toISOString())).toBe(expected);
  });

  it("returns empty string for an unparseable date", () => {
    expect(localDateOf("not-a-date")).toBe("");
  });
});

describe("bucketDay", () => {
  it("puts a live game on today regardless of when it started", () => {
    // Started two local days ago but still live → shows on today.
    expect(bucketDay(game(1, "Live", -48), DAY)).toBe(DAY);
  });

  it("puts a finished/upcoming game on the local day it started", () => {
    expect(bucketDay(game(1, "Final", 0), NEXT)).toBe(DAY);
    expect(bucketDay(game(1, "Preview", 0), PREV)).toBe(DAY);
  });
});

describe("gamesForDay", () => {
  it("prefers the real entry over a postponed ghost of the same game", () => {
    const ghost = game(1, "Preview", 0, "Postponed"); // buckets to DAY by start
    const real = game(1, "Final", 48, "Final"); // real replay, buckets to NEXT
    // Ghost first, then real — real must win, so pk 1 is NOT on DAY.
    expect(gamesForDay([ghost, real], DAY, DAY).map((g) => g.gamePk)).toEqual([]);
    expect(gamesForDay([ghost, real], NEXT, DAY).map((g) => g.gamePk)).toEqual([1]);
  });

  it("buckets live to today and finished to its start day", () => {
    const games = [
      game(10, "Final", 0), // finished today → DAY
      game(11, "Live", -48), // live, started 2 days ago → today (DAY)
      game(12, "Final", 48), // finished, started 2 days later → NEXT, not DAY
    ];
    const sorted = (arr: DatedGame[]) => arr.map((g) => g.gamePk).sort((a, b) => a - b);
    // On DAY (which is today): the game that finished today + the live game.
    expect(sorted(gamesForDay(games, DAY, DAY))).toEqual([10, 11]);
    // On NEXT while today is DAY: only the finished game that started NEXT — the
    // live game lives on today, not here.
    expect(sorted(gamesForDay(games, NEXT, DAY))).toEqual([12]);
  });

  it("orders a day's games by start time", () => {
    const games = [game(20, "Final", 5), game(21, "Final", 1), game(22, "Final", 3)];
    expect(gamesForDay(games, DAY, DAY).map((g) => g.gamePk)).toEqual([21, 22, 20]);
  });
});
