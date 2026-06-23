import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MapPin } from "lucide-react";
import { api, teamLogoUrl } from "../api/mlb";
import {
  Card,
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { shiftDate, todayIso } from "../lib/utils";

export default function VenuePage() {
  const { venueId } = useParams<{ venueId: string }>();
  const id = venueId!;
  const end = todayIso();
  const start = shiftDate(end, -30);

  const venue = useQuery({
    queryKey: ["venue", id],
    queryFn: () => api.venue(id),
  });
  const recent = useQuery({
    queryKey: ["venue-games", id, start, end],
    queryFn: () =>
      api.schedule({ venueIds: id, startDate: start, endDate: end }),
  });

  if (venue.isLoading)
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  if (venue.error) return <ErrorBox error={venue.error} />;
  const v = (venue.data?.venues ?? [])[0];
  if (!v) return null;
  const f = v.fieldInfo ?? {};

  const games = ((recent.data?.dates ?? []) as any[]).flatMap(
    (d) => d.games ?? []
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <Link
              to="/venues"
              className="text-xs text-pitch-300/60 hover:text-white"
            >
              ← All ballparks
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-white mt-1">
              {v.name}
            </h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-pitch-300">
              <MapPin size={14} />
              {[v.location?.city, v.location?.stateAbbrev, v.location?.country]
                .filter(Boolean)
                .join(", ")}
            </div>
          </div>
          <div className="text-xs text-pitch-300/70">
            <div>Tz: {v.timeZone?.id ?? "—"}</div>
            <div>Lat/Lng: {v.location?.latitude ?? "—"}, {v.location?.longitude ?? "—"}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Capacity" value={f.capacity} />
          <Stat label="Turf" value={f.turfType} />
          <Stat label="Roof" value={f.roofType} />
          <Stat label="LF" value={f.leftLine} suffix="ft" />
          <Stat label="LF-CF" value={f.leftCenter} suffix="ft" />
          <Stat label="CF" value={f.center} suffix="ft" />
          <Stat label="RF-CF" value={f.rightCenter} suffix="ft" />
          <Stat label="RF" value={f.rightLine} suffix="ft" />
        </div>
      </Card>

      <div>
        <SectionTitle
          title="Games here (last 30 days)"
          subtitle={`${start} → ${end}`}
        />
        {recent.isLoading ? (
          <Spinner />
        ) : games.length === 0 ? (
          <Empty message="No games at this venue in the last 30 days." />
        ) : (
          <Card pad={false}>
            <ul className="divide-y divide-white/5">
              {games.slice(0, 30).map((g: any) => (
                <li
                  key={g.gamePk}
                  className="px-4 py-2 flex items-center gap-3 text-sm"
                >
                  <span className="w-20 text-xs text-pitch-300/70">
                    {g.officialDate ?? g.gameDate?.slice(0, 10)}
                  </span>
                  <Link
                    to={`/teams/${g.teams?.away?.team?.id}`}
                    className="flex items-center gap-1 flex-1 hover:text-white"
                  >
                    <img
                      src={teamLogoUrl(g.teams?.away?.team?.id)}
                      alt=""
                      className="h-5 w-5 object-contain"
                    />
                    <span className="truncate">
                      {g.teams?.away?.team?.abbreviation ??
                        g.teams?.away?.team?.name}
                    </span>
                  </Link>
                  <span className="font-mono text-xs">
                    {g.teams?.away?.score ?? "-"} : {g.teams?.home?.score ?? "-"}
                  </span>
                  <Link
                    to={`/teams/${g.teams?.home?.team?.id}`}
                    className="flex items-center gap-1 flex-1 justify-end hover:text-white"
                  >
                    <span className="truncate text-right">
                      {g.teams?.home?.team?.abbreviation ??
                        g.teams?.home?.team?.name}
                    </span>
                    <img
                      src={teamLogoUrl(g.teams?.home?.team?.id)}
                      alt=""
                      className="h-5 w-5 object-contain"
                    />
                  </Link>
                  <Link
                    to={`/game/${g.gamePk}`}
                    className="text-xs pill hover:bg-pitch-700"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: unknown;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl bg-pitch-950/50 border border-white/5 p-2">
      <div className="text-[10px] uppercase tracking-wider text-pitch-300/70">
        {label}
      </div>
      <div className="font-mono text-white">
        {value === undefined || value === null || value === ""
          ? "—"
          : `${value}${suffix ? ` ${suffix}` : ""}`}
      </div>
    </div>
  );
}
