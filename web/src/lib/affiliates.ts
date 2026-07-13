export type Affiliate = {
  id: number;
  name: string;
  level: string;
  levelOrder: number;
  league: string;
};

// Real playing levels, ordered AAA → Rookie. Anything else (MLB itself sport.id=1,
// or umbrella pseudo-teams sport.id=21) is excluded from the farm-system list.
export const AFFILIATE_LEVELS: Record<number, { label: string; order: number }> = {
  11: { label: "AAA", order: 1 },
  12: { label: "AA", order: 2 },
  13: { label: "A+", order: 3 },
  14: { label: "A", order: 4 },
  16: { label: "Rookie", order: 5 },
};

export function parseAffiliates(raw: any): Affiliate[] {
  const teams = (raw?.teams ?? []) as any[];
  const out: Affiliate[] = [];
  for (const t of teams) {
    const lvl = AFFILIATE_LEVELS[t?.sport?.id];
    if (!lvl) continue;
    out.push({
      id: t.id,
      name: t.name,
      level: lvl.label,
      levelOrder: lvl.order,
      league: t?.league?.name ?? "",
    });
  }
  out.sort((a, b) => a.levelOrder - b.levelOrder || a.name.localeCompare(b.name));
  return out;
}
