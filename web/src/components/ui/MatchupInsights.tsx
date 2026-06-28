import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, teamLogoUrl } from "../../api/mlb";
import { Card, SectionTitle, Spinner } from "./Primitives";
import { cn, fmtDate, shiftDate, todayIso } from "../../lib/utils";

/* ── shared helpers ─────────────────────────────────────────── */

type GameRow = {
  gamePk: number;
  date: string;
  win: boolean;
  runsFor: number;
  runsAgainst: number;
  oppAbbr: string;
};

function finalGames(data: any): any[] {
  return ((data?.dates ?? []) as any[])
    .flatMap((d) => d.games ?? [])
    .filter((g) => g?.status?.abstractGameState === "Final")
    .sort((a, b) => String(a.gameDate ?? "").localeCompare(String(b.gameDate ?? "")));
}

function resultsForTeam(data: any, teamId: number): GameRow[] {
  return finalGames(data).map((g) => {
    const isHome = g.teams?.home?.team?.id === teamId;
    const me = isHome ? g.teams.home : g.teams.away;
    const opp = isHome ? g.teams.away : g.teams.home;
    return {
      gamePk: g.gamePk,
      date: g.gameDate,
      win: !!me?.isWinner,
      runsFor: me?.score ?? 0,
      runsAgainst: opp?.score ?? 0,
      oppAbbr: opp?.team?.abbreviation ?? "",
    };
  });
}

/* ── Head-to-Head: season series + recent meetings ──────────── */

