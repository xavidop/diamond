// web/src/lib/miniviewer.ts
//
// Pure data shaping for the mini viewer. deriveGameState() is the single seam
// between raw MLB JSON and every component: nothing below this file reads the
// API's shapes directly.

export type PersonT = { id?: number; fullName?: string };

type StatT = { wins?: number; losses?: number; era?: string; strikeOuts?: number };

type ProbableRawT = PersonT & { stats?: { splits?: { stat?: StatT }[] }[] };

type SideT = {
  team?: { id?: number; name?: string; abbreviation?: string };
  score?: number;
  isWinner?: boolean;
  leagueRecord?: { wins?: number; losses?: number; pct?: string };
  probablePitcher?: ProbableRawT;
};

type InningRawT = {
  num?: number;
  away?: { runs?: number; hits?: number; errors?: number };
  home?: { runs?: number; hits?: number; errors?: number };
};

export type LinescoreRawT = {
  currentInningOrdinal?: string;
  inningState?: string;
  isTopInning?: boolean;
  balls?: number;
  strikes?: number;
  outs?: number;
  scheduledInnings?: number;
  innings?: InningRawT[];
  teams?: { away?: { runs?: number; hits?: number; errors?: number }; home?: { runs?: number; hits?: number; errors?: number } };
  offense?: { batter?: PersonT; onDeck?: PersonT; inHole?: PersonT; first?: unknown; second?: unknown; third?: unknown };
  defense?: { pitcher?: PersonT };
};

export type MiniGame = {
  gamePk: number;
  gameDate?: string;
  status?: { abstractGameState?: string; detailedState?: string };
  teams?: { away?: SideT; home?: SideT };
  linescore?: LinescoreRawT;
  decisions?: { winner?: PersonT; loser?: PersonT; save?: PersonT };
  venue?: { name?: string };
  seriesGameNumber?: number;
  gamesInSeries?: number;
  dayNight?: string;
  doubleHeader?: string;
  gameNumber?: number;
};

export type BasesT = { first: boolean; second: boolean; third: boolean };

export type SideInfo = {
  teamId?: number;
  name: string;
  record: string;
  score: number | null;
};

export type LineT = {
  innings: { num: number; away: number | null; home: number | null }[];
  away: { runs: number; hits: number; errors: number };
  home: { runs: number; hits: number; errors: number };
  scheduledInnings: number;
};

export type ProbableT = { id?: number; name: string; line: string };

type Common = { gamePk: number; away: SideInfo; home: SideInfo; chips: string[] };

export type MiniGameState =
  | (Common & {
      kind: "scheduled";
      startsAt: Date | null;
      probables: { away: ProbableT; home: ProbableT };
    })
  | (Common & {
      kind: "live";
      inningOrdinal: string;
      inningState: string;
      isTop: boolean;
      balls: number;
      strikes: number;
      outs: number;
      bases: BasesT;
      pitcher: PersonT | null;
      batter: PersonT | null;
      onDeck: PersonT | null;
      line: LineT;
    })
  | (Common & {
      kind: "final";
      winnerSide: "away" | "home" | null;
      extras: number | null;
      decisions: { win: PersonT | null; loss: PersonT | null; save: PersonT | null };
      line: LineT;
    })
  | (Common & { kind: "postponed"; reason: string });

// Ordering: live games first, then finished games, then games still to come.
// Slate section order and the Focus game list both read from this.
const RANK: Record<string, number> = { Live: 0, Final: 1, Preview: 2 };

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
}): BasesT {
  return {
    first: !!offense?.first,
    second: !!offense?.second,
    third: !!offense?.third,
  };
}

function side(s?: SideT): SideInfo {
  const r = s?.leagueRecord;
  const record =
    r && r.wins != null && r.losses != null
      ? `${r.wins}-${r.losses}${r.pct ? ` · ${r.pct}` : ""}`
      : "";
  return {
    teamId: s?.team?.id,
    name: s?.team?.abbreviation ?? s?.team?.name ?? "?",
    record,
    score: s?.score ?? null,
  };
}

function probable(s?: SideT): ProbableT {
  const p = s?.probablePitcher;
  if (!p) return { name: "TBD", line: "" };
  const st = p.stats?.[0]?.splits?.[0]?.stat;
  const line =
    st && st.era != null
      ? `${st.wins ?? 0}-${st.losses ?? 0} · ${st.era} ERA · ${st.strikeOuts ?? 0} K`
      : "";
  return { id: p.id, name: p.fullName ?? "TBD", line };
}

function chips(g: MiniGame): string[] {
  const out: string[] = [];
  if (g.venue?.name) out.push(g.venue.name);
  if (g.seriesGameNumber && g.gamesInSeries) out.push(`Game ${g.seriesGameNumber} of ${g.gamesInSeries}`);
  if (g.doubleHeader && g.doubleHeader !== "N" && g.gameNumber) out.push(`DH Game ${g.gameNumber}`);
  if (g.dayNight) out.push(g.dayNight === "day" ? "Day" : "Night");
  return out;
}

