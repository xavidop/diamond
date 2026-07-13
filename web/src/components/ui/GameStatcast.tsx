import { useMemo, useState } from "react";
import { extractBattedBalls, battedBallLeaders, type BattedBall } from "../../lib/statcast";
import { Card, SectionTitle } from "./Primitives";
import { cn } from "../../lib/utils";

function Tile({ label, ball }: { label: string; ball: BattedBall | null }) {
  if (!ball) return null;
  const detail =
    label === "Longest"
      ? `${ball.distance} ft`
      : `${ball.ev} mph${ball.angle != null ? ` · ${ball.angle}°` : ""}`;
  return (
    <div className="rounded-lg bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">{label}</div>
      <div className="font-mono text-lg tabular-nums">{detail}</div>
      <div className="text-xs text-pitch-300">{ball.batter}</div>
    </div>
  );
}

export default function GameStatcast({ feed }: { feed: any }) {
  const { balls, hardestHit, longest } = useMemo(() => {
    const b = extractBattedBalls(feed);
    return { ...battedBallLeaders(b), balls: b };
  }, [feed]);

  const innings = useMemo(
    () => Array.from(new Set(balls.map((b) => b.inning))).sort((a, b) => a - b),
    [balls]
  );
  const [inning, setInning] = useState<number | "all">("all");
  const rows = inning === "all" ? balls : balls.filter((b) => b.inning === inning);

  if (balls.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionTitle title="Statcast" />
      <Card>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Tile label="Hardest Hit" ball={hardestHit} />
          <Tile label="Longest" ball={longest} />
        </div>
        <div className="mt-4 flex flex-wrap gap-1">
          <button
            onClick={() => setInning("all")}
            className={cn("btn", inning === "all" && "btn-primary")}
          >
            All
          </button>
          {innings.map((n) => (
            <button
              key={n}
              onClick={() => setInning(n)}
              className={cn("btn", inning === n && "btn-primary")}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="table-base w-full">
            <thead>
              <tr>
                <th className="text-left">Inn</th>
                <th className="text-left">Batter</th>
                <th className="text-left">Result</th>
                <th className="text-right">EV</th>
                <th className="text-right">LA</th>
                <th className="text-right">Dist</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <tr key={i}>
                  <td className="tabular-nums">{b.inning}</td>
                  <td>{b.batter}</td>
                  <td>{b.result}</td>
                  <td className="text-right tabular-nums font-mono">{b.ev ?? "—"}</td>
                  <td className="text-right tabular-nums font-mono">{b.angle ?? "—"}</td>
                  <td className="text-right tabular-nums font-mono">{b.distance ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
