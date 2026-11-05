import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/mlb";
import {
  mergeLeagues,
  sportHasSubleagues,
  staticLeagues,
  type League,
} from "../api/leagues";
import { useSport } from "../contexts/SportContext";

/**
 * The sub-league layer for the selected sport: the list of leagues under it,
 * the one the user filtered to (if any), and whether the sport has independent
 * sub-leagues at all (Winter Leagues yes, MLB no). The list comes from
 * /league?sportId=… with the static snapshot as instant/offline fallback.
 */
export function useLeagues() {
  const { sportId, leagueId, setLeagueId } = useSport();
  const hasSubleagues = sportHasSubleagues(sportId);

  // Scoped to the current season so the API answers with this winter's set
  // (inactive leagues are dropped in mergeLeagues either way).
  const season = new Date().getFullYear();
  const q = useQuery({
    queryKey: ["leagues", sportId, season],
    queryFn: () => api.leagues({ sportId, season }),
    enabled: hasSubleagues,
    staleTime: 60 * 60 * 1000,
    placeholderData: { leagues: staticLeagues(sportId) },
  });

  const leagues = useMemo<League[]>(
    () => (hasSubleagues ? mergeLeagues(q.data?.leagues, sportId) : []),
    [hasSubleagues, q.data, sportId]
  );

  const league = useMemo(
    () => (leagueId == null ? null : leagues.find((l) => l.id === leagueId) ?? null),
    [leagues, leagueId]
  );

  return {
    hasSubleagues,
    leagues,
    league,
    // A stale id (sport changed, league gone) acts as "all".
    leagueId: league ? leagueId : null,
    setLeagueId,
  };
}
