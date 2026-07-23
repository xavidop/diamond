import { teamLogoUrl } from "../../../api/mlb";

export default function TeamLogo({ id, size = 24 }: { id?: number; size?: number }) {
  if (!id) return null;
  return (
    <img
      src={teamLogoUrl(id)}
      alt=""
      style={{ height: size, width: size }}
      className="shrink-0 object-contain"
      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
    />
  );
}
