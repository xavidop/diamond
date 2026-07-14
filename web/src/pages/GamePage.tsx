import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Tv } from "lucide-react";
import { api, playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import {
  Card,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { useMiniViewer } from "../contexts/MiniViewerContext";
import PitchZone from "../components/ui/PitchZone";
import SprayChart from "../components/ui/SprayChart";
import WinProbability from "../components/ui/WinProbability";
import GameInfo from "../components/ui/GameInfo";
import { HeadToHead, RecentForm } from "../components/ui/MatchupInsights";
import GameStatcast from "../components/ui/GameStatcast";
import Highlights from "../components/ui/Highlights";
import NotifyButton from "../components/ui/NotifyButton";
import { Fragment, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";

export default function GamePage() {
  const { gamePk } = useParams<{ gamePk: string }>();
  const id = gamePk!;
  const { openMini } = useMiniViewer();

  const live = useQuery({
    queryKey: ["game-live", id],
    queryFn: () => api.game(id),
    refetchInterval: 20_000,
  });

  if (live.isLoading)
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  if (live.error) return <ErrorBox error={live.error} />;

  const feed = live.data as any;
  const game = feed?.gameData;
  const liveData = feed?.liveData;
  const box = liveData?.boxscore;
  const linescore = liveData?.linescore;
  const plays = liveData?.plays?.allPlays ?? [];

  const away = game?.teams?.away;
  const home = game?.teams?.home;

  const awayScore = linescore?.teams?.away?.runs;
  const homeScore = linescore?.teams?.home?.runs;
  const isLive = game?.status?.abstractGameState === "Live";
  const isFinal = game?.status?.abstractGameState === "Final";

  const sections: Record<string, ReactNode> = {
    linescore: <Linescore linescore={linescore} away={away} home={home} />,
    boxscore: <Boxscore box={box} />,
    highlights: <Highlights gamePk={id} />,
    playByPlay: <PlayByPlay plays={plays} />,
    winProb: (
      <div>
        <SectionTitle title="Win Probability" subtitle="Home team WP%, with leverage in tooltip." />
        <WinProbability
          gamePk={id}
          plays={plays}
          awayName={away?.teamName}
          homeName={home?.teamName}
        />
      </div>
    ),
    strikeZone: (
      <div>
        <SectionTitle title="Strike Zone" subtitle="All pitches plotted from the catcher's view." />
        <PitchZone gamePk={id} />
      </div>
    ),
    sprayChart: (
      <div>
        <SectionTitle title="Spray Chart" subtitle="All batted balls plotted on the field." />
        <SprayChart gamePk={id} />
      </div>
    ),
    statcast: <GameStatcast feed={feed} />,
    headToHead: (
      <HeadToHead
        awayId={away?.id}
        homeId={home?.id}
        awayName={away?.teamName}
        homeName={home?.teamName}
        season={game?.game?.season}
        endDate={game?.datetime?.officialDate}
        currentGamePk={Number(id)}
      />
    ),
    recentForm: (
      <RecentForm
        awayId={away?.id}
        homeId={home?.id}
        awayName={away?.teamName}
        homeName={home?.teamName}
        endDate={game?.datetime?.officialDate}
        currentGamePk={Number(id)}
      />
    ),
    gameInfo: <GameInfo box={box} game={game} />,
  };

  // Order sections by what matters most for the game's current state:
  //  - finished → results (boxscore, highlights, recap)
  //  - live → live game flow (linescore, win prob, play-by-play)
  //  - upcoming → only the pre-game matchup; the rest has no data yet, so skip it
  const order = isFinal
    ? ["linescore", "boxscore", "highlights", "playByPlay", "winProb", "strikeZone", "sprayChart", "statcast", "headToHead", "recentForm", "gameInfo"]
    : isLive
    ? ["linescore", "winProb", "playByPlay", "boxscore", "headToHead", "recentForm", "strikeZone", "sprayChart", "statcast", "highlights", "gameInfo"]
    : ["headToHead", "recentForm", "gameInfo"];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <TeamBlock team={away} score={awayScore} />

          <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-4 text-center md:border-0 md:pt-0">
            <div className="flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-pitch-300/70">
              {isLive && (
                <span className="h-[5px] w-[5px] shrink-0 animate-pulse rounded-full bg-volt-500 motion-reduce:animate-none" />
              )}
              {game?.status?.detailedState ?? "—"}
            </div>
            <div className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
              {linescore?.inningState ? `${linescore.inningState} ` : ""}
              {linescore?.currentInningOrdinal ?? "—"}
            </div>
            <div className="flex items-center justify-center gap-3 font-mono text-xs tabular-nums text-pitch-300/80">
              <span>B {linescore?.balls ?? 0}</span>
              <span>S {linescore?.strikes ?? 0}</span>
              <span>O {linescore?.outs ?? 0}</span>
            </div>
            <NotifyButton
              variant="button"
              className="mt-1"
              gamePk={Number(id)}
              label={`${away?.teamName ?? "Away"} @ ${home?.teamName ?? "Home"}`}
            />
          </div>

          <TeamBlock
            team={home}
            score={homeScore}
            align="right"
            className="border-t border-white/10 pt-4 md:border-0 md:pt-0"
          />

          <button
            onClick={() => openMini(Number(id))}
            className="btn btn-accent hidden lg:inline-flex"
            title="Open this game in the mini viewer"
          >
            <Tv size={14} /> Pop out
          </button>
        </div>
      </Card>

      {order.map((k) => (
        <Fragment key={k}>{sections[k]}</Fragment>
      ))}
    </div>
  );
}

function TeamBlock({
  team,
  score,
  align = "left",
  className,
}: {
  team: any;
  score?: number;
  align?: "left" | "right";
  className?: string;
}) {
  if (!team) return null;
  return (
    <Link
      to={`/teams/${team.id}`}
      className={cn(
        // Mobile: full-width row — logo + name pinned left, score pinned right.
        // Desktop: a shrink-to-fit column block (home side mirrored to the right).
        "group flex w-full items-center gap-3 md:w-auto",
        align === "right" && "md:flex-row-reverse md:text-right",
        className
      )}
    >
      <img
        src={teamLogoUrl(team.id)}
        alt=""
        className="h-14 w-14 shrink-0 object-contain motion-safe:transition-transform motion-safe:group-hover:scale-105 md:h-16 md:w-16"
      />
      <div className="min-w-0 flex-1 md:flex-none">
        <div className="text-xs uppercase tracking-wider text-pitch-300/70">
          {team.locationName}
        </div>
        <div className="truncate font-display text-3xl font-bold uppercase leading-none tracking-tight md:text-4xl">
          {team.teamName}
        </div>
        {/* Desktop: score sits in the column under the name. */}
        <div className="mt-1.5 hidden font-display text-5xl font-black tabular-nums leading-none md:block">
          {score ?? "—"}
        </div>
      </div>
      {/* Mobile: score is the right-hand anchor of the row. */}
      <div className="shrink-0 font-display text-5xl font-black tabular-nums leading-none md:hidden">
        {score ?? "—"}
      </div>
    </Link>
  );
}

function Linescore({
  linescore,
  away,
  home,
}: {
  linescore: any;
  away: any;
  home: any;
}) {
  if (!linescore) return null;
  const innings = linescore.innings ?? [];
  return (
    <Card pad={false}>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th></th>
              {innings.map((i: any) => (
                <th key={i.num} className="text-center w-8">
                  {i.num}
                </th>
              ))}
              <th className="text-center w-10">R</th>
              <th className="text-center w-10">H</th>
              <th className="text-center w-10">E</th>
            </tr>
          </thead>
          <tbody>
            <LinescoreRow
              name={away?.teamName}
              innings={innings.map((i: any) => i.away?.runs)}
              totals={linescore.teams?.away}
            />
            <LinescoreRow
              name={home?.teamName}
              innings={innings.map((i: any) => i.home?.runs)}
              totals={linescore.teams?.home}
            />
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LinescoreRow({
  name,
  innings,
  totals,
}: {
  name?: string;
  innings: any[];
  totals: any;
}) {
  return (
    <tr>
      <td className="font-semibold whitespace-nowrap">{name}</td>
      {innings.map((r, idx) => (
        <td key={idx} className="text-center tabular-nums">
          {r ?? "—"}
        </td>
      ))}
      <td className="text-center font-bold tabular-nums">
        {totals?.runs ?? 0}
      </td>
      <td className="text-center tabular-nums">{totals?.hits ?? 0}</td>
      <td className="text-center tabular-nums">{totals?.errors ?? 0}</td>
    </tr>
  );
}

function Boxscore({ box }: { box: any }) {
  const [side, setSide] = useState<"away" | "home">("away");
  if (!box) return null;
  const team = box.teams?.[side];
  if (!team) return null;

  const batters = (team.batters ?? [])
    .map((id: number) => team.players?.[`ID${id}`])
    .filter(Boolean);
  const pitchers = (team.pitchers ?? [])
    .map((id: number) => team.players?.[`ID${id}`])
    .filter(Boolean);

  return (
    <div>
      <SectionTitle
        title="Boxscore"
        right={
          <div className="flex gap-1">
            {(["away", "home"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={cn(
                  "btn",
                  side === s && "btn-primary"
                )}
              >
                {box.teams?.[s]?.team?.name}
              </button>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card pad={false}>
          <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
            Batters
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Player</th>
                  {["ab", "r", "h", "rbi", "bb", "so", "avg"].map((k) => (
                    <th key={k} className="text-right uppercase">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batters.map((p: any) => {
                  const s = p.stats?.batting ?? {};
                  const season = p.seasonStats?.batting ?? {};
                  return (
                    <tr key={p.person.id}>
                      <td className="truncate max-w-[180px]">
                        <Link
                          to={`/players/${p.person.id}`}
                          className="flex items-center gap-2 hover:text-white"
                        >
                          <img
                            src={playerHeadshotUrl(p.person.id, 60)}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover bg-pitch-800"
                          />
                          <span className="truncate">
                            {p.person.fullName}
                          </span>
                          <span className="text-[10px] text-pitch-300/60">
                            {p.position?.abbreviation}
                          </span>
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{s.atBats ?? 0}</td>
                      <td className="text-right tabular-nums">{s.runs ?? 0}</td>
                      <td className="text-right tabular-nums">{s.hits ?? 0}</td>
                      <td className="text-right tabular-nums">{s.rbi ?? 0}</td>
                      <td className="text-right tabular-nums">{s.baseOnBalls ?? 0}</td>
                      <td className="text-right tabular-nums">{s.strikeOuts ?? 0}</td>
                      <td className="text-right tabular-nums">{season.avg ?? ".000"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card pad={false}>
          <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
            Pitchers
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Player</th>
                  {["ip", "h", "r", "er", "bb", "so", "era"].map((k) => (
                    <th key={k} className="text-right uppercase">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pitchers.map((p: any) => {
                  const s = p.stats?.pitching ?? {};
                  const season = p.seasonStats?.pitching ?? {};
                  return (
                    <tr key={p.person.id}>
                      <td className="truncate max-w-[180px]">
                        <Link
                          to={`/players/${p.person.id}`}
                          className="flex items-center gap-2 hover:text-white"
                        >
                          <img
                            src={playerHeadshotUrl(p.person.id, 60)}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover bg-pitch-800"
                          />
                          <span className="truncate">
                            {p.person.fullName}
                          </span>
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{s.inningsPitched ?? "0.0"}</td>
                      <td className="text-right tabular-nums">{s.hits ?? 0}</td>
                      <td className="text-right tabular-nums">{s.runs ?? 0}</td>
                      <td className="text-right tabular-nums">{s.earnedRuns ?? 0}</td>
                      <td className="text-right tabular-nums">{s.baseOnBalls ?? 0}</td>
                      <td className="text-right tabular-nums">{s.strikeOuts ?? 0}</td>
                      <td className="text-right tabular-nums">{season.era ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PlayByPlay({ plays }: { plays: any[] }) {
  const [inning, setInning] = useState<number | "all">("all");
  if (!plays?.length) return null;
  const innings = Array.from(
    new Set(plays.map((p) => p.about?.inning).filter((n): n is number => !!n))
  ).sort((a, b) => a - b);
  const recent =
    inning === "all"
      ? plays.slice(-25).reverse()
      : plays.filter((p) => p.about?.inning === inning).reverse();
  return (
    <div>
      <SectionTitle
        title="Play-by-Play"
        subtitle={inning === "all" ? "Most recent 25 plays" : `Inning ${inning}`}
      />
      <div className="mb-2 flex flex-wrap gap-1">
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
      <Card pad={false}>
        <ul className="divide-y divide-white/5">
          {recent.map((p, i) => (
            <li key={i} className="px-4 py-3 flex items-start gap-3">
              <span className="pill shrink-0">
                {p.about?.halfInning === "top" ? "▲" : "▼"}{" "}
                {p.about?.inning}
              </span>
              <div className="flex-1">
                <div className="text-sm">{p.result?.description ?? "—"}</div>
                {p.result?.event && (
                  <div className="mt-0.5 text-xs text-pitch-300/70">
                    {p.result.event} · {p.result.awayScore}-{p.result.homeScore}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
