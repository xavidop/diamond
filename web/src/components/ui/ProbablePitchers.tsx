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
      className="card card-pad block hover:bg-pitch-900/80 transition-colors"
    >
      <div className="flex items-center justify-between text-[11px] text-pitch-300/70 mb-3">
        <span className="pill">{game.venue?.name ?? ""}</span>
        <span className="pill">{fmtTime(game.gameDate)}</span>
      </div>

      <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
        <PitcherSide side={away} align="left" />
        <span className="text-[10px] uppercase tracking-widest text-pitch-300/50">
          vs
        </span>
        <PitcherSide side={home} align="right" />
      </div>
    </Link>
  );
}

function PitcherSide({
  side,
  align,
}: {
  side: any;
  align: "left" | "right";
}) {
  const team = side?.team;
  const p = side?.probablePitcher;
  const stat = p?.stats?.[0]?.splits?.[0]?.stat;
  const reverse = align === "right";

  return (
    <div
      className={`flex items-center gap-3 min-w-0 ${
        reverse ? "flex-row-reverse text-right" : ""
      }`}
    >
      {p ? (
        <img
          src={playerHeadshotUrl(p.id, 90)}
          alt=""
          className="h-12 w-12 rounded-full object-cover bg-pitch-800 shrink-0"
        />
      ) : (
        <img
          src={teamLogoUrl(team?.id)}
          alt=""
          className="h-12 w-12 object-contain shrink-0 opacity-70"
        />
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-pitch-300/70">
          <img
            src={teamLogoUrl(team?.id)}
            alt=""
            className="h-3.5 w-3.5 object-contain"
          />
          <span className="truncate">{team?.abbreviation ?? team?.name}</span>
        </div>
        <div className="text-sm font-semibold truncate">
          {p?.fullName ?? "TBD"}
        </div>
        {stat ? (
          <div className="text-[11px] font-mono text-pitch-300/80">
            {stat.wins}-{stat.losses} · ERA {stat.era} · {stat.strikeOuts}K
          </div>
        ) : (
          <div className="text-[11px] text-pitch-300/50">—</div>
        )}
      </div>
    </div>
  );
}
