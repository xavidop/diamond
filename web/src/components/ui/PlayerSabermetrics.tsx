import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/mlb";
import { Card, SectionTitle } from "./Primitives";

function fmt(v: any, digits = 0): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return digits > 0 ? n.toFixed(digits) : String(v);
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-pitch-900/60 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-pitch-300">{label}</div>
      <div className="font-mono text-xl tabular-nums text-white">{value}</div>
    </div>
  );
}

export default function PlayerSabermetrics({
  personId,
  isPitcher,
  season,
}: {
  personId: number | string;
  isPitcher: boolean;
  season: number | string;
}) {
  const group = isPitcher ? "pitching" : "hitting";
  const { data } = useQuery({
    queryKey: ["sabermetrics", String(personId), group, String(season)],
    queryFn: () => api.personSabermetrics(personId, group, season),
    staleTime: 60 * 60_000,
    retry: false,
  });

  const stat = data?.stats?.[0]?.splits?.[0]?.stat;
  if (!stat) return null;

  const tiles: [string, string][] = isPitcher
    ? [
        ["WAR", fmt(stat.war, 1)],
        ["FIP", fmt(stat.fip, 2)],
        ["xFIP", fmt(stat.xfip, 2)],
        ["RA9-WAR", fmt(stat.ra9War, 1)],
      ]
    : [
        ["WAR", fmt(stat.war, 1)],
        ["wRC+", fmt(stat.wRcPlus, 0)],
        ["wRAA", fmt(stat.wRaa, 1)],
        ["wOBA", fmt(stat.woba)],
      ];

  return (
    <div className="space-y-3">
      <SectionTitle title="Sabermetrics" subtitle="Advanced value metrics" />
      <Card>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map(([label, value]) => (
            <Tile key={label} label={label} value={value} />
          ))}
        </div>
      </Card>
    </div>
  );
}
