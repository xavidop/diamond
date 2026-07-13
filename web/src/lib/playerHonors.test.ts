import { describe, it, expect } from "vitest";
import { filterAwards, educationLine } from "./playerHonors";

describe("filterAwards", () => {
  const awards = [
    { name: "SAL Mid-Season All-Star", season: "2014" },
    { name: "AL MVP", season: "2022" },
    { name: "Silver Slugger", season: "2021" },
    { name: "AFL Player of the Week", season: "2014" },
    { name: "AL MVP", season: "2024" },
  ];
  it("keeps major awards, most-recent first", () => {
    const r = filterAwards(awards);
    expect(r[0]).toEqual({ name: "AL MVP", season: "2024" });
    // AFL Player of the Week is filtered out (not a major award); All-Star kept
    expect(r.some((a) => a.name === "AFL Player of the Week")).toBe(false);
    expect(r.some((a) => a.name === "SAL Mid-Season All-Star")).toBe(true);
  });
  it("falls back to all awards when none are 'major'", () => {
    const r = filterAwards([{ name: "Some Local Award", season: "2020" }]);
    expect(r).toHaveLength(1);
  });
  it("handles empty", () => {
    expect(filterAwards(undefined)).toEqual([]);
  });
});

describe("educationLine", () => {
  it("joins colleges + high schools", () => {
    expect(
      educationLine({ colleges: [{ name: "Fresno State" }], highschools: [{ name: "Linden" }] })
    ).toBe("Fresno State · Linden");
  });
  it("empty → ''", () => {
    expect(educationLine({})).toBe("");
  });
});
