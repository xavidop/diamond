import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, playerHeadshotUrl } from "../../api/mlb";
import { Card, Empty, Spinner } from "./Primitives";
import { X, Search } from "lucide-react";
import { useSport } from "../../contexts/SportContext";

type Picked = { id: number; name: string; position?: string };

const HITTING_KEYS = [
  ["plateAppearances", "PA"],
  ["atBats", "AB"],
  ["hits", "H"],
  ["doubles", "2B"],
  ["triples", "3B"],
  ["homeRuns", "HR"],
  ["rbi", "RBI"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "K"],
  ["avg", "AVG"],
  ["obp", "OBP"],
  ["slg", "SLG"],
  ["ops", "OPS"],
];

const PITCHING_KEYS = [
  ["battersFaced", "BF"],
  ["inningsPitched", "IP"],
  ["hits", "H"],
  ["homeRuns", "HR"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "K"],
  ["earnedRuns", "ER"],
  ["era", "ERA"],
];

export default function VsPlayer({
  personId,
  isPitcher,
}: {
  personId: string | number;
  isPitcher: boolean;
}) {
  const [picked, setPicked] = useState<Picked | null>(null);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-pitch-300/70">
            {isPitcher ? "Versus batter" : "Versus pitcher"}
          </div>
          <div className="text-sm text-pitch-300">
            Career matchup history
          </div>
        </div>
        {picked && (
          <button
            className="btn"
            onClick={() => setPicked(null)}
            title="Clear"
          >
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      {!picked ? (
        <OpponentPicker onPick={setPicked} forPitcher={isPitcher} />
      ) : (
        <Matchup
          personId={personId}
          opponent={picked}
          isPitcher={isPitcher}
        />
      )}
    </Card>
  );
}

function OpponentPicker({
  onPick,
  forPitcher,
}: {
  onPick: (p: Picked) => void;
  forPitcher: boolean;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const { sportId } = useSport();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const search = useQuery({
    queryKey: ["vsplayer-search", sportId, debounced],
    queryFn: () => api.search(debounced, { sportId }),
    enabled: debounced.length > 1,
  });

  const results = ((search.data?.people ?? []) as any[]).filter((p) => {
    const isP = p.primaryPosition?.code === "1";
    return forPitcher ? !isP : isP;
  });

  return (
    <div>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-pitch-300/60"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            forPitcher ? "Search a batter…" : "Search an opposing pitcher…"
          }
          className="input pl-8"
        />
      </div>
      {search.isFetching && (
        <div className="mt-2 text-xs text-pitch-300/60 flex items-center gap-2">
          <Spinner /> Searching…
        </div>
      )}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-white/5 max-h-64 overflow-y-auto rounded-lg border border-white/10">
          {results.slice(0, 10).map((p) => (
            <li key={p.id}>
              <button
                onClick={() =>
                  onPick({
                    id: p.id,
                    name: p.fullName,
                    position: p.primaryPosition?.abbreviation,
                  })
                }
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
              >
                <img
                  src={playerHeadshotUrl(p.id, 60)}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover bg-pitch-800"
                />
                <div className="min-w-0">
                  <div className="text-sm truncate">{p.fullName}</div>
                  <div className="text-[11px] text-pitch-300/70 truncate">
                    {[p.primaryPosition?.abbreviation, p.currentTeam?.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Matchup({
  personId,
  opponent,
  isPitcher,
}: {
  personId: string | number;
  opponent: Picked;
  isPitcher: boolean;
}) {
  const group = isPitcher ? "pitching" : "hitting";
  const { data, isLoading, error } = useQuery({
    queryKey: ["vsplayer", personId, opponent.id, group],
    queryFn: () =>
      api.personSplits(personId, "vsPlayer", {
        opposingPlayerId: opponent.id,
        group,
        season: undefined,
        sportId: 1,
      }),
  });

  const keys = useMemo(
    () => (isPitcher ? PITCHING_KEYS : HITTING_KEYS),
    [isPitcher]
  );
  // The endpoint returns total + per-year splits; show the career row.
  const splits = (data?.stats?.[0]?.splits ?? []) as any[];
  const career = splits.find((s) => !s.season) ?? splits[0];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <img
          src={playerHeadshotUrl(opponent.id, 90)}
          alt=""
          className="h-10 w-10 rounded-full object-cover bg-pitch-800"
        />
        <div>
          <div className="text-sm font-semibold text-white">
            {opponent.name}
          </div>
          <div className="text-[11px] text-pitch-300/70">
            {opponent.position ?? "—"}
          </div>
        </div>
      </div>

      {isLoading && <Spinner />}
      {error && (
        <div className="text-sm text-pitch-300/70">Failed to load matchup.</div>
      )}
      {!isLoading && !career && (
        <Empty message="No career meetings on record." />
      )}
      {career && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {keys.map(([k, lbl]) => (
            <div
              key={k}
              className="rounded-xl bg-pitch-950/50 border border-white/5 p-2"
            >
              <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
                {lbl}
              </div>
              <div className="font-mono text-white">
                {String(career.stat?.[k] ?? "—")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
