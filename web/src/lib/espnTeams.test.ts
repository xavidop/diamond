import { describe, it, expect } from "vitest";
import { mlbToEspnTeamId, espnTeamId } from "./espnTeams";

describe("espnTeams", () => {
  it("maps all 30 MLB teams", () => {
    expect(Object.keys(mlbToEspnTeamId)).toHaveLength(30);
  });
  it("maps known teams (Yankees, Giants, Dodgers)", () => {
    expect(espnTeamId(147)).toBe(10); // NYY
    expect(espnTeamId("137")).toBe(26); // SF
    expect(espnTeamId(119)).toBe(19); // LAD
  });
  it("returns undefined for unknown / non-MLB ids", () => {
    expect(espnTeamId(99999)).toBeUndefined();
  });
});
