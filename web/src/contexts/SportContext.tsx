import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SPORT_ID, SPORTS, getSport, type Sport } from "../api/sports";
import { sportHasSubleagues } from "../api/leagues";

type Ctx = {
  sport: Sport;
  sportId: number;
  setSportId: (id: number) => void;
  sports: Sport[];
  /**
   * Sub-league filter for multi-league sports (Winter Leagues → LIDOM, LVBP…).
   * `null` means every league under the sport. Remembered per sport, so
   * switching MLB → Winter Leagues and back keeps your LIDOM pick.
   */
  leagueId: number | null;
  setLeagueId: (id: number | null) => void;
};

const SportContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "diamond.sportId";
const LEAGUE_KEY_PREFIX = "diamond.leagueId.";

function readLeagueId(sportId: number): number | null {
  if (typeof window === "undefined" || !sportHasSubleagues(sportId)) return null;
  try {
    const raw = window.localStorage.getItem(LEAGUE_KEY_PREFIX + sportId);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function SportProvider({ children }: { children: ReactNode }) {
  const [sportId, setSportIdState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_SPORT_ID;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return SPORTS.find((s) => s.id === n) ? n : DEFAULT_SPORT_ID;
  });
  const [leagueId, setLeagueIdState] = useState<number | null>(() => readLeagueId(sportId));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(sportId));
    } catch {
      /* ignore quota / private-mode */
    }
  }, [sportId]);

  const setSportId = useCallback((id: number) => {
    setSportIdState(id);
    setLeagueIdState(readLeagueId(id));
  }, []);

  const setLeagueId = useCallback(
    (id: number | null) => {
      const next = sportHasSubleagues(sportId) ? id : null;
      setLeagueIdState(next);
      try {
        const key = LEAGUE_KEY_PREFIX + sportId;
        if (next == null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, String(next));
      } catch {
        /* ignore quota / private-mode */
      }
    },
    [sportId]
  );

  const value = useMemo<Ctx>(
    () => ({
      sportId,
      setSportId,
      sport: getSport(sportId),
      sports: SPORTS,
      leagueId: sportHasSubleagues(sportId) ? leagueId : null,
      setLeagueId,
    }),
    [sportId, setSportId, leagueId, setLeagueId]
  );

  return (
    <SportContext.Provider value={value}>{children}</SportContext.Provider>
  );
}

export function useSport() {
  const ctx = useContext(SportContext);
  if (!ctx) throw new Error("useSport must be used inside <SportProvider>");
  return ctx;
}
