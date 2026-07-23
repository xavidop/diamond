import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/mlb";
import { shiftDate, gamesForDay, todayIso, type DatedGame } from "../lib/utils";

// useLocalDaySchedule returns the games that belong to the given local calendar
// date (YYYY-MM-DD). MLB files a game under its US date, so a game can land in
// an adjacent US slate for a viewer far from Eastern; we fetch the day before,
// the day itself, and the day after, then bucket each game by the viewer's
// local day (live games count as today, finished games stay on the day they
// were played). Query keys match the other schedule fetches, so the three
// slates are shared/cached across the app.
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

  const today = todayIso();
  const games = useMemo(() => {
    const all = [
      ...((prevQ.data?.dates?.[0]?.games ?? []) as T[]),
      ...((curQ.data?.dates?.[0]?.games ?? []) as T[]),
      ...((nextQ.data?.dates?.[0]?.games ?? []) as T[]),
    ];
    return gamesForDay(all, dateIso, today);
  }, [prevQ.data, curQ.data, nextQ.data, dateIso, today]);

  return { games, isLoading: curQ.isLoading, error: curQ.error };
}
