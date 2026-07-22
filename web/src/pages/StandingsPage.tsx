import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, teamLogoUrl } from "../api/mlb";
import {
  Card,
  ErrorBox,
  SectionTitle,
  Spinner,
  Empty,
} from "../components/ui/Primitives";
import { useMemo, useState } from "react";
import { useSport } from "../contexts/SportContext";

type View = "division" | "wildcard" | "diff";

export default function StandingsPage() {
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [view, setView] = useState<View>("division");
  const { sportId, sport } = useSport();

  const leagues = useQuery({
    queryKey: ["leagues", sportId],
    queryFn: () => api.leagues({ sportId }),
  });
  const divisions = useQuery({
    queryKey: ["divisions", sportId],
    queryFn: () => api.divisions(),
  });

  const allLeagues = (leagues.data?.leagues ?? []) as any[];
  const realLeagues = allLeagues.filter((l) => l.hasWildCard);
  const leagueId = (realLeagues.length ? realLeagues : allLeagues)
    .map((l) => l.id)
    .join(",");

  const leagueMap = useMemo(() => {
    const m = new Map<number, any>();
    for (const l of allLeagues) m.set(l.id, l);
    return m;
  }, [allLeagues]);
  const divisionMap = useMemo(() => {
    const m = new Map<number, any>();
    for (const d of (divisions.data?.divisions ?? []) as any[]) m.set(d.id, d);
    return m;
  }, [divisions.data]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["standings", sportId, leagueId, season],
    queryFn: () => api.standings({ leagueId, season }),
    enabled: !!leagueId,
  });
  const wildcard = useQuery({
    queryKey: ["wildcard", sportId, leagueId, season],
    queryFn: () =>
      api.standings({
        leagueId,
        season,
        standingsTypes: "wildCard",
      }),
    enabled: !!leagueId && view === "wildcard",
  });

  const records = (data?.records ?? []) as any[];
  const wcRecords = (wildcard.data?.records ?? []) as any[];

  // Group division records by league (first-seen order → AL then NL) so each
  // league renders as its own vertical column instead of interleaving across
  // the 2-col grid.
  const leagueGroups = useMemo(() => {
    const groups: { leagueId: number; league: any; records: any[] }[] = [];
    const byId = new Map<number, (typeof groups)[number]>();
    for (const rec of records) {
      const lid = rec.league?.id;
      let g = byId.get(lid);
      if (!g) {
        g = { leagueId: lid, league: leagueMap.get(lid), records: [] };
        byId.set(lid, g);
        groups.push(g);
      }
      g.records.push(rec);
    }
    return groups;
  }, [records, leagueMap]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`${sport.abbreviation} Standings`}
        subtitle="Division, wild card, and run differential views."
        right={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              {(["division", "wildcard", "diff"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs capitalize ${
                    view === v
                      ? "bg-volt-500 text-black"
                      : "bg-pitch-900/40 hover:bg-pitch-800"
                  }`}
                >
                  {v === "diff" ? "Run Diff" : v}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1901}
              max={new Date().getFullYear()}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="input w-24"
            />
          </div>
        }
      />

      {(isLoading || leagues.isLoading) && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {(error || leagues.error) && (
        <ErrorBox error={error ?? leagues.error} />
      )}
      {!isLoading && !error && records.length === 0 && (
        <Empty message="No standings available for this league/season." />
      )}

      {view === "division" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-8 items-start">
          {leagueGroups.map((group) => (
            <div key={group.leagueId} className="space-y-4">
              <LeagueBanner league={group.league} rec={group.records[0]} />
              {group.records.map((rec) => (
                <DivisionTable
                  key={`${rec.league?.id}-${rec.division?.id}`}
                  rec={rec}
                  league={leagueMap.get(rec.league?.id)}
                  division={divisionMap.get(rec.division?.id)}
                  showLeague={false}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {view === "wildcard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {wildcard.isLoading && <Spinner />}
          {wcRecords.map((rec) => (
            <WildCardTable
              key={`wc-${rec.league?.id}`}
              rec={rec}
              league={leagueMap.get(rec.league?.id)}
            />
          ))}
        </div>
      )}

      {view === "diff" && (
        <div className="space-y-4">
          {records.map((rec) => (
            <RunDiffSection
              key={`rd-${rec.league?.id}-${rec.division?.id}`}
              rec={rec}
              league={leagueMap.get(rec.league?.id)}
              division={divisionMap.get(rec.division?.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function pythag(rs: number, ra: number) {
  if (!rs && !ra) return null;
  const e = 1.83;
  return Math.pow(rs, e) / (Math.pow(rs, e) + Math.pow(ra, e));
}

function streakColor(code?: string) {
  if (!code) return "";
  if (code.startsWith("W")) return "text-emerald-400";
  if (code.startsWith("L")) return "text-red-400";
  return "";
}

function LeagueBanner({ league, rec }: { league?: any; rec?: any }) {
  const name = league?.name ?? rec?.league?.name ?? "League";
  const abbr = league?.abbreviation ?? rec?.league?.abbreviation;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-volt-500/60 pb-2">
      <h3 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight text-white">
        {name}
      </h3>
      {abbr && (
        <span className="pill bg-volt-500/[0.12] text-volt-500 border-volt-500/30">
          {abbr}
        </span>
      )}
    </div>
  );
}

function DivisionTable({
  rec,
  league,
  division,
  showLeague = true,
}: {
  rec: any;
  league?: any;
  division?: any;
  showLeague?: boolean;
}) {
  const rows = (rec.teamRecords ?? []) as any[];
  const leagueName = league?.name ?? rec.league?.name;
  const leagueAbbr = league?.abbreviation;
  const divisionName =
    division?.nameShort ?? division?.name ?? rec.division?.name ?? "Division";

  return (
    <Card pad={false}>
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          {showLeague && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-pitch-300/70">
              {leagueName ?? "League"}
            </div>
          )}
          <div className="font-semibold text-white">{divisionName}</div>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {showLeague && leagueAbbr && <span className="pill">{leagueAbbr}</span>}
          {division?.abbreviation && (
            <span className="pill bg-pitch-800/40">
              {division.abbreviation}
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base font-medium">
          <thead>
            <tr>
              <th>Team</th>
              <th className="text-right">W</th>
              <th className="text-right">L</th>
              <th className="text-right">PCT</th>
              <th className="text-right">GB</th>
              <th className="text-right" title="Magic number to clinch">
                M#
              </th>
              <th className="text-right">RS</th>
              <th className="text-right">RA</th>
              <th className="text-right" title="Run differential">
                DIFF
              </th>
              <th className="text-right" title="Pythagorean expected W%">
                pythW
              </th>
              <th className="text-right">L10</th>
              <th className="text-right">STRK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const last10 = r.records?.splitRecords?.find(
                (s: any) => s.type === "lastTen"
              );
              const diff = (r.runsScored ?? 0) - (r.runsAllowed ?? 0);
              const py = pythag(r.runsScored ?? 0, r.runsAllowed ?? 0);
              const magic = idx === 0 ? r.magicNumber ?? "—" : "—";
              return (
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
                      <span className="truncate">
                        {r.team?.abbreviation ?? r.team?.name}
                      </span>
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{r.wins}</td>
                  <td className="text-right tabular-nums">{r.losses}</td>
                  <td className="text-right tabular-nums">
                    {r.winningPercentage}
                  </td>
                  <td className="text-right tabular-nums">{r.gamesBack}</td>
                  <td className="text-right tabular-nums text-pitch-300">
                    {magic}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.runsScored ?? "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.runsAllowed ?? "—"}
                  </td>
                  <td
                    className={`text-right tabular-nums font-mono ${
                      diff > 0
                        ? "text-emerald-400"
                        : diff < 0
                        ? "text-red-400"
                        : ""
                    }`}
                  >
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="text-right tabular-nums font-mono text-pitch-300">
                    {py ? py.toFixed(3) : "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {last10 ? `${last10.wins}-${last10.losses}` : "—"}
                  </td>
                  <td
                    className={`text-right tabular-nums font-mono ${streakColor(
                      r.streak?.streakCode
                    )}`}
                  >
                    {r.streak?.streakCode ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[10px] text-pitch-300/60 border-t border-white/5">
        pythW = expected win % from runs. Magic # shown for current leader.
      </div>
    </Card>
  );
}

function WildCardTable({ rec, league }: { rec: any; league?: any }) {
  const rows = (rec.teamRecords ?? []) as any[];
  return (
    <Card pad={false}>
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-pitch-300/70">
            Wild Card
          </div>
          <div className="font-semibold text-white">
            {league?.name ?? rec.league?.name}
          </div>
        </div>
        {league?.abbreviation && (
          <span className="pill">{league.abbreviation}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="table-base font-medium">
          <thead>
            <tr>
              <th></th>
              <th>Team</th>
              <th className="text-right">W</th>
              <th className="text-right">L</th>
              <th className="text-right" title="Games back from wild-card spot">
                WCGB
              </th>
              <th className="text-right">STRK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const inWC = idx < 3;
              return (
                <tr
                  key={r.team?.id}
                  className={idx === 2 ? "border-b-2 border-amber-500/60" : ""}
                >
                  <td className="text-center w-10">
                    {inWC ? (
                      <span className="pill bg-amber-500/20 text-amber-300 text-[10px]">
                        WC{idx + 1}
                      </span>
                    ) : (
                      <span className="text-[10px] text-pitch-300/60">
                        {idx + 1}
                      </span>
                    )}
                  </td>
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
                      <span className="truncate">{r.team?.name}</span>
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{r.wins}</td>
                  <td className="text-right tabular-nums">{r.losses}</td>
                  <td className="text-right tabular-nums">
                    {r.wildCardGamesBack ?? r.gamesBack ?? "—"}
                  </td>
                  <td
                    className={`text-right tabular-nums font-mono ${streakColor(
                      r.streak?.streakCode
                    )}`}
                  >
                    {r.streak?.streakCode ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[10px] text-pitch-300/60 border-t border-white/5">
        Line marks the wild-card cutoff (top 3 clinch).
      </div>
    </Card>
  );
}

function RunDiffSection({
  rec,
  league,
  division,
}: {
  rec: any;
  league?: any;
  division?: any;
}) {
  const rows = (rec.teamRecords ?? []) as any[];
  const max =
    Math.max(
      ...rows.map((r) =>
        Math.abs((r.runsScored ?? 0) - (r.runsAllowed ?? 0))
      ),
      1
    );
  const divisionName =
    division?.nameShort ?? division?.name ?? rec.division?.name ?? "Division";
  return (
    <Card pad={false}>
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-pitch-300/70">
            {league?.name ?? rec.league?.name}
          </div>
          <div className="font-semibold text-white">{divisionName}</div>
        </div>
      </div>
      <ul className="divide-y divide-white/5">
        {rows.map((r) => {
          const diff = (r.runsScored ?? 0) - (r.runsAllowed ?? 0);
          const pct = (Math.abs(diff) / max) * 50;
          return (
            <li
              key={r.team?.id}
              className="px-4 py-2 grid grid-cols-[160px_1fr_60px] items-center gap-3"
            >
              <Link
                to={`/teams/${r.team?.id}`}
                className="flex items-center gap-2 hover:text-white min-w-0"
              >
                <img
                  src={teamLogoUrl(r.team?.id)}
                  alt=""
                  className="h-5 w-5 object-contain"
                />
                <span className="truncate text-sm">
                  {r.team?.abbreviation ?? r.team?.name}
                </span>
              </Link>
              <div className="relative h-3 rounded bg-pitch-950/50 overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                {diff >= 0 ? (
                  <div
                    className="absolute inset-y-0 left-1/2 bg-emerald-500/70"
                    style={{ width: `${pct}%` }}
                  />
                ) : (
                  <div
                    className="absolute inset-y-0 right-1/2 bg-red-500/70"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <div
                className={`text-right font-mono text-sm tabular-nums ${
                  diff > 0
                    ? "text-emerald-400"
                    : diff < 0
                    ? "text-red-400"
                    : ""
                }`}
              >
                {diff > 0 ? `+${diff}` : diff}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
