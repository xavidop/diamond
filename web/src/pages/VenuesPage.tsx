import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { api } from "../api/mlb";
import {
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";

export default function VenuesPage() {
  const [q, setQ] = useState("");

  const venues = useQuery({
    queryKey: ["venues-all"],
    queryFn: () =>
      api.venues({ sportIds: 1, hydrate: "location,fieldInfo" }),
  });

  const all = (venues.data?.venues ?? []) as any[];
  const norm = q.trim().toLowerCase();
  const list = useMemo(
    () =>
      (norm
        ? all.filter((v) =>
            [v.name, v.location?.city, v.location?.country]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(norm)
          )
        : all
      )
        .filter((v) => v.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [all, norm]
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Ballparks"
        subtitle={`${list.length} venues · dimensions, capacity, location`}
        right={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            className="input w-48"
          />
        }
      />

      {venues.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {venues.error && <ErrorBox error={venues.error} />}
      {!venues.isLoading && list.length === 0 && (
        <Empty message="No venues match that filter." />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {list.map((v) => (
          <Link
            key={v.id}
            to={`/venues/${v.id}`}
            className="card card-pad block hover:bg-pitch-900/80 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-semibold text-white leading-tight">
                {v.name}
              </div>
              <span className="pill text-[10px]">#{v.id}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-pitch-300/70">
              <MapPin size={12} />
              {[
                v.location?.city,
                v.location?.stateAbbrev ?? v.location?.state,
                v.location?.country,
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            <Dims v={v} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Dims({ v }: { v: any }) {
  const f = v.fieldInfo;
  if (!f) return null;
  const rows: [string, unknown][] = [
    ["LF", f.leftLine],
    ["CF", f.center],
    ["RF", f.rightLine],
    ["Cap", f.capacity],
    ["Turf", f.turfType],
    ["Roof", f.roofType],
  ];
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
      {rows.map(([k, val]) =>
        val ? (
          <div
            key={k}
            className="rounded bg-pitch-950/50 border border-white/5 px-2 py-1"
          >
            <div className="text-[9px] uppercase tracking-wider text-pitch-300/60">
              {k}
            </div>
            <div className="font-mono text-white/70 truncate">
              {String(val)}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
