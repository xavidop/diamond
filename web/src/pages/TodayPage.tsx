import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Star, Flame, CalendarDays, Trophy, Pin as PinIcon, X } from "lucide-react";
import { api, playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import {
  Card,
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { cn, fmtTime, todayIso } from "../lib/utils";
import { useSport } from "../contexts/SportContext";
import { useFavorites } from "../contexts/FavoritesContext";
import { usePins } from "../contexts/PinsContext";
import ProbablePitchers from "../components/ui/ProbablePitchers";
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
    };
    away?: {
      team?: { id?: number; name?: string };
      score?: number;
      isWinner?: boolean;
      leagueRecord?: { wins?: number; losses?: number };
    };
  };
  linescore?: { currentInningOrdinal?: string };
  gameDate?: string;
  venue?: { name?: string };
};

type MlbLeader = {
  rank?: number;
  value?: string | number;
  person?: { id?: number; fullName?: string };
  team?: { id?: number; name?: string };
};

export default function TodayPage() {
  const date = todayIso();
  const { sportId, sport } = useSport();
  const { favs } = useFavorites();
  const { pins, remove } = usePins();

  const schedule = useQuery({
    queryKey: ["schedule", sportId, date],
    queryFn: () => api.schedule({ date, sportId }),
    refetchInterval: 30_000,
  });
  const hrLeaders = useQuery({
    queryKey: ["leaders", sportId, "homeRuns"],
    queryFn: () =>
      api.statsLeaders({ leaderCategories: "homeRuns", statGroup: "hitting", sportId, limit: 5 }),
  });
  const eraLeaders = useQuery({
    queryKey: ["leaders", sportId, "earnedRunAverage"],
    queryFn: () =>
      api.statsLeaders({ leaderCategories: "earnedRunAverage", statGroup: "pitching", sportId, limit: 5 }),
  });

  const games = (schedule.data?.dates?.[0]?.games ?? []) as MlbGame[];
  const live     = games.filter((g) => g.status?.abstractGameState === "Live");
  const final    = games.filter((g) => g.status?.abstractGameState === "Final");
  const upcoming = games.filter((g) => g.status?.abstractGameState === "Preview");

  const favTeams   = favs.filter((f) => f.kind === "team");
  const favPlayers = favs.filter((f) => f.kind === "player");

  const favGames = games.filter((g) =>
    favTeams.some(
      (f) => f.id === g.teams?.home?.team?.id || f.id === g.teams?.away?.team?.id
    )
  );

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-8">
      <SectionTitle title={`Today · ${sport.abbreviation}`} subtitle={dateLabel} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Live now"  value={live.length}     accent icon={<Flame size={12} />} />
        <StatBox label="Final"     value={final.length}          icon={<Trophy size={12} />} />
        <StatBox label="Upcoming"  value={upcoming.length}       icon={<CalendarDays size={12} />} />
        <StatBox label="Favorites" value={favs.length}           icon={<Star size={12} />} />
      </div>

      {favGames.length > 0 && (
        <Section title="Your teams today">
          <GameList games={favGames} />
        </Section>
      )}

      {pins.length > 0 && (
        <Section title="Pinned">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pins.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start gap-2">
                  <PinIcon size={13} className="text-volt-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-[9px] tracking-[0.2em] uppercase text-white/30">
                      {p.type}
                    </div>
                    <Link
                      to={`/${p.type}${p.params}`}
                      className="font-display font-bold text-sm uppercase tracking-wide truncate hover:text-volt-500 block"
                    >
                      {p.title}
                    </Link>
                  </div>
                  <button
                    onClick={() => remove(p.id)}
                    className="text-white/30 hover:text-white shrink-0"
                    title="Remove pin"
                  >
                    <X size={13} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {live.length > 0 && (
        <Section title="Live games">
          <GameList games={live} />
        </Section>
      )}

      <Section title="Schedule today">
        {schedule.isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : schedule.error ? (
          <ErrorBox error={schedule.error} />
        ) : games.length === 0 ? (
          <Empty message="No games today." />
        ) : (
          <GameList games={[...upcoming, ...final].slice(0, 12)} />
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeadersCard title="HR Leaders" q={hrLeaders} statLabel="HR" />
        <LeadersCard title="ERA Leaders" q={eraLeaders} statLabel="ERA" />
      </div>

      <Section title="Probable pitchers · next 3 days">
        <ProbablePitchers days={3} />
      </Section>

      {favPlayers.length > 0 && (
        <Section title="Favorite players">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {favPlayers.map((p) => (
              <Link
                key={p.id}
                to={`/players/${p.id}`}
                className="card card-pad flex items-center gap-3 hover:bg-pitch-700 transition-colors"
              >
                <img
                  src={playerHeadshotUrl(p.id, 90)}
                  alt=""
                  className="h-10 w-10 rounded-xl object-cover object-top bg-pitch-700 shrink-0"
                  onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                />
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm uppercase tracking-wide truncate">
                    {p.name}
                  </div>
                  <div className="font-display font-bold text-[9px] tracking-widest uppercase text-white/25">
                    Player
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function StatBox({
  label, value, accent, icon,
}: {
  label: string; value: number; accent?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-1.5 font-display font-bold text-[9px] tracking-widest uppercase text-white/30 mb-2">
        {icon}
        {label}
      </div>
      <div className={cn("stat-val", accent ? "text-volt-500" : "text-white")}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 font-display font-bold text-[9px] tracking-[0.22em] uppercase text-white/25">
        {title}
      </div>
      {children}
    </div>
  );
}

function GameList({ games }: { games: MlbGame[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {games.map((g) => (
        <GameCard key={g.gamePk} game={g} />
      ))}
    </div>
  );
}

function GameCard({ game }: { game: MlbGame }) {
  const status     = game.status?.abstractGameState ?? "";
  const detail     = game.status?.detailedState ?? "";
  const away       = game.teams?.away;
  const home       = game.teams?.home;
  const isLive     = status === "Live";
  const isFinal    = status === "Final";
  const awayScore  = away?.score;
  const homeScore  = home?.score;

  return (
    <Link
      to={`/game/${game.gamePk}`}
      className={cn(
        "card card-pad hover:bg-pitch-700 transition-colors",
        isLive && "border-volt-500/20 bg-gradient-to-br from-volt-500/[0.04] to-pitch-800"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-display font-bold text-[9px] tracking-[0.12em] uppercase text-white/20 truncate mr-2">
          {game.venue?.name ?? ""}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isLive ? (
            <span className="live-badge">
              <span className="w-[5px] h-[5px] rounded-full bg-volt-500 animate-pulse shrink-0" />
              {game.linescore?.currentInningOrdinal ?? "Live"}
            </span>
          ) : (
            <span className="font-display font-bold text-[9px] tracking-wider uppercase text-white/20">
              {detail}
            </span>
          )}
          <NotifyButton
            gamePk={game.gamePk}
            label={`${away?.team?.name ?? "Away"} @ ${home?.team?.name ?? "Home"}`}
          />
        </div>
      </div>

      {(["away", "home"] as const).map((side) => {
        const t         = game.teams?.[side];
        const score     = side === "away" ? awayScore : homeScore;
        const oppScore  = side === "away" ? homeScore : awayScore;
        const isWinner  = isFinal && t?.isWinner;
        const isLeading = isLive && score !== undefined && oppScore !== undefined && score > oppScore;

        return (
          <div key={side} className="flex items-center gap-2.5 py-1.5">
            <img
              src={teamLogoUrl(t?.team?.id ?? 0)}
              alt=""
              className="w-7 h-7 object-contain shrink-0"
              onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
            />
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-display font-bold text-[13px] tracking-[0.03em] uppercase truncate",
                isWinner ? "text-white" : "text-white/50"
              )}>
                {t?.team?.name}
              </div>
              {t?.leagueRecord && (
                <div className="font-mono text-[9px] text-white/20">
                  {t.leagueRecord.wins}-{t.leagueRecord.losses}
                </div>
              )}
            </div>
            <div className={cn(
              "font-mono text-[22px] leading-none shrink-0 tabular-nums",
              isLeading ? "text-volt-500"
              : isWinner ? "text-white"
              : isFinal  ? "text-white/30"
              : "text-white/50"
            )}>
              {score !== undefined
                ? score
                : status === "Preview"
                ? fmtTime(game.gameDate ?? "")
                : "—"}
            </div>
          </div>
        );
      })}
    </Link>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeadersCard({
  title, q, statLabel,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  title: string; q: ReturnType<typeof useQuery<any>>; statLabel: string;
}) {
  const leaders = (q.data?.leagueLeaders?.[0]?.leaders ?? []) as MlbLeader[];
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="font-display font-bold text-[11px] tracking-[0.12em] uppercase text-white">
          {title}
        </span>
        <Link to="/leaders" className="font-display font-bold text-[9px] tracking-widest uppercase text-volt-500/70 hover:text-volt-500">
          See all →
        </Link>
      </div>
      {q.isLoading ? (
        <div className="p-4 flex justify-center"><Spinner /></div>
      ) : (
        <ul>
          {leaders.map((l) => (
            <li key={l.person?.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-pitch-700/50 transition-colors">
              <span className="font-mono text-[10px] text-white/20 w-4 text-center shrink-0">
                {l.rank}
              </span>
              <img
                src={playerHeadshotUrl(l.person?.id ?? 0, 60)}
                alt=""
                className="h-7 w-7 rounded-full object-cover object-top bg-pitch-700 shrink-0"
                onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
              />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/players/${l.person?.id}`}
                  className="font-display font-bold text-[12px] tracking-[0.03em] uppercase truncate hover:text-volt-500 block"
                >
                  {l.person?.fullName}
                </Link>
                {l.team && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <img
                      src={teamLogoUrl(l.team.id ?? 0)}
                      alt=""
                      className="h-3 w-3 object-contain shrink-0"
                      onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                    />
                    <span className="font-display font-bold text-[8px] tracking-[0.15em] uppercase text-white/25 truncate">
                      {l.team.name}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-base text-volt-500 tabular-nums leading-none">
                  {l.value}
                </div>
                <div className="font-display font-bold text-[8px] tracking-widest uppercase text-white/20">
                  {statLabel}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
