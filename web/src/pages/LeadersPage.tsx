import { useQueries, useQuery } from "@tanstack/react-query";
import { api, playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import {
  Card,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { Link, useSearchParams } from "react-router-dom";
import { useSport } from "../contexts/SportContext";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import ExportMenu from "../components/ui/ExportMenu";
import { usePins } from "../contexts/PinsContext";
import { useChartPalette } from "../contexts/ThemeContext";
import { Pin as PinIcon, PinOff } from "lucide-react";
import StatHeader from "../components/ui/StatHeader";

const HITTING_LEADERS = [
  { id: "homeRuns", label: "HR" },
  { id: "battingAverage", label: "AVG" },
  { id: "onBasePlusSlugging", label: "OPS" },
  { id: "runsBattedIn", label: "RBI" },
  { id: "hits", label: "H" },
  { id: "stolenBases", label: "SB" },
  { id: "runs", label: "R" },
];
const PITCHING_LEADERS = [
  { id: "earnedRunAverage", label: "ERA" },
  { id: "strikeouts", label: "K" },
  { id: "wins", label: "W" },
  { id: "saves", label: "SV" },
  { id: "walksAndHitsPerInningPitched", label: "WHIP" },
];

export default function LeadersPage() {
  const [params, setParams] = useSearchParams();
  const season = params.get("season") ?? String(new Date().getFullYear());
  const group: "hitting" | "pitching" =
    params.get("group") === "pitching" ? "pitching" : "hitting";
  const { sportId, sport } = useSport();
  const cats = group === "hitting" ? HITTING_LEADERS : PITCHING_LEADERS;
  const cat =
    cats.find((c) => c.id === params.get("cat"))?.id ?? cats[0].id;

  function patch(updates: Record<string, string | undefined>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  }
  const setSeason = (v: string) => patch({ season: v });
  const setGroup = (g: "hitting" | "pitching") =>
    patch({ group: g, cat: undefined });
  const setCat = (c: string) => patch({ cat: c });

  const { data, isLoading, error } = useQuery({
    queryKey: ["leaders", sportId, season, group, cat],
    queryFn: () =>
      api.statsLeaders({
        leaderCategories: cat,
        statGroup: group,
        season,
        sportId,
        limit: 25,
      }),
  });

  const leaders = data?.leagueLeaders?.[0]?.leaders ?? [];
  const label = cats.find((c) => c.id === cat)?.label ?? cat;

  const pins = usePins();
  const pinId = `leaders|${group}|${cat}|${season}`;
  const pinned = pins.isPinned(pinId);

  const exportRows = (leaders as any[]).map((l) => ({
    rank: l.rank,
    player: l.person?.fullName,
    playerId: l.person?.id,
    team: l.team?.name,
    teamId: l.team?.id,
    value: l.value,
  }));

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`${sport.abbreviation} Stat Leaders`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                pins.toggle({
                  id: pinId,
                  type: "leaders",
                  title: `${label} · ${group} · ${season}`,
                  params: `?group=${group}&cat=${cat}&season=${season}`,
                })
              }
              className={`btn inline-flex items-center gap-1 ${
                pinned ? "btn-accent" : ""
              }`}
              title={pinned ? "Unpin from Today" : "Pin to Today"}
            >
              {pinned ? <PinOff size={14} /> : <PinIcon size={14} />}
              {pinned ? "Pinned" : "Pin"}
            </button>
            <ExportMenu
              filename={`leaders-${group}-${cat}-${season}`}
              rows={exportRows}
              cols={[
                { key: "rank" },
                { key: "player" },
                { key: "team" },
                { key: "value", label },
              ]}
            />
            <input
              type="number"
              value={season}
              min={1901}
              max={new Date().getFullYear()}
              onChange={(e) => setSeason(e.target.value)}
              className="input w-28"
            />
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(["hitting", "pitching"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`px-3 py-1.5 text-sm capitalize ${
                  group === g
                    ? "bg-volt-500 text-black"
                    : "bg-pitch-900/40 hover:bg-pitch-800"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`btn ${cat === c.id ? "btn-accent" : ""}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {error && <ErrorBox error={error} />}

      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Player</th>
                <th>Team</th>
                <th className="text-right">
                  <StatHeader name={label}>{label}</StatHeader>
                </th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((l: any) => (
                <tr key={`${l.person?.id}-${l.rank}`}>
                  <td className="tabular-nums">{l.rank}</td>
                  <td>
                    <Link
                      to={`/players/${l.person?.id}`}
                      className="flex items-center gap-2 hover:text-white"
                    >
                      <img
                        src={playerHeadshotUrl(l.person?.id, 60)}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover bg-pitch-800"
                      />
                      {l.person?.fullName}
                    </Link>
                  </td>
                  <td>
                    {l.team && (
                      <Link
                        to={`/teams/${l.team.id}`}
                        className="flex items-center gap-2 hover:text-white"
                      >
                        <img
                          src={teamLogoUrl(l.team.id)}
                          alt=""
                          className="h-5 w-5 object-contain"
                        />
                        <span className="truncate">{l.team.name}</span>
                      </Link>
                    )}
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {l.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {group === "pitching" && (
        <KvsBBScatter season={season} sportId={sportId} />
      )}
    </div>
  );
}

function KvsBBScatter({
  season,
  sportId,
}: {
  season: string;
  sportId: number;
}) {
  const queries = useQueries({
    queries: [
      {
        queryKey: ["leaders-scatter", "k9", sportId, season],
        queryFn: () =>
          api.statsLeaders({
            leaderCategories: "strikeoutsPer9Inn",
            statGroup: "pitching",
            season,
            sportId,
            limit: 50,
          }),
      },
      {
        queryKey: ["leaders-scatter", "bb9", sportId, season],
        queryFn: () =>
          api.statsLeaders({
            leaderCategories: "baseOnBallsPer9Inn",
            statGroup: "pitching",
            season,
            sportId,
            limit: 50,
          }),
      },
    ],
  });
  const [kq, bbq] = queries;
  const isLoading = queries.some((q) => q.isLoading);
  const palette = useChartPalette();

  const k9 = (kq.data?.leagueLeaders?.[0]?.leaders ?? []) as any[];
  const bb9 = (bbq.data?.leagueLeaders?.[0]?.leaders ?? []) as any[];
  const bbMap = new Map<number, number>();
  for (const r of bb9) {
    const v = Number(r.value);
    if (Number.isFinite(v) && r.person?.id) bbMap.set(r.person.id, v);
  }
  const points = k9
    .map((r) => ({
      x: bbMap.get(r.person?.id) ?? null,
      y: Number(r.value),
      name: r.person?.fullName,
      team: r.team?.abbreviation,
      id: r.person?.id,
    }))
    .filter((p) => p.x !== null && Number.isFinite(p.y)) as {
    x: number;
    y: number;
    name: string;
    team: string;
    id: number;
  }[];

  return (
    <Card pad={false}>
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-pitch-300/70">
            K/9 vs BB/9
          </div>
          <div className="text-sm text-pitch-300">
            Up-and-to-the-left is dominant control + strikeouts.
          </div>
        </div>
      </div>
      <div className="p-4 h-80">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                dataKey="x"
                name="BB/9"
                tick={{ fontSize: 11, fill: "#9494b0" }}
                label={{
                  value: "BB/9",
                  position: "insideBottom",
                  offset: -8,
                  fill: "#9494b0",
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="K/9"
                tick={{ fontSize: 11, fill: "#9494b0" }}
                label={{
                  value: "K/9",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#9494b0",
                  fontSize: 11,
                }}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "#080810",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: any, n: any) => [v, n]}
                labelFormatter={() => ""}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as any;
                  return (
                    <div className="rounded-md border border-white/10 bg-pitch-900/95 px-2 py-1.5 text-xs">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-pitch-300/70">
                        {p.team} · BB/9 {p.x.toFixed(2)} · K/9 {p.y.toFixed(2)}
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={points} fill={palette.b} />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
