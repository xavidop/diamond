import { describe, it, expect } from "vitest";
import { notifyDiff, snapshotFromGame, type GameSnapshot, type NotifySettings } from "./notifyDiff";

const SETTINGS: NotifySettings = {
  enabled: true,
  followFavorites: false,
  runScored: true,
  gameFinal: true,
  gameStarting: true,
  permission: "granted",
};

function game(gamePk: number, away: number, home: number, state: string) {
  return {
    gamePk,
    status: { abstractGameState: state },
    teams: {
      away: { team: { id: 1, name: "Yankees" }, score: away },
      home: { team: { id: 2, name: "Red Sox" }, score: home },
    },
  };
}

describe("notifyDiff", () => {
  it("seeds silently on first sight (no events, fills next)", () => {
    const { events, next } = notifyDiff(new Map(), [game(1, 0, 0, "Preview")], SETTINGS, new Set([1]));
    expect(events).toEqual([]);
    expect(next.get(1)).toEqual({ away: 0, home: 0, state: "Preview" });
  });

  it("ignores games not in the watch set", () => {
    const { events } = notifyDiff(new Map(), [game(1, 0, 0, "Live")], SETTINGS, new Set());
    expect(events).toEqual([]);
  });

  it("emits a run event when a score increases", () => {
    const prev = new Map<number, GameSnapshot>([[1, { away: 1, home: 0, state: "Live" }]]);
    const { events } = notifyDiff(prev, [game(1, 1, 1, "Live")], SETTINGS, new Set([1]));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ gamePk: 1, type: "run", awayScore: 1, homeScore: 1 });
  });

  it("emits a starting event when state flips to Live", () => {
    const prev = new Map<number, GameSnapshot>([[1, { away: 0, home: 0, state: "Preview" }]]);
    const { events } = notifyDiff(prev, [game(1, 0, 0, "Live")], SETTINGS, new Set([1]));
    expect(events.map((e) => e.type)).toEqual(["starting"]);
  });

  it("emits a final event (not a run) when the game ends with a score change", () => {
    const prev = new Map<number, GameSnapshot>([[1, { away: 4, home: 4, state: "Live" }]]);
    const { events } = notifyDiff(prev, [game(1, 5, 4, "Final")], SETTINGS, new Set([1]));
    expect(events.map((e) => e.type)).toEqual(["final"]);
  });

  it("does not fire final twice", () => {
    const prev = new Map<number, GameSnapshot>([[1, { away: 5, home: 4, state: "Final" }]]);
    const { events } = notifyDiff(prev, [game(1, 5, 4, "Final")], SETTINGS, new Set([1]));
    expect(events).toEqual([]);
  });

  it("respects per-event settings toggles", () => {
    const prev = new Map<number, GameSnapshot>([[1, { away: 1, home: 0, state: "Live" }]]);
    const { events } = notifyDiff(prev, [game(1, 2, 0, "Live")], { ...SETTINGS, runScored: false }, new Set([1]));
    expect(events).toEqual([]);
  });

  it("snapshotFromGame reads scores and state with safe defaults", () => {
    expect(snapshotFromGame(game(1, 3, 2, "Live"))).toEqual({ away: 3, home: 2, state: "Live" });
    expect(snapshotFromGame({ gamePk: 9 })).toEqual({ away: 0, home: 0, state: "" });
  });
});
