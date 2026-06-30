// Static map: MLB Stats API team id -> ESPN team id. All 30 teams map 1:1.
export const mlbToEspnTeamId: Record<number, number> = {
  109: 29, // Arizona Diamondbacks
  133: 11, // Athletics
  144: 15, // Atlanta Braves
  110: 1,  // Baltimore Orioles
  111: 2,  // Boston Red Sox
  112: 16, // Chicago Cubs
  145: 4,  // Chicago White Sox
  113: 17, // Cincinnati Reds
  114: 5,  // Cleveland Guardians
  115: 27, // Colorado Rockies
  116: 6,  // Detroit Tigers
  117: 18, // Houston Astros
  118: 7,  // Kansas City Royals
  108: 3,  // Los Angeles Angels
  119: 19, // Los Angeles Dodgers
  146: 28, // Miami Marlins
  158: 8,  // Milwaukee Brewers
  142: 9,  // Minnesota Twins
  121: 21, // New York Mets
  147: 10, // New York Yankees
  143: 22, // Philadelphia Phillies
  134: 23, // Pittsburgh Pirates
  135: 25, // San Diego Padres
  137: 26, // San Francisco Giants
  136: 12, // Seattle Mariners
  138: 24, // St. Louis Cardinals
  139: 30, // Tampa Bay Rays
  140: 13, // Texas Rangers
  141: 14, // Toronto Blue Jays
  120: 20, // Washington Nationals
};

export function espnTeamId(mlbId: number | string): number | undefined {
  return mlbToEspnTeamId[Number(mlbId)];
}
