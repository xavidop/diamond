export type LeaderCat = { key: string; label: string; group: "hitting" | "pitching" };

export const HITTING_LEADER_CATS: LeaderCat[] = [
  { key: "homeRuns", label: "HR", group: "hitting" },
  { key: "battingAverage", label: "AVG", group: "hitting" },
  { key: "runsBattedIn", label: "RBI", group: "hitting" },
  { key: "onBasePlusSlugging", label: "OPS", group: "hitting" },
  { key: "stolenBases", label: "SB", group: "hitting" },
];

export const PITCHING_LEADER_CATS: LeaderCat[] = [
  { key: "earnedRunAverage", label: "ERA", group: "pitching" },
  { key: "wins", label: "W", group: "pitching" },
  { key: "strikeouts", label: "SO", group: "pitching" },
  { key: "saves", label: "SV", group: "pitching" },
  { key: "walksAndHitsPerInningPitched", label: "WHIP", group: "pitching" },
];

export const ALL_LEADER_CATS = [...HITTING_LEADER_CATS, ...PITCHING_LEADER_CATS];
export const LEADER_CATEGORY_PARAM = ALL_LEADER_CATS.map((c) => c.key).join(",");

export type LeaderEntry = { rank: number; value: string; name: string; personId?: number };
export type CatLeaders = { key: string; label: string; group: string; leaders: LeaderEntry[] };

/**
 * Pick the leaders for each requested category, filtered to the intended stat
 * group — the API returns e.g. `strikeouts` for both hitting (batter Ks) and
 * pitching (pitcher Ks), so the group filter disambiguates.
 */
export function pickLeaders(raw: any, cats: LeaderCat[]): CatLeaders[] {
  const groups = (raw?.teamLeaders ?? []) as any[];
  const out: CatLeaders[] = [];
  for (const c of cats) {
    const g = groups.find(
      (x) => x.leaderCategory === c.key && x.statGroup === c.group
    );
    const leaders = ((g?.leaders ?? []) as any[]).map((l) => ({
      rank: l.rank,
      value: l.value,
      name: l.person?.fullName ?? "",
      personId: l.person?.id,
    }));
    if (leaders.length) out.push({ key: c.key, label: c.label, group: c.group, leaders });
  }
  return out;
}
