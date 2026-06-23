import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Flame,
  GitCompare,
  History,
  Home,
  Layers,
  Search,
  Shield,
  Star,
  TerminalSquare,
  Trophy,
  User,
  Award,
  ArrowLeftRight,
  MapPin,
  Zap,
  Crown,
  Users,
  BookOpen,
} from "lucide-react";
import { api, playerHeadshotUrl, teamLogoUrl } from "../../api/mlb";
import { useFavorites } from "../../contexts/FavoritesContext";
import { useSport } from "../../contexts/SportContext";
import { cn } from "../../lib/utils";

type Item = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  to: string;
  icon: React.ReactNode;
  iconUrl?: string;
};

const PAGES: Item[] = [
  { id: "p-today", group: "Pages", label: "Today", to: "/", icon: <Home size={14} /> },
  { id: "p-scoreboard", group: "Pages", label: "Scoreboard", to: "/scoreboard", icon: <CalendarDays size={14} /> },
  { id: "p-standings", group: "Pages", label: "Standings", to: "/standings", icon: <Trophy size={14} /> },
  { id: "p-teams", group: "Pages", label: "Teams", to: "/teams", icon: <Shield size={14} /> },
  { id: "p-leaders", group: "Pages", label: "Leaders", to: "/leaders", icon: <Flame size={14} /> },
  { id: "p-streaks", group: "Pages", label: "Hot & Cold Streaks", to: "/streaks", icon: <Zap size={14} /> },
  { id: "p-compare", group: "Pages", label: "Compare Players", to: "/compare", icon: <GitCompare size={14} /> },
  { id: "p-team-compare", group: "Pages", label: "Compare Teams", to: "/team-compare", icon: <Users size={14} /> },
  { id: "p-postseason", group: "Pages", label: "Postseason Bracket", to: "/postseason", icon: <Crown size={14} /> },
  { id: "p-history", group: "Pages", label: "History", to: "/history", icon: <History size={14} /> },
  { id: "p-awards", group: "Pages", label: "Awards", to: "/awards", icon: <Award size={14} /> },
  { id: "p-trans", group: "Pages", label: "Transactions", to: "/transactions", icon: <ArrowLeftRight size={14} /> },
  { id: "p-venues", group: "Pages", label: "Ballparks", to: "/venues", icon: <MapPin size={14} /> },
  { id: "p-draft", group: "Pages", label: "Draft", to: "/draft", icon: <Layers size={14} /> },
  { id: "p-glossary", group: "Pages", label: "Stat Glossary", to: "/glossary", icon: <BookOpen size={14} /> },
  { id: "p-favs", group: "Pages", label: "Favorites", to: "/favorites", icon: <Star size={14} /> },
  { id: "p-api", group: "Pages", label: "API Explorer", to: "/explorer", icon: <TerminalSquare size={14} /> },
];

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { favs } = useFavorites();
  const { sportId } = useSport();
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      // focus after the panel mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounce search input for player API
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 180);
    return () => clearTimeout(t);
  }, [q]);

  const search = useQuery({
    queryKey: ["palette-search", sportId, debounced],
    queryFn: () => api.search(debounced, { sportId }),
    enabled: open && debounced.length > 1,
  });

  // Build flat list of items: filtered pages + favorites + search results
  const items: Item[] = useMemo(() => {
    const norm = q.trim().toLowerCase();
    const pages = norm
      ? PAGES.filter((p) => p.label.toLowerCase().includes(norm))
      : PAGES;

    const favItems: Item[] = favs.map((f) => ({
      id: `f-${f.kind}-${f.id}`,
      group: "Favorites",
      label: f.name,
      hint: f.kind === "team" ? "Team" : "Player",
      to: f.kind === "team" ? `/teams/${f.id}` : `/players/${f.id}`,
      icon: <Star size={14} className="text-amber-400" />,
      iconUrl:
        f.kind === "team"
          ? teamLogoUrl(f.id)
          : playerHeadshotUrl(f.id, 60),
    }));
    const favFiltered = norm
      ? favItems.filter((f) => f.label.toLowerCase().includes(norm))
      : favItems;

    const players = ((search.data?.people ?? []) as any[])
      .slice(0, 8)
      .map<Item>((p) => ({
        id: `s-${p.id}`,
        group: "Players",
        label: p.fullName,
        hint:
          [p.primaryPosition?.abbreviation, p.currentTeam?.name]
            .filter(Boolean)
            .join(" · ") || "Player",
        to: `/players/${p.id}`,
        icon: <User size={14} />,
        iconUrl: playerHeadshotUrl(p.id, 60),
      }));

    return [...favFiltered, ...pages, ...players];
  }, [q, favs, search.data]);

  useEffect(() => {
    setActive(0);
  }, [items.length, q]);

  const go = useCallback(
    (item: Item) => {
      navigate(item.to);
      onClose();
    },
    [navigate, onClose]
  );

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(items.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[active];
        if (item) go(item);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, active, go, onClose]);

  // Group items in order, preserving relative position
  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Item[]>();
    for (const it of items) {
      if (!map.has(it.group)) {
        map.set(it.group, []);
        order.push(it.group);
      }
      map.get(it.group)!.push(it);
    }
    return order.map((g) => ({ group: g, items: map.get(g)! }));
  }, [items]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-[10vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-pitch-900/95 shadow-card overflow-hidden text-white"
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <Search size={16} className="text-pitch-300/70" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players, teams, jump to page…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-pitch-300/40 py-2"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-white/10 bg-pitch-950/60 px-1.5 py-0.5 text-[10px] text-pitch-300/70">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-1">
          {items.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-pitch-300/60">
              {search.isFetching ? "Searching…" : "No matches"}
            </div>
          )}
          {grouped.map(({ group, items: gi }) => (
            <div key={group}>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-pitch-300/60">
                {group}
              </div>
              {gi.map((it) => {
                const idx = items.indexOf(it);
                const isActive = idx === active;
                return (
                  <button
                    key={it.id}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(it)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left text-sm",
                      isActive && "bg-white/10"
                    )}
                  >
                    {it.iconUrl ? (
                      <img
                        src={it.iconUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover bg-pitch-800"
                      />
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-pitch-800/60 text-pitch-300">
                        {it.icon}
                      </span>
                    )}
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.hint && (
                      <span className="text-xs text-pitch-300/60 truncate max-w-[180px]">
                        {it.hint}
                      </span>
                    )}
                    {isActive && (
                      <kbd className="ml-2 rounded border border-white/10 bg-pitch-950/60 px-1.5 py-0.5 text-[10px] text-pitch-300/70">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-3 py-2 text-[11px] text-pitch-300/60">
          <div className="flex items-center gap-3">
            <Hint label="Navigate" k="↑↓" />
            <Hint label="Select" k="↵" />
            <Hint label="Close" k="Esc" />
          </div>
          <span>{items.length} results</span>
        </div>
      </div>
    </div>
  );
}

function Hint({ label, k }: { label: string; k: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border border-white/10 bg-pitch-950/60 px-1.5 py-0.5 text-[10px] text-pitch-300/80">
        {k}
      </kbd>
      <span>{label}</span>
    </span>
  );
}
