import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PinType = "leaders" | "streaks" | "standings";

export type Pin = {
  id: string; // unique key
  type: PinType;
  title: string;
  /** URL search-string params for the source page, e.g. "?group=hitting&cat=homeRuns" */
  params: string;
};

type Ctx = {
  pins: Pin[];
  isPinned: (id: string) => boolean;
  add: (p: Pin) => void;
  remove: (id: string) => void;
  toggle: (p: Pin) => void;
  reorder: (from: number, to: number) => void;
};

const PinsContext = createContext<Ctx | null>(null);
const KEY = "diamond.pins";

export function PinsProvider({ children }: { children: ReactNode }) {
  const [pins, setPins] = useState<Pin[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Pin[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(pins));
    } catch {
      /* ignore */
    }
  }, [pins]);

  const isPinned = useCallback(
    (id: string) => pins.some((p) => p.id === id),
    [pins]
  );

  const add = useCallback((p: Pin) => {
    setPins((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]));
  }, []);

  const remove = useCallback((id: string) => {
    setPins((cur) => cur.filter((p) => p.id !== id));
  }, []);

  const toggle = useCallback((p: Pin) => {
    setPins((cur) =>
      cur.some((x) => x.id === p.id)
        ? cur.filter((x) => x.id !== p.id)
        : [...cur, p]
    );
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    setPins((cur) => {
      const next = cur.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ pins, isPinned, add, remove, toggle, reorder }),
    [pins, isPinned, add, remove, toggle, reorder]
  );

  return <PinsContext.Provider value={value}>{children}</PinsContext.Provider>;
}

export function usePins() {
  const ctx = useContext(PinsContext);
  if (!ctx) throw new Error("usePins must be inside <PinsProvider>");
  return ctx;
}
