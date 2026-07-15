import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, playerHeadshotUrl, teamLogoUrl } from "../../api/mlb";
import { Card, Empty, Spinner } from "./Primitives";
import { fmtDate, fmtTime, shiftDate, todayIso } from "../../lib/utils";
import { useSport } from "../../contexts/SportContext";

export default function ProbablePitchers({ days = 3 }: { days?: number }) {
  const { sportId } = useSport();
  const start = todayIso();
  const end = shiftDate(start, days - 1);

  const q = useQuery({
    queryKey: ["probables", sportId, start, end],
    queryFn: () =>
      api.probables({
        sportId,
        startDate: start,
        endDate: end,
      }),
  });

  if (q.isLoading)
    return (
      <Card>
        <Spinner />
      </Card>
    );

  const dates = ((q.data?.dates ?? []) as any[]).filter((d) =>
    (d.games ?? []).some(
      (g: any) =>
        g.teams?.away?.probablePitcher || g.teams?.home?.probablePitcher
    )
  );

  if (dates.length === 0)
    return <Empty message="No probable pitchers announced yet." />;

  return (
    <div className="space-y-4">
      {dates.map((d) => {
        const games = (d.games ?? []) as any[];
        return (
          <div key={d.date}>
            <div className="mb-2 text-xs uppercase tracking-wider text-pitch-300/70">
              {fmtDate(d.date)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {games.map((g) => (
                <ProbableCard key={g.gamePk} game={g} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProbableCard({ game }: { game: any }) {
  const away = game.teams?.away;
  const home = game.teams?.home;
  return (
    <Link
      to={`/game/${game.gamePk}`}
      className="card card-pad block hover:bg-pitch-700 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="pill truncate">{game.venue?.name ?? ""}</span>
        <span className="pill shrink-0">{fmtTime(game.gameDate)}</span>
      </div>

      <PitcherRow side={away} />

      <div className="my-2 flex items-center gap-2.5">
        <div className="h-px flex-1 bg-white/[0.07]" />
        <span className="font-display font-bold text-[9px] tracking-[0.2em] uppercase text-pitch-300/60">
          vs
        </span>
        <div className="h-px flex-1 bg-white/[0.07]" />
      </div>

      <PitcherRow side={home} />
    </Link>
  );
}

function PitcherRow({ side }: { side: any }) {
  const team = side?.team;
  const p = side?.probablePitcher;
  const stat = p?.stats?.[0]?.splits?.[0]?.stat;

  return (
    <div className="flex items-center gap-3 min-w-0">
      {p ? (
        <img
          src={playerHeadshotUrl(p.id, 90)}
          alt=""
          className="h-12 w-12 rounded-full object-cover object-top bg-pitch-700 shrink-0"
        />
      ) : (
        <div className="h-12 w-12 rounded-full bg-pitch-700/50 flex items-center justify-center shrink-0">
          <img
            src={teamLogoUrl(team?.id)}
            alt=""
            className="h-7 w-7 object-contain opacity-70"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-display font-bold text-[9px] tracking-[0.14em] uppercase text-pitch-300/70">
          <img
            src={teamLogoUrl(team?.id)}
            alt=""
            className="h-3.5 w-3.5 object-contain shrink-0"
          />
          <span className="truncate">{team?.abbreviation ?? team?.name}</span>
        </div>
        <div className="text-sm font-semibold truncate leading-tight">
          {p?.fullName ?? "TBD"}
        </div>
        {stat ? (
          <div className="mt-0.5 font-mono text-[11px] text-pitch-300/80 truncate">
            {stat.wins}-{stat.losses} · {stat.era} ERA · {stat.strikeOuts} K
          </div>
        ) : (
          <div className="mt-0.5 text-[11px] text-pitch-300/50">—</div>
        )}
      </div>
    </div>
  );
}
