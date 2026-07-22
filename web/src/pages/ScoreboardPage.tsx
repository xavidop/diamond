import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { api, teamLogoUrl } from "../api/mlb";
import { ErrorBox, SectionTitle, Spinner, Empty } from "../components/ui/Primitives";
import { cn, fmtGameTime, shiftDate, todayIso, mergeRecentSpillover } from "../lib/utils";
import { Link } from "react-router-dom";
import { useSport } from "../contexts/SportContext";
import NotifyButton from "../components/ui/NotifyButton";

type MlbGame = {
  gamePk: number;
  status?: { abstractGameState?: string; detailedState?: string };
  teams?: {
    home?: {
      team?: { id?: number; name?: string };
      score?: number;
      isWinner?: boolean;
      leagueRecord?: { wins?: number; losses?: number };
      probablePitcher?: { fullName?: string };
    };
    away?: {
      team?: { id?: number; name?: string };
      score?: number;
      isWinner?: boolean;
      leagueRecord?: { wins?: number; losses?: number };
      probablePitcher?: { fullName?: string };
    };
  };
  linescore?: { currentInningOrdinal?: string; inningState?: string };
  gameDate?: string;
  venue?: { name?: string };
  seriesDescription?: string;
};

export default function ScoreboardPage() {
  const [date, setDate] = useState(todayIso());
  const { sportId, sport } = useSport();
  const isToday = date === todayIso();
  const yesterday = shiftDate(date, -1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["schedule", sportId, date],
    queryFn: () => api.schedule({ date, sportId }),
    refetchInterval: 30_000,
  });
  // On "today", tonight's US games are filed under yesterday's date for viewers
  // east of the US; pull in the live/just-finished/imminent ones (see
  // mergeRecentSpillover). Other dates show exactly that day's slate.
  const yesterdayQuery = useQuery({
    queryKey: ["schedule", sportId, yesterday],
    queryFn: () => api.schedule({ date: yesterday, sportId }),
    refetchInterval: 30_000,
    enabled: isToday,
  });

  const games = useMemo(() => {
    const todayGames = ((data?.dates ?? [])[0]?.games ?? []) as MlbGame[];
    if (!isToday) return todayGames;
    const yGames = ((yesterdayQuery.data?.dates ?? [])[0]?.games ?? []) as MlbGame[];
    return mergeRecentSpillover(todayGames, yGames);
  }, [data, yesterdayQuery.data, isToday]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`${sport.abbreviation} Scoreboard`}
        subtitle="Live & scheduled games. Auto-refreshes every 30s."
        right={
          <div className="flex items-center gap-2">
            <button
              className="btn"
              onClick={() => setDate((d) => shiftDate(d, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-pitch-300/60 pointer-events-none"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value || todayIso())}
                className="input pl-8 w-44"
              />
            </div>
            <button
              className="btn"
              onClick={() => setDate((d) => shiftDate(d, 1))}
              aria-label="Next day"
            >
              <ChevronRight size={14} />
            </button>
            <button className="btn btn-primary" onClick={() => setDate(todayIso())}>
              Today
            </button>
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {error && <ErrorBox error={error} />}
      {!isLoading && !error && games.length === 0 && (
        <Empty message="No games scheduled." />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {games.map((g) => (
          <GameCard key={g.gamePk} game={g} />
        ))}
      </div>
    </div>
  );
}

function GameCard({ game }: { game: MlbGame }) {
  const status = game.status?.abstractGameState ?? "";
  const detail = game.status?.detailedState ?? "";
  const ls = game.linescore;
  const away = game.teams?.away;
  const home = game.teams?.home;

  const isLive = status === "Live";
  const isFinal = status === "Final";

  return (
    <Link
      to={`/game/${game.gamePk}`}
      className="card card-pad hover:bg-pitch-700 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-pitch-300/80">
          <span className="pill">
            {game.venue?.name ?? ""}
          </span>
          {game.seriesDescription && (
            <span className="pill bg-pitch-800/40">
              {game.seriesDescription}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <NotifyButton
            gamePk={game.gamePk}
            label={`${away?.team?.name ?? "Away"} @ ${home?.team?.name ?? "Home"}`}
          />
          <StatusBadge isLive={isLive} isFinal={isFinal} detail={detail} game={game} />
        </div>
      </div>

      <TeamRow team={away} score={away?.score} isWinner={isFinal && away?.isWinner} />
      <TeamRow team={home} score={home?.score} isWinner={isFinal && home?.isWinner} />

      <div className="mt-3 flex items-center justify-between text-xs text-pitch-300/80">
        <div>
          {status === "Preview" && game.gameDate
            ? fmtGameTime(game.gameDate)
            : ls?.inningState
            ? `${ls.inningState} ${ls.currentInningOrdinal ?? ""}`
            : detail}
        </div>
        <div className="flex items-center gap-2">
          {game.teams?.away?.probablePitcher && (
            <span title="Away SP" className="font-mono">
              {short(game.teams.away.probablePitcher.fullName)}
            </span>
          )}
          {game.teams?.home?.probablePitcher && (
            <>
              <span className="opacity-50">vs</span>
              <span title="Home SP" className="font-mono">
                {short(game.teams.home.probablePitcher.fullName)}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function short(name?: string) {
  if (!name) return "";
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
}

function StatusBadge({
  isLive, isFinal, detail, game,
}: {
  isLive: boolean; isFinal: boolean; detail?: string; game: MlbGame;
}) {
  if (isLive) {
    return (
      <span className="live-badge shrink-0">
        <span className="h-[5px] w-[5px] rounded-full bg-volt-500 animate-pulse shrink-0" />
        Live · {game.linescore?.currentInningOrdinal ?? ""}
      </span>
    );
  }
  if (isFinal) {
    return <span className="pill bg-white/5">{detail}</span>;
  }
  return <span className="pill">{detail ?? "Scheduled"}</span>;
}

type TeamSide = NonNullable<MlbGame["teams"]>["home"];

function TeamRow({
  team, score, isWinner,
}: {
  team: TeamSide; score?: number; isWinner?: boolean;
}) {
  const t = team?.team;
  if (!t) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <img
          src={teamLogoUrl(t.id ?? 0)}
          alt=""
          className="h-8 w-8 object-contain shrink-0"
          onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
        />
        <div className="min-w-0">
          <div className={cn("font-display font-bold text-[13px] tracking-[0.03em] uppercase truncate", isWinner ? "text-white" : "text-white/55")}>
            {t.name}
          </div>
          <div className="font-mono text-[9px] text-white/20">
            {team.leagueRecord ? `${team.leagueRecord.wins}-${team.leagueRecord.losses}` : ""}
          </div>
        </div>
      </div>
      <div className={cn("font-mono text-[22px] tabular-nums shrink-0", isWinner ? "text-white" : "text-white/35")}>
        {score ?? "—"}
      </div>
    </div>
  );
}
