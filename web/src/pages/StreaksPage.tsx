import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import {
  Card,
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { useSport } from "../contexts/SportContext";
import { shiftDate, todayIso } from "../lib/utils";
import { Flame, Snowflake } from "lucide-react";

type Window = 7 | 14 | 30;

const HITTING_SORTS = [
  { id: "homeRuns", label: "HR", desc: true },
  { id: "battingAverage", label: "AVG", desc: true, rate: true },
  { id: "onBasePlusSlugging", label: "OPS", desc: true, rate: true },
  { id: "hits", label: "H", desc: true },
  { id: "runsBattedIn", label: "RBI", desc: true },
  { id: "stolenBases", label: "SB", desc: true },
];

const PITCHING_SORTS = [
  { id: "earnedRunAverage", label: "ERA", desc: false, rate: true },
  { id: "strikeOuts", label: "K", desc: true },
  { id: "wins", label: "W", desc: true },
  { id: "saves", label: "SV", desc: true },
  { id: "walksAndHitsPerInningPitched", label: "WHIP", desc: false, rate: true },
];

export default function StreaksPage() {
  const { sportId, sport } = useSport();
  const [windowDays, setWindowDays] = useState<Window>(7);
  const [group, setGroup] = useState<"hitting" | "pitching">("hitting");
  const sortOpts = group === "hitting" ? HITTING_SORTS : PITCHING_SORTS;
  const [sort, setSort] = useState(sortOpts[0].id);

  // Keep sort valid when group toggles
  if (!sortOpts.find((s) => s.id === sort)) setSort(sortOpts[0].id);

  const today = todayIso();
  const start = shiftDate(today, -(windowDays - 1));

  const sortDef = sortOpts.find((s) => s.id === sort)!;

  const stats = useQuery({
    queryKey: [
      "streaks",
      sportId,
      windowDays,
      group,
      sort,
    ],
    queryFn: () =>
      api.statsByDateRange({
        startDate: start,
        endDate: today,
        group,
        sportIds: sportId,
        sortStat: sort,
        order: sortDef.desc ? "desc" : "asc",
        playerPool: "All",
        limit: 25,
      }),
  });

  const splits = useMemo(
    () => (stats.data?.stats?.[0]?.splits ?? []) as any[],
    [stats.data]
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`Hot & Cold · ${sport.abbreviation}`}
        subtitle={`Performance over the last ${windowDays} days (${start} → ${today})`}
        right={
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {([7, 14, 30] as Window[]).map((w) => (
              <button
                key={w}
                onClick={() => setWindowDays(w)}
                className={`px-3 py-1.5 text-sm ${
                  windowDays === w
                    ? "bg-volt-500 text-black"
                    : "bg-pitch-900/40 hover:bg-pitch-800"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(["hitting", "pitching"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`px-3 py-1.5 text-sm capitalize ${
                  group === g
                    ? "bg-volt-500 text-black"
                    : "bg-pitch-900/40 hover:bg-pitch-800"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {sortOpts.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={`btn ${sort === s.id ? "btn-accent" : ""}`}
              >
                {s.desc ? (
                  <Flame size={12} className="text-amber-400" />
                ) : (
                  <Snowflake size={12} className="text-sky-300" />
                )}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {stats.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {stats.error && <ErrorBox error={stats.error} />}

      {!stats.isLoading && splits.length === 0 && (
        <Empty message="No data in this window. Try a longer window or a different stat." />
      )}

      {splits.length > 0 && (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Player</th>
                  <th>Team</th>
                  {sortOpts.map((s) => (
                    <th key={s.id} className="text-right">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {splits.map((s: any, idx: number) => {
                  const p = s.player;
                  const t = s.team;
                  return (
                    <tr key={`${p?.id}-${idx}`}>
                      <td className="tabular-nums text-pitch-300/70">
                        {idx + 1}
                      </td>
                      <td>
                        <Link
                          to={`/players/${p?.id}`}
                          className="flex items-center gap-2 hover:text-white"
                        >
                          <img
                            src={playerHeadshotUrl(p?.id, 60)}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover bg-pitch-800"
                          />
                          {p?.fullName}
                        </Link>
                      </td>
                      <td>
                        {t && (
                          <Link
                            to={`/teams/${t.id}`}
                            className="flex items-center gap-2 hover:text-white"
                          >
                            <img
                              src={teamLogoUrl(t.id)}
                              alt=""
                              className="h-5 w-5 object-contain"
                            />
                            <span className="truncate">
                              {t.abbreviation ?? t.name}
                            </span>
                          </Link>
                        )}
                      </td>
                      {sortOpts.map((col) => {
                        const v = s.stat?.[mapKey(col.id)];
                        return (
                          <td
                            key={col.id}
                            className={`text-right font-mono tabular-nums ${
                              col.id === sort ? "text-white" : "text-pitch-300"
                            }`}
                          >
                            {fmtVal(v, col.rate)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// API returns these short keys on the stat object
function mapKey(id: string): string {
  switch (id) {
    case "battingAverage":
      return "avg";
    case "onBasePlusSlugging":
      return "ops";
    case "earnedRunAverage":
      return "era";
    case "walksAndHitsPerInningPitched":
      return "whip";
    case "runsBattedIn":
      return "rbi";
    default:
      return id;
  }
}

function fmtVal(v: unknown, rate?: boolean) {
  if (v === undefined || v === null || v === "") return "—";
  if (rate) return String(v);
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}
