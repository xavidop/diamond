import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/mlb";
import { Card, SectionTitle } from "./Primitives";

type Props = {
  personId: number | string;
  group: "hitting" | "pitching";
  season: number | string;
  actual?: { avg?: string; slg?: string };
};

function delta(actual?: string, expected?: string): { txt: string; cls: string } | null {
  if (!actual || !expected) return null;
  const d = parseFloat(actual) - parseFloat(expected);
  if (Number.isNaN(d)) return null;
  const cls = d >= 0 ? "text-emerald-400" : "text-red-400";
  return { txt: `${d >= 0 ? "+" : ""}${d.toFixed(3)}`, cls };
}

// Statcast red→blue percentile ramp: 0 = red, 50 = grey, 100 = blue.
function barColor(v: number): string {
  const lo = [207, 16, 25];
  const mid = [176, 176, 176];
  const hi = [50, 90, 168];
  const lerp = (a: number[], b: number[], t: number) =>
    a.map((x, i) => Math.round(x + (b[i] - x) * t));
  const rgb = v <= 50 ? lerp(lo, mid, v / 50) : lerp(mid, hi, (v - 50) / 50);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export default function StatcastCard({ personId, group, season, actual }: Props) {
  const expected = useQuery({
    queryKey: ["expected-stats", String(personId), group, String(season)],
    queryFn: () => api.personExpectedStats(personId, group, season),
    staleTime: 60 * 60_000,
  });

  const pos = group === "pitching" ? "pitcher" : "batter";
  const pct = useQuery({
    queryKey: ["savant-percentiles", String(personId), pos, String(season)],
    queryFn: () => api.savantPercentiles(personId, pos, season),
    staleTime: 60 * 60_000,
    retry: false,
  });

  const stat = expected.data?.stats?.[0]?.splits?.[0]?.stat;
  const hasExpected = !!stat;
  const hasPercentiles =
    pct.data && "ok" in pct.data && pct.data.ok && pct.data.percentiles.length > 0;

  // Nothing to show at all → render nothing.
  if (!hasExpected && !pct.isLoading && !hasPercentiles) return null;

  const rows: { label: string; expected?: string; actual?: string }[] = hasExpected
    ? [
        { label: "xBA", expected: stat.avg, actual: actual?.avg },
        { label: "xSLG", expected: stat.slg, actual: actual?.slg },
        { label: "xwOBA", expected: stat.woba },
        { label: "xwOBACON", expected: stat.wobaCon },
      ]
    : [];

  return (
    <div className="space-y-3">
      {hasExpected && (
        <>
          <SectionTitle title="Statcast — Expected Stats" />
          <Card>
            <table className="table-base w-full">
              <thead>
                <tr>
                  <th className="text-left">Metric</th>
                  <th className="text-right">Expected</th>
                  <th className="text-right">Actual</th>
                  <th className="text-right">Diff</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = delta(r.actual, r.expected);
                  return (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="text-right tabular-nums font-mono">{r.expected ?? "—"}</td>
                      <td className="text-right tabular-nums font-mono">{r.actual ?? "—"}</td>
                      <td className={`text-right tabular-nums font-mono ${d?.cls ?? ""}`}>
                        {d?.txt ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <SectionTitle title="Statcast — Percentile Rankings" />
      <Card>
        {hasPercentiles && pct.data && "ok" in pct.data && pct.data.ok ? (
          <div className="space-y-1.5">
            {pct.data.percentiles.map((p) => (
              <div key={p.key} className="flex items-center gap-3">
                <div className="w-28 text-xs text-pitch-300">{p.label}</div>
                <div className="relative h-4 flex-1 rounded-full bg-white/5">
                  <div
                    className="absolute top-0 h-4 rounded-full"
                    style={{ width: `${p.value}%`, background: barColor(p.value) }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 text-[10px] font-mono"
                    style={{ left: `calc(${p.value}% + 4px)` }}
                  >
                    {p.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : pct.isLoading ? (
          <div className="text-sm text-pitch-300/70">Loading percentiles…</div>
        ) : (
          <div className="text-sm text-pitch-300/70">Statcast percentiles unavailable.</div>
        )}
      </Card>
    </div>
  );
}