export function HeadToHead({
  awayId,
  homeId,
  awayName,
  homeName,
  season,
  endDate,
  currentGamePk,
}: {
  awayId?: number;
  homeId?: number;
  awayName?: string;
  homeName?: string;
  season?: string | number;
  endDate?: string;
  currentGamePk?: number;
}) {
  const yr = String(season ?? new Date().getFullYear());
  const q = useQuery({
    queryKey: ["head-to-head", awayId, homeId, yr],
    enabled: !!awayId && !!homeId,
    queryFn: () =>
      api.schedule({
        teamId: awayId,
        opponentId: homeId,
        startDate: `${yr}-01-01`,
        endDate: endDate ?? todayIso(),
        gameType: "R",
      }),
  });

  // Exclude the game being viewed so this reads as "the series leading up to
  // this matchup", not a list that includes the current game itself.
  const games = finalGames(q.data)
    .filter((g) => g.gamePk !== currentGamePk)
    .reverse(); // most recent first
  let awayWins = 0;
  let homeWins = 0;
  for (const g of games) {
    const winnerId = g.teams?.home?.isWinner
      ? g.teams?.home?.team?.id
      : g.teams?.away?.team?.id;
    if (winnerId === awayId) awayWins++;
    else if (winnerId === homeId) homeWins++;
  }

  const seriesLine =
    awayWins === homeWins
      ? `Series tied ${awayWins}–${homeWins}`
      : awayWins > homeWins
      ? `${awayName} lead the series ${awayWins}–${homeWins}`
      : `${homeName} lead the series ${homeWins}–${awayWins}`;

  return (
    <div>
      <SectionTitle title="Head-to-Head" subtitle="Season series & recent meetings" />
      <Card pad={false}>
        {q.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : games.length === 0 ? (
          <div className="px-4 py-6 text-sm text-pitch-300">
            No completed meetings this season yet.
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 px-4 py-3 border-b border-white/5">
              <span className="font-display font-bold text-sm uppercase tracking-wide text-white">
                {seriesLine}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-pitch-300">
                {games.length} game{games.length === 1 ? "" : "s"} · {yr}
              </span>
            </div>
            <ul className="divide-y divide-white/5">
              {games.slice(0, 5).map((g) => {
                const a = g.teams?.away;
                const h = g.teams?.home;
                return (
                  <li key={g.gamePk}>
                    <Link
                      to={`/game/${g.gamePk}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5"
                    >
                      <span className="w-14 shrink-0 text-[11px] tabular-nums text-pitch-300">
                        {fmtDate(g.gameDate, { month: "short", day: "numeric" })}
                      </span>
                      <div className="flex flex-1 items-center justify-center gap-2 font-mono tabular-nums">
                        <span className="w-10 text-right text-[11px] font-display font-bold uppercase tracking-wide text-pitch-300">
                          {a?.team?.abbreviation}
                        </span>
                        <span className={cn("text-sm", a?.isWinner ? "font-bold text-white" : "text-pitch-300")}>
                          {a?.score}
                        </span>
                        <span className="text-pitch-300">–</span>
                        <span className={cn("text-sm", h?.isWinner ? "font-bold text-white" : "text-pitch-300")}>
                          {h?.score}
                        </span>
                        <span className="w-10 text-left text-[11px] font-display font-bold uppercase tracking-wide text-pitch-300">
                          {h?.team?.abbreviation}
                        </span>
                      </div>
                      <span className="w-14 shrink-0 text-right text-[11px] font-display font-bold uppercase tracking-wide text-pitch-300">
                        {a?.isWinner ? a?.team?.abbreviation : h?.team?.abbreviation} W
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

/* ── Last 10 Games: recent form per team ────────────────────── */

function TeamForm({
  teamId,
  teamName,
  endDate,
  currentGamePk,
}: {
  teamId?: number;
  teamName?: string;
  endDate?: string;
  currentGamePk?: number;
}) {
  const end = endDate ?? todayIso();
  const q = useQuery({
    queryKey: ["team-last10", teamId, end],
    enabled: !!teamId,
    queryFn: () =>
      api.schedule({
        teamId,
        startDate: shiftDate(end, -50),
        endDate: end,
        gameType: "R",
      }),
  });

  const rows = resultsForTeam(q.data, teamId!)
    .filter((r) => r.gamePk !== currentGamePk)
    .slice(-10);
  const wins = rows.filter((r) => r.win).length;
  const losses = rows.length - wins;
  const n = rows.length || 1;
  const rf = rows.reduce((s, r) => s + r.runsFor, 0) / n;
  const ra = rows.reduce((s, r) => s + r.runsAgainst, 0) / n;
  const diff = rf - ra;

  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <img src={teamLogoUrl(teamId!)} alt="" className="h-6 w-6 object-contain" />
        <span className="flex-1 truncate font-display font-bold text-sm uppercase tracking-wide text-white">
          {teamName}
        </span>
        <span className="font-mono text-sm tabular-nums text-white">
          {wins}-{losses}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-pitch-300">last {rows.length}</span>
      </div>

      {q.isLoading ? (
        <div className="flex items-center py-4">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-4 text-xs text-pitch-300">No recent games.</div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1" title="Oldest → most recent">
            {rows.map((r) => (
              <span
                key={r.gamePk}
                title={`${r.win ? "W" : "L"} ${r.runsFor}-${r.runsAgainst} vs ${r.oppAbbr} · ${fmtDate(r.date, { month: "short", day: "numeric" })}`}
                className={cn(
                  "h-5 w-5 rounded-sm",
                  r.win ? "bg-green-500/80" : "bg-red-500/70"
                )}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 font-mono text-[11px] tabular-nums text-pitch-300">
            <span>RF <span className="text-white">{rf.toFixed(1)}</span>/g</span>
            <span>RA <span className="text-white">{ra.toFixed(1)}</span>/g</span>
            <span>
              DIFF{" "}
              <span className={cn(diff >= 0 ? "text-green-500" : "text-red-500")}>
                {diff >= 0 ? "+" : ""}
                {diff.toFixed(1)}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function RecentForm({
  awayId,
  homeId,
  awayName,
  homeName,
  endDate,
  currentGamePk,
}: {
  awayId?: number;
  homeId?: number;
  awayName?: string;
  homeName?: string;
  endDate?: string;
  currentGamePk?: number;
}) {
  return (
    <div>
      <SectionTitle title="Last 10 Games" subtitle="Recent form going into this matchup" />
      <Card pad={false}>
        <div className="grid divide-y divide-white/5 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <TeamForm teamId={awayId} teamName={awayName} endDate={endDate} currentGamePk={currentGamePk} />
          <TeamForm teamId={homeId} teamName={homeName} endDate={endDate} currentGamePk={currentGamePk} />
        </div>
      </Card>
    </div>
  );
}
