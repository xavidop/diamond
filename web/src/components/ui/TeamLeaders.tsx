import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/mlb";
import {
  LEADER_CATEGORY_PARAM,
  pickLeaders,
  HITTING_LEADER_CATS,
  PITCHING_LEADER_CATS,
  type CatLeaders,
} from "../../lib/teamLeaders";
import { Card, SectionTitle } from "./Primitives";

function CatBlock({ cat }: { cat: CatLeaders }) {
  return (
    <div className="rounded-lg bg-pitch-900/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-pitch-300">{cat.label}</div>
      <ol className="mt-1 space-y-0.5">
        {cat.leaders.map((l, i) => (
          <li key={`${l.rank}-${l.personId ?? i}`} className="flex items-baseline justify-between gap-2 text-sm">
            <Link
              to={`/players/${l.personId}`}
              className="truncate text-white hover:underline"
            >
              <span className="text-pitch-300">{l.rank}.</span> {l.name}
            </Link>
            <span className="shrink-0 font-mono tabular-nums text-white">{l.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function TeamLeaders({ teamId }: { teamId: number | string }) {
  const { data } = useQuery({
    queryKey: ["teamLeaders", String(teamId)],
    queryFn: () =>
      api.teamLeaders(teamId, LEADER_CATEGORY_PARAM, new Date().getFullYear()),
    staleTime: 6 * 60 * 60_000,
  });

  const hitting = data ? pickLeaders(data, HITTING_LEADER_CATS) : [];
  const pitching = data ? pickLeaders(data, PITCHING_LEADER_CATS) : [];
  if (hitting.length === 0 && pitching.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionTitle title="Team Leaders" subtitle="Season" />
      <Card>
        {hitting.length > 0 && (
          <>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-pitch-300">
              Hitting
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {hitting.map((c) => (
                <CatBlock key={c.key} cat={c} />
              ))}
            </div>
          </>
        )}
        {pitching.length > 0 && (
          <>
            <div className="mb-2 mt-4 text-[10px] uppercase tracking-wider text-pitch-300">
              Pitching
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {pitching.map((c) => (
                <CatBlock key={c.key} cat={c} />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
