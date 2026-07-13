import { describe, it, expect } from "vitest";
import { mergeTrail, hasMinors } from "./promotionTrail";

const lvl = (label: string, order: number, splits: any[]) => ({
  label,
  order,
  raw: { stats: [{ splits }] },
});

describe("mergeTrail", () => {
  const perLevel = [
    lvl("MLB", 0, [{ season: "2024", team: { name: "Rays" }, stat: { avg: ".248" } }]),
    lvl("AAA", 1, [{ season: "2024", team: { name: "Durham" }, stat: { avg: ".276" } }]),
    lvl("AA", 2, [{ season: "2023", team: { name: "Montgomery" }, stat: { avg: ".300" } }]),
  ];

  it("sorts by season asc, then Rookie→MLB within a season", () => {
    const rows = mergeTrail(perLevel);
    expect(rows.map((r) => `${r.season}-${r.level}`)).toEqual([
      "2023-AA",
      "2024-AAA",
      "2024-MLB",
    ]);
  });

  it("returns [] for empty input", () => {
    expect(mergeTrail([])).toEqual([]);
  });
});

describe("hasMinors", () => {
  it("true when a below-MLB row exists", () => {
    expect(hasMinors(mergeTrail([lvl("AAA", 1, [{ season: "2024", stat: {} }])]))).toBe(true);
  });
  it("false for MLB-only", () => {
    expect(
      hasMinors([{ season: "2024", level: "MLB", levelOrder: 0, team: "x", stat: {} }])
    ).toBe(false);
  });
});
