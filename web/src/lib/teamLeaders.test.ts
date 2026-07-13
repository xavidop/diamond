import { describe, it, expect } from "vitest";
import { pickLeaders, HITTING_LEADER_CATS, PITCHING_LEADER_CATS } from "./teamLeaders";

const raw = {
  teamLeaders: [
    {
      leaderCategory: "homeRuns",
      statGroup: "hitting",
      leaders: [
        { rank: 1, value: "58", person: { id: 1, fullName: "Aaron Judge" } },
        { rank: 2, value: "41", person: { id: 2, fullName: "Juan Soto" } },
      ],
    },
    { leaderCategory: "homeRuns", statGroup: "pitching", leaders: [{ rank: 1, value: "31", person: { id: 9, fullName: "P" } }] },
    { leaderCategory: "strikeouts", statGroup: "hitting", leaders: [{ rank: 1, value: "171", person: { id: 3, fullName: "Batter K" } }] },
    { leaderCategory: "strikeouts", statGroup: "pitching", leaders: [{ rank: 1, value: "220", person: { id: 4, fullName: "Ace" } }] },
  ],
};

describe("pickLeaders", () => {
  it("picks the hitting HR leaders, not the pitching HR group", () => {
    const r = pickLeaders(raw, HITTING_LEADER_CATS);
    const hr = r.find((c) => c.key === "homeRuns");
    expect(hr?.leaders[0].name).toBe("Aaron Judge");
    expect(hr?.leaders).toHaveLength(2);
  });
  it("disambiguates strikeouts by group", () => {
    const pitch = pickLeaders(raw, PITCHING_LEADER_CATS).find((c) => c.key === "strikeouts");
    expect(pitch?.leaders[0].name).toBe("Ace"); // pitcher Ks, not batter Ks
  });
  it("omits categories with no data / empty", () => {
    expect(pickLeaders({}, HITTING_LEADER_CATS)).toEqual([]);
  });
});
