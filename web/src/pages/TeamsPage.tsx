import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, teamLogoUrl } from "../api/mlb";
import { leagueAbbr } from "../api/leagues";
import {
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { useSport } from "../contexts/SportContext";
import { useLeagues } from "../hooks/useLeagues";

type Team = {
  id: number;
  name: string;
  locationName?: string;
  abbreviation?: string;
  league?: { id?: number; name?: string };
  division?: { id?: number; name?: string };
};

export default function TeamsPage() {
  const [q, setQ] = useState("");
  const { sportId, sport } = useSport();
  const { hasSubleagues, leagues, league, leagueId } = useLeagues();
  const { data, isLoading, error } = useQuery({
    queryKey: ["teams", sportId],
    queryFn: () => api.teams({ sportId }),
  });

  const teams = useMemo(() => {
    const list = (data?.teams ?? []) as Team[];
    const inLeague = leagueId == null ? list : list.filter((t) => t.league?.id === leagueId);
    const filtered = q
      ? inLeague.filter((t) =>
          (t.name + " " + (t.locationName ?? "") + " " + (t.abbreviation ?? ""))
            .toLowerCase()
            .includes(q.toLowerCase())
        )
      : inLeague;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [data, q, leagueId]);

  // For a multi-league sport with no league picked, group clubs under their
  // league so LIDOM, LVBP, LMP… read as the separate competitions they are.
  const groups = useMemo(() => {
    if (!hasSubleagues || leagueId != null) return [{ key: "all", title: null, teams }];
    const byLeague = new Map<number | string, Team[]>();
    for (const t of teams) {
      const k = t.league?.id ?? "other";
      if (!byLeague.has(k)) byLeague.set(k, []);
      byLeague.get(k)!.push(t);
    }
    const order = new Map(leagues.map((l, i) => [l.id, i] as const));
    return [...byLeague.entries()]
      .sort(([a], [b]) => (order.get(a as number) ?? 999) - (order.get(b as number) ?? 999))
      .map(([k, ts]) => {
        const lg = leagues.find((l) => l.id === k);
        return {
          key: String(k),
          title: lg ? `${lg.name} · ${lg.abbreviation}` : ts[0]?.league?.name ?? "Other",
          teams: ts,
        };
      });
  }, [hasSubleagues, leagueId, leagues, teams]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`${league?.name ?? sport.name} · Teams`}
        subtitle={`${teams.length} clubs${league ? ` · ${league.abbreviation}` : ""}`}
        right={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter teams…"
            className="input w-56"
          />
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {error && <ErrorBox error={error} />}

      {groups.map((g) => (
        <div key={g.key} className="space-y-3">
          {g.title && (
            <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2">
              <h3 className="font-display font-black text-lg uppercase tracking-tight text-white">
                {g.title}
              </h3>
              <span className="font-mono text-[10px] text-white/30">{g.teams.length} clubs</span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {g.teams.map((t) => (
              <Link
                key={t.id}
                to={`/teams/${t.id}`}
                className="card card-pad flex flex-col items-center gap-2 hover:bg-pitch-900/80 transition-colors text-center"
              >
                <img
                  src={teamLogoUrl(t.id)}
                  alt={t.name}
                  className="h-16 w-16 object-contain"
                />
                <div className="text-sm font-semibold leading-tight">{t.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
                  {hasSubleagues
                    ? leagueAbbr(leagues, t.league?.id, t.league?.name) ?? ""
                    : `${t.league?.name ?? ""} · ${t.division?.name?.split(" ").pop() ?? ""}`}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
