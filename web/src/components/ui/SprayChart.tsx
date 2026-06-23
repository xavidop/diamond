import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/mlb";
import { Card, Empty, Spinner } from "./Primitives";
import { cn } from "../../lib/utils";

/**
 * MLB Stats API gives `hitData.coordinates.coordX/coordY` in pixel coordinates
 * relative to a 250x250 stadium image (home plate near bottom-center).
 * - x range ~ [0, 250], home plate ≈ 125
 * - y range ~ [0, 250], home plate ≈ 205
 * We re-project onto our own SVG field.
 */

type Hit = {
  x: number;
  y: number;
  result: string;
  bb: string; // batted ball type
  ev?: number; // exit velo
  ld?: number; // launch angle
  desc: string;
  batter: string;
  inning: number;
  isOut: boolean;
  isHr: boolean;
};

const RESULT_COLOR: Record<string, string> = {
  single: "#10b981",
  double: "#3b82f6",
  triple: "#a855f7",
  home_run: "#ef4444",
  out: "#94a3b8",
  field_error: "#f59e0b",
};

export default function SprayChart({
  gamePk,
  batterId,
}: {
  gamePk: string | number;
  batterId?: number;
}) {
  const [bbFilter, setBbFilter] = useState<string>("all");
  const { data, isLoading, error } = useQuery({
    queryKey: ["pbp-spray", gamePk],
    queryFn: () => api.gamePlayByPlay(gamePk),
  });

  const hits = useMemo<Hit[]>(() => {
    const plays = (data?.allPlays ?? []) as any[];
    const out: Hit[] = [];
    for (const play of plays) {
      if (batterId && play.matchup?.batter?.id !== batterId) continue;
      const ev = (play.playEvents ?? []) as any[];
      const last = ev[ev.length - 1];
      const hit = last?.hitData;
      if (!hit?.coordinates) continue;
      const result = (play.result?.eventType ?? "out") as string;
      out.push({
        x: hit.coordinates.coordX,
        y: hit.coordinates.coordY,
        result,
        bb: hit.trajectory ?? "unknown",
        ev: hit.launchSpeed,
        ld: hit.launchAngle,
        desc: play.result?.description ?? "",
        batter: play.matchup?.batter?.fullName ?? "",
        inning: play.about?.inning ?? 0,
        isOut: result.includes("out") || result === "force_out",
        isHr: result === "home_run",
      });
    }
    return out;
  }, [data, batterId]);

  const trajectories = useMemo(
    () => Array.from(new Set(hits.map((h) => h.bb))).sort(),
    [hits]
  );

  const visible =
    bbFilter === "all" ? hits : hits.filter((h) => h.bb === bbFilter);

  if (isLoading)
    return (
      <Card>
        <Spinner />
      </Card>
    );
  if (error) return null;
  if (hits.length === 0)
    return (
      <Card>
        <Empty message="No batted-ball data yet for this game." />
      </Card>
    );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-pitch-300/70">
            Batted balls
          </div>
          <div className="text-sm">
            {visible.length} / {hits.length}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setBbFilter("all")}
            className={cn("btn", bbFilter === "all" && "btn-primary")}
          >
            All
          </button>
          {trajectories.map((t) => (
            <button
              key={t}
              onClick={() => setBbFilter(t)}
              className={cn("btn capitalize", bbFilter === t && "btn-primary")}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,180px] gap-4">
        <Field hits={visible} />
        <div className="space-y-2 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
            Legend
          </div>
          {[
            ["single", "Single"],
            ["double", "Double"],
            ["triple", "Triple"],
            ["home_run", "Home Run"],
            ["out", "Out"],
            ["field_error", "Error"],
          ].map(([k, lbl]) => (
            <div key={k} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: RESULT_COLOR[k] }}
              />
              <span className="text-pitch-300">{lbl}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-white/5 text-pitch-300/60">
            Coordinates from MLB Stats API (250×250 stadium grid).
          </div>
        </div>
      </div>
    </Card>
  );
}

function Field({ hits }: { hits: Hit[] }) {
  const W = 320;
  const H = 320;
  // Map source 250x250 (home plate near (125, 205)) into our field.
  // We want home plate near bottom-center of our SVG and the outfield up.
  const PLATE_X = 125;
  const PLATE_Y = 205;
  const HOME = { x: W / 2, y: H - 28 };

  // Scale ~1.4 fits the typical outfield
  const SCALE = 1.15;
  const proj = (cx: number, cy: number) => {
    const dx = (cx - PLATE_X) * SCALE;
    const dy = (cy - PLATE_Y) * SCALE; // negative = toward outfield
    return { x: HOME.x + dx, y: HOME.y + dy };
  };

  // Foul lines: roughly 45° from home plate
  const lineLen = 250;
  const leftFoul = {
    x: HOME.x - Math.cos(Math.PI / 4) * lineLen,
    y: HOME.y - Math.sin(Math.PI / 4) * lineLen,
  };
  const rightFoul = {
    x: HOME.x + Math.cos(Math.PI / 4) * lineLen,
    y: HOME.y - Math.sin(Math.PI / 4) * lineLen,
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md mx-auto">
      <defs>
        <radialGradient id="grass" cx="50%" cy="100%" r="120%">
          <stop offset="0%" stopColor="rgba(16,185,129,0.18)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0.04)" />
        </radialGradient>
      </defs>

      {/* Fair territory wedge */}
      <polygon
        points={`${HOME.x},${HOME.y} ${leftFoul.x},${leftFoul.y} ${
          W / 2
        },${30} ${rightFoul.x},${rightFoul.y}`}
        fill="url(#grass)"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
      />

      {/* Outfield arc */}
      <path
        d={`M ${leftFoul.x} ${leftFoul.y} Q ${W / 2} ${-20} ${rightFoul.x} ${
          rightFoul.y
        }`}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1.5}
      />

      {/* Infield diamond (~90 ft scaled) */}
      <polygon
        points={`${HOME.x},${HOME.y} ${HOME.x - 55},${HOME.y - 55} ${HOME.x},${
          HOME.y - 110
        } ${HOME.x + 55},${HOME.y - 55}`}
        fill="rgba(245,158,11,0.08)"
        stroke="rgba(245,158,11,0.4)"
        strokeWidth={1}
      />

      {/* Pitcher's mound */}
      <circle
        cx={HOME.x}
        cy={HOME.y - 60}
        r={6}
        fill="rgba(245,158,11,0.5)"
      />

      {/* Home plate */}
      <polygon
        points={`${HOME.x - 6},${HOME.y} ${HOME.x + 6},${HOME.y} ${
          HOME.x + 6
        },${HOME.y + 6} ${HOME.x},${HOME.y + 10} ${HOME.x - 6},${HOME.y + 6}`}
        fill="white"
        opacity={0.9}
      />

      {/* Hits */}
      {hits.map((h, i) => {
        const { x, y } = proj(h.x, h.y);
        const color = RESULT_COLOR[h.result] ?? RESULT_COLOR.out;
        const r = h.isHr ? 6 : h.isOut ? 3.5 : 5;
        return (
          <g key={i}>
            <title>
              {`Inn ${h.inning} · ${h.batter}\n${h.desc}${
                h.ev ? ` (${h.ev} mph, ${h.ld}°)` : ""
              }`}
            </title>
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={color}
              fillOpacity={0.75}
              stroke={color}
              strokeWidth={1}
            />
          </g>
        );
      })}
    </svg>
  );
}
