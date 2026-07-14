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
import SectionNav from "../components/ui/SectionNav";
import TeamGameLog from "../components/ui/TeamGameLog";
import FarmSystem from "../components/ui/FarmSystem";
import TeamLeaders from "../components/ui/TeamLeaders";
import CoachingStaff from "../components/ui/CoachingStaff";
import DepthChart from "../components/ui/DepthChart";
import TeamTransactions from "../components/ui/TeamTransactions";
import NewsList from "../components/ui/NewsList";
import { useNews } from "../api/espn";
import { espnTeamId } from "../lib/espnTeams";
import { MapPin, Calendar, Trophy } from "lucide-react";

type MlbTeam = {
  id: number;
  name: string;
  abbreviation?: string;
  shortName?: string;
  firstYearOfPlay?: string;
  league?: { id?: number; name?: string };
  division?: { id?: number; name?: string };
  venue?: { name?: string };
  record?: { wins?: number; losses?: number };
};

type StandingsRecord = {
  team?: { id?: number };
  wins?: number;
  losses?: number;
  winningPercentage?: string;
  gamesBack?: string;
  divisionRank?: string | number;
  streak?: { streakCode?: string };
  records?: {
    splitRecords?: Array<{ type?: string; wins?: number; losses?: number }>;
  };
  runsScored?: number;
  runsAllowed?: number;
};

function ordinal(n?: number | string) {
  const num = Number(n);
  if (!num || Number.isNaN(num)) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return `${num}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function shortLeague(name?: string) {
  if (!name) return "";
  return name
    .replace("American League", "AL")
    .replace("National League", "NL");
}

function findTeamRecord(
  data: { records?: Array<{ teamRecords?: StandingsRecord[] }> } | undefined,
  teamId: number
): StandingsRecord | undefined {
  for (const rec of data?.records ?? []) {
    for (const tr of rec.teamRecords ?? []) {
      if (tr.team?.id === teamId) return tr;
    }
  }
  return undefined;
}

type MlbRosterPlayer = {
  person: { id: number; fullName: string };
  position?: { name?: string; abbreviation?: string; code?: string; type?: string };
  status?: { description?: string };
  jerseyNumber?: string;
};

type MlbStatGroup = {
  group?: { displayName?: string };
  splits?: Array<{ stat?: Record<string, unknown> }>;
};

type MlbTeamStatsData = {
  stats?: MlbStatGroup[];
};

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const id = teamId!;

  const team = useQuery({
    queryKey: ["team", id],
    queryFn: () => api.team(id),
  });
  const roster = useQuery({
    queryKey: ["roster", id],
    queryFn: () => api.teamRoster(id),
  });
  const stats = useQuery({
    queryKey: ["teamStats", id],
    queryFn: () => api.teamStats(id),
  });

  const leagueId = (team.data?.teams?.[0] as MlbTeam | undefined)?.league?.id;
  const standings = useQuery({
    queryKey: ["teamStandings", leagueId],
    queryFn: () => api.standings({ leagueId }),
    enabled: !!leagueId,
  });

  const espnId = espnTeamId(id);
  const news = useNews({ espnTeamId: espnId, limit: 6 });

  if (team.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (team.error) return <ErrorBox error={team.error} />;

  const t = team.data?.teams?.[0] as MlbTeam | undefined;
  if (!t) return null;

  const rec = findTeamRecord(standings.data, t.id);
  const last10 = rec?.records?.splitRecords?.find((s) => s.type === "lastTen");
  const diff =
    rec != null ? (rec.runsScored ?? 0) - (rec.runsAllowed ?? 0) : null;

  return (
    <div className="space-y-6">
      {/* Identity + record — the most important info, up top */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <img
            src={teamLogoUrl(t.id)}
            alt={t.name}
            className="h-24 w-24 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <div className="flex-1 text-center sm:text-left">
            <div className="page-eyebrow">
              {shortLeague(t.division?.name) || t.league?.name}
            </div>
            <h1 className="font-display font-black text-4xl sm:text-5xl uppercase leading-none text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
              {t.name}
              <FavButton fav={{ kind: "team", id: t.id, name: t.name }} size={20} />
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start text-sm text-pitch-300">
              {t.venue?.name && (
                <span className="pill">
                  <MapPin size={12} /> {t.venue.name}
                </span>
              )}
              {t.firstYearOfPlay && (
                <span className="pill">
                  <Calendar size={12} /> Since {t.firstYearOfPlay}
                </span>
              )}
              {t.shortName && <span className="pill">{t.abbreviation}</span>}
            </div>
          </div>
        </div>

        {rec && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 overflow-hidden rounded-xl border-t border-l border-white/10">
            <HeaderStat label="Record" value={`${rec.wins ?? "—"}-${rec.losses ?? "—"}`} />
            <HeaderStat label="Win %" value={rec.winningPercentage ?? "—"} />
            <HeaderStat label="Div. Rank" value={ordinal(rec.divisionRank)} />
            <HeaderStat
              label="Games Back"
              value={!rec.gamesBack || rec.gamesBack === "-" ? "—" : rec.gamesBack}
            />
            <HeaderStat
              label="Streak"
              value={rec.streak?.streakCode ?? "—"}
              valueClass={streakColor(rec.streak?.streakCode)}
            />
            <HeaderStat
              label="Run Diff"
              value={diff == null ? "—" : diff > 0 ? `+${diff}` : String(diff)}
              valueClass={
                diff == null || diff === 0
                  ? "text-white"
                  : diff > 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }
              sub={last10 ? `L10 ${last10.wins}-${last10.losses}` : undefined}
            />
          </div>
        )}
      </Card>

      <SectionNav />

      {/* Current form — how the team is playing right now */}
      <TeamGameLog teamId={t.id} season={new Date().getFullYear()} />

      {/* Standout players */}
      <TeamLeaders teamId={t.id} />

      {/* Roster core with reference sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <SectionTitle title="Depth Chart" subtitle="Field positions and pitching staff." />
            {roster.isLoading && <Spinner />}
            {roster.data && <DepthChart roster={roster.data.roster ?? []} />}
          </div>
          <div>
            <SectionTitle title="Active Roster" />
            {roster.isLoading && <Spinner />}
            {roster.error && <ErrorBox error={roster.error} />}
            {roster.data && <RosterTable roster={roster.data.roster ?? []} />}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <SectionTitle title="Team Stats" subtitle="Season" />
            {stats.isLoading && <Spinner />}
            {stats.error && <ErrorBox error={stats.error} />}
            {stats.data && <TeamStats data={stats.data} />}
          </div>
          <div>
            <SectionTitle title="News" subtitle="Latest headlines" />
            {espnId === undefined ? (
              <div className="text-sm text-pitch-300/60">
                News not available for this team.
              </div>
            ) : (
              <NewsList
                articles={news.data}
                isLoading={news.isLoading}
                error={news.error}
                compact
              />
            )}
          </div>
          <div>
            <SectionTitle title="Transactions" subtitle="Recent moves" />
            <TeamTransactions teamId={t.id} limit={8} />
          </div>
        </div>
      </div>

      {/* Lower-priority detail — organization and pipeline */}
      <CoachingStaff teamId={t.id} />

      <FarmSystem team={t} />
    </div>
  );
}

function HeaderStat({
  label,
  value,
  valueClass = "text-white",
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div className="border-r border-b border-white/10 bg-pitch-900/40 px-3.5 py-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </div>
      <div
        className={`mt-1 font-display font-black text-xl sm:text-2xl tabular-nums leading-none ${valueClass}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[10px] tabular-nums text-white/45">
          {sub}
        </div>
      )}
    </div>
  );
}

