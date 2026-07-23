import { describe, it, expect } from "vitest";
import { clampGeom, MIN_PANEL, DEFAULT_PANEL } from "./panelGeometry";

const viewport = { w: 1200, h: 800 };

describe("clampGeom", () => {
  it("leaves an in-bounds panel alone", () => {
    const g = { x: 24, y: 24, w: 360, h: 480 };
    expect(clampGeom(g, viewport)).toEqual(g);
  });

  it("pulls a panel back inside the right and bottom edges", () => {
    expect(clampGeom({ x: -50, y: -50, w: 360, h: 480 }, viewport)).toEqual({ x: 0, y: 0, w: 360, h: 480 });
  });

  it("stops a panel being dragged off the left and top", () => {
    // x/y are measured from the right/bottom, so a large value pushes it off-screen left/up
    const out = clampGeom({ x: 5000, y: 5000, w: 360, h: 480 }, viewport);
    expect(out.x).toBe(viewport.w - 360);
    expect(out.y).toBe(viewport.h - 480);
  });

  it("enforces the minimum size", () => {
    const out = clampGeom({ x: 0, y: 0, w: 10, h: 10 }, viewport);
    expect(out.w).toBe(MIN_PANEL.w);
    expect(out.h).toBe(MIN_PANEL.h);
  });

  it("shrinks a panel larger than the viewport", () => {
    const out = clampGeom({ x: 0, y: 0, w: 2000, h: 2000 }, { w: 500, h: 600 });
    expect(out.w).toBe(500);
    expect(out.h).toBe(600);
  });

  it("has a sane default", () => {
    expect(DEFAULT_PANEL).toEqual({ x: 24, y: 24, w: 360, h: 480 });
  });
});
