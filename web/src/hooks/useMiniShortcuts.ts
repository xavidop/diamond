import { useEffect } from "react";
import type { MiniMode } from "../lib/miniStorage";

/**
 * Keyboard control for the mini viewer, bound to whichever document hosts it —
 * the Picture-in-Picture window when one is open, otherwise the main document.
 *
 * Deliberately separate from useShortcuts(): that hook is bound to `window` and
 * owns the `g`-prefixed navigation sequences, so sharing a handler would let a
 * mini-viewer keypress navigate the page underneath.
 */
export function useMiniShortcuts({
  doc,
  games,
  selectedGamePk,
  onSelect,
  mode,
  setMode,
  onClose,
}: {
  doc: Document | null;
  games: { gamePk: number }[];
  selectedGamePk: number | null;
  onSelect: (gamePk: number) => void;
  mode: MiniMode;
  setMode: (mode: MiniMode) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!doc) return;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;
      if (key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (key === "t" || key === "T") {
        e.preventDefault();
        setMode(mode === "focus" ? "slate" : "focus");
        return;
      }

      const step = key === "ArrowDown" || key === "j" ? 1 : key === "ArrowUp" || key === "k" ? -1 : 0;
      if (step === 0) return;

      const index = games.findIndex((g) => g.gamePk === selectedGamePk);
      const next = index === -1 ? 0 : index + step;
      if (next < 0 || next >= games.length) return;
      e.preventDefault();
      onSelect(games[next].gamePk);
    }

    doc.addEventListener("keydown", onKey);
    return () => doc.removeEventListener("keydown", onKey);
  }, [doc, games, selectedGamePk, onSelect, mode, setMode, onClose]);
}
