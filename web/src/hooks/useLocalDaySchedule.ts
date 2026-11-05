import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/mlb";
import { shiftDate, gamesForDay, todayIso, type DatedGame } from "../lib/utils";
import { filterGamesByLeague, type LeagueTaggedGame } from "../api/leagues";

// useLocalDaySchedule returns the MLB slate for the given date (YYYY-MM-DD) —
// the games the API files under that day, shown as-is. When the date is today
// it also folds in any currently-live game filed under the day before/after, so
// an active game in another timezone still shows. The neighbouring slates are
// fetched with the same query keys as the rest of the app, so they're cached.
//
// `leagueId` narrows a multi-league sport (Winter Leagues) to one league. The
// filter is applied client-side so the cached ["schedule", sportId, date]
// payload stays the full slate shared with the notification poller and the
// live-count badge, regardless of which league the user is looking at.
export function useLocalDaySchedule<T extends DatedGame = DatedGame>(
  dateIso: string,
  sportId: number,
  leagueId: number | null = null,
) {
  const prevQ = useQuery({
    queryKey: ["schedule", sportId, shiftDate(dateIso, -1)],
    queryFn: () => api.daySchedule({ date: shiftDate(dateIso, -1), sportId }),
    refetchInterval: 30_000,
  });
  const curQ = useQuery({
    queryKey: ["schedule", sportId, dateIso],
    queryFn: () => api.daySchedule({ date: dateIso, sportId }),
    refetchInterval: 30_000,
  });
  const nextQ = useQuery({
    queryKey: ["schedule", sportId, shiftDate(dateIso, 1)],
    queryFn: () => api.daySchedule({ date: shiftDate(dateIso, 1), sportId }),
    refetchInterval: 30_000,
  });

  const isToday = dateIso === todayIso();
  const games = useMemo(() => {
    const slate = (curQ.data?.dates?.[0]?.games ?? []) as T[];
    const neighbors = [
      ...((prevQ.data?.dates?.[0]?.games ?? []) as T[]),
      ...((nextQ.data?.dates?.[0]?.games ?? []) as T[]),
    ];
    const day = gamesForDay(slate, neighbors, isToday);
    return filterGamesByLeague(day as (T & LeagueTaggedGame)[], leagueId) as T[];
  }, [prevQ.data, curQ.data, nextQ.data, isToday, leagueId]);

  return { games, isLoading: curQ.isLoading, error: curQ.error };
}
