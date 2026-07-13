import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/mlb";
import { Card, SectionTitle } from "./Primitives";

function d(v: any): string {
  return v == null || v === "" ? "—" : String(v);
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-pitch-900/60 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-pitch-300">{label}</div>
      <div className="font-mono text-lg tabular-nums text-white">{value}</div>
    </div>
  );
}

export default function PlayerProjections({
  personId,
  isPitcher,
}: {
  personId: number | string;
  isPitcher: boolean;
}) {
  const group = isPitcher ? "pitching" : "hitting";
  const { data } = useQuery({
    queryKey: ["projections", String(personId), group],
    queryFn: () => api.personProjections(personId, group),
    staleTime: 60 * 60_000,
    retry: false,
  });

  const stat = data?.stats?.[0]?.splits?.[0]?.stat;
  if (!stat) return null;

  const tiles: [string, string][] = isPitcher
    ? [
        ["W", d(stat.wins)],
        ["ERA", d(stat.era)],
        ["IP", d(stat.inningsPitched)],
        ["SO", d(stat.strikeOuts)],
        ["BB", d(stat.baseOnBalls)],
        ["WHIP", d(stat.whip)],
      ]
    : [
        ["HR", d(stat.homeRuns)],
        ["R", d(stat.runs)],
        ["AVG", d(stat.avg)],
        ["OBP", d(stat.obp)],
        ["SLG", d(stat.slg)],
        ["OPS", d(stat.ops)],
      ];

  return (
    <div className="space-y-3">
      <SectionTitle title="Projections" subtitle="ZiPS — rest of season" />
      <Card>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {tiles.map(([label, value]) => (
            <Tile key={label} label={label} value={value} />
          ))}
        </div>
      </Card>
    </div>
  );
}
