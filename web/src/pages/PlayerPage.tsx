import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import {
  Card,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import FavButton from "../components/ui/FavButton";
import VsPlayer from "../components/ui/VsPlayer";
import Splits from "../components/ui/Splits";
import GameLog from "../components/ui/GameLog";
import PitchArsenal from "../components/ui/PitchArsenal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type MlbPerson = {
  id: number;
  fullName: string;
  primaryPosition?: { code?: string; name?: string };
  primaryNumber?: string;
  currentTeam?: { id?: number; name?: string };
  batSide?: { code?: string };
  pitchHand?: { code?: string };
  height?: string;
  weight?: number;
  birthDate?: string;
  birthCity?: string;
  birthStateProvince?: string;
  birthCountry?: string;
  stats?: MlbStatGroup[];
};

type MlbStatGroup = {
  type?: { displayName?: string };
  group?: { displayName?: string };
  splits?: MlbStatSplit[];
};

type MlbStatSplit = {
  season?: string;
  team?: { id?: number; name?: string };
  stat?: Record<string, string | number | undefined>;
};

export default function PlayerPage() {
  const { personId } = useParams<{ personId: string }>();
  const id = personId!;

  const { data, isLoading, error } = useQuery({
    queryKey: ["person", id],
    queryFn: () => api.person(id),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  if (error) return <ErrorBox error={error} />;
  const p = data?.people?.[0] as MlbPerson | undefined;
  if (!p) return null;

  const allStats = (p.stats ?? []) as MlbStatGroup[];
  const yearByYearHitting = allStats.find(
    (s) =>
      s.type?.displayName === "yearByYear" &&
      s.group?.displayName === "hitting"
  );
  const yearByYearPitching = allStats.find(
    (s) =>
      s.type?.displayName === "yearByYear" &&
      s.group?.displayName === "pitching"
  );
  const careerHitting = allStats.find(
    (s) =>
      s.type?.displayName === "career" && s.group?.displayName === "hitting"
  );
  const careerPitching = allStats.find(
    (s) =>
      s.type?.displayName === "career" && s.group?.displayName === "pitching"
  );

  const isPitcher = p.primaryPosition?.code === "1";

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Headshot + jersey badge */}
          {/* Mobile: full headshot centered on the dark panel (w-auto + contain
              so the face is always visible, not cropped to the cap). Desktop:
              a narrow cover strip beside the info column. */}
          <div className="relative shrink-0 h-[210px] sm:h-auto sm:w-[140px] bg-pitch-900 flex items-center justify-center overflow-hidden">
            <img
              src={playerHeadshotUrl(p.id, 426)}
              alt={p.fullName}
              className="h-full w-auto object-contain sm:w-full sm:object-cover sm:object-top"
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
            />
            {p.primaryNumber && (
              <span className="absolute bottom-2 right-2 bg-volt-500 text-black font-display font-black text-[11px] leading-none px-1.5 py-0.5 rounded">
                #{p.primaryNumber}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-5 flex flex-col justify-between gap-3">
            <div>
              <div className="page-eyebrow mb-1">{p.primaryPosition?.name ?? "Player"}</div>
              <div className="flex items-start gap-2">
                <h1 className="font-display font-black text-3xl sm:text-4xl uppercase leading-none text-white tracking-tight">
                  {p.fullName}
                </h1>
                <FavButton
                  fav={{ kind: "player", id: p.id, name: p.fullName, teamId: p.currentTeam?.id }}
                  size={20}
                />
              </div>
              {p.currentTeam && (
                <Link
                  to={`/teams/${p.currentTeam.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors"
                >
                  <img
                    src={teamLogoUrl(p.currentTeam.id!)}
                    alt=""
                    className="h-4 w-4 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                  />
                  <span className="font-display font-bold text-[11px] tracking-wider uppercase">
                    {p.currentTeam.name}
                  </span>
                </Link>
              )}
            </div>

            {/* Bio stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.04]">
              <StatCell label="B/T" value={`${p.batSide?.code ?? "?"}/${p.pitchHand?.code ?? "?"}`} />
              <StatCell label="Height" value={p.height ?? "—"} />
              <StatCell label="Weight" value={p.weight ? `${p.weight} lb` : "—"} />
              <StatCell
                label="Born"
                value={p.birthDate ?? "—"}
                sub={p.birthCity ? `${p.birthCity}, ${p.birthCountry ?? ""}` : undefined}
              />
            </div>
          </div>
        </div>
      </Card>

      {isPitcher ? (
        <>
          <CareerCard title="Career Pitching" data={careerPitching} keys={PITCHING_KEYS} />
          <YearByYearCard
            title="Year by Year — Pitching"
            data={yearByYearPitching}
            keys={PITCHING_KEYS}
            chartKey="era"
            chartLabel="ERA"
            chartLowerBetter
          />
        </>
      ) : (
        <>
          <CareerCard title="Career Hitting" data={careerHitting} keys={HITTING_KEYS} />
          <YearByYearCard
            title="Year by Year — Hitting"
            data={yearByYearHitting}
            keys={HITTING_KEYS}
            chartKey="avg"
            chartLabel="AVG"
          />
        </>
      )}

      <div>
        <SectionTitle
          title="Splits"
          subtitle="vs L/R, home/away, day/night, situational."
        />
        <Splits personId={id} isPitcher={isPitcher} />
      </div>

      <div>
        <SectionTitle
          title="Game Log"
          subtitle="Recent games with rolling sparkline."
        />
        <GameLog personId={id} isPitcher={isPitcher} />
      </div>

      {isPitcher && (
        <div>
          <SectionTitle
            title="Pitch Arsenal"
            subtitle="Aggregated pitch types across recent games."
          />
          <PitchArsenal personId={id} isPitcher={isPitcher} />
        </div>
      )}

      <div>
        <SectionTitle
          title="Matchup"
          subtitle={`Career ${
            isPitcher ? "vs any batter" : "vs any pitcher"
          }.`}
        />
        <VsPlayer personId={id} isPitcher={isPitcher} />
      </div>
    </div>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-pitch-900/60 px-3 py-2">
      <div className="font-display font-bold text-[9px] tracking-[0.12em] uppercase text-white/30">
        {label}
      </div>
      <div className="font-mono text-sm text-white leading-tight">{value}</div>
      {sub && <div className="font-display text-[10px] text-white/25 leading-tight">{sub}</div>}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-pitch-950/50 border border-white/[0.04] p-2.5">
      <div className="font-display font-bold text-[9px] tracking-[0.12em] uppercase text-white/30">
        {label}
      </div>
      <div className="font-mono text-lg text-white leading-tight tabular-nums">{value}</div>
    </div>
  );
}

const HITTING_KEYS = [
  "gamesPlayed",
  "atBats",
  "runs",
  "hits",
  "doubles",
  "triples",
  "homeRuns",
  "rbi",
  "baseOnBalls",
  "strikeOuts",
  "stolenBases",
  "avg",
  "obp",
  "slg",
  "ops",
];

const PITCHING_KEYS = [
  "gamesPlayed",
  "gamesStarted",
  "wins",
  "losses",
  "saves",
  "inningsPitched",
  "strikeOuts",
  "baseOnBalls",
  "hits",
  "homeRuns",
  "earnedRuns",
  "era",
  "whip",
  "strikeoutsPer9Inn",
];

function CareerCard({
  title,
  data,
  keys,
}: {
  title: string;
  data: MlbStatGroup | undefined;
  keys: string[];
}) {
  const stat = data?.splits?.[0]?.stat;
  if (!stat) return null;
  return (
    <div>
      <SectionTitle title={title} />
      <Card>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {keys.map((k) => (
            <StatBox
              key={k}
              label={k.replace(/([A-Z])/g, " $1").trim()}
              value={String(stat[k] ?? "—")}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function YearByYearCard({
  title,
  data,
  keys,
  chartKey,
  chartLabel,
  chartLowerBetter,
}: {
  title: string;
  data: MlbStatGroup | undefined;
  keys: string[];
  chartKey: string;
  chartLabel: string;
  chartLowerBetter?: boolean;
}) {
  const splits = data?.splits ?? [];
  if (!splits.length) return null;

  const chartData = splits
    .filter((s) => s.team)
    .map((s) => ({
      season: s.season,
      [chartLabel]: Number(s.stat?.[chartKey] ?? 0),
    }));

  return (
    <div>
      <SectionTitle title={title} />
      <Card pad={false}>
        {chartData.length > 1 && (
          <div className="p-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="season" stroke="#9494b0" tick={{ fontSize: 11 }} />
                <YAxis
                  stroke="#9494b0"
                  tick={{ fontSize: 11 }}
                  domain={chartLowerBetter ? [0, "auto"] : ["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#080810",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={chartLabel}
                  stroke="#e8ff47"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Season</th>
                <th>Team</th>
                {keys.map((k) => (
                  <th key={k} className="text-right">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {splits.map((s, i) => (
                <tr key={`${s.season}-${s.team?.id ?? i}`}>
                  <td className="tabular-nums">{s.season}</td>
                  <td className="truncate">{s.team?.name ?? "—"}</td>
                  {keys.map((k) => (
                    <td key={k} className="text-right tabular-nums font-mono">
                      {String(s.stat?.[k] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
