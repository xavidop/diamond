import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

const SCROLL_OFFSET = 72; // keep a jumped-to heading clear of the sticky bar

/** Trim redundant prefixes so chips stay short (e.g. "Statcast — Expected Stats"). */
function shortLabel(s: string) {
  return s.replace(/^Statcast\s*[—-]\s*/, "");
}

function slug(label: string) {
  return (
    "sec-" +
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
}

/**
 * Sticky in-page navigator for long detail pages (team / player / game).
 * Auto-discovers the section headings (<h2>) rendered in <main>, so it adapts
 * to whatever sections are present — including the game page's state-based
 * layout and async-loaded sections. Highlights the section in view (scroll-spy)
 * and smooth-scrolls to a section when its chip is clicked.
 */
export default function SectionNav() {
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [active, setActive] = useState("");
  const rowRef = useRef<HTMLDivElement>(null);

  // Discover headings and keep them in sync as sections load in.
  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;

    const scan = () => {
      const found: { id: string; label: string }[] = [];
      const seen = new Set<string>();
      root.querySelectorAll("h2").forEach((h) => {
        const label = h.textContent?.trim();
        if (!label) return;
        let id = h.id;
        if (!id) {
          id = slug(label);
          h.id = id;
        }
        if (seen.has(id)) return;
        seen.add(id);
        (h as HTMLElement).style.scrollMarginTop = `${SCROLL_OFFSET}px`;
        found.push({ id, label });
      });
      setSections((prev) =>
        prev.length === found.length &&
        prev.every((p, i) => p.id === found[i].id)
          ? prev
          : found
      );
    };

    scan();
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  // Scroll-spy: the active section is the last one whose heading has reached the
  // zone just below the sticky bar — so there's always exactly one highlighted,
  // and it flips as soon as a new heading rises into view.
  useEffect(() => {
    if (sections.length < 2) return;
    const main = document.querySelector("main");
    if (!main) return;
    const LINE = SCROLL_OFFSET + 56;
    const onScroll = () => {
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= LINE) current = s.id;
        else break;
      }
      // At the very bottom, the last (often short) section may never reach the
      // line — force it so the final chip can light up.
      if (main.scrollTop + main.clientHeight >= main.scrollHeight - 4) {
        current = sections[sections.length - 1].id;
      }
      setActive(current);
    };
    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [sections]);

  // Keep the active chip in view within the horizontally-scrolling bar.
  useEffect(() => {
    const row = rowRef.current;
    if (!active || !row) return;
    const chip = row.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!chip) return;
    row.scrollTo({
      left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2,
      behavior: "smooth",
    });
  }, [active]);

  if (sections.length < 2) return null;

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-pitch-950/90 px-4 backdrop-blur diamond-chrome">
      <div
        ref={rowRef}
        className="flex gap-1.5 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((s) => (
          <button
            key={s.id}
            data-chip={s.id}
            onClick={() =>
              document
                .getElementById(s.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-display text-[11px] font-bold uppercase tracking-wide transition-colors",
              active === s.id
                ? "bg-volt-500 text-black"
                : "text-white/55 hover:bg-white/10 hover:text-white/90"
            )}
          >
            {shortLabel(s.label)}
          </button>
        ))}
      </div>
    </div>
  );
}
