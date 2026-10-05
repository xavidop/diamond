// Picks which season the Postseason page opens on. Mirrors the CLI's
// mlb.CurrentPostseason: this year once its bracket has real clubs in it (or,
// for MLB, a club has clinched a berth), otherwise last year's postseason.

/**
 * True when any game in a /schedule/postseason response has a real club in
 * it. Before matchups are known MLB schedules games between placeholders
 * ("AL Higher Seed", "Lower Seed League Champion"); those carry no division.
 */
export function hasPostseasonClubs(data: any): boolean {
  for (const d of data?.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.teams?.away?.team?.division?.id || g.teams?.home?.team?.division?.id) {
        return true;
      }
    }
  }
  return false;
}

/** True when any team in a /standings response has clinched a berth. */
export function anyClinched(standings: any): boolean {
  return (standings?.records ?? []).some((r: any) =>
    (r.teamRecords ?? []).some((t: any) => t.clinched)
  );
}

export async function resolvePostseasonSeason(
  now: Date,
  fetchPostseason: (season: string) => Promise<any>,
  fetchStandings?: (season: string) => Promise<any>
): Promise<string> {
  const cur = String(now.getFullYear());
  try {
    if (hasPostseasonClubs(await fetchPostseason(cur))) return cur;
  } catch {
    // fall through to the clinch check / last year
  }
  if (fetchStandings) {
    try {
      if (anyClinched(await fetchStandings(cur))) return cur;
    } catch {
      // ignore
    }
  }
  return String(now.getFullYear() - 1);
}
