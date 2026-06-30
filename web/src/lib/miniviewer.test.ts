import { describe, it, expect } from "vitest";
import { sortGames, pickDefaultGame, isLive, basesFromOffense, type MiniGame } from "./miniviewer";

const g = (gamePk: number, state: string): MiniGame => ({
  gamePk,
  status: { abstractGameState: state },
});

describe("miniviewer helpers", () => {
  it("sorts Live, then Preview, then Final", () => {
    const out = sortGames([g(1, "Final"), g(2, "Preview"), g(3, "Live")]).map((x) => x.gamePk);
    expect(out).toEqual([3, 2, 1]);
  });
  it("pickDefaultGame returns the first live game", () => {
    expect(pickDefaultGame([g(1, "Preview"), g(2, "Live"), g(3, "Live")])).toBe(2);
  });
  it("pickDefaultGame falls back to the first game, then null", () => {
    expect(pickDefaultGame([g(7, "Final"), g(8, "Preview")])).toBe(7);
    expect(pickDefaultGame([])).toBeNull();
  });
  it("isLive reflects abstractGameState", () => {
    expect(isLive(g(1, "Live"))).toBe(true);
    expect(isLive(g(1, "Final"))).toBe(false);
    expect(isLive(null)).toBe(false);
  });
  it("basesFromOffense maps presence of runners", () => {
    expect(basesFromOffense({ first: { id: 1 }, third: { id: 2 } })).toEqual({
      first: true,
      second: false,
      third: true,
    });
    expect(basesFromOffense(undefined)).toEqual({ first: false, second: false, third: false });
  });
});
