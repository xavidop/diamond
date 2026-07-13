export type TrailRow = {
  season: string;
  level: string;
  levelOrder: number;
  team: string;
  stat: Record<string, any>;
};

// MLB down to Rookie. order 0 = MLB (top of the pyramid).
export const TRAIL_LEVELS: { sportId: number; label: string; order: number }[] = [
  { sportId: 1, label: "MLB", order: 0 },
  { sportId: 11, label: "AAA", order: 1 },
  { sportId: 12, label: "AA", order: 2 },
  { sportId: 13, label: "A+", order: 3 },
  { sportId: 14, label: "A", order: 4 },
  { sportId: 16, label: "Rookie", order: 5 },
];

/**
 * Merge per-level yearByYear responses into one timeline: sorted by season
 * ascending, and within a season by level Rookie→MLB so it reads as a climb.
 */
export function mergeTrail(
  perLevel: { label: string; order: number; raw: any }[]
): TrailRow[] {
  const rows: TrailRow[] = [];
  for (const lvl of perLevel) {
    const splits = (lvl.raw?.stats?.[0]?.splits ?? []) as any[];
    for (const s of splits) {
      rows.push({
        season: s.season ?? "",
        level: lvl.label,
        levelOrder: lvl.order,
        team: s.team?.name ?? "",
        stat: s.stat ?? {},
      });
    }
  }
  rows.sort((a, b) =>
    a.season !== b.season
      ? a.season.localeCompare(b.season)
      : b.levelOrder - a.levelOrder
  );
  return rows;
}

/** True when the player has at least one minor-league (below-MLB) row. */
export function hasMinors(rows: TrailRow[]): boolean {
  return rows.some((r) => r.levelOrder > 0);
}
