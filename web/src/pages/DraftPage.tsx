import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import {
  Card,
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";

const CURRENT = new Date().getFullYear();

export default function DraftPage() {
  const [year, setYear] = useState(CURRENT - 1);
  const [round, setRound] = useState("1");
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["draft", year],
    queryFn: () => api.meta(`draft/${year}`),
  });

  const rounds = useMemo(
    () => ((data?.drafts?.rounds ?? []) as any[]),
    [data]
  );

  const activeRound = rounds.find((r) => String(r.round) === round) ?? rounds[0];
  const picks = ((activeRound?.picks ?? []) as any[]).filter((p) => {
    if (!q) return true;
    const hay = [p.person?.fullName, p.team?.name, p.school, p.headshotLink]
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title="MLB Draft"
        subtitle="Browse picks by year and round."
        right={
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1965}
              max={CURRENT}
              value={year}
              onChange={(e) => setYear(Number(e.target.value || CURRENT))}
              className="input w-28 text-center font-mono"
            />
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {error && <ErrorBox error={error} />}
      {!isLoading && rounds.length === 0 && <Empty message="No draft data." />}

      {rounds.length > 0 && (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-1">
                {rounds.map((r) => (
                  <button
                    key={String(r.round)}
                    onClick={() => setRound(String(r.round))}
                    className={`btn ${
                      String(r.round) === String(activeRound?.round)
                        ? "btn-primary"
                        : ""
                    }`}
                  >
                    R{r.round}
                  </button>
                ))}
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter picks…"
                className="input w-60 ml-auto"
              />
            </div>
          </Card>

          <Card pad={false}>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="w-12">Pick</th>
                    <th>Player</th>
                    <th>Team</th>
                    <th>School</th>
                    <th>Pos</th>
                    <th className="text-right">B/T</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((p) => (
                    <tr key={`${p.pickRound}-${p.pickNumber}`}>
                      <td className="font-mono tabular-nums">
                        {p.pickNumber}
                      </td>
                      <td>
                        {p.person?.id ? (
                          <Link
                            to={`/players/${p.person.id}`}
                            className="flex items-center gap-2 hover:text-white"
                          >
                            <img
                              src={playerHeadshotUrl(p.person.id, 60)}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover bg-pitch-800"
                            />
                            {p.person.fullName ?? p.name}
                          </Link>
                        ) : (
                          <span>{p.person?.fullName ?? p.name ?? "—"}</span>
                        )}
                      </td>
                      <td>
                        {p.team?.id ? (
                          <Link
                            to={`/teams/${p.team.id}`}
                            className="flex items-center gap-2 hover:text-white"
                          >
                            <img
                              src={teamLogoUrl(p.team.id)}
                              alt=""
                              className="h-5 w-5 object-contain"
                            />
                            <span className="truncate">{p.team.name}</span>
                          </Link>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="text-pitch-300/90 truncate max-w-[220px]">
                        {p.school?.name ?? p.school ?? "—"}
                      </td>
                      <td>{p.person?.primaryPosition?.abbreviation ?? "—"}</td>
                      <td className="text-right font-mono">
                        {p.person?.batSide?.code ?? "?"}/
                        {p.person?.pitchHand?.code ?? "?"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
