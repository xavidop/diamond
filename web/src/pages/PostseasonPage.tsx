import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, teamLogoUrl } from "../api/mlb";
import {
  Card,
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { useSport } from "../contexts/SportContext";

type Game = {
  gamePk: number;
  seriesDescription?: string;
  seriesGameNumber?: number;
  gameType?: string;
  status?: any;
  teams?: any;
  gameDate?: string;
};

type Series = {
  description: string;
  round: number;
  games: Game[];
  homeId?: number;
  awayId?: number;
  key: string;
};

// Round is derived from the MLB gameType code (F/D/L/W), which is stable and
// language-independent. seriesDescription can't be trusted for this: the LCS
// comes back as "AL Championship Series" / "NL Championship Series", which does
// not contain "League Championship Series", so text matching dropped the whole
// round. (This mirrors the CLI's gameTypeOrder.)
const GAME_TYPE_ROUND: Record<string, number> = { F: 0, D: 1, L: 2, W: 3 };
const ROUND_LABELS = [
  "Wild Card",
  "Division Series",
  "Championship Series",
  "World Series",
];

function roundIndex(g: Game): number {
  const gt = g.gameType ?? "";
  if (gt in GAME_TYPE_ROUND) return GAME_TYPE_ROUND[gt];
  // Fallback to description text if gameType is ever absent.
  const d = (g.seriesDescription ?? "").toLowerCase();
  if (d.includes("world series")) return 3;
  if (d.includes("championship series")) return 2;
  if (d.includes("division series")) return 1;
  if (d.includes("wild card")) return 0;
  return -1;
}

export default function PostseasonPage() {
  const [params, setParams] = useSearchParams();
  const { sportId } = useSport();
  const season =
    params.get("season") ?? String(new Date().getFullYear() - 1);
  const setSeason = (s: string) => {
    const p = new URLSearchParams(params);
    p.set("season", s);
    setParams(p, { replace: true });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["postseason", season, sportId],
    queryFn: () => api.postseason(season, sportId),
  });

  const series = useMemo<Series[]>(() => {
    const dates = (data?.dates ?? []) as any[];
    const games: Game[] = dates.flatMap((d) => d.games ?? []);
    const byKey = new Map<string, Series>();
    for (const g of games) {
      const desc = g.seriesDescription ?? "Series";
      const homeId = g.teams?.home?.team?.id;
      const awayId = g.teams?.away?.team?.id;
      const key = `${desc}|${[homeId, awayId].sort().join("-")}`;
      let s = byKey.get(key);
      if (!s) {
        s = {
          description: desc,
          round: roundIndex(g),
          games: [],
          homeId,
          awayId,
          key,
        };
        byKey.set(key, s);
      }
      s.games.push(g);
    }
    return Array.from(byKey.values())
      .map((s) => ({
        ...s,
        games: s.games.sort(
          (a, b) => (a.seriesGameNumber ?? 0) - (b.seriesGameNumber ?? 0)
        ),
      }))
      .sort((a, b) => a.round - b.round);
  }, [data]);

  const rounds = ROUND_LABELS.map((label, idx) => ({
    label,
    items: series.filter((s) => s.round === idx),
  })).filter((r) => r.items.length);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Postseason Bracket"
        subtitle={`Series breakdown for ${season}.`}
        right={
          <input
            type="number"
            value={season}
            min={1903}
            max={new Date().getFullYear()}
            onChange={(e) => setSeason(e.target.value)}
            className="input w-28"
          />
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {error && <ErrorBox error={error} />}
      {!isLoading && !rounds.length && (
        <Empty message="No postseason data for this season." />
      )}

      {rounds.length > 0 && (
        <BracketGrid rounds={rounds} allSeries={series} />
      )}
    </div>
  );
}

