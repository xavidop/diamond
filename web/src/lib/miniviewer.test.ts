import { describe, it, expect } from "vitest";
import {
  sortGames,
  pickDefaultGame,
  isLive,
  basesFromOffense,
  deriveGameState,
  type MiniGame,
} from "./miniviewer";

const g = (gamePk: number, state: string): MiniGame => ({
  gamePk,
  status: { abstractGameState: state },
});

const scheduled: MiniGame = {
  gamePk: 1,
  gameDate: "2026-07-23T22:40:00Z",
  status: { abstractGameState: "Preview", detailedState: "Scheduled" },
  venue: { name: "Comerica Park" },
  seriesGameNumber: 2,
  gamesInSeries: 3,
  dayNight: "night",
  teams: {
    away: {
      team: { id: 118, name: "Kansas City Royals", abbreviation: "KC" },
      leagueRecord: { wins: 43, losses: 60, pct: ".417" },
      probablePitcher: {
        id: 1,
        fullName: "Randy Dobnak",
        stats: [{ splits: [{ stat: { wins: 6, losses: 8, era: "4.12", strikeOuts: 88 } }] }],
      },
    },
    home: {
      team: { id: 116, name: "Detroit Tigers", abbreviation: "DET" },
      leagueRecord: { wins: 61, losses: 42, pct: ".592" },
    },
  },
};

const live: MiniGame = {
  gamePk: 2,
  status: { abstractGameState: "Live", detailedState: "In Progress" },
  teams: {
    away: { team: { id: 118, abbreviation: "KC" }, score: 3 },
    home: { team: { id: 116, abbreviation: "DET" }, score: 5 },
  },
  linescore: {
    currentInningOrdinal: "7th",
    inningState: "Top",
    isTopInning: true,
    balls: 1,
    strikes: 2,
    outs: 2,
    scheduledInnings: 9,
    innings: [
      { num: 1, away: { runs: 0 }, home: { runs: 2 } },
      { num: 2, away: { runs: 1 }, home: { runs: 0 } },
    ],
    teams: { away: { runs: 3, hits: 7, errors: 0 }, home: { runs: 5, hits: 9, errors: 1 } },
    offense: { batter: { id: 10, fullName: "B. Witt Jr." }, onDeck: { id: 11, fullName: "S. Perez" }, first: { id: 12 }, third: { id: 13 } },
    defense: { pitcher: { id: 20, fullName: "T. Skubal" } },
  },
};

const final: MiniGame = {
  gamePk: 3,
  status: { abstractGameState: "Final", detailedState: "Final" },
  teams: {
    away: { team: { id: 118, abbreviation: "KC" }, score: 3 },
    home: { team: { id: 116, abbreviation: "DET" }, score: 5 },
  },
  linescore: {
    scheduledInnings: 9,
    innings: [
      { num: 1, away: { runs: 0 }, home: { runs: 2 } },
      { num: 9, away: { runs: 0 }, home: {} },
    ],
    teams: { away: { runs: 3, hits: 7, errors: 0 }, home: { runs: 5, hits: 9, errors: 1 } },
  },
  decisions: {
    winner: { id: 20, fullName: "T. Skubal" },
    loser: { id: 21, fullName: "C. Ragans" },
    save: { id: 22, fullName: "W. Vest" },
  },
};

describe("miniviewer helpers", () => {
  it("sorts Live, then Final, then Preview", () => {
    const out = sortGames([g(2, "Preview"), g(1, "Final"), g(3, "Live")]).map((x) => x.gamePk);
    expect(out).toEqual([3, 1, 2]);
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

describe("deriveGameState", () => {
  it("derives a scheduled game with probables, record and chips", () => {
    const s = deriveGameState(scheduled);
    expect(s.kind).toBe("scheduled");
    if (s.kind !== "scheduled") return;
    expect(s.away.name).toBe("KC");
    expect(s.away.record).toBe("43-60 · .417");
    expect(s.away.score).toBeNull();
    expect(s.startsAt?.toISOString()).toBe("2026-07-23T22:40:00.000Z");
    expect(s.probables.away.name).toBe("Randy Dobnak");
    expect(s.probables.away.line).toBe("6-8 · 4.12 ERA · 88 K");
    expect(s.probables.home.name).toBe("TBD");
    expect(s.probables.home.line).toBe("");
    expect(s.chips).toEqual(["Comerica Park", "Game 2 of 3", "Night"]);
  });

  it("derives a live game with count, bases and matchup names", () => {
    const s = deriveGameState(live);
    expect(s.kind).toBe("live");
    if (s.kind !== "live") return;
    expect(s.inningOrdinal).toBe("7th");
    expect(s.isTop).toBe(true);
    expect(s.balls).toBe(1);
    expect(s.strikes).toBe(2);
    expect(s.outs).toBe(2);
    expect(s.bases).toEqual({ first: true, second: false, third: true });
    expect(s.pitcher?.fullName).toBe("T. Skubal");
    expect(s.batter?.fullName).toBe("B. Witt Jr.");
    expect(s.onDeck?.fullName).toBe("S. Perez");
    expect(s.line.away.runs).toBe(3);
    expect(s.line.innings[0]).toEqual({ num: 1, away: 0, home: 2 });
  });

  it("prefers an override linescore over the schedule's copy", () => {
    const s = deriveGameState(live, { linescore: { ...live.linescore, outs: 1, balls: 3 } });
    if (s.kind !== "live") return;
    expect(s.outs).toBe(1);
    expect(s.balls).toBe(3);
  });

  it("derives a final game with decisions, winner and an un-batted half", () => {
    const s = deriveGameState(final);
    expect(s.kind).toBe("final");
    if (s.kind !== "final") return;
    expect(s.winnerSide).toBe("home");
    expect(s.extras).toBeNull();
    expect(s.decisions.win?.fullName).toBe("T. Skubal");
    expect(s.decisions.save?.fullName).toBe("W. Vest");
    expect(s.line.innings[1]).toEqual({ num: 9, away: 0, home: null });
  });

  it("reports extra innings", () => {
    const extra = {
      ...final,
      linescore: { ...final.linescore, innings: [...(final.linescore!.innings ?? []), { num: 10, away: { runs: 1 }, home: { runs: 2 } }] },
    };
    const s = deriveGameState(extra as MiniGame);
    if (s.kind !== "final") return;
    expect(s.extras).toBe(10);
  });

  it("detects postponed games hiding behind Preview", () => {
    const pp = { ...scheduled, status: { abstractGameState: "Preview", detailedState: "Postponed" } };
    const s = deriveGameState(pp as MiniGame);
    expect(s.kind).toBe("postponed");
    if (s.kind !== "postponed") return;
    expect(s.reason).toBe("Postponed");
  });

  it("falls back to the full team name when no abbreviation exists", () => {
    const noAbbr = { ...scheduled, teams: { ...scheduled.teams, away: { team: { id: 118, name: "Kansas City Royals" } } } };
    const s = deriveGameState(noAbbr as MiniGame);
    expect(s.away.name).toBe("Kansas City Royals");
    expect(s.away.record).toBe("");
  });
});
