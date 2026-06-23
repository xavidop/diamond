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

const ROUND_ORDER = [
  "Wild Card",
  "Wild Card Series",
  "Division Series",
  "League Championship Series",
  "World Series",
];

function roundIndex(desc: string) {
  for (let i = 0; i < ROUND_ORDER.length; i++) {
    if (desc.toLowerCase().includes(ROUND_ORDER[i].toLowerCase())) return i;
  }
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
          round: roundIndex(desc),
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

  const rounds = ROUND_ORDER.map((label, idx) => ({
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

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{
        display: "grid",
        gap: "3rem 4rem",
        gridTemplateColumns: `repeat(${rounds.length}, minmax(220px, 1fr))`,
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
  );
}

function SeriesCard({ series }: { series: Series }) {
  // Count wins for each team across the series games
  const homeWins = series.games.filter(
    (g) => g.teams?.home?.isWinner
  ).length;
  const awayWins = series.games.filter(
    (g) => g.teams?.away?.isWinner
  ).length;

  const last = series.games[series.games.length - 1];
  const home = last?.teams?.home?.team;
  const away = last?.teams?.away?.team;

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
          const aWon = g.teams?.away?.isWinner;
          const hWon = g.teams?.home?.isWinner;
          const hasScore =
            typeof aScore === "number" && typeof hScore === "number";
          const winnerColor = aWon
            ? "border-volt-500/60 text-white/70"
            : hWon
            ? "border-pitch-400/60 text-white/70"
            : "border-white/10 text-pitch-300/80";
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
                hasScore ? ` · ${aScore}-${hScore}` : ""
              }`}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border bg-pitch-900/40 hover:bg-white/10 ${winnerColor}`}
            >
              <span className="opacity-70">G{g.seriesGameNumber}</span>{" "}
              <span className="tabular-nums">{label}</span>
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
