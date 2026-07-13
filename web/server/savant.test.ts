import { describe, it, expect } from "vitest";
import { parsePercentileCsv } from "./savant.ts";

const csv =
  `﻿"player_name","player_id","year","xwoba","xba","xslg","brl_percent","exit_velocity","hard_hit_percent","k_percent","bb_percent","sprint_speed"\n` +
  `"Judge, Aaron","592450","2023","98","81","96","97","100","100","","","74"\n` +
  `"Judge, Aaron","592450","2024","100","89","100","100","100","100","70","99","75"\n`;

describe("parsePercentileCsv", () => {
  it("selects the requested season and maps known columns", () => {
    const r = parsePercentileCsv(csv, 2024);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.season).toBe(2024);
    const xwoba = r.percentiles.find((p) => p.key === "xwoba");
    expect(xwoba?.value).toBe(100);
    expect(xwoba?.label).toBe("xwOBA");
    expect(r.percentiles.every((p) => !Number.isNaN(p.value))).toBe(true);
  });

  it("falls back to the latest non-blank row when season missing", () => {
    const r = parsePercentileCsv(csv, 1999);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.season).toBe(2024);
  });

  it("returns {ok:false} on garbage", () => {
    expect(parsePercentileCsv("nonsense", 2024).ok).toBe(false);
    expect(parsePercentileCsv("", 2024).ok).toBe(false);
  });
});
