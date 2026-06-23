import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type FavKind = "team" | "player";
export type Fav = {
  kind: FavKind;
  id: number;
  name: string;
  teamId?: number; // for players
};

type Ctx = {
  favs: Fav[];
  isFav: (kind: FavKind, id: number) => boolean;
  toggle: (f: Fav) => void;
  remove: (kind: FavKind, id: number) => void;
};

const FavoritesContext = createContext<Ctx | null>(null);
const KEY = "diamond.favs";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favs, setFavs] = useState<Fav[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Fav[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(favs));
    } catch {
      /* ignore */
    }
  }, [favs]);

  const isFav = useCallback(
    (kind: FavKind, id: number) =>
      favs.some((f) => f.kind === kind && f.id === id),
    [favs]
  );

  const toggle = useCallback((f: Fav) => {
    setFavs((cur) => {
      const exists = cur.some((x) => x.kind === f.kind && x.id === f.id);
      return exists
        ? cur.filter((x) => !(x.kind === f.kind && x.id === f.id))
        : [...cur, f];
    });
  }, []);

  const remove = useCallback((kind: FavKind, id: number) => {
    setFavs((cur) => cur.filter((x) => !(x.kind === kind && x.id === id)));
  }, []);

  const value = useMemo(() => ({ favs, isFav, toggle, remove }), [
    favs,
    isFav,
    toggle,
    remove,
  ]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be inside <FavoritesProvider>");
  return ctx;
}
