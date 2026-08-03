import { describe, it, expect } from "vitest";
import { gameSectionOrder } from "./gameSections";

describe("gameSectionOrder", () => {
  it("leads a live game with the 8-bit gamecast", () => {
    expect(gameSectionOrder("live")[0]).toBe("ribbie");
  });

  it("keeps the gamecast off a finished game, which has nothing left to watch", () => {
    expect(gameSectionOrder("final")).not.toContain("ribbie");
  });

  it("leads a scheduled game with the gamecast, for its countdown and lineups", () => {
    expect(gameSectionOrder("preview")[0]).toBe("ribbie");
  });

  it("still leads a finished game with its results", () => {
    expect(gameSectionOrder("final").slice(0, 3)).toEqual([
      "linescore",
      "boxscore",
      "highlights",
    ]);
  });

  it("still shows a scheduled game nothing but the gamecast and the matchup", () => {
    expect(gameSectionOrder("preview")).toEqual([
      "ribbie",
      "headToHead",
      "recentForm",
      "gameInfo",
    ]);
  });

  it("puts the live game's own flow directly after the gamecast", () => {
    expect(gameSectionOrder("live").slice(1, 4)).toEqual([
      "linescore",
      "winProb",
      "playByPlay",
    ]);
  });
});
