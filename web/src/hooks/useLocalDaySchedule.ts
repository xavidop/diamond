import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/mlb";
import { shiftDate, gamesForDay, todayIso, type DatedGame } from "../lib/utils";

// useLocalDaySchedule returns the MLB slate for the given date (YYYY-MM-DD) —
// the games the API files under that day, shown as-is. When the date is today
// it also folds in any currently-live game filed under the day before/after, so
// an active game in another timezone still shows. The neighbouring slates are
// fetched with the same query keys as the rest of the app, so they're cached.
export function useLocalDaySchedule<T extends DatedGame = DatedGame>(
  dateIso: string,
  sportId: number,
) {
  const prevQ = useQuery({
    queryKey: ["schedule", sportId, shiftDate(dateIso, -1)],
    queryFn: () => api.schedule({ date: shiftDate(dateIso, -1), sportId }),
    refetchInterval: 30_000,
  });
  const curQ = useQuery({
    queryKey: ["schedule", sportId, dateIso],
    queryFn: () => api.schedule({ date: dateIso, sportId }),
    refetchInterval: 30_000,
  });
  const nextQ = useQuery({
    queryKey: ["schedule", sportId, shiftDate(dateIso, 1)],
    queryFn: () => api.schedule({ date: shiftDate(dateIso, 1), sportId }),
    refetchInterval: 30_000,
  });

  const isToday = dateIso === todayIso();
  const games = useMemo(() => {
    const slate = (curQ.data?.dates?.[0]?.games ?? []) as T[];
    const neighbors = [
      ...((prevQ.data?.dates?.[0]?.games ?? []) as T[]),
      ...((nextQ.data?.dates?.[0]?.games ?? []) as T[]),
    ];
    return gamesForDay(slate, neighbors, isToday);
  }, [prevQ.data, curQ.data, nextQ.data, isToday]);

  return { games, isLoading: curQ.isLoading, error: curQ.error };
}
