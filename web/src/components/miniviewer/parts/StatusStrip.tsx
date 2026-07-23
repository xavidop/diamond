import type { MiniGameState } from "../../../lib/miniviewer";
import { formatCountdown } from "../../../lib/miniviewer";
import { fmtGameTime } from "../../../lib/utils";
import Diamond from "./Diamond";
import Pips from "./Pips";

const LABEL = "font-display text-[9px] font-bold uppercase tracking-[0.14em] text-white/40";
const STRIP = "flex items-center gap-3 border-y border-white/[0.07] bg-white/[0.045] px-3 py-2";

/** `now` is injected rather than read from Date.now() so the countdown is testable. */
export default function StatusStrip({ state, now }: { state: MiniGameState; now: number }) {
  if (state.kind === "live") {
    return (
      <div className={STRIP}>
        <div>
          <div className={LABEL}>Inning</div>
          <div className="font-display text-[17px] font-black text-volt-500">
            {state.isTop ? "▲" : "▼"} {state.inningOrdinal.toUpperCase()}
          </div>
        </div>
        <Diamond bases={state.bases} />
        <div className="ml-auto text-right">
          <div className={`${LABEL} mb-[3px]`}>Count</div>
          <div className="font-mono text-[17px] font-medium">{state.balls}-{state.strikes}</div>
        </div>
        <div>
          <div className={`${LABEL} mb-1`}>Out</div>
          <Pips count={3} filled={state.outs} kind="out" label={`${state.outs} out`} />
        </div>
      </div>
    );
  }

  if (state.kind === "final") {
    return (
      <div className={STRIP}>
        <div className="font-display text-[17px] font-black tracking-[0.1em]">
          {state.extras ? `FINAL/${state.extras}` : "FINAL"}
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
          {state.chips.map((c) => <span key={c} className="pill">{c}</span>)}
        </div>
      </div>
    );
  }

  if (state.kind === "postponed") {
    return (
      <div className={STRIP}>
        <div className="font-display text-[17px] font-black uppercase tracking-[0.1em] text-white/70">
          {state.reason}
        </div>
      </div>
    );
  }

  const remaining = state.startsAt ? state.startsAt.getTime() - now : NaN;
  const countdown = Number.isNaN(remaining) ? "" : formatCountdown(remaining);
  return (
    <div className={STRIP}>
      <div>
        <div className={LABEL}>First pitch</div>
        <div className="font-display text-[17px] font-black">
          {state.startsAt ? fmtGameTime(state.startsAt) : "TBD"}
        </div>
      </div>
      {countdown && (
        <div className="ml-auto text-right">
          <div className={LABEL}>Starts in</div>
          <div className="font-mono text-[15px] text-volt-500">{countdown}</div>
        </div>
      )}
    </div>
  );
}
