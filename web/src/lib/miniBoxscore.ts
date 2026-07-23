// web/src/lib/miniBoxscore.ts
//
// The linescore names the current pitcher and batter but carries no stats.
// These helpers pull the matching lines out of a boxscore response, which is
// fetched only for the focused game.

export type StatLine = { season: string; game: string };

type PlayerT = {
  person?: { id?: number };
  stats?: { pitching?: Record<string, unknown>; batting?: Record<string, unknown> };
  seasonStats?: { pitching?: Record<string, unknown>; batting?: Record<string, unknown> };
};

/** Boxscore players are keyed "ID<personId>" and split across both teams. */
function findPlayer(box: any, personId?: number): PlayerT | null {
  if (!box || personId == null) return null;
  const key = `ID${personId}`;
  return box?.teams?.home?.players?.[key] ?? box?.teams?.away?.players?.[key] ?? null;
}

export function pitcherLine(box: any, personId?: number): StatLine | null {
  const p = findPlayer(box, personId);
  const game = p?.stats?.pitching as Record<string, any> | undefined;
  const season = p?.seasonStats?.pitching as Record<string, any> | undefined;
  if (!game || season?.era == null) return null;

  const seasonText = `${season.wins ?? 0}-${season.losses ?? 0} · ${season.era} ERA`;
  const parts: string[] = [];
  const pitches = game.numberOfPitches ?? game.pitchesThrown;
  if (pitches != null) parts.push(`${pitches} P`);
  if (game.inningsPitched != null) parts.push(`${game.inningsPitched} IP`);
  return { season: seasonText, game: parts.join(" · ") };
}

export function batterLine(box: any, personId?: number): StatLine | null {
  const p = findPlayer(box, personId);
  const game = p?.stats?.batting as Record<string, any> | undefined;
  const season = p?.seasonStats?.batting as Record<string, any> | undefined;
  if (!game || game.atBats == null || season?.avg == null) return null;

  const parts = [`${game.hits ?? 0}-${game.atBats}`];
  if (game.rbi) parts.push(`${game.rbi} RBI`);
  if (game.homeRuns) parts.push(`${game.homeRuns} HR`);
  return { season: `${season.avg} AVG`, game: parts.join(" · ") };
}
