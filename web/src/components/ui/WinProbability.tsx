import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../api/mlb";
import { useChartPalette } from "../../contexts/ThemeContext";
import { Card, Empty } from "./Primitives";

type Point = {
  i: number;
  inning: number;
  half: "T" | "B";
  homeWP: number;
  awayWP: number;
  desc: string;
  awayScore: number;
  homeScore: number;
  li?: number; // leverage index
};

export default function WinProbability({
  gamePk,
  plays,
  awayName,
  homeName,
}: {
  gamePk?: string | number;
  plays: any[];
  awayName?: string;
  homeName?: string;
}) {
  // Fallback: the dedicated /game/{pk}/winProbability endpoint usually has
  // values even when play-by-play doesn't.
  const wpQuery = useQuery({
    queryKey: ["winProbability", gamePk],
    queryFn: () => api.gameWinProbability(gamePk!),
    enabled: gamePk != null,
    staleTime: 60_000,
  });

  const data = useMemo<Point[]>(() => {
    // Prefer the dedicated endpoint when it has rows
    const wpItems = (wpQuery.data ?? []) as any[];
    if (Array.isArray(wpItems) && wpItems.length > 0) {
      return wpItems
        .map((p, i) => {
          const home = p.homeTeamWinProbability;
          if (typeof home !== "number") return null;
          return {
            i,
            inning: p.atBatIndex ?? i,
            half: p.about?.halfInning === "top" ? "T" : "B",
            homeWP: home,
            awayWP: 100 - home,
            desc: p.result?.description ?? p.result?.event ?? "",
            awayScore: p.result?.awayScore ?? 0,
            homeScore: p.result?.homeScore ?? 0,
            li: p.leverageIndex,
          } as Point;
        })
        .filter(Boolean) as Point[];
    }

    const out: Point[] = [];
    plays.forEach((p, i) => {
      const wp = p.about?.homeWinProbability;
      const wpAway = p.about?.awayWinProbability;
      if (wp == null && wpAway == null) return;
      const home = typeof wp === "number" ? wp : 100 - (wpAway ?? 0);
      out.push({
        i,
        inning: p.about?.inning ?? 0,
        half: p.about?.halfInning === "top" ? "T" : "B",
        homeWP: home,
        awayWP: 100 - home,
        desc: p.result?.description ?? p.result?.event ?? "",
        awayScore: p.result?.awayScore ?? 0,
        homeScore: p.result?.homeScore ?? 0,
        li: p.about?.leverageIndex,
      });
    });
    return out;
  }, [plays, wpQuery.data]);

  if (data.length === 0)
    return (
      <Card>
        <Empty message="No win-probability data yet." />
      </Card>
    );

  const last = data[data.length - 1];
  const palette = useChartPalette();
  const homeColor = palette.a; // blue (good/home)
  const awayColor = palette.b; // red or orange (CB)

  return (
    <Card>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-pitch-300/70">
            Win probability
          </div>
          <div className="text-sm text-pitch-300">
            {awayName ?? "Away"} vs {homeName ?? "Home"}
          </div>
        </div>
        <div className="text-right text-xs space-y-0.5">
          <div className="flex items-center gap-2 justify-end">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ background: awayColor }}
            />
            <span>
              {awayName ?? "Away"}{" "}
              <span className="font-mono">{last.awayWP.toFixed(1)}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ background: homeColor }}
            />
            <span>
              {homeName ?? "Home"}{" "}
              <span className="font-mono">{last.homeWP.toFixed(1)}%</span>
            </span>
          </div>
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="wpHome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={homeColor} stopOpacity={0.45} />
                <stop offset="100%" stopColor={homeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="i"
              stroke="#9494b0"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => {
                const p = data[v];
                return p ? `${p.half}${p.inning}` : "";
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#9494b0"
              tick={{ fontSize: 10 }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <ReferenceLine y={50} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{
                background: "#080810",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(idx: any) => {
                const p = data[Number(idx)];
                if (!p) return "";
                return `${p.half === "T" ? "Top" : "Bot"} ${p.inning} · ${p.awayScore}-${p.homeScore}`;
              }}
              formatter={(value: any, _key, info: any) => {
                const p = info?.payload as Point;
                return [
                  `${Number(value).toFixed(1)}%${
                    p?.li ? ` · LI ${p.li.toFixed(2)}` : ""
                  }`,
                  homeName ?? "Home",
                ];
              }}
            />
            <Area
              type="monotone"
              dataKey="homeWP"
              stroke={homeColor}
              strokeWidth={2}
              fill="url(#wpHome)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
