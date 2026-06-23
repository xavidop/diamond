export const GLOSSARY: Record<string, string> = {
  // Hitting
  avg: "Batting Average — hits divided by at-bats.",
  obp: "On-Base Percentage — times reaching base divided by plate appearances.",
  slg: "Slugging — total bases divided by at-bats.",
  ops: "On-Base Plus Slugging — OBP + SLG.",
  iso: "Isolated Power — SLG minus AVG (extra-base power).",
  babip: "Batting Average on Balls in Play.",
  wrcPlus: "Weighted Runs Created Plus — runs created vs league avg (100).",
  hr: "Home Runs.",
  rbi: "Runs Batted In.",
  sb: "Stolen Bases.",
  r: "Runs Scored.",
  h: "Hits.",
  // Pitching
  era: "Earned Run Average — earned runs allowed per 9 innings.",
  whip: "Walks + Hits per Inning Pitched.",
  fip: "Fielding Independent Pitching — ERA-scale of K, BB, HR.",
  eraPlus: "ERA+ — ERA vs league avg (100, higher is better).",
  k: "Strikeouts.",
  k9: "Strikeouts per 9 innings pitched.",
  bb: "Walks (Bases on Balls).",
  bb9: "Walks per 9 innings pitched.",
  ip: "Innings Pitched.",
  er: "Earned Runs allowed.",
  w: "Wins.",
  l: "Losses.",
  sv: "Saves.",
  hld: "Holds.",
  so: "Strikeouts (pitching/hitting).",
  // Standings
  pct: "Win percentage — wins / (wins + losses).",
  gb: "Games Behind division leader.",
  wcgb: "Wild Card Games Behind.",
  "m#": "Magic Number — combined wins by leader + losses by trailer to clinch.",
  rs: "Runs Scored (season totals).",
  ra: "Runs Allowed (season totals).",
  diff: "Run differential — RS minus RA.",
  pythw: "Pythagorean wins — projected wins from runs scored/allowed.",
  l10: "Record over the last 10 games.",
  strk: "Current streak — W or L plus length.",
};

export function glossary(name: string): string | undefined {
  return GLOSSARY[name.toLowerCase()];
}
