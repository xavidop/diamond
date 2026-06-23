import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api, playerHeadshotUrl } from "../api/mlb";
import {
  Card,
  Empty,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { useSport } from "../contexts/SportContext";
import { useChartPalette } from "../contexts/ThemeContext";
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

const HITTING = ["avg", "obp", "slg", "ops"];
const HITTING_RAW = ["homeRuns", "rbi", "hits", "runs", "stolenBases"];
const PITCHING = ["era", "whip"];
const PITCHING_RAW = ["wins", "saves", "strikeOuts", "inningsPitched"];

export default function ComparePage() {
  const cb = useChartPalette();
  const PALETTE = [cb.b, cb.a, cb.c, cb.d];
  const [params, setParams] = useSearchParams();
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const groupParam = (params.get("g") ?? "hitting") as "hitting" | "pitching";
  const group = groupParam === "pitching" ? "pitching" : "hitting";

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
      queryKey: ["person", id],
      queryFn: () => api.person(id),
    })),
  });

  const people = queries
    .map((q, i) => ({ q, id: ids[i] }))
    .filter((x) => x.q.data?.people?.[0])
    .map((x) => ({ id: x.id, person: x.q.data.people[0] }));

  const seasonStat = (person: any, statGroup: string) => {
    const list = (person.stats ?? []) as any[];
    const career = list.find(
      (s) =>
        s.type?.displayName === "career" && s.group?.displayName === statGroup
    );
    return career?.splits?.[0]?.stat ?? {};
  };

  const rateKeys = group === "hitting" ? HITTING : PITCHING;
  const totalKeys = group === "hitting" ? HITTING_RAW : PITCHING_RAW;

  const rateChartData = rateKeys.map((k) => {
    const row: any = { stat: k.toUpperCase() };
    people.forEach((p, i) => {
      const v = seasonStat(p.person, group)[k];
      row[`p${i}`] = Number(v ?? 0);
    });
    return row;
  });
  const totalChartData = totalKeys.map((k) => {
    const row: any = { stat: k };
    people.forEach((p, i) => {
      const v = seasonStat(p.person, group)[k];
      row[`p${i}`] = Number(v ?? 0);
    });
    return row;
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Compare Players"
        subtitle="Add up to 4 players to compare career stats side by side."
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
        {people.map((p, i) => (
          <PlayerSlot
            key={p.id}
            person={p.person}
            color={PALETTE[i]}
            onRemove={() => setIds(ids.filter((id) => id !== p.id))}
          />
        ))}
        {ids.length < 4 && (
          <AddSlot
            color={PALETTE[ids.length]}
            disabled={ids.length >= 4}
            taken={ids}
            onAdd={(id) => setIds([...ids, id])}
          />
        )}
      </div>

      {queries.some((q) => q.error) && (
        <ErrorBox error={queries.find((q) => q.error)!.error as Error} />
      )}

      {people.length >= 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Rate stats"
            data={rateChartData}
            people={people}
            palette={PALETTE}
            domain={[0, "auto"]}
          />
          <ChartCard
            title="Counting stats"
            data={totalChartData}
            people={people}
            palette={PALETTE}
          />
        </div>
      )}

      {people.length >= 1 && (
        <Card pad={false}>
          <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
            Career — {group}
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Stat</th>
                  {people.map((p, i) => (
                    <th key={p.id} className="text-right" style={{ color: PALETTE[i] }}>
                      {p.person.fullName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rateKeys, ...totalKeys].map((k) => (
                  <tr key={k}>
                    <td className="font-mono text-pitch-300/80">{k}</td>
                    {people.map((p) => (
                      <td
                        key={p.id}
                        className="text-right font-mono tabular-nums"
                      >
                        {String(seasonStat(p.person, group)[k] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {people.length === 0 && (
        <Empty message="Pick a player to start comparing." />
      )}
    </div>
  );
}

function PlayerSlot({
  person,
  color,
  onRemove,
}: {
  person: any;
  color: string;
  onRemove: () => void;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <img
          src={playerHeadshotUrl(person.id, 120)}
          alt=""
          className="h-14 w-14 rounded-xl object-cover bg-pitch-800"
        />
        <div className="flex-1 min-w-0">
          <Link
            to={`/players/${person.id}`}
            className="font-semibold truncate hover:underline block"
          >
            {person.fullName}
          </Link>
          <div className="text-xs text-pitch-300/70 truncate">
            {person.primaryPosition?.name}
            {person.currentTeam ? ` · ${person.currentTeam.name}` : ""}
          </div>
          <div className="mt-1 inline-block h-1 w-10 rounded-full" style={{ background: color }} />
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
  disabled,
  taken,
  onAdd,
}: {
  color: string;
  disabled: boolean;
  taken: number[];
  onAdd: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const { sportId } = useSport();
  const { data, isFetching } = useQuery({
    queryKey: ["search", sportId, q],
    queryFn: () => api.search(q, { sportId }),
    enabled: q.length > 1,
  });
  const results = ((data?.people ?? []) as any[]).filter(
    (p) => !taken.includes(p.id)
  );

  return (
    <Card>
      <div className="flex items-center gap-2 text-xs text-pitch-300/70 mb-2">
        <Plus size={14} />
        <span>Add player</span>
        <span
          className="ml-auto inline-block h-1 w-10 rounded-full opacity-60"
          style={{ background: color }}
        />
      </div>
      <input
        disabled={disabled}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search players…"
        className="input"
      />
      {q.length > 1 && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-black/30">
          {isFetching && <div className="p-2"><Spinner /></div>}
          {results.length === 0 && !isFetching && (
            <div className="p-2 text-xs text-pitch-300/60">No results</div>
          )}
          {results.slice(0, 10).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onAdd(p.id);
                setQ("");
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-white/5"
            >
              <img
                src={playerHeadshotUrl(p.id, 60)}
                alt=""
                className="h-6 w-6 rounded-full bg-pitch-800"
              />
              <span className="flex-1 truncate">{p.fullName}</span>
              <span className="text-[10px] text-pitch-300/60">
                {p.primaryPosition?.abbreviation}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function ChartCard({
  title,
  data,
  people,
  palette,
  domain,
}: {
  title: string;
  data: any[];
  people: { id: number; person: any }[];
  palette: string[];
  domain?: any;
}) {
  return (
    <Card pad={false}>
      <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70">
        {title}
      </div>
      <div className="h-72 p-3">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="stat" stroke="#9494b0" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9494b0" tick={{ fontSize: 11 }} domain={domain} />
            <Tooltip
              contentStyle={{
                background: "#080810",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {people.map((p, i) => (
              <Bar
                key={p.id}
                dataKey={`p${i}`}
                name={p.person.lastName ?? p.person.fullName}
                fill={palette[i]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
