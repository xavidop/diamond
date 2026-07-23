import type { PanelGeom } from "./miniStorage";

/** x and y are offsets from the viewport's right and bottom edges. */
export const DEFAULT_PANEL: PanelGeom = { x: 24, y: 24, w: 360, h: 480 };
export const MIN_PANEL = { w: 280, h: 320 };

export function clampGeom(geom: PanelGeom, viewport: { w: number; h: number }): PanelGeom {
  const w = Math.min(Math.max(geom.w, MIN_PANEL.w), viewport.w);
  const h = Math.min(Math.max(geom.h, MIN_PANEL.h), viewport.h);
  return {
    w,
    h,
    x: Math.min(Math.max(geom.x, 0), Math.max(0, viewport.w - w)),
    y: Math.min(Math.max(geom.y, 0), Math.max(0, viewport.h - h)),
  };
}
