import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api, playerHeadshotUrl } from "../api/mlb";
import {
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { useSport } from "../contexts/SportContext";

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const { sportId } = useSport();

  const { data, isLoading, error } = useQuery({
    queryKey: ["search", sportId, q],
    queryFn: () => api.search(q, { sportId }),
    enabled: q.length > 1,
  });

  const people = (data?.people ?? []) as any[];

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Search"
        subtitle={q ? `Results for “${q}”` : "Type a query in the header"}
      />
      {!q && <Empty message="Enter a player name to search." />}
      {q && isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {error && <ErrorBox error={error} />}
      {q && !isLoading && people.length === 0 && (
        <Empty message="No players found." />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {people.map((p) => (
          <Link key={p.id} to={`/players/${p.id}`} className="card card-pad flex items-center gap-3 hover:bg-pitch-900/80">
            <img
              src={playerHeadshotUrl(p.id, 60)}
              alt=""
              className="h-14 w-14 rounded-xl object-cover object-top shrink-0 bg-pitch-800"
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
            />
            <div className="min-w-0">
              <div className="font-display font-bold text-sm uppercase tracking-wide text-white truncate">{p.fullName}</div>
              <div className="text-xs text-pitch-300/70 truncate">
                {p.primaryPosition?.name ?? ""}
                {p.currentTeam?.name ? ` · ${p.currentTeam.name}` : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
