import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api, playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import {
  Card,
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { Link, useSearchParams } from "react-router-dom";
import { Trophy, GitCompare } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();

export default function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const season = Number(params.get("season") ?? CURRENT_YEAR - 1);
  const compareRaw = params.get("compare");
  const compare = compareRaw ? Number(compareRaw) : null;
  function setSeason(v: number | ((s: number) => number)) {
    const next = typeof v === "function" ? v(season) : v;
    const p = new URLSearchParams(params);
    p.set("season", String(next));
    setParams(p, { replace: true });
  }
  function setCompare(v: number | null) {
    const p = new URLSearchParams(params);
    if (v === null) p.delete("compare");
    else p.set("compare", String(v));
    setParams(p, { replace: true });
  }

  const standings = useQuery({
    queryKey: ["history-standings", season],
    queryFn: () =>
      api.standings({ season: String(season), leagueId: "103,104" }),
  });
  const divisions = useQuery({
    queryKey: ["divisions"],
    queryFn: () => api.divisions(),
    staleTime: 60 * 60_000,
  });
  const leagues = useQuery({
    queryKey: ["leagues-mlb"],
    queryFn: () => api.leagues({ sportId: 1 }),
    staleTime: 60 * 60_000,
  });
  const ws = useQuery({
    queryKey: ["history-ws", season],
    queryFn: () => api.postseason(season, 1),
  });
  const hr = useQuery({
    queryKey: ["history-hr", season],
    queryFn: () =>
      api.statsLeaders({
        leaderCategories: "homeRuns",
        statGroup: "hitting",
        season: String(season),
        sportId: 1,
        limit: 10,
      }),
  });
  const era = useQuery({
    queryKey: ["history-era", season],
    queryFn: () =>
      api.statsLeaders({
        leaderCategories: "earnedRunAverage",
        statGroup: "pitching",
        season: String(season),
        sportId: 1,
        limit: 10,
      }),
  });

  const wsSeries =
    (ws.data?.series?.[0]?.games?.[0] as any) ?? null;
  // World Series champion: among ALL postseason games, filter to the WS
  // series and pick the team with the most wins in that series.
  const champion: any = (() => {
    const dates = (ws.data?.dates ?? []) as any[];
    const wsGames = dates
      .flatMap((d) => d.games ?? [])
      .filter(
        (g: any) =>
          typeof g.seriesDescription === "string" &&
          /world series/i.test(g.seriesDescription)
      );
    if (!wsGames.length) return null;
    const wins = new Map<number, { team: any; n: number }>();
    for (const g of wsGames) {
      for (const side of ["home", "away"] as const) {
        const t = g.teams?.[side];
        if (t?.isWinner && t.team?.id) {
          const cur = wins.get(t.team.id) ?? { team: t.team, n: 0 };
          cur.n++;
          wins.set(t.team.id, cur);
        }
      }
    }
    let best: { team: any; n: number } | null = null;
    for (const v of wins.values()) {
      if (!best || v.n > best.n) best = v;
    }
    return best && best.n >= 4 ? best.team : null;
  })();

  const divisionMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of (divisions.data?.divisions ?? []) as any[]) {
      m.set(d.id, d.name);
    }
    return m;
  }, [divisions.data]);
  const leagueMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of (leagues.data?.leagues ?? []) as any[]) {
      m.set(l.id, l.name);
    }
    return m;
  }, [leagues.data]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Historical Seasons"
        subtitle="Look up any past season — standings, leaders, World Series champ."
        right={
          <div className="flex items-center gap-2">
            <button
              className="btn"
              onClick={() => setSeason((s) => Math.max(1901, s - 1))}
            >
              −
            </button>
            <input
              type="number"
              min={1876}
              max={CURRENT_YEAR}
              value={season}
              onChange={(e) => setSeason(Number(e.target.value || CURRENT_YEAR))}
              className="input w-28 text-center font-mono text-lg"
            />
            <button
              className="btn"
              onClick={() => setSeason((s) => Math.min(CURRENT_YEAR, s + 1))}
            >
              +
            </button>
            <div className="ml-2 flex items-center gap-1 pl-2 border-l border-white/10">
              <GitCompare size={14} className="text-pitch-300/70" />
              <input
                type="number"
                min={1876}
                max={CURRENT_YEAR}
                placeholder="vs"
                value={compare ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setCompare(v ? Number(v) : null);
                }}
                className="input w-24 text-center font-mono"
              />
              {compare !== null && (
                <button
                  className="btn"
                  onClick={() => setCompare(null)}
                  title="Clear compare"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        }
      />

      <Card>
        <div className="flex items-center gap-4">
          <Trophy className="text-amber-400" size={32} />
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-pitch-300/70">
              {season} World Series Champion
            </div>
            {ws.isLoading ? (
              <Spinner />
            ) : champion ? (
              <Link
                to={`/teams/${champion.id}`}
                className="flex items-center gap-3 mt-1 hover:underline"
              >
                <img
                  src={teamLogoUrl(champion.id)}
                  alt=""
                  className="h-8 w-8 object-contain"
                />
                <span className="text-2xl font-bold">{champion.name}</span>
              </Link>
            ) : (
              <div className="text-pitch-300/70 mt-1">
                {wsSeries
                  ? "Series in progress / no winner data"
                  : "Not available"}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MiniLeaderboard title="HR Leaders" q={hr} suffix="HR" />
        <MiniLeaderboard title="ERA Leaders" q={era} suffix="ERA" />
      </div>

      <SectionTitle title={`${season} Standings`} />
      {standings.isLoading && <Spinner />}
      {standings.error && <ErrorBox error={standings.error} />}
      {!standings.isLoading && (standings.data?.records ?? []).length === 0 && (
        <Empty message="No standings for this season." />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(standings.data?.records ?? []).map((rec: any) => (
          <Card key={`${rec.league?.id}-${rec.division?.id}`} pad={false}>
            <div className="px-4 py-2 border-b border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
                {rec.league?.name ??
                  leagueMap.get(rec.league?.id) ??
                  "League"}
              </div>
              <div className="font-semibold">
                {rec.division?.name ??
                  divisionMap.get(rec.division?.id) ??
                  "Division"}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th className="text-right">W</th>
                    <th className="text-right">L</th>
                    <th className="text-right">PCT</th>
                  </tr>
                </thead>
                <tbody>
                  {(rec.teamRecords ?? []).map((r: any) => (
                    <tr key={r.team?.id}>
                      <td>
                        <Link
                          to={`/teams/${r.team?.id}`}
                          className="flex items-center gap-2 hover:text-white"
                        >
                          <img
                            src={teamLogoUrl(r.team?.id)}
                            alt=""
                            className="h-5 w-5 object-contain"
                          />
                          {r.team?.name}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{r.wins}</td>
                      <td className="text-right tabular-nums">{r.losses}</td>
                      <td className="text-right tabular-nums">
                        {r.winningPercentage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      {compare !== null && (
        <CompareSeason season={compare} primary={season} />
      )}
    </div>
  );
}

function CompareSeason({ season, primary }: { season: number; primary: number }) {
  const standings = useQuery({
    queryKey: ["history-standings", season],
    queryFn: () =>
      api.standings({ season: String(season), leagueId: "103,104" }),
  });
  const divisions = useQuery({
    queryKey: ["divisions"],
    queryFn: () => api.divisions(),
    staleTime: 60 * 60_000,
  });
  const leagues = useQuery({
    queryKey: ["leagues-mlb"],
    queryFn: () => api.leagues({ sportId: 1 }),
    staleTime: 60 * 60_000,
  });
  const ws = useQuery({
    queryKey: ["history-ws", season],
    queryFn: () => api.postseason(season, 1),
  });
  const hr = useQuery({
    queryKey: ["history-hr", season],
    queryFn: () =>
      api.statsLeaders({
        leaderCategories: "homeRuns",
        statGroup: "hitting",
        season: String(season),
        sportId: 1,
        limit: 5,
      }),
  });
  const era = useQuery({
    queryKey: ["history-era", season],
    queryFn: () =>
      api.statsLeaders({
        leaderCategories: "earnedRunAverage",
        statGroup: "pitching",
        season: String(season),
        sportId: 1,
        limit: 5,
      }),
  });

  const champion: any = (() => {
    const dates = (ws.data?.dates ?? []) as any[];
    const wsGames = dates
      .flatMap((d) => d.games ?? [])
      .filter(
        (g: any) =>
          typeof g.seriesDescription === "string" &&
          /world series/i.test(g.seriesDescription)
      );
    if (!wsGames.length) return null;
    const wins = new Map<number, { team: any; n: number }>();
    for (const g of wsGames) {
      for (const side of ["home", "away"] as const) {
        const t = g.teams?.[side];
        if (t?.isWinner && t.team?.id) {
          const cur = wins.get(t.team.id) ?? { team: t.team, n: 0 };
          cur.n++;
          wins.set(t.team.id, cur);
        }
      }
    }
    let best: { team: any; n: number } | null = null;
    for (const v of wins.values()) {
      if (!best || v.n > best.n) best = v;
    }
    return best && best.n >= 4 ? best.team : null;
  })();

  const divisionMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of (divisions.data?.divisions ?? []) as any[]) {
      m.set(d.id, d.name);
    }
    return m;
  }, [divisions.data]);
  const leagueMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of (leagues.data?.leagues ?? []) as any[]) {
      m.set(l.id, l.name);
    }
    return m;
  }, [leagues.data]);

  return (
    <div className="space-y-4 pt-2 border-t border-white/10">
      <SectionTitle
        title={`Compared: ${season}`}
        subtitle={`Side-by-side with ${primary}.`}
      />
      <Card>
        <div className="flex items-center gap-4">
          <Trophy className="text-amber-400" size={28} />
          <div>
            <div className="text-xs uppercase tracking-wider text-pitch-300/70">
              {season} World Series Champion
            </div>
            {ws.isLoading ? (
              <Spinner />
            ) : champion ? (
              <Link
                to={`/teams/${champion.id}`}
                className="flex items-center gap-2 mt-1 hover:underline"
              >
                <img
                  src={teamLogoUrl(champion.id)}
                  alt=""
                  className="h-7 w-7 object-contain"
                />
                <span className="text-xl font-bold">{champion.name}</span>
              </Link>
            ) : (
              <div className="text-pitch-300/70 mt-1">Not available</div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompareLeaders title={`${season} · HR`} q={hr} />
        <CompareLeaders title={`${season} · ERA`} q={era} />
      </div>

      {standings.isLoading && <Spinner />}
      {standings.error && <ErrorBox error={standings.error} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(standings.data?.records ?? []).map((rec: any) => (
          <Card key={`cmp-${rec.league?.id}-${rec.division?.id}`} pad={false}>
            <div className="px-4 py-2 border-b border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
                {rec.league?.name ??
                  leagueMap.get(rec.league?.id) ??
                  "League"}
              </div>
              <div className="font-semibold">
                {rec.division?.name ??
                  divisionMap.get(rec.division?.id) ??
                  "Division"}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th className="text-right">W</th>
                    <th className="text-right">L</th>
                    <th className="text-right">PCT</th>
                  </tr>
                </thead>
                <tbody>
                  {(rec.teamRecords ?? []).map((r: any) => (
                    <tr key={r.team?.id}>
                      <td>
                        <Link
                          to={`/teams/${r.team?.id}`}
                          className="flex items-center gap-2 hover:text-white"
                        >
                          <img
                            src={teamLogoUrl(r.team?.id)}
                            alt=""
                            className="h-5 w-5 object-contain"
                          />
                          {r.team?.name}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{r.wins}</td>
                      <td className="text-right tabular-nums">{r.losses}</td>
                      <td className="text-right tabular-nums">
                        {r.winningPercentage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CompareLeaders({
  title,
  q,
}: {
  title: string;
  q: ReturnType<typeof useQuery<any>>;
}) {
  const leaders = (q.data?.leagueLeaders?.[0]?.leaders ?? []) as any[];
  return (
    <Card pad={false}>
      <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
        {title}
      </div>
      {q.isLoading ? (
        <div className="p-4"><Spinner /></div>
      ) : (
        <ul className="divide-y divide-white/5">
          {leaders.map((l) => (
            <li key={l.person?.id} className="px-4 py-2 flex items-center gap-3">
              <span className="w-5 text-center tabular-nums text-xs text-pitch-300/70">
                {l.rank}
              </span>
              <img
                src={playerHeadshotUrl(l.person?.id, 60)}
                alt=""
                className="h-7 w-7 rounded-full object-cover bg-pitch-800"
              />
              <Link
                to={`/players/${l.person?.id}`}
                className="flex-1 truncate text-sm hover:underline"
              >
                {l.person?.fullName}
              </Link>
              <span className="font-mono tabular-nums">{l.value}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MiniLeaderboard({
  title,
  q,
  suffix,
}: {
  title: string;
  q: ReturnType<typeof useQuery<any>>;
  suffix: string;
}) {
  const leaders = (q.data?.leagueLeaders?.[0]?.leaders ?? []) as any[];
  return (
    <Card pad={false}>
      <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
        {title}
      </div>
      {q.isLoading ? (
        <div className="p-4">
          <Spinner />
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {leaders.map((l) => (
            <li key={l.person?.id} className="px-4 py-2 flex items-center gap-3">
              <span className="w-5 text-center tabular-nums text-xs text-pitch-300/70">
                {l.rank}
              </span>
              <img
                src={playerHeadshotUrl(l.person?.id, 60)}
                alt=""
                className="h-7 w-7 rounded-full object-cover bg-pitch-800"
              />
              <Link
                to={`/players/${l.person?.id}`}
                className="flex-1 truncate hover:text-white text-sm"
              >
                {l.person?.fullName}
              </Link>
              <span className="font-mono tabular-nums text-sm">
                {l.value}
                <span className="ml-1 text-[10px] uppercase text-pitch-300/60">
                  {suffix}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
