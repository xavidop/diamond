import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SPORT_ID, SPORTS, getSport, type Sport } from "../api/sports";

type Ctx = {
  sport: Sport;
  sportId: number;
  setSportId: (id: number) => void;
  sports: Sport[];
};

const SportContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "diamond.sportId";

export function SportProvider({ children }: { children: ReactNode }) {
  const [sportId, setSportIdState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_SPORT_ID;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return SPORTS.find((s) => s.id === n) ? n : DEFAULT_SPORT_ID;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(sportId));
    } catch {
      /* ignore quota / private-mode */
    }
  }, [sportId]);

  const value = useMemo<Ctx>(
    () => ({
      sportId,
      setSportId: setSportIdState,
      sport: getSport(sportId),
      sports: SPORTS,
    }),
    [sportId]
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
