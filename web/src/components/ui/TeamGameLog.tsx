import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, teamLogoUrl } from "../../api/mlb";
import { Card, Spinner } from "./Primitives";
import { cn } from "../../lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function TeamGameLog({
  teamId,
  season,
}: {
  teamId: number;
  season: number;
}) {
  const [month, setMonth] = useState(() => new Date().getMonth());
  const year = season;

  const startDate = isoLocal(new Date(year, month, 1));
  const endDate = isoLocal(new Date(year, month + 1, 0));

  const { data, isLoading } = useQuery({
    queryKey: ["team-schedule", teamId, startDate, endDate],
    queryFn: () =>
      api.schedule({
        teamId,
        startDate,
        endDate,
        sportId: 1,
      }),
  });

  const games = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of (data?.dates ?? []) as any[]) {
      map.set(d.date, d.games ?? []);
    }
    return map;
  }, [data]);

  const days = monthDays(year, month);
  const firstDow = new Date(year, month, 1).getDay();

  return (
    <Card pad={false}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
            Game Log
          </div>
          <div className="font-semibold">
            {MONTH_NAMES[month]} {year}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn"
            onClick={() =>
              setMonth((m) => {
                if (m === 0) return 11;
                return m - 1;
              })
            }
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="btn"
            onClick={() =>
              setMonth((m) => {
                if (m === 11) return 0;
                return m + 1;
              })
            }
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-pitch-300/60 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((d) => {
              const iso = isoLocal(d);
              const gs = games.get(iso) ?? [];
              return <DayCell key={iso} date={d} teamId={teamId} games={gs} />;
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function DayCell({
  date,
  teamId,
  games,
}: {
  date: Date;
  teamId: number;
  games: any[];
}) {
  const today = sameDay(date, new Date());
  if (games.length === 0) {
    return (
      <div
        className={cn(
          "h-16 rounded-lg border border-white/5 px-1.5 py-1 text-[10px] text-pitch-300/40",
          today && "border-volt-500/60"
        )}
      >
        {date.getDate()}
      </div>
    );
  }
  const g = games[0];
  const isHome = g.teams?.home?.team?.id === teamId;
  const us = isHome ? g.teams?.home : g.teams?.away;
  const them = isHome ? g.teams?.away : g.teams?.home;
  const status = g.status?.abstractGameState;
  const final = status === "Final";
  const win = final && us?.isWinner;
  const loss = final && them?.isWinner;

  return (
    <Link
      to={`/game/${g.gamePk}`}
      className={cn(
        "h-16 rounded-lg border px-1.5 py-1 text-[10px] hover:bg-white/5 transition-colors flex flex-col",
        win && "border-emerald-500/40 bg-emerald-500/5",
        loss && "border-volt-500/40 bg-volt-500/5",
        !final && "border-white/10",
        today && "ring-1 ring-volt-500/50"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-pitch-300/70">{date.getDate()}</span>
        {final && (
          <span
            className={cn(
              "font-mono font-bold",
              win && "text-emerald-300",
              loss && "text-volt-500"
            )}
          >
            {win ? "W" : loss ? "L" : "—"}
          </span>
        )}
      </div>
      <div className="mt-auto flex items-center gap-1 truncate">
        <span className="text-pitch-300/70">{isHome ? "vs" : "@"}</span>
        <img
          src={teamLogoUrl(them?.team?.id)}
          alt=""
          className="h-3.5 w-3.5 object-contain"
        />
        {final && (
          <span className="ml-auto font-mono tabular-nums text-pitch-300">
            {us?.score}-{them?.score}
          </span>
        )}
      </div>
    </Link>
  );
}

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function monthDays(y: number, m: number) {
  const out: Date[] = [];
  const last = new Date(y, m + 1, 0).getDate();
  for (let i = 1; i <= last; i++) out.push(new Date(y, m, i));
  return out;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
