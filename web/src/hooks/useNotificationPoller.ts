import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/mlb";
import { useSport } from "../contexts/SportContext";
import { useFavorites } from "../contexts/FavoritesContext";
import { useNotifications } from "../contexts/NotificationsContext";
import { useToast } from "../contexts/ToastContext";
import { notifyDiff, type GameSnapshot } from "../lib/notifyDiff";
import { buildMessage, fireNative } from "../lib/notifyEmit";
import { todayIso, shiftDate } from "../lib/utils";

export function useNotificationPoller(): void {
  const { sportId } = useSport();
  const { favs } = useFavorites();
  const { subs, settings, appendFeed } = useNotifications();
  const { pushToast } = useToast();
  const prevRef = useRef<Map<number, GameSnapshot>>(new Map());

  const enabled = settings.enabled;
  const today = todayIso();
  const yesterday = shiftDate(today, -1);

  const todayQ = useQuery({
    queryKey: ["schedule", sportId, today],
    queryFn: () => api.daySchedule({ date: today, sportId }),
    refetchInterval: enabled ? 30_000 : false,
    enabled,
  });
  const yesterdayQ = useQuery({
    queryKey: ["schedule", sportId, yesterday],
    queryFn: () => api.daySchedule({ date: yesterday, sportId }),
    refetchInterval: enabled ? 30_000 : false,
    enabled,
  });

  // When notifications are off, drop the diff baseline so re-enabling
  // re-seeds silently instead of replaying everything missed while off.
  useEffect(() => {
    if (!enabled) prevRef.current = new Map();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const games: any[] = [
      ...((todayQ.data?.dates?.[0]?.games as any[]) ?? []),
      ...((yesterdayQ.data?.dates?.[0]?.games as any[]) ?? []),
    ];
    if (games.length === 0) return;

    const favTeamIds = new Set(favs.filter((f) => f.kind === "team").map((f) => f.id));
    const watch = new Set<number>(subs.map((s) => s.gamePk));
    if (settings.followFavorites) {
      for (const g of games) {
        const a = g?.teams?.away?.team?.id;
        const h = g?.teams?.home?.team?.id;
        if ((a != null && favTeamIds.has(a)) || (h != null && favTeamIds.has(h))) {
          watch.add(g.gamePk);
        }
      }
    }
    if (watch.size === 0) return;

    const { events, next } = notifyDiff(prevRef.current, games, settings, watch);
    prevRef.current = next;

    for (const e of events) {
      const { title, body } = buildMessage(e);
      pushToast({ title, body, gamePk: e.gamePk });
      appendFeed(e);
      fireNative(e);
    }
  }, [enabled, todayQ.data, yesterdayQ.data, favs, subs, settings, pushToast, appendFeed]);
}
