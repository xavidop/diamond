import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, teamLogoUrl } from "../../api/mlb";
import { Card, Empty, Spinner } from "./Primitives";

const HITTING_COLS = [
  ["atBats", "AB"],
  ["runs", "R"],
  ["hits", "H"],
  ["doubles", "2B"],
  ["triples", "3B"],
  ["homeRuns", "HR"],
  ["rbi", "RBI"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "K"],
  ["avg", "AVG"],
];

const PITCHING_COLS = [
  ["inningsPitched", "IP"],
  ["hits", "H"],
  ["runs", "R"],
  ["earnedRuns", "ER"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "K"],
  ["era", "ERA"],
];

export default function GameLog({
  personId,
  isPitcher,
}: {
  personId: string | number;
  isPitcher: boolean;
}) {
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const group = isPitcher ? "pitching" : "hitting";

  const { data, isLoading, error } = useQuery({
    queryKey: ["gamelog", personId, group, season],
    queryFn: () => api.personGameLog(personId, group, season),
  });

  const splits = (data?.stats?.[0]?.splits ?? []) as any[];
  const cols = isPitcher ? PITCHING_COLS : HITTING_COLS;

  // Rolling 10-game sparkline of AVG or ERA
  const sparkData = useMemo(() => {
    const window = 10;
    const points: { i: number; date: string; val: number }[] = [];
    if (!splits.length) return points;
    if (isPitcher) {
      let er = 0;
      let ip = 0;
      const ers: number[] = [];
      const ips: number[] = [];
      splits.forEach((s, idx) => {
        const e = Number(s.stat?.earnedRuns ?? 0);
        const i = parseIp(s.stat?.inningsPitched ?? "0");
        ers.push(e);
        ips.push(i);
        er += e;
        ip += i;
        if (ers.length > window) {
          er -= ers.shift()!;
          ip -= ips.shift()!;
        }
        const era = ip > 0 ? (9 * er) / ip : 0;
        points.push({ i: idx, date: s.date ?? "", val: era });
      });
    } else {
      let h = 0;
      let ab = 0;
      const hs: number[] = [];
      const abs: number[] = [];
      splits.forEach((s, idx) => {
        const hh = Number(s.stat?.hits ?? 0);
        const aa = Number(s.stat?.atBats ?? 0);
        hs.push(hh);
        abs.push(aa);
        h += hh;
        ab += aa;
        if (hs.length > window) {
          h -= hs.shift()!;
          ab -= abs.shift()!;
        }
        const avg = ab > 0 ? h / ab : 0;
        points.push({ i: idx, date: s.date ?? "", val: avg });
      });
    }
    return points;
  }, [splits, isPitcher]);

  const recent = splits.slice(-20).reverse();

  return (
    <Card pad={false}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div>
          <div className="text-xs uppercase tracking-wider text-pitch-300/70">
            Game log
          </div>
          <div className="text-sm text-pitch-300">
            Most recent 20 games · rolling 10-game{" "}
            {isPitcher ? "ERA" : "AVG"}
          </div>
        </div>
        <input
          type="number"
          value={season}
          min={1901}
          max={new Date().getFullYear()}
          onChange={(e) => setSeason(Number(e.target.value || new Date().getFullYear()))}
          className="input w-24 text-center"
        />
      </div>

      {isLoading && (
        <div className="p-6 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && (
        <div className="p-4 text-sm text-pitch-300/70">Failed to load.</div>
      )}
      {!isLoading && splits.length === 0 && (
        <div className="p-4">
          <Empty message="No games for this season." />
        </div>
      )}

      {sparkData.length > 1 && (
        <div className="px-4 pt-3 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id="glGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="i" hide />
              <YAxis
                stroke="#9494b0"
                tick={{ fontSize: 10 }}
                domain={isPitcher ? [0, "auto"] : [0, 0.5]}
                tickFormatter={(v: number) =>
                  isPitcher ? v.toFixed(2) : v.toFixed(3)
                }
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: "#080810",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(idx: any) =>
                  sparkData[Number(idx)]?.date ?? ""
                }
                formatter={(v: any) => [
                  isPitcher ? Number(v).toFixed(2) : Number(v).toFixed(3),
                  isPitcher ? "ERA(10)" : "AVG(10)",
                ]}
              />
              <Area
                type="monotone"
                dataKey="val"
                stroke="#ef4444"
                fill="url(#glGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {recent.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Opp</th>
                <th></th>
                {cols.map(([, lbl]) => (
                  <th key={lbl} className="text-right">
                    {lbl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((s: any, i: number) => {
                const opp = s.opponent;
                const isHome = s.isHome === true;
                return (
                  <tr key={`${s.date}-${s.game?.gamePk ?? i}`}>
                    <td className="tabular-nums text-xs text-pitch-300/80">
                      {s.date}
                    </td>
                    <td>
                      {opp && (
                        <Link
                          to={`/teams/${opp.id}`}
                          className="flex items-center gap-1.5 hover:text-white"
                        >
                          <span className="text-[10px] text-pitch-300/60">
                            {isHome ? "vs" : "@"}
                          </span>
                          <img
                            src={teamLogoUrl(opp.id)}
                            alt=""
                            className="h-4 w-4 object-contain"
                          />
                          <span className="text-xs">
                            {opp.abbreviation ?? opp.name}
                          </span>
                        </Link>
                      )}
                    </td>
                    <td>
                      {s.game?.gamePk && (
                        <Link
                          to={`/game/${s.game.gamePk}`}
                          className="text-[10px] pill hover:bg-pitch-700"
                        >
                          View
                        </Link>
                      )}
                    </td>
                    {cols.map(([k]) => (
                      <td
                        key={k}
                        className="text-right font-mono tabular-nums"
                      >
                        {String(s.stat?.[k] ?? "—")}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function parseIp(ip: string | number) {
  const s = String(ip);
  const [whole, frac] = s.split(".");
  return Number(whole ?? 0) + (Number(frac ?? 0) || 0) / 3;
}
