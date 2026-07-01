import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, X } from "lucide-react";
import { api, playerHeadshotUrl } from "../api/mlb";
import {
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { useSport } from "../contexts/SportContext";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const { sportId } = useSport();

  // Local input state so typing feels instant; the URL (?q=) is the source of
  // truth for the query, updated on a short debounce.
  const [input, setInput] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local input in sync when the URL changes externally (e.g. Command
  // Palette navigation or back/forward).
  useEffect(() => {
    setInput(q);
  }, [q]);

  // Debounce writing the input back to the URL search param.
  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed === q) return;
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) next.set("q", trimmed);
          else next.delete("q");
          return next;
        },
        { replace: true }
      );
    }, 250);
    return () => clearTimeout(t);
  }, [input, q, setParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["search", sportId, q],
    queryFn: () => api.search(q, { sportId }),
    enabled: q.length > 1,
  });

  const people = (data?.people ?? []) as any[];

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Search"
        subtitle={q ? `Results for “${q}”` : "Find players by name"}
      />

      <div className="relative">
        <SearchIcon
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pitch-300/60"
        />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          type="search"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Search players…"
          className="card w-full bg-pitch-900/60 py-3 pl-10 pr-10 text-sm text-white outline-none placeholder:text-pitch-300/40 focus:border-volt-500/40"
        />
        {input && (
          <button
            type="button"
            onClick={() => {
              setInput("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-lg text-pitch-300/60 hover:bg-white/[0.06] hover:text-white"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {!q && <Empty message="Enter a player name to search." />}
      {q && isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {error && <ErrorBox error={error} />}
      {q && !isLoading && people.length === 0 && (
        <Empty message="No players found." />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {people.map((p) => (
          <Link key={p.id} to={`/players/${p.id}`} className="card card-pad flex items-center gap-3 hover:bg-pitch-900/80">
            <img
              src={playerHeadshotUrl(p.id, 60)}
              alt=""
              className="h-14 w-14 rounded-xl object-cover object-top shrink-0 bg-pitch-800"
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
            />
            <div className="min-w-0">
              <div className="font-display font-bold text-sm uppercase tracking-wide text-white truncate">{p.fullName}</div>
              <div className="text-xs text-pitch-300/70 truncate">
                {p.primaryPosition?.name ?? ""}
                {p.currentTeam?.name ? ` · ${p.currentTeam.name}` : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
