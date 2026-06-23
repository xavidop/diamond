import { useQueries, useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, teamLogoUrl } from "../api/mlb";
import {
  Card,
  Empty,
  SectionTitle,
} from "../components/ui/Primitives";
import { useSport } from "../contexts/SportContext";
import { useChartPalette } from "../contexts/ThemeContext";

const HITTING = ["avg", "obp", "slg", "ops"];
const HITTING_RAW = ["runs", "homeRuns", "hits", "stolenBases"];
const PITCHING = ["era", "whip"];
const PITCHING_RAW = ["strikeOuts", "saves", "wins", "shutouts"];

export default function TeamComparePage() {
  const [params, setParams] = useSearchParams();
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const group = (params.get("g") ?? "hitting") as "hitting" | "pitching";
  const { sportId } = useSport();
  const cb = useChartPalette();
  const PALETTE = [cb.b, cb.a, cb.c, cb.d];

  function setIds(next: number[]) {
    const p = new URLSearchParams(params);
    if (next.length) p.set("ids", next.join(","));
    else p.delete("ids");
    setParams(p, { replace: true });
  }
  function setGroup(g: "hitting" | "pitching") {
    const p = new URLSearchParams(params);
    p.set("g", g);
    setParams(p, { replace: true });
  }

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["team-compare", id],
      queryFn: () =>
        Promise.all([api.team(id), api.teamStats(id)]).then(([t, s]) => ({
          team: t.teams?.[0],
          stats: s,
        })),
    })),
  });

  const teams = queries
    .map((q, i) => ({ q, id: ids[i] }))
    .filter((x) => x.q.data?.team)
    .map((x) => ({ id: x.id, ...x.q.data! }));

  const seasonStat = (data: any, statGroup: string) => {
    const list = (data?.stats ?? []) as any[];
    const g = list.find((s) => s.group?.displayName === statGroup);
    return g?.splits?.[0]?.stat ?? {};
  };

  const rateKeys = group === "hitting" ? HITTING : PITCHING;
  const totalKeys = group === "hitting" ? HITTING_RAW : PITCHING_RAW;

  const rateChartData = rateKeys.map((k) => {
    const row: any = { stat: k.toUpperCase() };
    teams.forEach((t, i) => {
      row[`t${i}`] = Number(seasonStat(t.stats, group)[k] ?? 0);
    });
    return row;
  });
  const totalChartData = totalKeys.map((k) => {
    const row: any = { stat: k };
    teams.forEach((t, i) => {
      row[`t${i}`] = Number(seasonStat(t.stats, group)[k] ?? 0);
    });
    return row;
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Compare Teams"
        subtitle="Add up to 4 teams to compare season totals."
        right={
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
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {teams.map((t, i) => (
          <TeamSlot
            key={t.id}
            team={t.team}
            color={PALETTE[i]}
            onRemove={() => setIds(ids.filter((id) => id !== t.id))}
          />
        ))}
        {ids.length < 4 && (
          <AddSlot
            color={PALETTE[ids.length]}
            taken={ids}
            sportId={sportId}
            onAdd={(id) => setIds([...ids, id])}
          />
        )}
      </div>

      {teams.length >= 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Rate stats"
            data={rateChartData}
            teams={teams}
            palette={PALETTE}
            domain={[0, "auto"]}
          />
          <ChartCard
            title="Counting stats"
            data={totalChartData}
            teams={teams}
            palette={PALETTE}
          />
        </div>
      )}

      {teams.length >= 1 && (
        <Card pad={false}>
          <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
            Season — {group}
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Stat</th>
                  {teams.map((t, i) => (
                    <th
                      key={t.id}
                      className="text-right"
                      style={{ color: PALETTE[i] }}
                    >
                      {t.team.abbreviation ?? t.team.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rateKeys, ...totalKeys].map((k) => (
                  <tr key={k}>
                    <td className="font-mono text-pitch-300/80">{k}</td>
                    {teams.map((t) => (
                      <td
                        key={t.id}
                        className="text-right font-mono tabular-nums"
                      >
                        {String(seasonStat(t.stats, group)[k] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {teams.length === 0 && (
        <Empty message="Pick a team to start comparing." />
      )}
    </div>
  );
}

function TeamSlot({
  team,
  color,
  onRemove,
}: {
  team: any;
  color: string;
  onRemove: () => void;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <img
          src={teamLogoUrl(team.id)}
          alt=""
          className="h-12 w-12 object-contain"
        />
        <div className="flex-1 min-w-0">
          <Link
            to={`/teams/${team.id}`}
            className="font-semibold truncate hover:underline block"
          >
            {team.name}
          </Link>
          <div className="text-xs text-pitch-300/70 truncate">
            {team.league?.name}
            {team.division?.name ? ` · ${team.division.name}` : ""}
          </div>
          <div
            className="mt-1 inline-block h-1 w-10 rounded-full"
            style={{ background: color }}
          />
        </div>
        <button
          onClick={onRemove}
          className="text-pitch-300/70 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </Card>
  );
}

function AddSlot({
  color,
  taken,
  sportId,
  onAdd,
}: {
  color: string;
  taken: number[];
  sportId: number;
  onAdd: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["teams-pick", sportId],
    queryFn: () => api.teams({ sportId }),
  });
  const all = (data?.teams ?? []) as any[];
  const norm = q.trim().toLowerCase();
  const results = all
    .filter((t) => t.active !== false && !taken.includes(t.id))
    .filter(
      (t) =>
        !norm ||
        t.name.toLowerCase().includes(norm) ||
        t.abbreviation?.toLowerCase().includes(norm)
    );

  return (
    <Card>
      <div className="flex items-center gap-2 text-xs text-pitch-300/70 mb-2">
        <Plus size={14} />
        <span>Add team</span>
        <span
          className="ml-auto inline-block h-1 w-10 rounded-full opacity-60"
          style={{ background: color }}
        />
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter teams…"
        className="input"
      />
      <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-black/30">
        {results.slice(0, 12).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onAdd(t.id);
              setQ("");
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-white/5"
          >
            <img
              src={teamLogoUrl(t.id)}
              alt=""
              className="h-5 w-5 object-contain"
            />
            <span className="flex-1 truncate">{t.name}</span>
            <span className="text-[10px] text-pitch-300/60">
              {t.abbreviation}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  data,
  teams,
  palette,
  domain,
}: {
  title: string;
  data: any[];
  teams: { id: number; team: any }[];
  palette: string[];
  domain?: [number | string, number | string];
}) {
  return (
    <Card pad={false}>
      <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
        {title}
      </div>
      <div className="p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="stat" stroke="#9494b0" tick={{ fontSize: 11 }} />
            <YAxis
              stroke="#9494b0"
              tick={{ fontSize: 11 }}
              domain={domain ?? ["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#080810",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend />
            {teams.map((t, i) => (
              <Bar
                key={t.id}
                dataKey={`t${i}`}
                name={t.team.abbreviation ?? t.team.name}
                fill={palette[i]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
