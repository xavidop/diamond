import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/mlb";
import { parseHotColdZones, zoneGrid } from "../../lib/hotColdZones";
import { Card, SectionTitle } from "./Primitives";
import { cn } from "../../lib/utils";

function Cell({ zone }: { zone?: { color: string; value: string } }) {
  return (
    <div
      className="flex aspect-square items-center justify-center rounded-sm text-[11px] font-mono tabular-nums text-white/90"
      style={{ background: zone?.color ?? "rgba(255,255,255,0.04)" }}
    >
      {zone?.value ?? ""}
    </div>
  );
}

export default function HotColdZones({
  personId,
  isPitcher,
}: {
  personId: number | string;
  isPitcher: boolean;
}) {
  const group = isPitcher ? "pitching" : "hitting";
  const { data } = useQuery({
    queryKey: ["hotcold", String(personId), group],
    queryFn: () => api.personHotColdZones(personId, group, new Date().getFullYear()),
    staleTime: 60 * 60_000,
    retry: false,
  });
  const [metricIdx, setMetricIdx] = useState(0);

  const metrics = data ? parseHotColdZones(data) : [];
  if (metrics.length === 0) return null;

  const metric = metrics[Math.min(metricIdx, metrics.length - 1)];
  const { inner, outside } = zoneGrid(metric.zones);

  return (
    <div className="space-y-3">
      <SectionTitle
        title="Hot / Cold Zones"
        subtitle={isPitcher ? "Results allowed by pitch location" : "Performance by pitch location"}
      />
      <Card>
        <div className="mb-3 flex flex-wrap gap-1">
          {metrics.map((m, i) => (
            <button
              key={m.key}
              onClick={() => setMetricIdx(i)}
              className={cn("btn", i === metricIdx && "btn-primary")}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          {/* Catcher's-view strike zone: 3×3 core with the four out-of-zone
              quadrants at the corners. */}
          <div className="grid w-full max-w-[220px] grid-cols-4 gap-1">
            <Cell zone={outside[0]} />
            <div className="col-span-2" />
            <Cell zone={outside[1]} />
          </div>
          <div className="w-full max-w-[220px] rounded-md border border-white/15 p-1">
            <div className="grid grid-cols-3 gap-1">
              {inner.map((z, i) => (
                <Cell key={i} zone={z} />
              ))}
            </div>
          </div>
          <div className="grid w-full max-w-[220px] grid-cols-4 gap-1">
            <Cell zone={outside[2]} />
            <div className="col-span-2" />
            <Cell zone={outside[3]} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
            {metric.label} · catcher's view · red = hot, blue = cold
          </div>
        </div>
      </Card>
    </div>
  );
}
