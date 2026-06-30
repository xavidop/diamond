// web/src/components/ui/TeamTransactions.tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import { api } from "../../api/mlb";
import { Card, Empty, ErrorBox, Spinner } from "./Primitives";
import { todayIso } from "../../lib/utils";

export default function TeamTransactions({
  teamId,
  limit,
}: {
  teamId: number | string;
  /** When set, only the most recent `limit` transactions are shown. */
  limit?: number;
}) {
  const start = `${new Date().getFullYear()}-01-01`;
  const end = todayIso();
  const q = useQuery({
    queryKey: ["teamTransactions", teamId, start, end],
    queryFn: () =>
      api.transactions({ teamId, startDate: start, endDate: end }),
  });

  if (q.isLoading)
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  if (q.error) return <ErrorBox error={q.error} />;

  const all = ((q.data?.transactions ?? []) as any[]).slice().reverse();
  if (all.length === 0)
    return <Empty message="No transactions this season." />;
  const txns = limit ? all.slice(0, limit) : all;

  return (
    <Card pad={false}>
      <ul className="divide-y divide-white/5">
        {txns.map((t: any, i: number) => (
          <li key={`${t.id}-${t.date}-${i}`} className="px-4 py-3 flex items-start gap-3">
            <span className="pill mt-0.5 shrink-0">{t.typeCode ?? "—"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                {t.person ? (
                  <Link
                    to={`/players/${t.person.id}`}
                    className="font-semibold hover:text-white"
                  >
                    {t.person.fullName}
                  </Link>
                ) : null}{" "}
                <span className="text-pitch-300">{t.description}</span>
              </div>
              {t.fromTeam && t.toTeam && (
                <div className="mt-0.5 text-[11px] text-pitch-300/70 flex items-center gap-2">
                  <Link to={`/teams/${t.fromTeam.id}`} className="hover:text-white">
                    {t.fromTeam.name}
                  </Link>
                  <ArrowLeftRight size={10} />
                  <Link to={`/teams/${t.toTeam.id}`} className="hover:text-white">
                    {t.toTeam.name}
                  </Link>
                </div>
              )}
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-pitch-300/50">
                {(t.date ?? "").slice(0, 10)}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {limit && all.length > txns.length && (
        <div className="px-4 py-2 border-t border-white/5 text-[11px] text-pitch-300/50">
          +{all.length - txns.length} more this season
        </div>
      )}
    </Card>
  );
}
