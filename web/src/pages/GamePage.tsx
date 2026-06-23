import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import {
  Card,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import PitchZone from "../components/ui/PitchZone";
import SprayChart from "../components/ui/SprayChart";
import WinProbability from "../components/ui/WinProbability";
import GameInfo from "../components/ui/GameInfo";
import { useState } from "react";
import { cn } from "../lib/utils";

export default function GamePage() {
  const { gamePk } = useParams<{ gamePk: string }>();
  const id = gamePk!;

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

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <TeamBlock team={away} score={awayScore} />
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-pitch-300/70">
              {game?.status?.detailedState}
            </div>
            <div className="text-2xl font-bold">
              {linescore?.currentInningOrdinal ?? "—"}
            </div>
            <div className="text-xs text-pitch-300/70">
              {linescore?.inningState}
            </div>
            <div className="mt-2 flex items-center gap-3 justify-center text-xs text-pitch-300/80">
              <span>B {linescore?.balls ?? 0}</span>
              <span>S {linescore?.strikes ?? 0}</span>
              <span>O {linescore?.outs ?? 0}</span>
            </div>
          </div>
          <TeamBlock team={home} score={homeScore} align="right" />
        </div>
      </Card>

      <Linescore linescore={linescore} away={away} home={home} />
      <div>
        <SectionTitle title="Win Probability" subtitle="Home team WP%, with leverage in tooltip." />
        <WinProbability
          gamePk={id}
          plays={plays}
          awayName={away?.teamName}
          homeName={home?.teamName}
        />
      </div>
      <Boxscore box={box} />
      <GameInfo box={box} game={game} />
      <div>
        <SectionTitle title="Strike Zone" subtitle="All pitches plotted from the catcher's view." />
        <PitchZone gamePk={id} />
      </div>
      <div>
        <SectionTitle title="Spray Chart" subtitle="All batted balls plotted on the field." />
        <SprayChart gamePk={id} />
      </div>
      <PlayByPlay plays={plays} />
    </div>
  );
}

function TeamBlock({
  team,
  score,
  align = "left",
}: {
  team: any;
  score?: number;
  align?: "left" | "right";
}) {
  if (!team) return null;
  return (
    <Link
      to={`/teams/${team.id}`}
      className={cn(
        "flex items-center gap-3",
        align === "right" && "flex-row-reverse text-right"
      )}
    >
      <img
        src={teamLogoUrl(team.id)}
        alt=""
        className="h-16 w-16 object-contain"
      />
      <div>
        <div className="text-sm text-pitch-300/70">{team.locationName}</div>
        <div className="text-2xl font-bold">{team.teamName}</div>
        <div className="text-4xl font-extrabold tabular-nums">
          {score ?? "—"}
        </div>
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
  if (!plays?.length) return null;
  const recent = plays.slice(-25).reverse();
  return (
    <div>
      <SectionTitle title="Play-by-Play" subtitle="Most recent 25 plays" />
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
