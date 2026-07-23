import { deriveGameState, type MiniGame } from "../../../lib/miniviewer";
import { fmtGameTime } from "../../../lib/utils";
import Diamond from "./Diamond";
import Pips from "./Pips";
import TeamLogo from "./TeamLogo";

/**
 * One game in a list. `line` is the single-line form under Focus; `stacked` is
 * the away-over-home form used by Slate.
 */
export default function GameRow({
  game,
  selected,
  onSelect,
  variant,
}: {
  game: MiniGame;
  selected: boolean;
  onSelect: (gamePk: number) => void;
  variant: "line" | "stacked";
}) {
  const s = deriveGameState(game);
  const live = s.kind === "live";

  const status =
    s.kind === "live" ? `${s.isTop ? "▲" : "▼"} ${s.inningOrdinal}`
    : s.kind === "final" ? (s.extras ? `Final/${s.extras}` : "Final")
    : s.kind === "postponed" ? "Ppd"
    : game.gameDate ? fmtGameTime(game.gameDate)
    : "";

  const loserSide = s.kind === "final" ? (s.winnerSide === "away" ? "home" : s.winnerSide === "home" ? "away" : null) : null;
  const dim = (which: "away" | "home") => (loserSide === which ? "opacity-55" : "");

  const liveBits = live ? (
    <>
      <Diamond bases={s.bases} size="sm" />
      <Pips count={3} filled={s.outs} kind="out" label={`${s.outs} out`} size="sm" />
    </>
  ) : null;

  const score = (v: number | null) =>
    v == null ? <span className="text-white/30">—</span> : v;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(game.gamePk)}
        aria-current={selected ? "true" : undefined}
        className={`flex w-full items-center gap-2 border-b border-white/5 px-3 text-left hover:bg-white/5 ${
          variant === "stacked" ? "py-1.5" : "py-2"
        } ${selected ? "bg-white/10" : ""}`}
      >
        {variant === "line" ? (
          <>
            <TeamLogo id={s.away.teamId} size={17} />
            <span className={`w-[34px] font-display text-sm font-extrabold uppercase ${dim("away")}`}>{s.away.name}</span>
            <span className={`font-mono text-[13px] ${dim("away")}`}>{score(s.away.score)}</span>
            <span className="text-white/30">@</span>
            <TeamLogo id={s.home.teamId} size={17} />
            <span className={`w-[34px] font-display text-sm font-extrabold uppercase ${dim("home")}`}>{s.home.name}</span>
            <span className={`font-mono text-[13px] ${dim("home")}`}>{score(s.home.score)}</span>
            <span className="ml-auto flex items-center gap-1.5">
              {liveBits}
              <span className={`font-display text-[10px] font-bold uppercase tracking-[0.09em] ${live ? "text-volt-500" : "text-white/35"}`}>
                {status}
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className={`flex items-center gap-2 ${dim("away")}`}>
                <TeamLogo id={s.away.teamId} size={17} />
                <span className="font-display text-sm font-extrabold uppercase">{s.away.name}</span>
                <span className="ml-auto font-mono text-sm">{score(s.away.score)}</span>
              </span>
              <span className={`mt-[3px] flex items-center gap-2 ${dim("home")}`}>
                <TeamLogo id={s.home.teamId} size={17} />
                <span className="font-display text-sm font-extrabold uppercase">{s.home.name}</span>
                <span className="ml-auto font-mono text-sm">{score(s.home.score)}</span>
              </span>
            </span>
            <span className="flex w-[64px] flex-col items-center gap-1 border-l border-white/10 pl-2">
              <span className={`font-display text-[10.5px] font-extrabold uppercase tracking-[0.09em] ${live ? "text-volt-500" : "text-white/35"}`}>
                {status}
              </span>
              {liveBits}
            </span>
          </>
        )}
      </button>
    </li>
  );
}
