import { deriveGameState, sortGames, type MiniGame, type LinescoreRawT } from "../../lib/miniviewer";
import ScoreRows from "./parts/ScoreRows";
import StatusStrip from "./parts/StatusStrip";
import DetailBand, { type BandStats } from "./parts/DetailBand";
import Linescore from "./parts/Linescore";
import GameRow from "./parts/GameRow";

export default function FocusView({
  game,
  games,
  selectedGamePk,
  onSelect,
  stats,
  now,
  liveLinescore,
  compact = false,
}: {
  game: MiniGame | null;
  games: MiniGame[];
  selectedGamePk: number | null;
  onSelect: (gamePk: number) => void;
  stats: BandStats;
  now: number;
  liveLinescore?: LinescoreRawT;
  compact?: boolean;
}) {
  const state = game ? deriveGameState(game, { linescore: liveLinescore }) : null;
  const others = sortGames(games).filter((g) => g.gamePk !== selectedGamePk);
  const showLine = state?.kind === "live" || state?.kind === "final";

  return (
    <div className="flex h-full flex-col">
      {state && (
        <div className="shrink-0">
          <ScoreRows state={state} compact={compact} />
          <StatusStrip state={state} now={now} />
          <DetailBand state={state} stats={stats} compact={compact} />
          {showLine && (
            <div className="border-b border-white/[0.07] px-3 py-2">
              <Linescore
                line={state.line}
                awayName={state.away.name}
                homeName={state.home.name}
                isFinal={state.kind === "final"}
                compact={compact}
              />
            </div>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {others.length > 0 && (
          <div className="px-3 pb-0.5 pt-1.5 font-display text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">
            Other games · {others.length}
          </div>
        )}
        <ul className="divide-y divide-white/5">
          {others.map((g) => (
            <GameRow key={g.gamePk} game={g} selected={false} onSelect={onSelect} variant="line" />
          ))}
        </ul>
      </div>
    </div>
  );
}
