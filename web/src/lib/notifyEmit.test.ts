import { describe, it, expect } from "vitest";
import { buildMessage } from "./notifyEmit";
import type { NotifyEvent } from "./notifyDiff";

const base: Omit<NotifyEvent, "type"> = {
  gamePk: 7,
  awayName: "Yankees",
  homeName: "Red Sox",
  awayScore: 3,
  homeScore: 2,
};

describe("buildMessage", () => {
  it("formats a run event", () => {
    expect(buildMessage({ ...base, type: "run" })).toEqual({
      title: "⚾ Run scored",
      body: "Yankees 3, Red Sox 2",
      tag: "7:run",
    });
  });

  it("formats a final event", () => {
    expect(buildMessage({ ...base, type: "final" })).toEqual({
      title: "Final",
      body: "Yankees 3, Red Sox 2",
      tag: "7:final",
    });
  });

  it("formats a starting event with matchup body", () => {
    expect(buildMessage({ ...base, type: "starting" })).toEqual({
      title: "▶ Game starting",
      body: "Yankees @ Red Sox",
      tag: "7:starting",
    });
  });
});