function streakColor(code?: string) {
  if (!code) return "text-white";
  if (code.startsWith("W")) return "text-emerald-400";
  if (code.startsWith("L")) return "text-red-400";
  return "text-white";
}

function RosterTable({ roster }: { roster: MlbRosterPlayer[] }) {
  const byPos: Record<string, MlbRosterPlayer[]> = {};
  for (const p of roster) {
    const key = p.position?.type ?? "Other";
    (byPos[key] ??= []).push(p);
  }

  return (
    <div className="space-y-4">
      {Object.entries(byPos).map(([group, players]) => (
        <Card key={group} pad={false}>
          <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
            {group}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-white/5">
            {players.map((p) => (
              <Link
                key={p.person.id}
                to={`/players/${p.person.id}`}
                className="flex items-center gap-3 px-4 py-2 hover:bg-white/5"
              >
                <img
                  src={playerHeadshotUrl(p.person.id, 60)}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover bg-pitch-800"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.person.fullName}
                  </div>
                  <div className="text-xs text-pitch-300/70">
                    #{p.jerseyNumber ?? "—"} · {p.position?.abbreviation}
                  </div>
                </div>
                <Trophy size={12} className="text-pitch-300/40" />
              </Link>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function TeamStats({ data }: { data: MlbTeamStatsData }) {
  const groups: MlbStatGroup[] = data?.stats ?? [];
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const split = g.splits?.[0]?.stat ?? {};
        const entries = Object.entries(split).slice(0, 14);
        return (
          <Card key={g.group?.displayName} pad={false}>
            <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
              {g.group?.displayName}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-4 text-sm">
              {entries.map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-pitch-300/80">{k}</span>
                  <span className="font-mono text-white">
                    {String(v ?? "—")}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
