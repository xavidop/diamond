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
import TeamGameLog from "../components/ui/TeamGameLog";
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
  league?: { name?: string };
  division?: { name?: string };
  venue?: { name?: string };
  record?: { wins?: number; losses?: number };
};

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

  return (
    <div className="space-y-6">
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
              {t.league?.name} · {t.division?.name}
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
      </Card>

      <TeamGameLog teamId={t.id} season={new Date().getFullYear()} />

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
            <SectionTitle title="Transactions" subtitle="Recent moves" />
            <TeamTransactions teamId={t.id} limit={8} />
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
        </div>
      </div>
    </div>
  );
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
