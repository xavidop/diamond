import { describe, it, expect } from "vitest";
import { pitcherLine, batterLine } from "./miniBoxscore";

const BOX = {
  teams: {
    home: {
      players: {
        ID20: {
          person: { id: 20, fullName: "T. Skubal" },
          stats: { pitching: { numberOfPitches: 91, inningsPitched: "6.0", strikeOuts: 8 } },
          seasonStats: { pitching: { era: "2.41", wins: 13, losses: 4, saves: 0 } },
        },
      },
    },
    away: {
      players: {
        ID10: {
          person: { id: 10, fullName: "B. Witt Jr." },
          stats: { batting: { atBats: 3, hits: 1, rbi: 1, homeRuns: 0 } },
          seasonStats: { batting: { avg: ".332", ops: ".921", homeRuns: 25 } },
        },
      },
    },
  },
};

describe("pitcherLine", () => {
  it("reads season ERA/record and today's pitch count across both teams", () => {
    expect(pitcherLine(BOX, 20)).toEqual({ season: "13-4 · 2.41 ERA", game: "91 P · 6.0 IP" });
  });
  it("returns null for an unknown or missing person", () => {
    expect(pitcherLine(BOX, 999)).toBeNull();
    expect(pitcherLine(BOX, undefined)).toBeNull();
    expect(pitcherLine(undefined, 20)).toBeNull();
  });
});

describe("batterLine", () => {
  it("reads season average and today's line", () => {
    expect(batterLine(BOX, 10)).toEqual({ season: ".332 AVG", game: "1-3 · 1 RBI" });
  });
  it("omits the RBI segment when there are none", () => {
    const b = JSON.parse(JSON.stringify(BOX));
    b.teams.away.players.ID10.stats.batting.rbi = 0;
    expect(batterLine(b, 10)?.game).toBe("1-3");
  });
  it("returns null when the player has no batting stats yet", () => {
    expect(batterLine(BOX, 20)).toBeNull();
  });
});