function lineOf(ls?: LinescoreRawT): LineT {
  const half = (v?: { runs?: number }) => (v?.runs == null ? null : v.runs);
  return {
    innings: (ls?.innings ?? []).map((i, idx) => ({
      num: i.num ?? idx + 1,
      away: half(i.away),
      home: half(i.home),
    })),
    away: {
      runs: ls?.teams?.away?.runs ?? 0,
      hits: ls?.teams?.away?.hits ?? 0,
      errors: ls?.teams?.away?.errors ?? 0,
    },
    home: {
      runs: ls?.teams?.home?.runs ?? 0,
      hits: ls?.teams?.home?.hits ?? 0,
      errors: ls?.teams?.home?.errors ?? 0,
    },
    scheduledInnings: ls?.scheduledInnings ?? 9,
  };
}

const POSTPONED = /postponed|suspended|cancelled|canceled/i;

/**
 * Convert one schedule game into the union every mini-viewer component renders
 * from. `opts.linescore` lets the focused game override the schedule's copy
 * with a fresher poll.
 */
export function deriveGameState(
  game: MiniGame,
  opts: { linescore?: LinescoreRawT } = {}
): MiniGameState {
  const ls = opts.linescore ?? game.linescore;
  const common: Common = {
    gamePk: game.gamePk,
    away: side(game.teams?.away),
    home: side(game.teams?.home),
    chips: chips(game),
  };
  const abstract = game.status?.abstractGameState ?? "";
  const detailed = game.status?.detailedState ?? "";

  if (POSTPONED.test(detailed)) {
    return { ...common, kind: "postponed", reason: detailed };
  }

  if (abstract === "Live") {
    return {
      ...common,
      kind: "live",
      inningOrdinal: ls?.currentInningOrdinal ?? "",
      inningState: ls?.inningState ?? "",
      isTop: ls?.isTopInning ?? true,
      balls: ls?.balls ?? 0,
      strikes: ls?.strikes ?? 0,
      outs: ls?.outs ?? 0,
      bases: basesFromOffense(ls?.offense),
      pitcher: ls?.defense?.pitcher ?? null,
      batter: ls?.offense?.batter ?? null,
      onDeck: ls?.offense?.onDeck ?? null,
      line: lineOf(ls),
    };
  }

  if (abstract === "Final") {
    const line = lineOf(ls);
    const lastInningNum = line.innings.length > 0 ? line.innings[line.innings.length - 1]?.num : 0;
    const a = common.away.score ?? 0;
    const h = common.home.score ?? 0;
    return {
      ...common,
      kind: "final",
      winnerSide: a === h ? null : a > h ? "away" : "home",
      extras: lastInningNum > line.scheduledInnings ? lastInningNum : null,
      decisions: {
        win: game.decisions?.winner ?? null,
        loss: game.decisions?.loser ?? null,
        save: game.decisions?.save ?? null,
      },
      line,
    };
  }

  return {
    ...common,
    kind: "scheduled",
    startsAt: game.gameDate ? new Date(game.gameDate) : null,
    probables: { away: probable(game.teams?.away), home: probable(game.teams?.home) },
  };
}

export type SlateGroup = {
  key: "live" | "final" | "upcoming";
  label: string;
  games: MiniGame[];
};

const GROUP_OF: Record<string, SlateGroup["key"]> = {
  Live: "live",
  Final: "final",
  Preview: "upcoming",
};

const GROUP_ORDER: { key: SlateGroup["key"]; title: string }[] = [
  { key: "live", title: "Live" },
  { key: "final", title: "Final" },
  { key: "upcoming", title: "Upcoming" },
];

function startMs(g: MiniGame): number {
  const t = g.gameDate ? Date.parse(g.gameDate) : NaN;
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/** Bucket the slate into Live / Final / Upcoming, each ordered by start time. */
export function groupGames(games: MiniGame[]): SlateGroup[] {
  return GROUP_ORDER.map(({ key, title }) => {
    const inGroup = games
      .filter((g) => (GROUP_OF[g.status?.abstractGameState ?? ""] ?? "upcoming") === key)
      .sort((a, b) => startMs(a) - startMs(b));
    return { key, label: `${title} · ${inGroup.length}`, games: inGroup };
  }).filter((s) => s.games.length > 0);
}

/**
 * "2:14:38" / "9:05" / "0:00". Returns "" past 24 hours, which tells the caller
 * to render an absolute date instead of a running clock.
 */
export function formatCountdown(ms: number): string {
  if (ms > 24 * 3600_000) return "";
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
