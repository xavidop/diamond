import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Linescore from "./Linescore";
import type { LineT } from "../../../lib/miniviewer";

const line: LineT = {
  innings: [
    { num: 1, away: 0, home: 2 },
    { num: 2, away: 1, home: null },
  ],
  away: { runs: 1, hits: 4, errors: 0 },
  home: { runs: 2, hits: 5, errors: 1 },
  scheduledInnings: 9,
};

describe("Linescore", () => {
  it("pads to the scheduled inning count", () => {
    render(<Linescore line={line} awayName="KC" homeName="DET" />);
    expect(screen.getByRole("columnheader", { name: "9" })).toBeTruthy();
  });

  it("renders R, H and E totals", () => {
    render(<Linescore line={line} awayName="KC" homeName="DET" />);
    const away = screen.getByRole("row", { name: /KC/ });
    expect(within(away).getByTestId("r").textContent).toBe("1");
    expect(within(away).getByTestId("h").textContent).toBe("4");
    expect(within(away).getByTestId("e").textContent).toBe("0");
  });

  it("shows X for a half-inning that was never batted", () => {
    const ended: LineT = {
      ...line,
      innings: [{ num: 1, away: 0, home: 2 }, { num: 9, away: 0, home: null }],
    };
    render(<Linescore line={ended} awayName="KC" homeName="DET" isFinal />);
    expect(screen.getByText("X")).toBeTruthy();
  });

  it("does not pad past the played innings in extras", () => {
    const extra: LineT = {
      ...line,
      innings: Array.from({ length: 11 }, (_, i) => ({ num: i + 1, away: 0, home: 0 })),
    };
    render(<Linescore line={extra} awayName="KC" homeName="DET" />);
    expect(screen.getByRole("columnheader", { name: "11" })).toBeTruthy();
  });
});
