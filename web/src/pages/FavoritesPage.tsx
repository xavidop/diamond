import { Link } from "react-router-dom";
import { Star, Trash2 } from "lucide-react";
import { useFavorites } from "../contexts/FavoritesContext";
import { playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import { Empty, SectionTitle } from "../components/ui/Primitives";

export default function FavoritesPage() {
  const { favs, remove } = useFavorites();

  const teams = favs.filter((f) => f.kind === "team");
  const players = favs.filter((f) => f.kind === "player");

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Favorites"
        subtitle="Quick access to your starred teams & players."
      />

      {favs.length === 0 && (
        <Empty message="Star teams or players from their pages to see them here." />
      )}

      {teams.length > 0 && (
        <div>
          <h3 className="mb-3 font-display font-bold text-[9px] tracking-[0.22em] uppercase text-white/25">
            Teams
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {teams.map((t) => (
              <div key={t.id} className="card card-pad relative group">
                <button
                  onClick={() => remove("team", t.id)}
                  className="absolute top-1.5 right-1.5 text-pitch-300/60 hover:text-volt-500 opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
                <Link
                  to={`/teams/${t.id}`}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <img
                    src={teamLogoUrl(t.id)}
                    alt=""
                    className="h-8 w-8 object-contain shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                  />
                  <div className="font-display font-bold text-sm uppercase tracking-wide text-white leading-tight truncate w-full">
                    {t.name}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {players.length > 0 && (
        <div>
          <h3 className="mb-3 font-display font-bold text-[9px] tracking-[0.22em] uppercase text-white/25">
            Players
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map((p) => (
              <div key={p.id} className="card card-pad flex items-center gap-3 group relative">
                <button
                  onClick={() => remove("player", p.id)}
                  className="absolute top-1.5 right-1.5 text-pitch-300/60 hover:text-volt-500 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
                <img
                  src={playerHeadshotUrl(p.id, 60)}
                  alt=""
                  className="h-10 w-10 rounded-xl object-cover object-top shrink-0 bg-pitch-800"
                  onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/players/${p.id}`}
                    className="font-display font-bold text-sm uppercase tracking-wide text-white truncate block hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-1 text-xs text-pitch-300/70">
                    <Star size={10} className="text-amber-400" /> Favorite
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
