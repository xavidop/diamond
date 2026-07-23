// web/src/lib/miniStorage.ts
//
// localStorage for the mini viewer, under the app's existing `diamond.*` key
// convention (see ThemeContext's `diamond.cbSafe`). Every read tolerates a
// missing, corrupt, or unwritable store — the mini viewer must open regardless.

export type MiniMode = "focus" | "slate";
export type PanelGeom = { x: number; y: number; w: number; h: number };

const KEY_MODE = "diamond.mini.mode";
const KEY_GAME = "diamond.mini.gamePk";
const KEY_PANEL = "diamond.mini.panel";

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode, quota, or no storage — non-fatal */
  }
}

export function readMode(): MiniMode {
  return get(KEY_MODE) === "slate" ? "slate" : "focus";
}

export function writeMode(mode: MiniMode) {
  set(KEY_MODE, mode);
}

export function readGamePk(): number | null {
  const raw = get(KEY_GAME);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function writeGamePk(pk: number | null) {
  set(KEY_GAME, pk == null ? null : String(pk));
}

export function readPanelGeom(): PanelGeom | null {
  const raw = get(KEY_PANEL);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const ok = ["x", "y", "w", "h"].every((k) => typeof v?.[k] === "number");
    return ok ? (v as PanelGeom) : null;
  } catch {
    return null;
  }
}

export function writePanelGeom(geom: PanelGeom) {
  set(KEY_PANEL, JSON.stringify(geom));
}
