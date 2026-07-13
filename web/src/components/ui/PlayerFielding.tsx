import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/mlb";
import { Card, SectionTitle } from "./Primitives";

type FieldRow = {
  pos: string;
  g: any;
  fpct: any;
  po: any;
  a: any;
  e: any;
  dp: any;
};

function parseFielding(raw: any): FieldRow[] {
  const splits = (raw?.stats?.[0]?.splits ?? []) as any[];
  const rows: FieldRow[] = [];
  for (const s of splits) {
    const st = s?.stat ?? {};
    const pos = st.position?.abbreviation ?? "";
    // Skip DH / positions with no defensive activity.
    if (pos === "DH") continue;
    if ((st.gamesPlayed ?? 0) === 0 && (st.putOuts ?? 0) === 0 && (st.assists ?? 0) === 0)
      continue;
    rows.push({
      pos,
      g: st.gamesPlayed,
      fpct: st.fielding,
      po: st.putOuts,
      a: st.assists,
      e: st.errors,
      dp: st.doublePlays,
    });
  }
  return rows;
}

function d(v: any): string {
  return v == null || v === "" ? "—" : String(v);
}

export default function PlayerFielding({
  personId,
  season,
}: {
  personId: number | string;
  season: number | string;
}) {
  const { data } = useQuery({
    queryKey: ["fielding", String(personId), String(season)],
    queryFn: () => api.personFielding(personId, season),
    staleTime: 60 * 60_000,
    retry: false,
  });

  const rows = data ? parseFielding(data) : [];
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionTitle title="Fielding" subtitle="By position" />
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="table-base w-full">
            <thead>
              <tr>
                <th className="text-left">Pos</th>
                <th className="text-right">G</th>
                <th className="text-right">FPCT</th>
                <th className="text-right">PO</th>
                <th className="text-right">A</th>
                <th className="text-right">E</th>
                <th className="text-right">DP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="font-medium text-white">{r.pos}</td>
                  <td className="text-right tabular-nums font-mono">{d(r.g)}</td>
                  <td className="text-right tabular-nums font-mono">{d(r.fpct)}</td>
                  <td className="text-right tabular-nums font-mono">{d(r.po)}</td>
                  <td className="text-right tabular-nums font-mono">{d(r.a)}</td>
                  <td className="text-right tabular-nums font-mono">{d(r.e)}</td>
                  <td className="text-right tabular-nums font-mono">{d(r.dp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
