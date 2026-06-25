export type GameSnapshot = { away: number; home: number; state: string };
export type NotifyEventType = "run" | "final" | "starting";

export interface NotifyEvent {
  gamePk: number;
  type: NotifyEventType;
  awayName: string;
  homeName: string;
  awayScore: number;
  homeScore: number;
}

export interface NotifySettings {
  enabled: boolean;
  followFavorites: boolean;
  runScored: boolean;
  gameFinal: boolean;
  gameStarting: boolean;
  permission: NotificationPermission;
}

const FINAL_STATES = new Set(["Final", "Game Over"]);

export function snapshotFromGame(g: any): GameSnapshot {
  return {
    away: g?.teams?.away?.score ?? 0,
    home: g?.teams?.home?.score ?? 0,
    state: g?.status?.abstractGameState ?? "",
  };
}

function makeEvent(g: any, type: NotifyEventType, cur: GameSnapshot): NotifyEvent {
  return {
    gamePk: g.gamePk,
    type,
    awayName: g?.teams?.away?.team?.name ?? "Away",
    homeName: g?.teams?.home?.team?.name ?? "Home",
    awayScore: cur.away,
    homeScore: cur.home,
  };
}

export function notifyDiff(
  prev: Map<number, GameSnapshot>,
  games: any[],
  settings: NotifySettings,
  watch: Set<number>
): { events: NotifyEvent[]; next: Map<number, GameSnapshot> } {
  const events: NotifyEvent[] = [];
  const next = new Map(prev);

  for (const g of games) {
    const gamePk: number = g?.gamePk;
    if (gamePk == null || !watch.has(gamePk)) continue;

    const cur = snapshotFromGame(g);
    const p = prev.get(gamePk);
    next.set(gamePk, cur);

    if (!p) continue; // seed silently on first sight

    const isFinalNow = FINAL_STATES.has(cur.state);
    const wasFinal = FINAL_STATES.has(p.state);

    if (isFinalNow && !wasFinal) {
      if (settings.gameFinal) events.push(makeEvent(g, "final", cur));
      continue; // final is exclusive of run on the same tick
    }

    if (cur.state === "Live" && p.state !== "Live" && settings.gameStarting) {
      events.push(makeEvent(g, "starting", cur));
    }

    if (!isFinalNow && (cur.away > p.away || cur.home > p.home) && settings.runScored) {
      events.push(makeEvent(g, "run", cur));
    }
  }

  return { events, next };
}
