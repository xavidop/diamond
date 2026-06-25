import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { NotifyEvent, NotifySettings } from "../lib/notifyDiff";

export interface GameSub {
  gamePk: number;
  label: string;
}

export interface FeedEntry extends NotifyEvent {
  id: string;
  ts: number;
  read: boolean;
}

type Ctx = {
  subs: GameSub[];
  isSubscribed: (gamePk: number) => boolean;
  toggleSubscription: (g: GameSub) => void;
  settings: NotifySettings;
  updateSettings: (patch: Partial<NotifySettings>) => void;
  requestPermission: () => Promise<NotificationPermission>;
  feed: FeedEntry[];
  unreadCount: number;
  appendFeed: (e: NotifyEvent) => void;
  markFeedRead: () => void;
};

const NotificationsContext = createContext<Ctx | null>(null);
const SUBS_KEY = "diamond.notify.subs";
const SETTINGS_KEY = "diamond.notify.settings";
const FEED_CAP = 50;

function currentPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission;
}

const DEFAULT_SETTINGS: NotifySettings = {
  enabled: true,
  followFavorites: true,
  runScored: true,
  gameFinal: true,
  gameStarting: true,
  permission: "default",
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [subs, setSubs] = useState<GameSub[]>(() => load(SUBS_KEY, []));
  const [settings, setSettings] = useState<NotifySettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...load(SETTINGS_KEY, {}),
    permission: currentPermission(),
  }));
  const [feed, setFeed] = useState<FeedEntry[]>([]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SUBS_KEY, JSON.stringify(subs));
    } catch {
      /* ignore */
    }
  }, [subs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const isSubscribed = useCallback(
    (gamePk: number) => subs.some((s) => s.gamePk === gamePk),
    [subs]
  );

  const toggleSubscription = useCallback((g: GameSub) => {
    setSubs((cur) =>
      cur.some((s) => s.gamePk === g.gamePk)
        ? cur.filter((s) => s.gamePk !== g.gamePk)
        : [...cur, g]
    );
  }, []);

  const updateSettings = useCallback((patch: Partial<NotifySettings>) => {
    setSettings((cur) => ({ ...cur, ...patch }));
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      updateSettings({ permission: "denied" });
      return "denied" as NotificationPermission;
    }
    const result = await Notification.requestPermission();
    updateSettings({ permission: result });
    return result;
  }, [updateSettings]);

  const appendFeed = useCallback((e: NotifyEvent) => {
    setFeed((cur) => {
      const entry: FeedEntry = {
        ...e,
        id: `${e.gamePk}:${e.type}:${Date.now()}`,
        ts: Date.now(),
        read: false,
      };
      return [entry, ...cur].slice(0, FEED_CAP);
    });
  }, []);

  const markFeedRead = useCallback(() => {
    setFeed((cur) => cur.map((f) => (f.read ? f : { ...f, read: true })));
  }, []);

  const unreadCount = useMemo(() => feed.filter((f) => !f.read).length, [feed]);

  const value = useMemo(
    () => ({
      subs,
      isSubscribed,
      toggleSubscription,
      settings,
      updateSettings,
      requestPermission,
      feed,
      unreadCount,
      appendFeed,
      markFeedRead,
    }),
    [subs, isSubscribed, toggleSubscription, settings, updateSettings, requestPermission, feed, unreadCount, appendFeed, markFeedRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be inside <NotificationsProvider>");
  return ctx;
}
