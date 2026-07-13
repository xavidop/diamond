import { describe, it, expect } from "vitest";
import { parseAffiliates } from "./affiliates";

describe("parseAffiliates", () => {
  const raw = {
    teams: [
      { id: 1, name: "MLB Club", sport: { id: 1 }, league: { name: "NL" } },
      { id: 2, name: "AAA Club", sport: { id: 11 }, league: { name: "IL" } },
      { id: 3, name: "Rookie Club", sport: { id: 16 }, league: { name: "ACL" } },
      { id: 4, name: "AA Club", sport: { id: 12 }, league: { name: "TL" } },
      { id: 5, name: "Org Pseudo", sport: { id: 21 }, league: { name: "MiLB" } },
    ],
  };

  it("filters to real levels, labels them, and orders AAA→Rookie", () => {
    const a = parseAffiliates(raw);
    expect(a.map((x) => x.level)).toEqual(["AAA", "AA", "Rookie"]);
    expect(a.map((x) => x.id)).toEqual([2, 4, 3]);
    expect(a[0].league).toBe("IL");
  });

  it("returns [] for empty/garbage", () => {
    expect(parseAffiliates({})).toEqual([]);
    expect(parseAffiliates({ teams: [] })).toEqual([]);
  });
});
