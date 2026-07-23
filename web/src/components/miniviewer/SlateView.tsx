import { groupGames, type MiniGame } from "../../lib/miniviewer";
import GameRow from "./parts/GameRow";

export default function SlateView({
  games,
  selectedGamePk,
  onSelect,
}: {
  games: MiniGame[];
  selectedGamePk: number | null;
  onSelect: (gamePk: number) => void;
}) {
  const groups = groupGames(games);
  return (
    <div className="h-full overflow-y-auto">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="flex items-center gap-2 bg-white/[0.03] px-3 pb-1 pt-1.5">
            <h3
              className={`font-display text-[9px] font-bold uppercase tracking-[0.14em] ${
                group.key === "live" ? "text-volt-500" : "text-white/40"
              }`}
            >
              {group.label}
            </h3>
            <div className="h-px flex-1 bg-white/[0.07]" />
          </div>
          <ul className="divide-y divide-white/5">
            {group.games.map((g) => (
              <GameRow
                key={g.gamePk}
                game={g}
                selected={g.gamePk === selectedGamePk}
                onSelect={onSelect}
                variant="stacked"
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
