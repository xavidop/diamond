import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/mlb";
import { Card, Empty, Spinner } from "./Primitives";
import { cn } from "../../lib/utils";

/**
 * Common MLB Stats API "situation" codes (sitCodes) for /people/{id}/stats?stats=statSplits.
 * Each row in the response corresponds to one situation; we surface the most useful ones
 * grouped by category.
 */
const SIT_CODES: { id: string; label: string; cat: string }[] = [
  { id: "vl", label: "vs LHP", cat: "Handedness" },
  { id: "vr", label: "vs RHP", cat: "Handedness" },
  { id: "h", label: "Home", cat: "Location" },
  { id: "a", label: "Away", cat: "Location" },
  { id: "d", label: "Day", cat: "Time" },
  { id: "n", label: "Night", cat: "Time" },
  { id: "g", label: "Grass", cat: "Surface" },
  { id: "t", label: "Turf", cat: "Surface" },
  { id: "risp", label: "Risp", cat: "Situational" },
  { id: "loaded", label: "Bases loaded", cat: "Situational" },
];

const HITTING = [
  ["plateAppearances", "PA"],
  ["atBats", "AB"],
  ["hits", "H"],
  ["homeRuns", "HR"],
  ["rbi", "RBI"],
  ["baseOnBalls", "BB"],
  ["strikeOuts", "K"],
  ["avg", "AVG"],
  ["obp", "OBP"],
  ["slg", "SLG"],
  ["ops", "OPS"],
];

const PITCHING = [
  ["battersFaced", "BF"],
  ["inningsPitched", "IP"],
  ["hits", "H"],
  ["homeRuns", "HR"],
  ["strikeOuts", "K"],
  ["baseOnBalls", "BB"],
  ["earnedRuns", "ER"],
  ["era", "ERA"],
  ["whip", "WHIP"],
];

export default function Splits({
  personId,
  isPitcher,
}: {
  personId: string | number;
  isPitcher: boolean;
}) {
  const group = isPitcher ? "pitching" : "hitting";
  const [season, setSeason] = useState<string>(
    String(new Date().getFullYear())
  );

  const sitCodes = SIT_CODES.map((s) => s.id).join(",");

  const { data, isLoading, error } = useQuery({
    queryKey: ["splits", personId, group, season, sitCodes],
    queryFn: () =>
      api.personSplits(personId, "statSplits", {
        group,
        season,
        sitCodes,
      }),
  });

  const splits = ((data?.stats?.[0]?.splits ?? []) as any[]).filter(
    (s) => s.split?.code
  );
  const keys = isPitcher ? PITCHING : HITTING;

  // Group rows by category for nicer display
  const grouped = SIT_CODES.reduce<Record<string, typeof SIT_CODES>>(
    (acc, s) => {
      acc[s.cat] = acc[s.cat] || [];
      acc[s.cat].push(s);
      return acc;
    },
    {}
  );

  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/5">
        <div>
          <div className="text-xs uppercase tracking-wider text-pitch-300/70">
            Situational splits
          </div>
          <div className="text-sm">vs L/R, home/away, day/night, more</div>
        </div>
        <input
          type="number"
          value={season}
          min={1901}
          max={new Date().getFullYear()}
          onChange={(e) => setSeason(e.target.value)}
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
          <Empty message="No splits available for this season." />
        </div>
      )}

      {splits.length > 0 && (
        <div className="divide-y divide-white/5">
          {Object.entries(grouped).map(([cat, codes]) => {
            const rows = codes
              .map((c) => ({
                cfg: c,
                split: splits.find((s) => s.split?.code === c.id),
              }))
              .filter((x) => x.split);
            if (rows.length === 0) return null;
            return (
              <div key={cat}>
                <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-pitch-300/60">
                  {cat}
                </div>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Split</th>
                        {keys.map(([, lbl]) => (
                          <th key={lbl} className="text-right">
                            {lbl}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ cfg, split }) => (
                        <tr key={cfg.id}>
                          <td>
                            <span
                              className={cn(
                                "pill",
                                "text-[10px] tracking-wider"
                              )}
                            >
                              {cfg.label}
                            </span>
                          </td>
                          {keys.map(([k]) => (
                            <td
                              key={k}
                              className="text-right font-mono tabular-nums"
                            >
                              {String(split?.stat?.[k] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
