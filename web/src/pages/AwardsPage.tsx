import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { api, playerHeadshotUrl, teamLogoUrl } from "../api/mlb";
import {
  Card,
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";

const FEATURED = [
  "MLBMVP",
  "ALMVP",
  "NLMVP",
  "ALCY",
  "NLCY",
  "ALROY",
  "NLROY",
  "WSMVP",
  "ALCSMVP",
  "NLCSMVP",
  "MLBHOF",
];

export default function AwardsPage() {
  const [awardId, setAwardId] = useState<string>("ALMVP");
  const [season, setSeason] = useState<string>("");

  const list = useQuery({
    queryKey: ["awards-list"],
    queryFn: () => api.awards(),
  });

  const recipients = useQuery({
    queryKey: ["award-recipients", awardId, season],
    queryFn: () =>
      api.awardRecipients(awardId, season ? { season } : {}),
    enabled: !!awardId,
  });

  const awards = ((list.data?.awards ?? []) as any[])
    .filter((a) => a.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const featured = useMemo(
    () => FEATURED.map((id) => awards.find((a) => a.id === id)).filter(Boolean),
    [awards]
  );

  const winners = ((recipients.data?.awards ?? []) as any[])
    .slice()
    .sort((a, b) => Number(b.season ?? 0) - Number(a.season ?? 0));

  const activeAward = awards.find((a) => a.id === awardId);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Awards"
        subtitle="MVP, Cy Young, Rookie of the Year and more — by season."
        right={
          <input
            type="number"
            placeholder="Year (optional)"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="input w-36"
          />
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {featured.map((a: any) => (
            <button
              key={a.id}
              onClick={() => setAwardId(a.id)}
              className={`btn ${awardId === a.id ? "btn-accent" : ""}`}
            >
              <Award size={12} />
              {a.name}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-pitch-300/60 mb-2">
          All awards ({awards.length}):
        </div>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {awards.map((a) => (
            <button
              key={a.id}
              onClick={() => setAwardId(a.id)}
              className={`pill text-[11px] hover:bg-pitch-700/40 ${
                awardId === a.id ? "bg-pitch-700/60 text-white" : ""
              }`}
              title={a.name}
            >
              {a.id}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3">
          <div className="text-xs uppercase tracking-wider text-pitch-300/70">
            Selected award
          </div>
          <div className="text-lg font-semibold text-white">
            {activeAward?.name ?? awardId}
          </div>
          {activeAward?.notes && (
            <div className="text-[11px] text-pitch-300/70 mt-1">
              {activeAward.notes}
            </div>
          )}
        </div>

        {recipients.isLoading && <Spinner />}
        {recipients.error && <ErrorBox error={recipients.error} />}
        {!recipients.isLoading && winners.length === 0 && (
          <Empty message="No recipients available for that selection." />
        )}

        {winners.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-20">Season</th>
                  <th>Recipient</th>
                  <th>Team</th>
                  <th>Position</th>
                  <th>Votes</th>
                </tr>
              </thead>
              <tbody>
                {winners.map((w: any) => (
                  <tr key={`${w.season}-${w.player?.id ?? w.team?.id}`}>
                    <td className="tabular-nums font-mono">{w.season}</td>
                    <td>
                      {w.player ? (
                        <Link
                          to={`/players/${w.player.id}`}
                          className="flex items-center gap-2 hover:text-white"
                        >
                          <img
                            src={playerHeadshotUrl(w.player.id, 60)}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover bg-pitch-800"
                          />
                          {w.player.nameFirstLast ?? w.player.fullName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {w.team && (
                        <Link
                          to={`/teams/${w.team.id}`}
                          className="flex items-center gap-2 hover:text-white"
                        >
                          <img
                            src={teamLogoUrl(w.team.id)}
                            alt=""
                            className="h-5 w-5 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                          <span className="truncate">{w.team.name}</span>
                        </Link>
                      )}
                    </td>
                    <td className="text-pitch-300/80">
                      {w.player?.primaryPosition?.abbreviation ?? "—"}
                    </td>
                    <td className="tabular-nums font-mono text-pitch-300/80">
                      {w.votes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
