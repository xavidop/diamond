import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GameRow from "./GameRow";
import type { MiniGame } from "../../../lib/miniviewer";

const liveGame: MiniGame = {
  gamePk: 2,
  status: { abstractGameState: "Live" },
  teams: {
    away: { team: { id: 118, abbreviation: "KC" }, score: 3 },
    home: { team: { id: 116, abbreviation: "DET" }, score: 5 },
  },
  linescore: {
    currentInningOrdinal: "7th",
    isTopInning: true,
    outs: 2,
    offense: { first: { id: 1 } },
  },
};

const upcoming: MiniGame = {
  gamePk: 4,
  gameDate: "2026-07-23T23:07:00Z",
  status: { abstractGameState: "Preview", detailedState: "Scheduled" },
  teams: { away: { team: { abbreviation: "TB" } }, home: { team: { abbreviation: "TOR" } } },
};

const finalGame: MiniGame = {
  gamePk: 5,
  status: { abstractGameState: "Final" },
  teams: {
    away: { team: { abbreviation: "AZ" }, score: 6 },
    home: { team: { abbreviation: "STL" }, score: 3 },
  },
};

describe("GameRow", () => {
  it("shows both teams, scores, inning and live indicators", () => {
    render(<GameRow game={liveGame} selected={false} onSelect={() => {}} variant="line" />);
    expect(screen.getByText("KC")).toBeTruthy();
    expect(screen.getByText("DET")).toBeTruthy();
    expect(screen.getByText("▲ 7th")).toBeTruthy();
    expect(screen.getByLabelText("Runner on 1st")).toBeTruthy();
    expect(screen.getByLabelText("2 out")).toBeTruthy();
  });

  it("shows a start time for upcoming games and no diamond", () => {
    render(<GameRow game={upcoming} selected={false} onSelect={() => {}} variant="line" />);
    expect(screen.queryByLabelText(/Bases|Runner/)).toBeNull();
    expect(screen.getByText(/ET/)).toBeTruthy();
  });

  it("shows Final for finished games", () => {
    render(<GameRow game={finalGame} selected={false} onSelect={() => {}} variant="line" />);
    expect(screen.getByText("Final")).toBeTruthy();
  });

  it("calls onSelect with the gamePk", () => {
    const onSelect = vi.fn();
    render(<GameRow game={liveGame} selected={false} onSelect={onSelect} variant="stacked" />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("marks the selected row for assistive tech", () => {
    render(<GameRow game={liveGame} selected onSelect={() => {}} variant="line" />);
    expect(screen.getByRole("button").getAttribute("aria-current")).toBe("true");
  });
});
