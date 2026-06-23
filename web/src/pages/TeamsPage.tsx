import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, teamLogoUrl } from "../api/mlb";
import {
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { useSport } from "../contexts/SportContext";

export default function TeamsPage() {
  const [q, setQ] = useState("");
  const { sportId, sport } = useSport();
  const { data, isLoading, error } = useQuery({
    queryKey: ["teams", sportId],
    queryFn: () => api.teams({ sportId }),
  });

  const teams = useMemo(() => {
    const list = (data?.teams ?? []) as any[];
    const filtered = q
      ? list.filter((t) =>
          (t.name + " " + (t.locationName ?? "") + " " + (t.abbreviation ?? ""))
            .toLowerCase()
            .includes(q.toLowerCase())
        )
      : list;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [data, q]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`${sport.name} · Teams`}
        subtitle={`${teams.length} clubs`}
        right={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter teams…"
            className="input w-56"
          />
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {error && <ErrorBox error={error} />}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {teams.map((t) => (
          <Link
            key={t.id}
            to={`/teams/${t.id}`}
            className="card card-pad flex flex-col items-center gap-2 hover:bg-pitch-900/80 transition-colors text-center"
          >
            <img
              src={teamLogoUrl(t.id)}
              alt={t.name}
              className="h-16 w-16 object-contain"
            />
            <div className="text-sm font-semibold leading-tight">{t.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
              {t.league?.name ?? ""} · {t.division?.name?.split(" ").pop()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
