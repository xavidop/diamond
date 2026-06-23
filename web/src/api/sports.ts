export type Sport = {
  id: number;
  code: string;
  name: string;
  abbreviation: string;
  sortOrder: number;
};

/**
 * Snapshot of /api/v1/sports.
 * Kept static so the selector renders instantly without an extra request,
 * but the Explorer can always fetch fresh via the Reference → Sports endpoint.
 */
export const SPORTS: Sport[] = [
  { id: 1, code: "mlb", name: "Major League Baseball", abbreviation: "MLB", sortOrder: 11 },
  { id: 11, code: "aaa", name: "Triple-A", abbreviation: "AAA", sortOrder: 101 },
  { id: 12, code: "aax", name: "Double-A", abbreviation: "AA", sortOrder: 201 },
  { id: 13, code: "afa", name: "High-A", abbreviation: "A+", sortOrder: 301 },
  { id: 14, code: "afx", name: "Single-A", abbreviation: "A", sortOrder: 401 },
  { id: 16, code: "rok", name: "Rookie", abbreviation: "ROK", sortOrder: 701 },
  { id: 17, code: "win", name: "Winter Leagues", abbreviation: "WIN", sortOrder: 1301 },
  { id: 21, code: "min", name: "Minor League Baseball", abbreviation: "Minors", sortOrder: 1402 },
  { id: 23, code: "ind", name: "Independent Leagues", abbreviation: "IND", sortOrder: 2101 },
  { id: 61, code: "nlb", name: "Negro League Baseball", abbreviation: "NLB", sortOrder: 2401 },
  { id: 32, code: "kor", name: "Korean Baseball Organization", abbreviation: "KBO", sortOrder: 2601 },
  { id: 31, code: "jml", name: "Nippon Professional Baseball", abbreviation: "NPB", sortOrder: 2701 },
  { id: 51, code: "int", name: "International Baseball", abbreviation: "INT", sortOrder: 3501 },
  { id: 509, code: "nae", name: "International Baseball (18U)", abbreviation: "18U", sortOrder: 3503 },
  { id: 510, code: "nas", name: "International Baseball (16U)", abbreviation: "16U", sortOrder: 3505 },
  { id: 6005, code: "ame", name: "International Baseball (amateur)", abbreviation: "AME", sortOrder: 3509 },
  { id: 52, code: "oly", name: "Olympic Baseball", abbreviation: "OLY", sortOrder: 3511 },
  { id: 22, code: "bbc", name: "College Baseball", abbreviation: "College", sortOrder: 5101 },
  { id: 586, code: "hsb", name: "High School Baseball", abbreviation: "H.S.", sortOrder: 6201 },
  { id: 576, code: "wps", name: "Women's Professional Softball", abbreviation: "WPS", sortOrder: 7001 },
].sort((a, b) => a.sortOrder - b.sortOrder);

export const DEFAULT_SPORT_ID = 1;

export function getSport(id: number): Sport {
  return SPORTS.find((s) => s.id === id) ?? SPORTS[0];
}
