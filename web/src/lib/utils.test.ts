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

  it("excludes finished games with no/unparseable date but keeps live", () => {
    const yesterday: SpilloverGame[] = [
      { gamePk: 6, status: { abstractGameState: "Final" } },
      { gamePk: 7, status: { abstractGameState: "Live" } },
    ];
    const out = mergeRecentSpillover([], yesterday, NOW);
    expect(out.map((g) => g.gamePk).sort()).toEqual([7]);
  });
});
