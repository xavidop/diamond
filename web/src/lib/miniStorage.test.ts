import { describe, it, expect, beforeEach } from "vitest";
import { readMode, writeMode, readGamePk, writeGamePk, readPanelGeom, writePanelGeom } from "./miniStorage";

beforeEach(() => window.localStorage.clear());

describe("miniStorage", () => {
  it("defaults to focus mode", () => {
    expect(readMode()).toBe("focus");
  });
  it("round-trips the mode", () => {
    writeMode("slate");
    expect(readMode()).toBe("slate");
  });
  it("ignores a corrupt mode value", () => {
    window.localStorage.setItem("diamond.mini.mode", "banana");
    expect(readMode()).toBe("focus");
  });
  it("round-trips the selected game", () => {
    expect(readGamePk()).toBeNull();
    writeGamePk(824247);
    expect(readGamePk()).toBe(824247);
    writeGamePk(null);
    expect(readGamePk()).toBeNull();
  });
  it("ignores a non-numeric game key", () => {
    window.localStorage.setItem("diamond.mini.gamePk", "nope");
    expect(readGamePk()).toBeNull();
  });
  it("round-trips panel geometry and rejects malformed json", () => {
    expect(readPanelGeom()).toBeNull();
    writePanelGeom({ x: 24, y: 24, w: 360, h: 480 });
    expect(readPanelGeom()).toEqual({ x: 24, y: 24, w: 360, h: 480 });
    window.localStorage.setItem("diamond.mini.panel", "{oops");
    expect(readPanelGeom()).toBeNull();
  });
});
