// web/src/components/miniviewer/MiniScoreboard.tsx
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api, teamLogoUrl } from "../../api/mlb";
import { useSport } from "../../contexts/SportContext";
import { useMiniViewer } from "../../contexts/MiniViewerContext";
import { Spinner, Empty } from "../ui/Primitives";
import { todayIso } from "../../lib/utils";
import { useLocalDaySchedule } from "../../hooks/useLocalDaySchedule";
import {
  sortGames,
  pickDefaultGame,
  isLive,
  basesFromOffense,
  type MiniGame,
} from "../../lib/miniviewer";

export default function MiniScoreboard() {
  const { sportId } = useSport();
  const { selectedGamePk, selectGame, closeMini } = useMiniViewer();
  const date = todayIso();

  // Same local-day bucketing as the Today page so the two always agree.
  const { games: dayGames, isLoading } = useLocalDaySchedule<MiniGame>(date, sportId);
  const games = sortGames(dayGames);
  const selected = games.find((g) => g.gamePk === selectedGamePk) ?? null;

  useEffect(() => {
    if (selectedGamePk == null && games.length > 0) {
      const def = pickDefaultGame(games);
      if (def != null) selectGame(def);
    }
  }, [selectedGamePk, games, selectGame]);

  const line = useQuery({
    queryKey: ["mini-linescore", selectedGamePk],
    queryFn: () => api.gameLinescore(selectedGamePk!),
    enabled: selectedGamePk != null && isLive(selected),
    refetchInterval: 15_000,
  });

  return (
    <div className="diamond-mini diamond-chrome flex h-full flex-col bg-pitch-950 text-white font-sans text-sm">
      <header className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <span className="font-display font-black uppercase tracking-widest text-[11px] text-volt-500">
          Mini Viewer
        </span>
        <button
          onClick={closeMini}
          aria-label="Close mini viewer"
          className="text-white/40 hover:text-white"
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
        <div className="flex-1 overflow-y-auto">
          <Detail game={selected} line={line.data} />
          <GamesList games={games} selectedGamePk={selectedGamePk} onSelect={selectGame} />
        </div>
      )}
    </div>
  );
}

function Logo({ id, size = 24 }: { id?: number; size?: number }) {
  if (!id) return null;
  return (
    <img
      src={teamLogoUrl(id)}
      alt=""
      style={{ height: size, width: size }}
      className="object-contain"
      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
    />
  );
}

function Detail({ game, line }: { game: MiniGame | null; line?: any }) {
  if (!game) return null;
  const away = game.teams?.away;
  const home = game.teams?.home;
  const state = game.status?.abstractGameState ?? "";
  const live = state === "Live";
  const final = state === "Final";

  let statusLine = "Scheduled";
  if (final) statusLine = "Final";
  else if (live) {
    const ord = line?.currentInningOrdinal ?? game.linescore?.currentInningOrdinal ?? "";
    const half = line?.inningState ?? game.linescore?.inningState ?? "";
    statusLine = `${half} ${ord}`.trim();
  }

  const bases = basesFromOffense(line?.offense);
  const outs = live ? line?.outs ?? 0 : 0;

  return (
    <div className="border-b border-white/10 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Logo id={away?.team?.id} />
          <span className="font-display font-bold uppercase truncate">
            {away?.team?.abbreviation ?? away?.team?.name}
          </span>
        </div>
        <span className="font-mono font-black text-lg tabular-nums">{away?.score ?? "-"}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Logo id={home?.team?.id} />
          <span className="font-display font-bold uppercase truncate">
            {home?.team?.abbreviation ?? home?.team?.name}
          </span>
        </div>
        <span className="font-mono font-black text-lg tabular-nums">{home?.score ?? "-"}</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="pill">{statusLine || "—"}</span>
        {live && (
          <div className="flex items-center gap-3">
            <Diamond bases={bases} />
            <Outs outs={outs} />
          </div>
        )}
      </div>
    </div>
  );
}

function Diamond({ bases }: { bases: { first: boolean; second: boolean; third: boolean } }) {
  const pip = (on: boolean) =>
    `h-2.5 w-2.5 rotate-45 border border-white/40 ${on ? "bg-volt-500" : "bg-transparent"}`;
  return (
    <div className="relative h-7 w-7" title="Runners on base">
      <div className={`absolute left-1/2 top-0 -translate-x-1/2 ${pip(bases.second)}`} />
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 ${pip(bases.third)}`} />
      <div className={`absolute right-0 top-1/2 -translate-y-1/2 ${pip(bases.first)}`} />
    </div>
  );
}

function Outs({ outs }: { outs: number }) {
  return (
    <div className="flex items-center gap-1" title={`${outs} out`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < outs ? "bg-danger-500" : "bg-white/15"}`}
        />
      ))}
    </div>
  );
}

function GamesList({
  games,
  selectedGamePk,
  onSelect,
}: {
  games: MiniGame[];
  selectedGamePk: number | null;
  onSelect: (gamePk: number) => void;
}) {
  return (
    <ul className="divide-y divide-white/5">
      {games.map((g) => {
        const a = g.teams?.away;
        const h = g.teams?.home;
        const stateRaw = g.status?.abstractGameState ?? "";
        const sel = g.gamePk === selectedGamePk;
        return (
          <li key={g.gamePk}>
            <button
              onClick={() => onSelect(g.gamePk)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/5 ${
                sel ? "bg-white/10" : ""
              }`}
            >
              <span className="min-w-0 truncate">
                <span className="font-display font-bold uppercase">
                  {a?.team?.abbreviation ?? "?"}
                </span>{" "}
                <span className="font-mono">{a?.score ?? ""}</span>
                <span className="text-white/40"> @ </span>
                <span className="font-display font-bold uppercase">
                  {h?.team?.abbreviation ?? "?"}
                </span>{" "}
                <span className="font-mono">{h?.score ?? ""}</span>
              </span>
              <span
                className={`text-[10px] uppercase tracking-wider shrink-0 ${
                  stateRaw === "Live" ? "text-volt-500" : "text-white/40"
                }`}
              >
                {stateRaw === "Live"
                  ? g.linescore?.currentInningOrdinal ?? "Live"
                  : stateRaw === "Final"
                  ? "Final"
                  : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
