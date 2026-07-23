import type { MiniGameState, SideInfo } from "../../../lib/miniviewer";
import TeamLogo from "./TeamLogo";

export default function ScoreRows({
  state,
  compact = false,
}: {
  state: MiniGameState;
  compact?: boolean;
}) {
  const leader =
    state.kind === "final" ? state.winnerSide
    : state.kind === "live"
      ? (state.away.score ?? 0) === (state.home.score ?? 0)
        ? null
        : (state.away.score ?? 0) > (state.home.score ?? 0) ? "away" : "home"
      : null;
  const loser = state.kind === "final" && leader ? (leader === "away" ? "home" : "away") : null;

  const row = (which: "away" | "home", info: SideInfo) => (
    <div className={`flex items-center gap-2.5 ${loser === which ? "opacity-55" : ""} ${which === "home" ? "mt-1.5" : ""}`}>
      <TeamLogo id={info.teamId} size={compact ? 20 : 24} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-display text-[19px] font-extrabold uppercase">{info.name}</span>
          {state.kind === "final" && leader === which && (
            <span className="font-display text-sm font-extrabold text-volt-500" aria-label="Winner">◀</span>
          )}
        </div>
        {info.record && <div className="font-mono text-[10px] text-white/35">{info.record}</div>}
      </div>
      <span className={`ml-auto font-mono text-[26px] font-medium tabular-nums ${leader === which ? "text-volt-500" : "text-white/70"}`}>
        {info.score == null ? "—" : info.score}
      </span>
    </div>
  );

  return (
    <div className="px-3 pb-2 pt-2.5">
      {row("away", state.away)}
      {row("home", state.home)}
    </div>
  );
}
