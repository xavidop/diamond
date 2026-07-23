// web/src/contexts/MiniViewerContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { copyStyles, getDocPip, syncPipTheme } from "../lib/pip";
import { readMode, writeMode, readGamePk, writeGamePk, type MiniMode } from "../lib/miniStorage";
import { useTheme } from "./ThemeContext";

type MiniViewerValue = {
  open: boolean;
  selectedGamePk: number | null;
  pipWindow: Window | null;
  usePanel: boolean;
  mode: MiniMode;
  openMini: (gamePk?: number) => void;
  closeMini: () => void;
  selectGame: (gamePk: number) => void;
  setMode: (mode: MiniMode) => void;
};

const Ctx = createContext<MiniViewerValue | null>(null);

const PIP_SIZE = { width: 360, height: 480 };

export function MiniViewerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(() => readGamePk());
  const [mode, setModeState] = useState<MiniMode>(() => readMode());
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [usePanel, setUsePanel] = useState(false);
  const pipRef = useRef<Window | null>(null);
  const { theme, cbSafe } = useTheme();

  // Keep an already-open PiP window's theme in sync when the user toggles
  // light/dark (or color-blind) — copyStyles only mirrors the theme at open.
  // The in-page panel re-themes on its own (it lives in the main document).
  useEffect(() => {
    if (pipRef.current) syncPipTheme(pipRef.current);
  }, [theme, cbSafe, pipWindow]);

  const closeMini = useCallback(() => {
    setOpen(false);
    setUsePanel(false);
    pipRef.current?.close();
    pipRef.current = null;
    setPipWindow(null);
  }, []);

  // NOTE: requestWindow() is called synchronously here (inside the click that
  // invokes openMini) to satisfy the browser's user-activation requirement.
  const openMini = useCallback(
    (gamePk?: number) => {
      if (gamePk != null) {
        setSelectedGamePk(gamePk);
        writeGamePk(gamePk);
      }
      setOpen(true);
      const dp = getDocPip();
      if (!dp) {
        setUsePanel(true);
        return;
      }
      dp.requestWindow(PIP_SIZE)
        .then((win) => {
          copyStyles(win);
          win.addEventListener("pagehide", () => {
            pipRef.current = null;
            setPipWindow(null);
            setOpen(false);
          });
          pipRef.current = win;
          setPipWindow(win);
        })
        .catch(() => setUsePanel(true));
    },
    []
  );

  const selectGame = useCallback((gamePk: number) => {
    setSelectedGamePk(gamePk);
    writeGamePk(gamePk);
  }, []);

  const setMode = useCallback((next: MiniMode) => {
    setModeState(next);
    writeMode(next);
  }, []);

  return (
    <Ctx.Provider
      value={{
        open,
        selectedGamePk,
        pipWindow,
        usePanel,
        mode,
        openMini,
        closeMini,
        selectGame,
        setMode,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useMiniViewer(): MiniViewerValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMiniViewer must be used within MiniViewerProvider");
  return v;
}
