export type BattedBall = {
  batter: string;
  result: string;
  ev: number | null;
  angle: number | null;
  distance: number | null;
  inning: number;
};

export type BattedBallLeaders = {
  hardestHit: BattedBall | null;
  longest: BattedBall | null;
  balls: BattedBall[];
};

function num(v: any): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

export function extractBattedBalls(feed: any): BattedBall[] {
  const plays: any[] = feed?.liveData?.plays?.allPlays ?? [];
  const out: BattedBall[] = [];
  for (const play of plays) {
    const events: any[] = play?.playEvents ?? [];
    const hit = events.map((e) => e?.hitData).filter(Boolean).pop();
    if (!hit) continue;
    out.push({
      batter: play?.matchup?.batter?.fullName ?? "",
      result: play?.result?.event ?? "",
      ev: num(hit.launchSpeed),
      angle: num(hit.launchAngle),
      distance: num(hit.totalDistance),
      inning: play?.about?.inning ?? 0,
    });
  }
  return out;
}

export function battedBallLeaders(balls: BattedBall[]): BattedBallLeaders {
  let hardestHit: BattedBall | null = null;
  let longest: BattedBall | null = null;
  for (const b of balls) {
    if (b.ev != null && (!hardestHit || b.ev > (hardestHit.ev ?? -1))) hardestHit = b;
    if (b.distance != null && (!longest || b.distance > (longest.distance ?? -1))) longest = b;
  }
  return { hardestHit, longest, balls };
}
