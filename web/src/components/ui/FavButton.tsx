import { Star } from "lucide-react";
import { useFavorites, type Fav } from "../../contexts/FavoritesContext";
import { cn } from "../../lib/utils";

export default function FavButton({
  fav,
  size = 14,
  className,
}: {
  fav: Fav;
  size?: number;
  className?: string;
}) {
  const { isFav, toggle } = useFavorites();
  const active = isFav(fav.kind, fav.id);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(fav);
      }}
      title={active ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 transition-colors",
        active
          ? "text-amber-400 hover:text-amber-300"
          : "text-pitch-300/60 hover:text-amber-400",
        className
      )}
    >
      <Star
        size={size}
        fill={active ? "currentColor" : "none"}
        strokeWidth={2}
      />
    </button>
  );
}
