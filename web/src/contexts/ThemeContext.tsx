import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";
const KEY = "diamond.theme";
const KEY_CB = "diamond.cbSafe";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  cbSafe: boolean;
  toggleCb: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return (window.localStorage.getItem(KEY) as Theme) ?? "dark";
  });
  const [cbSafe, setCbSafe] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY_CB) === "1";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (cbSafe) root.classList.add("cbsafe");
    else root.classList.remove("cbsafe");
    try {
      window.localStorage.setItem(KEY_CB, cbSafe ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [cbSafe]);

  const value = useMemo(
    () => ({
      theme,
      toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      cbSafe,
      toggleCb: () => setCbSafe((v) => !v),
    }),
    [theme, cbSafe]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside <ThemeProvider>");
  return ctx;
}

/** Returns the active chart palette (CB-safe IBM colors when enabled). */
export function useChartPalette() {
  const { cbSafe } = useTheme();
  return cbSafe
    ? {
        a: "#648FFF",
        b: "#FE6100",
        c: "#785EF0",
        d: "#FFB000",
        e: "#DC267F",
        good: "#648FFF",
        bad: "#FE6100",
      }
    : {
        a: "#3b82f6",
        b: "#ef4444",
        c: "#10b981",
        d: "#f59e0b",
        e: "#a855f7",
        good: "#10b981",
        bad: "#ef4444",
      };
}
