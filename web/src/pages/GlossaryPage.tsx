import { useMemo, useState } from "react";
import { Card, Empty, SectionTitle } from "../components/ui/Primitives";
import { GLOSSARY } from "../lib/glossary";

export default function GlossaryPage() {
  const [q, setQ] = useState("");
  const entries = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return Object.entries(GLOSSARY)
      .filter(([k, v]) =>
        !norm ? true : k.includes(norm) || v.toLowerCase().includes(norm)
      )
      .sort(([a], [b]) => a.localeCompare(b));
  }, [q]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Stat Glossary"
        subtitle="Definitions for stats and standings columns used across Diamond."
        right={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="input w-48"
          />
        }
      />

      <Card pad={false}>
        {entries.length === 0 ? (
          <div className="p-4">
            <Empty message="No matches." />
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {entries.map(([k, v]) => (
              <li key={k} className="px-4 py-2 grid grid-cols-[100px,1fr] gap-3">
                <div className="font-mono uppercase text-volt-300 text-sm">
                  {k}
                </div>
                <div className="text-sm text-white/70">{v}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
