import { useMemo, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import {
  CATEGORIES,
  ENDPOINTS,
  type EndpointDef,
  type ParamDef,
} from "../api/endpoints";
import { MLB_API_BASE, MLB_API_BASE_V11, mlbFetchRaw } from "../api/mlb";
import {
  Card,
  ErrorBox,
  SectionTitle,
  Spinner,
} from "../components/ui/Primitives";
import { JsonView } from "../components/ui/JsonView";
import { cn } from "../lib/utils";

export default function ExplorerPage() {
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]);
  const [activeId, setActiveId] = useState<string>(
    ENDPOINTS.find((e) => e.category === CATEGORIES[0])!.id
  );
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return ENDPOINTS.filter(
      (e) =>
        e.category === activeCat &&
        (query
          ? (e.name + e.path + e.description)
              .toLowerCase()
              .includes(query.toLowerCase())
          : true)
    );
  }, [activeCat, query]);

  const active =
    ENDPOINTS.find((e) => e.id === activeId) ?? ENDPOINTS[0];

  return (
    <div className="space-y-6">
      <SectionTitle
        title="API Explorer"
        subtitle="Hit any MLB Stats API endpoint with live parameters."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-4">
        <Card pad={false} className="lg:sticky lg:top-24 lg:self-start">
          <div className="p-3 border-b border-white/5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter endpoints…"
              className="input"
            />
          </div>
          <div className="p-2 flex flex-wrap gap-1 border-b border-white/5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setActiveCat(c);
                  const first = ENDPOINTS.find((e) => e.category === c);
                  if (first) setActiveId(first.id);
                }}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md",
                  activeCat === c
                    ? "bg-volt-500 text-black"
                    : "bg-pitch-900/40 hover:bg-pitch-800 text-pitch-300"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setActiveId(e.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 border-b border-white/5 hover:bg-white/5",
                    activeId === e.id && "bg-white/10"
                  )}
                >
                  <div className="text-sm font-medium">{e.name}</div>
                  <div className="text-[11px] font-mono text-pitch-300/70 truncate">
                    {e.path}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <EndpointRunner key={active.id} ep={active} />
      </div>
    </div>
  );
}

function EndpointRunner({ ep }: { ep: EndpointDef }) {
  const initialPath = Object.fromEntries(
    (ep.pathParams ?? []).map((p) => [p.name, p.defaultValue ?? ""])
  );
  const initialQuery = Object.fromEntries(
    (ep.queryParams ?? []).map((p) => [p.name, p.defaultValue ?? ""])
  );

  const [pathVals, setPathVals] = useState<Record<string, string>>(initialPath);
  const [queryVals, setQueryVals] = useState<Record<string, string>>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<{
    url: string;
    status: number;
    data: unknown;
  } | null>(null);

  const base = ep.base === "v1.1" ? MLB_API_BASE_V11 : MLB_API_BASE;
  const resolvedPath = ep.path.replace(/\{(\w+)\}/g, (_, k) =>
    encodeURIComponent(pathVals[k] ?? `{${k}}`)
  );
  const previewUrl = (() => {
    const u = new URL(`${base}${resolvedPath}`);
    for (const [k, v] of Object.entries(queryVals)) {
      if (v) u.searchParams.set(k, v);
    }
    return u.toString();
  })();

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await mlbFetchRaw(resolvedPath, queryVals, { base });
      setResult(r);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill bg-emerald-500/15 border-emerald-500/30 text-emerald-200">
            {ep.method}
          </span>
          <span className="font-mono text-sm break-all">{ep.path}</span>
          {ep.base === "v1.1" && <span className="pill">v1.1</span>}
        </div>
        <p className="mt-2 text-sm text-pitch-300">{ep.description}</p>

        {(ep.pathParams?.length ?? 0) > 0 && (
          <ParamGroup
            title="Path Parameters"
            defs={ep.pathParams!}
            values={pathVals}
            onChange={(k, v) => setPathVals((s) => ({ ...s, [k]: v }))}
          />
        )}
        {(ep.queryParams?.length ?? 0) > 0 && (
          <ParamGroup
            title="Query Parameters"
            defs={ep.queryParams!}
            values={queryVals}
            onChange={(k, v) => setQueryVals((s) => ({ ...s, [k]: v }))}
          />
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            <Play size={14} /> {loading ? "Running…" : "Run request"}
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="btn"
          >
            <ExternalLink size={14} /> Open URL
          </a>
        </div>
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider text-pitch-300/70 mb-1">
            Request URL
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs break-all">
            {previewUrl}
          </div>
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}
      {error ? <ErrorBox error={error} /> : null}
      {result && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm">
              Status:{" "}
              <span
                className={cn(
                  "font-mono",
                  result.status >= 400 ? "text-red-300" : "text-emerald-300"
                )}
              >
                {result.status}
              </span>
            </div>
            <div className="text-xs text-pitch-300/70">
              {JSON.stringify(result.data).length.toLocaleString()} chars
            </div>
          </div>
          <JsonView data={result.data as unknown} />
        </Card>
      )}
    </div>
  );
}

function ParamGroup({
  title,
  defs,
  values,
  onChange,
}: {
  title: string;
  defs: ParamDef[];
  values: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="mt-4">
      <div className="text-xs uppercase tracking-wider text-pitch-300/70 mb-2">
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {defs.map((p) => (
          <label key={p.name} className="block">
            <div className="text-xs text-pitch-300 mb-1 flex items-center gap-1">
              <span className="font-mono">{p.name}</span>
              {p.required && (
                <span className="text-volt-500">*</span>
              )}
              {p.help && (
                <span className="text-pitch-300/50">— {p.help}</span>
              )}
            </div>
            <input
              value={values[p.name] ?? ""}
              onChange={(e) => onChange(p.name, e.target.value)}
              placeholder={p.placeholder}
              className="input font-mono"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
