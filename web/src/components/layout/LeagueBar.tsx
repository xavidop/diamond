import { Layers } from "lucide-react";
import { useLeagues } from "../../hooks/useLeagues";
import { cn } from "../../lib/utils";

/**
 * Chip row to filter a multi-league sport (Winter Leagues, Independent, …) down
 * to one of its leagues. Hidden for sports like MLB whose leagues are halves of
 * a single competition. Shown above every page so the choice applies app-wide.
 */
export default function LeagueBar() {
  const { hasSubleagues, leagues, leagueId, setLeagueId } = useLeagues();
  if (!hasSubleagues || leagues.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="League"
      className="league-bar mb-6 -mx-4 px-4 flex items-center gap-2 overflow-x-auto"
    >
      <span className="inline-flex items-center gap-1.5 shrink-0 font-display font-bold text-[9px] tracking-[0.22em] uppercase text-white/25 mr-1">
        <Layers size={11} />
        League
      </span>
      <Chip active={leagueId == null} onClick={() => setLeagueId(null)} title="All leagues">
        All
      </Chip>
      {leagues.map((l) => (
        <Chip
          key={l.id}
          active={leagueId === l.id}
          onClick={() => setLeagueId(l.id)}
          title={l.name}
        >
          {l.abbreviation}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={title}
      onClick={onClick}
      className={cn(
        "league-chip shrink-0 rounded-full border px-3 py-1 font-display font-bold text-[10px] tracking-[0.12em] uppercase transition-colors",
        active
          ? "bg-volt-500 border-volt-500 text-black"
          : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.08] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
