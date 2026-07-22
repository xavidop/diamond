import { describe, it, expect } from "vitest";
import { mergeRecentSpillover, type SpilloverGame } from "./utils";

const NOW = new Date("2026-06-27T08:00:00Z");

function game(gamePk: number, state: string, hoursFromNow: number): SpilloverGame {
  return {
    gamePk,
    status: { abstractGameState: state },
    gameDate: new Date(NOW.getTime() + hoursFromNow * 3600_000).toISOString(),
  };
}

describe("mergeRecentSpillover", () => {
  it("keeps live and recently-finished spillover, drops stale and dups", () => {
    const today = [game(1, "Preview", 6), game(2, "Live", -1)];
    const yesterday = [
      game(2, "Live", -1), // already in today → not duplicated
      game(3, "Live", -15), // long/suspended but live → kept via Live rule
      game(4, "Final", -3), // finished a few hours ago → kept
      game(5, "Final", -20), // a full slate ago → dropped
    ];
    const out = mergeRecentSpillover(today, yesterday, NOW);
    const ids = out.map((g) => g.gamePk).sort();
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  it("keeps adjacent games starting soon (imminent upcoming), drops far-future", () => {
    // For a viewer east of the US, this evening's US games are filed under the
    // previous (adjacent) date and haven't started yet — they must still show.
    const today = [game(1, "Preview", 18)]; // tomorrow's slate, primary → always kept
    const yesterday = [
      game(10, "Preview", 1), // starts in 1h → imminent → kept
      game(11, "Preview", 5), // starts in 5h → within upcoming window → kept
      game(12, "Preview", 8), // starts in 8h → beyond upcoming window → dropped
    ];
    const out = mergeRecentSpillover(today, yesterday, NOW);
    expect(out.map((g) => g.gamePk).sort((a, b) => a - b)).toEqual([1, 10, 11]);
  });

  it("excludes finished games with no/unparseable date but keeps live", () => {
    const yesterday: SpilloverGame[] = [
      { gamePk: 6, status: { abstractGameState: "Final" } },
      { gamePk: 7, status: { abstractGameState: "Live" } },
    ];
    const out = mergeRecentSpillover([], yesterday, NOW);
    expect(out.map((g) => g.gamePk).sort()).toEqual([7]);
  });
});