function BracketGrid({
  rounds,
  allSeries,
}: {
  rounds: { label: string; items: Series[] }[];
  allSeries: Series[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [lines, setLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; winnerId?: number }[]
  >([]);
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });

  // Pairs: for each series in round n+1, find the round n series whose
  // matchup includes one of the next round's teams. That team is the one
  // that advanced — draw a line from that prior series to this one.
  const pairs = useMemo(() => {
    const out: { from: string; to: string; winnerId: number }[] = [];
    for (const s of allSeries) {
      const prevRound = s.round - 1;
      if (prevRound < 0) continue;
      const teamIds = [s.homeId, s.awayId].filter(Boolean) as number[];
      for (const tid of teamIds) {
        const prior = allSeries.find(
          (p) =>
            p.round === prevRound &&
            (p.homeId === tid || p.awayId === tid)
        );
        if (prior) {
          out.push({ from: prior.key, to: s.key, winnerId: tid });
        }
      }
    }
    return out;
  }, [allSeries]);

  useLayoutEffect(() => {
    function recompute() {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wrapBox = wrap.getBoundingClientRect();
      setWrapSize({ w: wrapBox.width, h: wrapBox.height });
      const next: typeof lines = [];
      for (const p of pairs) {
        const a = cardRefs.current.get(p.from);
        const b = cardRefs.current.get(p.to);
        if (!a || !b) continue;
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        next.push({
          x1: ar.right - wrapBox.left,
          y1: ar.top + ar.height / 2 - wrapBox.top,
          x2: br.left - wrapBox.left,
          y2: br.top + br.height / 2 - wrapBox.top,
          winnerId: p.winnerId,
        });
      }
      setLines(next);
    }
    recompute();
    // re-measure once async content (logos) settles
    const t1 = setTimeout(recompute, 200);
    const t2 = setTimeout(recompute, 700);
    const ro = new ResizeObserver(recompute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    for (const el of cardRefs.current.values()) ro.observe(el);
    window.addEventListener("resize", recompute);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [pairs, rounds]);

  const wrapW = wrapSize.w;
  const wrapH = wrapSize.h;

  // The bracket needs ~220px per round plus the column gap; on a narrow screen
  // that exceeds the viewport, so let it scroll horizontally instead of being
  // clipped. minWidth keeps the full multi-column width on mobile while the
  // 1fr tracks still stretch to fill wider screens.
  const minBracketWidth = rounds.length * 220 + (rounds.length - 1) * 64;
  return (
    <div className="overflow-x-auto pb-2">
    <div
      ref={wrapRef}
      className="relative"
      style={{
        display: "grid",
        gap: "3rem 4rem",
        gridTemplateColumns: `repeat(${rounds.length}, minmax(220px, 1fr))`,
        minWidth: minBracketWidth,
      }}
    >
      {rounds.map((r) => (
        <div key={r.label} className="space-y-3 flex flex-col">
          <div className="text-[10px] uppercase tracking-widest text-pitch-300/70 text-center">
            {r.label}
          </div>
          <div className="flex flex-col gap-6 flex-1 justify-around">
            {r.items.map((s) => (
              <div
                key={s.key}
                ref={(el) => {
                  if (el) cardRefs.current.set(s.key, el);
                  else cardRefs.current.delete(s.key);
                }}
              >
                <SeriesCard series={s} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {lines.length > 0 && wrapW > 0 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={wrapW}
          height={wrapH}
          style={{ overflow: "visible" }}
        >
          {lines.map((l, i) => {
            const midX = (l.x1 + l.x2) / 2;
            const d = `M ${l.x1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${l.x2} ${l.y2}`;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="rgba(239,68,68,0.55)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      )}
    </div>
    </div>
  );
}

function SeriesCard({ series }: { series: Series }) {
  const last = series.games[series.games.length - 1];
  const home = last?.teams?.home?.team;
  const away = last?.teams?.away?.team;

  // Count wins per team by comparing scores and attributing to the team id.
  // isWinner can't be used (the API flags the series winner on every game), and
  // tallying by home/away role is wrong because those roles alternate between
  // games in the DS/LCS/WS rounds. (Mirrors the CLI's getSeriesStats.)
  let homeWins = 0;
  let awayWins = 0;
  for (const g of series.games) {
    if (g.status?.abstractGameState !== "Final") continue;
    const as = g.teams?.away?.score;
    const hs = g.teams?.home?.score;
    if (typeof as !== "number" || typeof hs !== "number") continue;
    const winId = as > hs ? g.teams?.away?.team?.id : hs > as ? g.teams?.home?.team?.id : undefined;
    if (winId === home?.id) homeWins++;
    else if (winId === away?.id) awayWins++;
  }

  const homeWon = homeWins > awayWins;
  const awayWon = awayWins > homeWins;

  return (
    <Card pad={false}>
      <div className="px-3 py-2 space-y-1.5">
        <SeriesRow
          team={away}
          wins={awayWins}
          isWinner={awayWon}
          loser={homeWon}
        />
        <SeriesRow
          team={home}
          wins={homeWins}
          isWinner={homeWon}
          loser={awayWon}
        />
      </div>
      <div className="px-3 py-1.5 border-t border-white/5 flex flex-wrap gap-1">
        {series.games.map((g) => {
          const aScore = g.teams?.away?.score;
          const hScore = g.teams?.home?.score;
          const hasScore =
            typeof aScore === "number" && typeof hScore === "number";
          // Show the winning team's logo (it maps straight to a row above) so
          // "who won game N" reads at a glance — no color legend to decode.
          // Decide by score, not isWinner (which flags the series winner on
          // every game, not the per-game winner).
          const winner = hasScore
            ? aScore > hScore
              ? g.teams?.away?.team
              : hScore > aScore
              ? g.teams?.home?.team
              : null
            : null;
          const winAbbr = winner?.abbreviation ?? winner?.name;
          const label = hasScore
            ? `${Math.max(aScore, hScore)}-${Math.min(aScore, hScore)}`
            : g.status?.detailedState?.slice(0, 3) ?? "—";
          const date = g.gameDate
            ? new Date(g.gameDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : "";
          return (
            <Link
              key={g.gamePk}
              to={`/game/${g.gamePk}`}
              title={`Game ${g.seriesGameNumber}${date ? " · " + date : ""}${
                winAbbr ? ` · ${winAbbr} won ${label}` : hasScore ? ` · ${label}` : ""
              }`}
              className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-pitch-900/40 hover:bg-white/10 text-pitch-300/80"
            >
              <span className="opacity-60">G{g.seriesGameNumber}</span>
              {winner && (
                <img
                  src={teamLogoUrl(winner.id)}
                  alt={winAbbr}
                  title={`${winAbbr} won`}
                  className="h-3.5 w-3.5 object-contain shrink-0"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
              )}
              <span className="tabular-nums text-white/80">{label}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function SeriesRow({
  team,
  wins,
  isWinner,
  loser,
}: {
  team: any;
  wins: number;
  isWinner: boolean;
  loser: boolean;
}) {
  if (!team) return null;
  return (
    <div
      className={`flex items-center gap-2 ${
        loser ? "opacity-50" : ""
      }`}
    >
      <img
        src={teamLogoUrl(team.id)}
        alt=""
        className="h-6 w-6 object-contain"
      />
      <Link
        to={`/teams/${team.id}`}
        className={`flex-1 truncate text-sm ${
          isWinner ? "font-semibold" : ""
        } hover:underline`}
      >
        {team.abbreviation ?? team.name}
      </Link>
      <span
        className={`font-mono text-sm tabular-nums ${
          isWinner ? "text-volt-300" : "text-pitch-300/70"
        }`}
      >
        {wins}
      </span>
    </div>
  );
}
