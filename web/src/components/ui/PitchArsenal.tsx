import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { api } from "../../api/mlb";
import { Card, Empty, Spinner } from "./Primitives";

type PitchSummary = {
  type: string;
  code: string;
  count: number;
  velos: number[];
  spins: number[];
  swings: number;
  whiffs: number;
  called: number;
  inPlay: number;
  hits: number;
  hr: number;
};

const TYPE_COLOR: Record<string, string> = {
  FF: "#ef4444",
  FT: "#f97316",
  SI: "#fb923c",
  FC: "#f59e0b",
  SL: "#a855f7",
  CU: "#3b82f6",
  KC: "#0ea5e9",
  CH: "#10b981",
  FS: "#06b6d4",
  KN: "#a3a3a3",
  ST: "#8b5cf6",
  SV: "#6366f1",
  EP: "#a3a3a3",
};

export default function PitchArsenal({
  personId,
  isPitcher,
}: {
  personId: string | number;
  isPitcher: boolean;
}) {
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [numGames, setNumGames] = useState(3);

  const gameLog = useQuery({
    queryKey: ["arsenal-gl", personId, season],
    queryFn: () => api.personGameLog(personId, "pitching", season),
    enabled: isPitcher,
  });

  const gamePks: string[] = useMemo(() => {
    const splits = (gameLog.data?.stats?.[0]?.splits ?? []) as any[];
    const last = splits.slice(-numGames).reverse();
    return last
      .map((s) => s.game?.gamePk)
      .filter(Boolean)
      .map(String);
  }, [gameLog.data, numGames]);

  const pbps = useQueries({
    queries: gamePks.map((pk) => ({
      queryKey: ["pbp", pk],
      queryFn: () => api.gamePlayByPlay(pk),
      staleTime: 5 * 60_000,
    })),
  });

  const summaries = useMemo<PitchSummary[]>(() => {
    const pid = Number(personId);
    const map = new Map<string, PitchSummary>();
    for (const q of pbps) {
      const plays = (q.data?.allPlays ?? []) as any[];
      for (const play of plays) {
        if (play.matchup?.pitcher?.id !== pid) continue;
        for (const ev of (play.playEvents ?? []) as any[]) {
          if (!ev.isPitch) continue;
          const t = ev.details?.type?.description ?? "Unknown";
          const code = ev.details?.type?.code ?? "?";
          const key = `${code}|${t}`;
          let row = map.get(key);
          if (!row) {
            row = {
              type: t,
              code,
              count: 0,
              velos: [],
              spins: [],
              swings: 0,
              whiffs: 0,
              called: 0,
              inPlay: 0,
              hits: 0,
              hr: 0,
            };
            map.set(key, row);
          }
          row.count++;
          const v = ev.pitchData?.startSpeed;
          if (typeof v === "number") row.velos.push(v);
          const sp = ev.pitchData?.breaks?.spinRate;
          if (typeof sp === "number") row.spins.push(sp);
          const c = ev.details?.code;
          if (["S", "W", "T", "L", "F"].includes(c)) row.swings++;
          if (["S", "W"].includes(c)) {
            row.whiffs++;
            row.swings++;
          }
          if (c === "C") row.called++;
          if (c === "X" || c === "D" || c === "E") {
            row.inPlay++;
            row.swings++;
            const eventType = play.result?.eventType ?? "";
            if (
              ["single", "double", "triple", "home_run"].includes(eventType)
            ) {
              row.hits++;
              if (eventType === "home_run") row.hr++;
            }
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [pbps, personId]);

  if (!isPitcher)
    return (
      <Card>
        <Empty message="Pitch arsenal only available for pitchers." />
      </Card>
    );

  const total = summaries.reduce((s, x) => s + x.count, 0);
  const isLoading = gameLog.isLoading || pbps.some((q) => q.isLoading);

  const radarData = summaries.slice(0, 6).map((s) => ({
    type: s.code,
    usage: total ? (s.count / total) * 100 : 0,
  }));

  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/5">
        <div>
          <div className="text-xs uppercase tracking-wider text-pitch-300/70">
            Pitch arsenal
          </div>
          <div className="text-sm text-pitch-300">
            Aggregated from last {numGames} games · {total} pitches
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {[1, 3, 5].map((n) => (
              <button
                key={n}
                onClick={() => setNumGames(n)}
                className={`px-2 py-1 text-xs ${
                  numGames === n
                    ? "bg-volt-500 text-black"
                    : "bg-pitch-900/40 hover:bg-pitch-800"
                }`}
              >
                {n} games
              </button>
            ))}
          </div>
          <input
            type="number"
            value={season}
            onChange={(e) =>
              setSeason(Number(e.target.value || new Date().getFullYear()))
            }
            className="input w-20 text-center"
          />
        </div>
      </div>

      {isLoading && (
        <div className="p-6 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {!isLoading && summaries.length === 0 && (
        <div className="p-4">
          <Empty message="No pitch data for these games." />
        </div>
      )}

      {summaries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,260px] gap-0">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Pitch</th>
                  <th className="text-right">Count</th>
                  <th className="text-right">Usage</th>
                  <th className="text-right">Avg velo</th>
                  <th className="text-right">Avg spin</th>
                  <th className="text-right" title="Swings on this pitch">
                    Sw
                  </th>
                  <th className="text-right" title="Whiff % of swings">
                    Whiff%
                  </th>
                  <th className="text-right" title="In-play results">
                    InPlay
                  </th>
                  <th className="text-right">H</th>
                  <th className="text-right">HR</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => {
                  const usage = total ? (s.count / total) * 100 : 0;
                  const avgVelo = avg(s.velos);
                  const avgSpin = avg(s.spins);
                  const whiffPct = s.swings
                    ? (s.whiffs / s.swings) * 100
                    : 0;
                  return (
                    <tr key={`${s.code}-${s.type}`}>
                      <td>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{
                              background: TYPE_COLOR[s.code] ?? "#94a3b8",
                            }}
                          />
                          <span className="font-mono text-[10px] text-pitch-300/70">
                            {s.code}
                          </span>
                          <span className="text-sm">{s.type}</span>
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{s.count}</td>
                      <td className="text-right tabular-nums font-mono">
                        {usage.toFixed(1)}%
                      </td>
                      <td className="text-right tabular-nums font-mono">
                        {avgVelo ? avgVelo.toFixed(1) : "—"}
                      </td>
                      <td className="text-right tabular-nums font-mono">
                        {avgSpin ? avgSpin.toFixed(0) : "—"}
                      </td>
                      <td className="text-right tabular-nums">{s.swings}</td>
                      <td className="text-right tabular-nums font-mono">
                        {s.swings ? whiffPct.toFixed(1) + "%" : "—"}
                      </td>
                      <td className="text-right tabular-nums">{s.inPlay}</td>
                      <td className="text-right tabular-nums">{s.hits}</td>
                      <td className="text-right tabular-nums">{s.hr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t lg:border-t-0 lg:border-l border-white/5 h-64">
            <div className="text-[10px] uppercase tracking-widest text-pitch-300/60 mb-2">
              Usage radar
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis
                  dataKey="type"
                  tick={{ fontSize: 10, fill: "#9494b0" }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, "auto"]}
                  tick={false}
                  stroke="rgba(255,255,255,0.1)"
                />
                <Radar
                  dataKey="usage"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

function avg(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
