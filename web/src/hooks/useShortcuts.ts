import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Vim-like `g X` sequences plus a few single-key shortcuts.
 * Returns `helpOpen` state and a setter so a parent can render the modal.
 *
 * Shortcuts:
 *   g t  → today (home)
 *   g s  → scoreboard
 *   g d  → standings
 *   g m  → teams
 *   g l  → leaders
 *   g c  → compare
 *   g h  → history
 *   g r  → draft
 *   g f  → favorites
 *   g a  → API explorer
 *   g v  → venues
 *   g x  → transactions
 *   g w  → awards
 *   g k  → streaks
 *   ?    → toggle this help
 */
const SEQUENCES: Record<string, string> = {
  t: "/",
  s: "/scoreboard",
  d: "/standings",
  m: "/teams",
  l: "/leaders",
  c: "/compare",
  e: "/team-compare",
  p: "/postseason",
  h: "/history",
  r: "/draft",
  f: "/favorites",
  a: "/explorer",
  v: "/venues",
  x: "/transactions",
  w: "/awards",
  k: "/streaks",
  g: "/glossary",
};

export function useShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    let buffer = "";

    function flush() {
      buffer = "";
      if (pending) clearTimeout(pending);
      pending = null;
    }

    function onKey(e: KeyboardEvent) {
      // ignore when typing in inputs
      const tgt = e.target as HTMLElement | null;
      if (
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable)
      ) {
        return;
      }
      // Modifier-only events shouldn't trigger
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // help toggle (shift+/ = ?)
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }

      if (e.key === "Escape") {
        setHelpOpen(false);
        flush();
        return;
      }

      if (buffer === "g") {
        const dest = SEQUENCES[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          navigate(dest);
        }
        flush();
        return;
      }

      if (e.key.toLowerCase() === "g") {
        buffer = "g";
        if (pending) clearTimeout(pending);
        pending = setTimeout(flush, 1000);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (pending) clearTimeout(pending);
    };
  }, [navigate]);

  return { helpOpen, setHelpOpen };
}

export const SHORTCUT_GROUPS = [
  {
    title: "Navigation (press g, then…)",
    items: [
      ["g t", "Today"],
      ["g s", "Scoreboard"],
      ["g d", "Standings"],
      ["g m", "Teams"],
      ["g l", "Leaders"],
      ["g k", "Streaks"],
      ["g c", "Compare Players"],
      ["g e", "Compare Teams"],
      ["g p", "Postseason"],
      ["g h", "History"],
      ["g r", "Draft"],
      ["g w", "Awards"],
      ["g x", "Transactions"],
      ["g v", "Venues"],
      ["g g", "Glossary"],
      ["g f", "Favorites"],
      ["g a", "API Explorer"],
    ],
  },
  {
    title: "Global",
    items: [
      ["⌘ K", "Command palette / search"],
      ["?", "Show / hide this cheatsheet"],
      ["Esc", "Close dialogs"],
    ],
  },
];
