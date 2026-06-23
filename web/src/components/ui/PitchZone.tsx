import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/mlb";
import { Card, Spinner } from "./Primitives";
import { cn } from "../../lib/utils";
import { useTheme } from "../../contexts/ThemeContext";

type Pitch = {
  pX: number;
  pZ: number;
  type: string;
  code: string;
  description: string;
  callDesc?: string;
  inning: number;
  batter?: string;
  pitcher?: string;
};

const COLORS: Record<string, string> = {
  B: "#3b82f6", // ball
  C: "#10b981", // called strike
  S: "#10b981", // swinging strike
  X: "#f59e0b", // in play
  D: "#f59e0b",
  E: "#f59e0b",
  F: "#10b981",
  T: "#10b981",
  L: "#10b981",
  W: "#10b981",
  H: "#ef4444", // HBP
};

const LEGEND: { code: string; label: string }[] = [
  { code: "B", label: "Ball" },
  { code: "C", label: "Strike" },
  { code: "X", label: "In play" },
  { code: "H", label: "HBP" },
];

export default function PitchZone({ gamePk }: { gamePk: string }) {
  const [filter, setFilter] = useState<string>("all");
  const [mode, setMode] = useState<"dots" | "heat">("dots");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading, error } = useQuery({
    queryKey: ["pbp", gamePk],
    queryFn: () => api.gamePlayByPlay(gamePk),
  });

  const pitches = useMemo<Pitch[]>(() => {
    const all = (data?.allPlays ?? []) as any[];
    const out: Pitch[] = [];
    for (const play of all) {
      const events = (play.playEvents ?? []) as any[];
      for (const ev of events) {
        if (ev.isPitch && ev.pitchData?.coordinates) {
          out.push({
            pX: ev.pitchData.coordinates.pX,
            pZ: ev.pitchData.coordinates.pZ,
            type: ev.details?.type?.description ?? "Pitch",
            code: ev.details?.code ?? "",
            description: ev.details?.description ?? "",
            callDesc: ev.details?.call?.description,
            inning: play.about?.inning ?? 0,
            batter: play.matchup?.batter?.fullName,
            pitcher: play.matchup?.pitcher?.fullName,
          });
        }
      }
    }
    return out;
  }, [data]);

  const types = useMemo(
    () => Array.from(new Set(pitches.map((p) => p.type))).sort(),
    [pitches]
  );

  const visible = filter === "all" ? pitches : pitches.filter((p) => p.type === filter);

  if (isLoading)
    return (
      <Card>
        <Spinner />
      </Card>
    );
  if (error || pitches.length === 0) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-pitch-300/70">
            Pitches plotted
          </div>
          <div className="text-sm">
            {visible.length} / {pitches.length}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(["dots", "heat"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-1 text-xs capitalize ${
                  mode === m
                    ? "bg-volt-500 text-black"
                    : "bg-pitch-900/40 hover:bg-pitch-800"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <button
            onClick={() => setFilter("all")}
            className={cn("btn", filter === "all" && "btn-primary")}
          >
            All
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn("btn", filter === t && "btn-primary")}
            >
              {t}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,180px] gap-4">
        <ZonePlot pitches={visible} mode={mode} isDark={isDark} />
        <div className="space-y-2 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
            Legend
          </div>
          {LEGEND.map((l) => (
            <div key={l.code} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: COLORS[l.code] ?? "#666" }}
              />
              <span className="text-pitch-300">{l.label}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-white/5 text-pitch-300/60">
            Coordinates from MLB Stats API (pX/pZ feet). Catcher's view.
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Strike zone roughly: pX ∈ [-0.83, 0.83] ft, pZ ∈ [1.5, 3.5] ft.
 * We render an SVG with the zone in the middle and pad ~1 ft around.
 */
function ZonePlot({ pitches, mode = "dots", isDark = true }: { pitches: Pitch[]; mode?: "dots" | "heat"; isDark?: boolean }) {
  const svgBg     = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)";
  const zoneFill  = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const zoneStroke= isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.40)";
  const gridLine  = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";
  const plateFill = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const plateStroke=isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.22)";

  const W = 320;
  const H = 360;
  const X_MIN = -2.5;
  const X_MAX = 2.5;
  const Y_MIN = 0;
  const Y_MAX = 5;

  const sx = (x: number) => ((x - X_MIN) / (X_MAX - X_MIN)) * W;
  const sy = (y: number) => H - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * H;

  const zoneX = sx(-0.83);
  const zoneY = sy(3.5);
  const zoneW = sx(0.83) - zoneX;
  const zoneH = sy(1.5) - zoneY;

  // 5x5 heat grid spanning the zone + a small buffer
  const GRID = 5;
  const heat: number[][] = Array.from({ length: GRID }, () =>
    Array(GRID).fill(0)
  );
  let maxCell = 0;
  if (mode === "heat") {
    const xMin = -1.0;
    const xMax = 1.0;
    const yMin = 1.0;
    const yMax = 4.0;
    for (const p of pitches) {
      const fx = (p.pX - xMin) / (xMax - xMin);
      const fy = (p.pZ - yMin) / (yMax - yMin);
      if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) continue;
      const gx = Math.floor(fx * GRID);
      const gy = GRID - 1 - Math.floor(fy * GRID);
      heat[gy][gx]++;
      if (heat[gy][gx] > maxCell) maxCell = heat[gy][gx];
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm mx-auto">
      {/* Outer plate */}
      <rect x="0" y="0" width={W} height={H} fill={svgBg} rx="12" />

      {/* Heat cells (rendered behind the zone) */}
      {mode === "heat" &&
        heat.map((row, gy) =>
          row.map((c, gx) => {
            if (!c) return null;
            const cellW = sx(1.0) - sx(-1.0);
            const cellH = sy(1.0) - sy(4.0);
            const x = sx(-1.0) + (cellW / GRID) * gx;
            const y = sy(4.0) + (cellH / GRID) * gy;
            const ratio = c / maxCell;
            const color = heatColor(ratio);
            return (
              <rect
                key={`${gx}-${gy}`}
                x={x}
                y={y}
                width={cellW / GRID}
                height={cellH / GRID}
                fill={color}
                fillOpacity={0.85}
              >
                <title>{c} pitches</title>
              </rect>
            );
          })
        )}

      {/* Strike zone */}
      <rect
        x={zoneX}
        y={zoneY}
        width={zoneW}
        height={zoneH}
        fill={mode === "heat" ? "none" : zoneFill}
        stroke={zoneStroke}
        strokeWidth={1.5}
      />
      {/* Zone thirds */}
      {[1, 2].map((i) => (
        <line
          key={`v${i}`}
          x1={zoneX + (zoneW / 3) * i}
          x2={zoneX + (zoneW / 3) * i}
          y1={zoneY}
          y2={zoneY + zoneH}
          stroke={gridLine}
        />
      ))}
      {[1, 2].map((i) => (
        <line
          key={`h${i}`}
          y1={zoneY + (zoneH / 3) * i}
          y2={zoneY + (zoneH / 3) * i}
          x1={zoneX}
          x2={zoneX + zoneW}
          stroke={gridLine}
        />
      ))}

      {/* Home plate outline (decorative) */}
      <polygon
        points={`${sx(-0.7)},${sy(0.4)} ${sx(0.7)},${sy(0.4)} ${sx(0.5)},${sy(
          0.15
        )} ${sx(0)},${sy(0.05)} ${sx(-0.5)},${sy(0.15)}`}
        fill={plateFill}
        stroke={plateStroke}
      />

      {mode === "dots" &&
        pitches.map((p, i) => (
          <circle
            key={i}
            cx={sx(p.pX)}
            cy={sy(p.pZ)}
            r={5}
            fill={COLORS[p.code] ?? "#94a3b8"}
            fillOpacity={0.75}
            stroke="rgba(0,0,0,0.4)"
          >
            <title>
              {`Inn ${p.inning} · ${p.type}\n${p.description}${
                p.callDesc ? ` (${p.callDesc})` : ""
              }${p.pitcher ? `\n${p.pitcher} → ${p.batter}` : ""}`}
            </title>
          </circle>
        ))}
    </svg>
  );
}

function heatColor(t: number) {
  // 0..1 → blue (cool) → yellow → red
  const r = Math.round(255 * Math.min(1, t * 1.6));
  const g = Math.round(255 * Math.min(1, 1.2 - Math.abs(0.6 - t) * 2));
  const b = Math.round(255 * Math.max(0, 1 - t * 1.6));
  return `rgb(${r},${g},${b})`;
}
