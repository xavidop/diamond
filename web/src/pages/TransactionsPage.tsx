import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  Calendar,
  Filter,
  Plane,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api, teamLogoUrl } from "../api/mlb";
import {
  Card,
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { shiftDate, todayIso } from "../lib/utils";

const TYPES: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "ALL", label: "All", icon: <Filter size={12} /> },
  { id: "TR", label: "Trade", icon: <ArrowLeftRight size={12} /> },
  { id: "SFA", label: "Signed FA", icon: <TrendingUp size={12} /> },
  { id: "REL", label: "Released", icon: <TrendingDown size={12} /> },
  { id: "OPT", label: "Optioned", icon: <Plane size={12} /> },
  { id: "REC", label: "Recalled", icon: <Plane size={12} /> },
  { id: "SC", label: "Status Chg", icon: <Calendar size={12} /> },
];

export default function TransactionsPage() {
  const [days, setDays] = useState(14);
  const [type, setType] = useState("ALL");
  const start = shiftDate(todayIso(), -days);
  const end = todayIso();

  const q = useQuery({
    queryKey: ["transactions", start, end],
    queryFn: () =>
      api.transactions({
        startDate: start,
        endDate: end,
      }),
  });

  const all = (q.data?.transactions ?? []) as any[];
  const txns = useMemo(
    () =>
      (type === "ALL"
        ? all
        : all.filter((t) => t.typeCode === type)
      ).slice().reverse(),
    [all, type]
  );

  // Group by date
  const byDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of txns) {
      const d = (t.date ?? "").slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    }
    return Array.from(map.entries());
  }, [txns]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Transactions"
        subtitle={`Last ${days} days · ${start} → ${end}`}
        right={
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm ${
                  days === d
                    ? "bg-volt-500 text-black"
                    : "bg-pitch-900/40 hover:bg-pitch-800"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`btn ${type === t.id ? "btn-accent" : ""}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {q.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {q.error && <ErrorBox error={q.error} />}
      {!q.isLoading && byDate.length === 0 && (
        <Empty message="No transactions in this window." />
      )}

      {byDate.map(([date, items]) => (
        <div key={date}>
          <div className="mb-2 text-xs uppercase tracking-wider text-pitch-300/70">
            {date}
          </div>
          <Card pad={false}>
            <ul className="divide-y divide-white/5">
              {items.map((t: any, i: number) => (
                <li
                  key={`${t.id}-${t.date}-${i}`}
                  className="px-4 py-3 flex items-start gap-3"
                >
                  <span className="pill mt-0.5 shrink-0">
                    {t.typeCode ?? "—"}
                  </span>
                  {t.team && (
                    <Link
                      to={`/teams/${t.team.id}`}
                      title={t.team.name}
                      className="shrink-0"
                    >
                      <img
                        src={teamLogoUrl(t.team.id)}
                        alt=""
                        className="h-7 w-7 object-contain"
                      />
                    </Link>
                  )}
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
                      <span className="text-pitch-300">
                        {t.description}
                      </span>
                    </div>
                    {t.fromTeam && t.toTeam && (
                      <div className="mt-0.5 text-[11px] text-pitch-300/70 flex items-center gap-2">
                        <Link
                          to={`/teams/${t.fromTeam.id}`}
                          className="hover:text-white"
                        >
                          {t.fromTeam.name}
                        </Link>
                        <ArrowLeftRight size={10} />
                        <Link
                          to={`/teams/${t.toTeam.id}`}
                          className="hover:text-white"
                        >
                          {t.toTeam.name}
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ))}
    </div>
  );
}
