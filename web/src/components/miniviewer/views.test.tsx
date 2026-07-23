import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FocusView from "./FocusView";
import SlateView from "./SlateView";
import type { MiniGame } from "../../lib/miniviewer";

const live: MiniGame = {
  gamePk: 2,
  status: { abstractGameState: "Live" },
  teams: {
    away: { team: { id: 118, abbreviation: "KC" }, score: 3 },
    home: { team: { id: 116, abbreviation: "DET" }, score: 5 },
  },
  linescore: {
    currentInningOrdinal: "7th", isTopInning: true, balls: 1, strikes: 2, outs: 2, scheduledInnings: 9,
    innings: [{ num: 1, away: { runs: 0 }, home: { runs: 2 } }],
    teams: { away: { runs: 3, hits: 7, errors: 0 }, home: { runs: 5, hits: 9, errors: 1 } },
    offense: { batter: { id: 10, fullName: "B. Witt Jr." }, first: { id: 1 } },
    defense: { pitcher: { id: 20, fullName: "T. Skubal" } },
  },
};

const upcoming: MiniGame = {
  gamePk: 4,
  gameDate: "2026-07-23T23:07:00Z",
  status: { abstractGameState: "Preview", detailedState: "Scheduled" },
  teams: { away: { team: { abbreviation: "TB" } }, home: { team: { abbreviation: "TOR" } } },
};

const done: MiniGame = {
  gamePk: 5,
  gameDate: "2026-07-23T17:10:00Z",
  status: { abstractGameState: "Final" },
  teams: { away: { team: { abbreviation: "AZ" }, score: 6 }, home: { team: { abbreviation: "STL" }, score: 3 } },
  linescore: { scheduledInnings: 9, innings: [], teams: {} },
};

const NO_STATS = { pitcher: null, batter: null };

describe("FocusView", () => {
  it("renders score, status, detail, linescore and the other games", () => {
    render(<FocusView game={live} games={[live, upcoming, done]} selectedGamePk={2} onSelect={() => {}} stats={NO_STATS} now={0} />);
    expect(screen.getByText("▲ 7TH")).toBeTruthy();
    expect(screen.getByText("T. Skubal")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "9" })).toBeTruthy();
    expect(screen.getByText("TB")).toBeTruthy();
  });

  it("omits the linescore for a scheduled game", () => {
    render(<FocusView game={upcoming} games={[upcoming]} selectedGamePk={4} onSelect={() => {}} stats={NO_STATS} now={0} />);
    expect(screen.queryByRole("columnheader", { name: "9" })).toBeNull();
  });

  it("renders nothing but the list when no game is selected", () => {
    render(<FocusView game={null} games={[upcoming]} selectedGamePk={null} onSelect={() => {}} stats={NO_STATS} now={0} />);
    expect(screen.getByText("TB")).toBeTruthy();
  });
});

describe("SlateView", () => {
  it("groups into live, final and upcoming with counts, in that order", () => {
    render(<SlateView games={[upcoming, done, live]} selectedGamePk={2} onSelect={() => {}} />);
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual(["Live · 1", "Final · 1", "Upcoming · 1"]);
  });

  it("selects a game when a row is clicked", () => {
    const onSelect = vi.fn();
    render(<SlateView games={[live, upcoming]} selectedGamePk={2} onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalledWith(4);
  });
});
