import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/mlb";
import { TRAIL_LEVELS, mergeTrail, hasMinors } from "../../lib/promotionTrail";
import { Card, SectionTitle } from "./Primitives";

const LEVEL_COLORS: Record<string, string> = {
  MLB: "#3b82f6",
  AAA: "#10b981",
  AA: "#84cc16",
  "A+": "#eab308",
  A: "#f97316",
  Rookie: "#ef4444",
};

function fmtStat(v: any): string {
  return v == null || v === "" ? "—" : String(v);
}

export default function PromotionTrail({
  personId,
  isPitcher,
}: {
  personId: number | string;
  isPitcher: boolean;
}) {
  const group = isPitcher ? "pitching" : "hitting";

  const results = useQueries({
    queries: TRAIL_LEVELS.map((lvl) => ({
      queryKey: ["trail", String(personId), group, lvl.sportId],
      queryFn: () => api.personStatsAtLevel(personId, group, lvl.sportId),
      staleTime: 60 * 60_000,
      retry: false,
    })),
  });

  if (results.some((r) => r.isLoading)) return null;

  const perLevel = TRAIL_LEVELS.map((lvl, i) => ({
    label: lvl.label,
    order: lvl.order,
    raw: results[i].data,
  }));
  const rows = mergeTrail(perLevel);

  // MLB-only players are already covered by the existing Year-by-Year table.
  if (!hasMinors(rows)) return null;

  const cols: [string, string][] = isPitcher
    ? [["G", "gamesPlayed"], ["ERA", "era"], ["SO", "strikeOuts"], ["WHIP", "whip"]]
    : [["G", "gamesPlayed"], ["AVG", "avg"], ["HR", "homeRuns"], ["OPS", "ops"]];

  return (
    <div className="space-y-3">
      <SectionTitle title="Career Path" subtitle="Across levels — Rookie ball to the majors" />
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="table-base w-full">
            <thead>
              <tr>
                <th className="text-left">Season</th>
                <th className="text-left">Level</th>
                <th className="text-left">Team</th>
                {cols.map(([lbl]) => (
                  <th key={lbl} className="text-right">
                    {lbl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const color = LEVEL_COLORS[r.level] ?? "#94a3b8";
                return (
                  <tr key={i}>
                    <td className="tabular-nums">{r.season}</td>
                    <td>
                      <span
                        className="pill"
                        style={{ background: `${color}22`, color }}
                      >
                        {r.level}
                      </span>
                    </td>
                    <td>
                      {r.teamId ? (
                        <Link
                          to={`/teams/${r.teamId}`}
                          className="hover:text-volt-500 hover:underline underline-offset-2 transition-colors"
                        >
                          {r.team}
                        </Link>
                      ) : (
                        r.team
                      )}
                    </td>
                    {cols.map(([lbl, key]) => (
                      <td key={lbl} className="text-right tabular-nums font-mono">
                        {fmtStat(r.stat[key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
