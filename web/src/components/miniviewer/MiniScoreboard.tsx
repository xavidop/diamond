// web/src/components/miniviewer/MiniScoreboard.tsx
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../../api/mlb";
import { useSport } from "../../contexts/SportContext";
import { useMiniViewer } from "../../contexts/MiniViewerContext";
import { Spinner, Empty } from "../ui/Primitives";
import { todayIso } from "../../lib/utils";
import { useLocalDaySchedule } from "../../hooks/useLocalDaySchedule";
import { useElementWidth } from "../../hooks/useElementWidth";
import { pitcherLine, batterLine } from "../../lib/miniBoxscore";
import { sortGames, pickDefaultGame, isLive, type MiniGame } from "../../lib/miniviewer";
import type { MiniMode } from "../../lib/miniStorage";
import FocusView from "./FocusView";
import SlateView from "./SlateView";

/** Ticks once a second so the scheduled-game countdown advances. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export default function MiniScoreboard() {
  const { sportId } = useSport();
  const { selectedGamePk, selectGame, closeMini, mode, setMode } = useMiniViewer();
  const date = todayIso();

  // Same local-day bucketing as the Today page so the two always agree.
  const { games: dayGames, isLoading } = useLocalDaySchedule<MiniGame>(date, sportId);
  const games = sortGames(dayGames);
  const selected = games.find((g) => g.gamePk === selectedGamePk) ?? null;

  // Select a default when nothing is chosen, and recover when a persisted
  // selection points at a game that is not on today's slate (e.g. reopening
  // the next day).
  useEffect(() => {
    if (games.length === 0) return;
    if (selectedGamePk != null && selected) return;
    const def = pickDefaultGame(games);
    if (def != null) selectGame(def);
  }, [selectedGamePk, selected, games, selectGame]);

  const live = isLive(selected);
  const final = selected?.status?.abstractGameState === "Final";
  const scheduled = !!selected && !live && !final;

  const lineQ = useQuery({
    queryKey: ["mini-linescore", selectedGamePk],
    queryFn: () => api.gameLinescore(selectedGamePk!),
    enabled: selectedGamePk != null && live,
    refetchInterval: 15_000,
  });

  const boxQ = useQuery({
    queryKey: ["mini-boxscore", selectedGamePk],
    queryFn: () => api.gameBoxscore(selectedGamePk!),
    enabled: selectedGamePk != null && (live || final),
    // A final boxscore never changes; only poll while the game is in progress.
    refetchInterval: live ? 15_000 : false,
    staleTime: live ? 0 : Infinity,
  });

  const ls = lineQ.data ?? selected?.linescore;
  const now = useNow(mode === "focus" && scheduled);

  const stats = {
    pitcher: pitcherLine(boxQ.data, ls?.defense?.pitcher?.id),
    batter: batterLine(boxQ.data, ls?.offense?.batter?.id),
  };

  const [rootRef, width] = useElementWidth();
  // Below ~320px the headshots and full-size grid stop fitting.
  const compact = width > 0 && width < 320;

  return (
    <div ref={rootRef} className="diamond-mini diamond-chrome flex h-full flex-col bg-pitch-950 font-sans text-sm text-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        {games.some(isLive) && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-volt-500 shadow-glow-volt" aria-hidden />
        )}
        <span className="font-display text-[11px] font-black uppercase tracking-[0.16em] text-volt-500">
          Mini Viewer
        </span>
        <ModeToggle mode={mode} onChange={setMode} />
        <button
          onClick={closeMini}
          aria-label="Close mini viewer"
          className="ml-auto text-white/40 hover:text-white"
        >
          <X size={14} />
        </button>
      </header>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : games.length === 0 ? (
        <div className="p-4">
          <Empty message="No games today" />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          {mode === "focus" ? (
            <FocusView
              game={selected}
              games={games}
              selectedGamePk={selectedGamePk}
              onSelect={selectGame}
              stats={stats}
              now={now}
              liveLinescore={live ? lineQ.data : undefined}
              compact={compact}
            />
          ) : (
            <SlateView games={games} selectedGamePk={selectedGamePk} onSelect={(pk) => { selectGame(pk); setMode("focus"); }} />
          )}
        </div>
      )}
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: MiniMode; onChange: (m: MiniMode) => void }) {
  const item = (value: MiniMode, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={mode === value}
      className={`rounded px-2 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-[0.1em] ${
        mode === value ? "bg-volt-500 text-pitch-950" : "text-white/45 hover:text-white/80"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex rounded-md bg-white/[0.06] p-0.5">
      {item("focus", "Focus")}
      {item("slate", "Slate")}
    </div>
  );
}
