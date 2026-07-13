export type Zone = { zone: string; color: string; temp: string; value: string };
export type ZoneMetric = { key: string; label: string; zones: Zone[] };

const METRIC_LABELS: Record<string, string> = {
  battingAverage: "AVG",
  onBasePercentage: "OBP",
  sluggingPercentage: "SLG",
  onBasePlusSlugging: "OPS",
  exitVelocity: "Exit Velo",
};

// Preferred display order (falls back to API order for anything unlisted).
const METRIC_ORDER = [
  "battingAverage",
  "onBasePercentage",
  "sluggingPercentage",
  "onBasePlusSlugging",
  "exitVelocity",
];

export function parseHotColdZones(raw: any): ZoneMetric[] {
  const splits = (raw?.stats?.[0]?.splits ?? []) as any[];
  const out: ZoneMetric[] = [];
  for (const s of splits) {
    const name = s?.stat?.name;
    const zones = (s?.stat?.zones ?? []) as Zone[];
    if (!name || zones.length === 0) continue;
    out.push({ key: name, label: METRIC_LABELS[name] ?? name, zones });
  }
  out.sort((a, b) => {
    const ia = METRIC_ORDER.indexOf(a.key);
    const ib = METRIC_ORDER.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return out;
}

/**
 * Split the 13 zones into the 3×3 strike zone (codes 01–09, row-major
 * top-left→bottom-right) and the four out-of-zone quadrants (11–14). Codes may
 * arrive zero-padded ("01") or not ("1"); both are normalized.
 */
export function zoneGrid(zones: Zone[]): {
  inner: (Zone | undefined)[];
  outside: (Zone | undefined)[];
} {
  const byCode: Record<string, Zone> = {};
  for (const z of zones) byCode[String(z.zone).padStart(2, "0")] = z;
  const inner = ["01", "02", "03", "04", "05", "06", "07", "08", "09"].map(
    (c) => byCode[c]
  );
  const outside = ["11", "12", "13", "14"].map((c) => byCode[c]);
  return { inner, outside };
}
