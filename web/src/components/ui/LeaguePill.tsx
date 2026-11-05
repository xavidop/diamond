import { gameLeagueId, leagueAbbr, type LeagueTaggedGame } from "../../api/leagues";
import { useLeagues } from "../../hooks/useLeagues";
import { cn } from "../../lib/utils";

/**
 * Small tag naming the league a game belongs to (LIDOM, LVBP, AFL…). Renders
 * nothing for single-competition sports like MLB, or when the user has already
 * filtered down to one league — the tag would be redundant noise then.
 */
export default function LeaguePill({
  game,
  className,
}: {
  game: LeagueTaggedGame;
  className?: string;
}) {
  const { hasSubleagues, leagues, leagueId } = useLeagues();
  if (!hasSubleagues || leagueId != null) return null;
  const id = gameLeagueId(game);
  const abbr = leagueAbbr(
    leagues,
    id,
    game.teams?.home?.team?.league?.name ?? game.teams?.away?.team?.league?.name
  );
  if (!abbr) return null;
  return (
    <span
      className={cn("pill bg-volt-500/[0.12] text-volt-500 border-volt-500/30 shrink-0", className)}
      title="League"
    >
      {abbr}
    </span>
  );
}
