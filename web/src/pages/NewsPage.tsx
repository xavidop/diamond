import { useMemo, useState } from "react";
import { LayoutGrid, List, Search, X } from "lucide-react";
import type { Article } from "../api/espn";
import { useNews } from "../api/espn";
import { SectionTitle, Empty, Card } from "../components/ui/Primitives";
import NewsList from "../components/ui/NewsList";
import { useSport } from "../contexts/SportContext";

const VIEW_KEY = "news.view";

// Humanize ESPN's raw article types for the filter pills.
const TYPE_LABELS: Record<string, string> = {
  HeadlineNews: "Headlines",
  Preview: "Preview",
  Recap: "Recap",
  Story: "Story",
  Media: "Media",
  News: "News",
};
// Preferred display order; anything else falls in after these.
const TYPE_ORDER = ["Preview", "Recap", "HeadlineNews", "Story", "Media", "News"];

function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const ymd = (x: Date) => x.toISOString().slice(0, 10);
  if (ymd(d) === ymd(today)) return "Today";
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (ymd(d) === ymd(yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function NewsPage() {
  const { sportId } = useSport();
  const isMlb = sportId === 1;
  const q = useNews({ limit: 50 });

  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "grid" || v === "list") return v;
    }
    return "grid";
  });
  const chooseView = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const [type, setType] = useState("All");
  const [day, setDay] = useState("all");
  const [query, setQuery] = useState("");

  const articles = useMemo<Article[]>(() => q.data ?? [], [q.data]);

  const types = useMemo(() => {
    const present = new Set(articles.map((a) => a.type));
    const ordered = TYPE_ORDER.filter((t) => present.has(t));
    const extras = [...present].filter((t) => !TYPE_ORDER.includes(t));
    return ["All", ...ordered, ...extras];
  }, [articles]);

  const days = useMemo(() => {
    const present = new Set(articles.map((a) => a.published.slice(0, 10)).filter(Boolean));
    return [...present].sort().reverse();
  }, [articles]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (type !== "All" && a.type !== type) return false;
      if (day !== "all" && a.published.slice(0, 10) !== day) return false;
      if (needle && !`${a.headline} ${a.description}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [articles, type, day, query]);

  const viewToggle = (
    <div className="flex rounded-lg border border-white/10 overflow-hidden">
      {([
        ["grid", LayoutGrid, "Grid"],
        ["list", List, "List"],
      ] as const).map(([v, Icon, label]) => (
        <button
          key={v}
          onClick={() => chooseView(v)}
          title={`${label} view`}
          aria-label={`${label} view`}
          className={`px-3 py-1.5 ${
            view === v ? "bg-volt-500 text-black" : "bg-pitch-900/40 hover:bg-pitch-800 text-white/70"
          }`}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title="News"
        subtitle="Latest around the league"
        right={isMlb ? viewToggle : undefined}
      />

      {!isMlb ? (
        <Empty message="News is available for MLB only." />
      ) : (
        <>
          <Card>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search headlines…"
                    className="input w-full pl-9 pr-8"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="input"
                  aria-label="Filter by day"
                >
                  <option value="all">All days</option>
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {dayLabel(d)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-1">
                {types.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`btn ${type === t ? "btn-accent" : ""}`}
                  >
                    {t === "All" ? "All" : TYPE_LABELS[t] ?? t}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {!q.isLoading && !q.error && (
            <div className="text-xs uppercase tracking-wider text-pitch-300/60">
              {filtered.length} {filtered.length === 1 ? "story" : "stories"}
              {(type !== "All" || day !== "all" || query) && articles.length > 0
                ? ` of ${articles.length}`
                : ""}
            </div>
          )}

          <NewsList
            articles={q.isLoading || q.error ? undefined : filtered}
            isLoading={q.isLoading}
            error={q.error}
            layout={view}
          />
        </>
      )}
    </div>
  );
}
