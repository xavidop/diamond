import type { MiniGameState } from "../../../lib/miniviewer";
import type { StatLine } from "../../../lib/miniBoxscore";
import { playerHeadshotUrl } from "../../../api/mlb";

const LABEL = "font-display text-[9px] font-bold uppercase tracking-[0.14em] text-white/40";
const BAND = "border-b border-white/[0.07] px-3 py-2";

export type BandStats = { pitcher: StatLine | null; batter: StatLine | null };

export default function DetailBand({
  state,
  stats,
  compact = false,
}: {
  state: MiniGameState;
  stats: BandStats;
  compact?: boolean;
}) {
  if (state.kind === "live") {
    return (
      <div className={BAND}>
        <div className="flex items-baseline gap-2">
          <span className={`${LABEL} w-[34px]`}>P</span>
          <span className="truncate font-semibold">{state.pitcher?.fullName ?? "—"}</span>
          <span className="ml-auto shrink-0 text-right font-mono text-[10px] text-white/35">
            {stats.pitcher && (
              <>
                <span>{stats.pitcher.season}</span>
                {stats.pitcher.game ? <> · <span>{stats.pitcher.game}</span></> : null}
              </>
            )}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className={`${LABEL} w-[34px] text-volt-500`}>AB</span>
          <span className="truncate font-semibold">{state.batter?.fullName ?? "—"}</span>
          <span className="ml-auto shrink-0 text-right font-mono text-[10px] text-white/35">
            {stats.batter && (
              <>
                <span>{stats.batter.season}</span>
                {stats.batter.game ? <> · <span>{stats.batter.game}</span></> : null}
              </>
            )}
          </span>
        </div>
        {state.onDeck?.fullName && (
          <div className="mt-1.5 font-mono text-[10px] text-white/35">On deck · {state.onDeck.fullName}</div>
        )}
      </div>
    );
  }

  if (state.kind === "final") {
    const rows: [string, string, string | undefined][] = [
      ["W", "text-volt-500", state.decisions.win?.fullName],
      ["L", "text-danger-500", state.decisions.loss?.fullName],
      ["SV", "text-white/40", state.decisions.save?.fullName],
    ];
    const present = rows.filter(([, , name]) => !!name);
    if (present.length === 0) return null;
    return (
      <div className={BAND}>
        <div className={`${LABEL} mb-1.5`}>Decisions</div>
        {present.map(([key, tone, name], i) => (
          <div key={key} className={`flex items-baseline gap-2 ${i > 0 ? "mt-1.5" : ""}`}>
            <span
              className={`${LABEL} w-[22px] ${tone}`}
              {...(key === "L" ? { "data-cb-bad": "" } : {})}
            >
              {key}
            </span>
            <span className="truncate font-semibold">{name}</span>
          </div>
        ))}
      </div>
    );
  }

  if (state.kind === "scheduled" || state.kind === "postponed") {
    if (state.kind === "postponed") return null;
    const pitcher = (p: { id?: number; name: string; line: string }) => (
      <div className="flex items-center gap-2.5">
        {!compact && p.id != null && (
          <img
            src={playerHeadshotUrl(p.id, 90)}
            alt=""
            className="h-[38px] w-[38px] shrink-0 rounded-full bg-pitch-700 object-cover object-top"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
        )}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{p.name}</div>
          {p.line && <div className="truncate font-mono text-[10px] text-white/35">{p.line}</div>}
        </div>
      </div>
    );
    return (
      <div className={BAND}>
        <div className={`${LABEL} mb-1.5`}>Probable pitchers</div>
        {pitcher(state.probables.away)}
        <div className="my-1.5 flex items-center gap-2.5">
          <div className="h-px flex-1 bg-white/[0.07]" />
          <span className={LABEL}>vs</span>
          <div className="h-px flex-1 bg-white/[0.07]" />
        </div>
        {pitcher(state.probables.home)}
      </div>
    );
  }

  return null;
}
