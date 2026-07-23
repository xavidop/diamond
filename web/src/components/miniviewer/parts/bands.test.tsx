import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoreRows from "./ScoreRows";
import StatusStrip from "./StatusStrip";
import DetailBand from "./DetailBand";
import { deriveGameState, type MiniGame } from "../../../lib/miniviewer";

const NO_STATS = { pitcher: null, batter: null };

const live = deriveGameState({
  gamePk: 2,
  status: { abstractGameState: "Live" },
  teams: {
    away: { team: { id: 118, abbreviation: "KC" }, score: 3, leagueRecord: { wins: 43, losses: 60, pct: ".417" } },
    home: { team: { id: 116, abbreviation: "DET" }, score: 5 },
  },
  linescore: {
    currentInningOrdinal: "7th", isTopInning: true, balls: 1, strikes: 2, outs: 2,
    offense: { batter: { id: 10, fullName: "B. Witt Jr." }, onDeck: { id: 11, fullName: "S. Perez" }, first: { id: 1 } },
    defense: { pitcher: { id: 20, fullName: "T. Skubal" } },
  },
} as MiniGame);

const scheduled = deriveGameState({
  gamePk: 1,
  gameDate: "2026-07-23T22:40:00Z",
  status: { abstractGameState: "Preview", detailedState: "Scheduled" },
  venue: { name: "Comerica Park" },
  teams: {
    away: { team: { abbreviation: "KC" }, probablePitcher: { id: 1, fullName: "Randy Dobnak", stats: [{ splits: [{ stat: { wins: 6, losses: 8, era: "4.12", strikeOuts: 88 } }] }] } },
    home: { team: { abbreviation: "DET" } },
  },
} as MiniGame);

const final = deriveGameState({
  gamePk: 3,
  status: { abstractGameState: "Final" },
  teams: {
    away: { team: { abbreviation: "KC" }, score: 3 },
    home: { team: { abbreviation: "DET" }, score: 5 },
  },
  linescore: { scheduledInnings: 9, innings: [], teams: {} },
  decisions: { winner: { id: 20, fullName: "T. Skubal" }, loser: { id: 21, fullName: "C. Ragans" }, save: { id: 22, fullName: "W. Vest" } },
} as MiniGame);

describe("ScoreRows", () => {
  it("renders both teams with records and scores", () => {
    render(<ScoreRows state={live} />);
    expect(screen.getByText("KC")).toBeTruthy();
    expect(screen.getByText("43-60 · .417")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });
  it("renders dashes for a scheduled game", () => {
    render(<ScoreRows state={scheduled} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});

describe("StatusStrip", () => {
  it("shows inning, count and outs when live", () => {
    render(<StatusStrip state={live} now={0} />);
    expect(screen.getByText("▲ 7TH")).toBeTruthy();
    expect(screen.getByText("1-2")).toBeTruthy();
    expect(screen.getByLabelText("2 out")).toBeTruthy();
    expect(screen.getByLabelText("Runner on 1st")).toBeTruthy();
  });

  it("counts down to first pitch when scheduled", () => {
    const now = Date.parse("2026-07-23T20:25:22Z"); // 2:14:38 before first pitch
    render(<StatusStrip state={scheduled} now={now} />);
    expect(screen.getByText("2:14:38")).toBeTruthy();
  });

  it("shows FINAL when the game is over", () => {
    render(<StatusStrip state={final} now={0} />);
    expect(screen.getByText("FINAL")).toBeTruthy();
  });
});

describe("DetailBand", () => {
  it("shows the pitcher/batter matchup and on-deck when live", () => {
    render(<DetailBand state={live} stats={NO_STATS} />);
    expect(screen.getByText("T. Skubal")).toBeTruthy();
    expect(screen.getByText("B. Witt Jr.")).toBeTruthy();
    expect(screen.getByText(/S. Perez/)).toBeTruthy();
  });

  it("shows boxscore stat lines when supplied", () => {
    render(<DetailBand state={live} stats={{ pitcher: { season: "13-4 · 2.41 ERA", game: "91 P · 6.0 IP" }, batter: { season: ".332 AVG", game: "1-3" } }} />);
    expect(screen.getByText("13-4 · 2.41 ERA")).toBeTruthy();
    expect(screen.getByText("91 P · 6.0 IP")).toBeTruthy();
  });

  it("shows probables and TBD when scheduled", () => {
    render(<DetailBand state={scheduled} stats={NO_STATS} />);
    expect(screen.getByText("Randy Dobnak")).toBeTruthy();
    expect(screen.getByText("6-8 · 4.12 ERA · 88 K")).toBeTruthy();
    expect(screen.getByText("TBD")).toBeTruthy();
  });

  it("shows W/L/SV decisions when final", () => {
    render(<DetailBand state={final} stats={NO_STATS} />);
    expect(screen.getByText("T. Skubal")).toBeTruthy();
    expect(screen.getByText("C. Ragans")).toBeTruthy();
    expect(screen.getByText("W. Vest")).toBeTruthy();
  });
});
