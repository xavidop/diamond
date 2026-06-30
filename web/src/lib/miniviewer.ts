type SideT = {
  team?: { id?: number; name?: string; abbreviation?: string };
  score?: number;
  isWinner?: boolean;
};

export type MiniGame = {
  gamePk: number;
  status?: { abstractGameState?: string };
  teams?: { away?: SideT; home?: SideT };
  linescore?: { currentInningOrdinal?: string; inningState?: string };
};

const RANK: Record<string, number> = { Live: 0, Preview: 1, Final: 2 };

export function sortGames(games: MiniGame[]): MiniGame[] {
  return [...games].sort(
    (a, b) =>
      (RANK[a.status?.abstractGameState ?? ""] ?? 3) -
      (RANK[b.status?.abstractGameState ?? ""] ?? 3)
  );
}

export function pickDefaultGame(games: MiniGame[]): number | null {
  const live = games.find((g) => g.status?.abstractGameState === "Live");
  if (live) return live.gamePk;
  return games[0]?.gamePk ?? null;
}

export function isLive(g?: MiniGame | null): boolean {
  return g?.status?.abstractGameState === "Live";
}

export function basesFromOffense(offense?: {
  first?: unknown;
  second?: unknown;
  third?: unknown;
}): { first: boolean; second: boolean; third: boolean } {
  return {
    first: !!offense?.first,
    second: !!offense?.second,
    third: !!offense?.third,
  };
}
