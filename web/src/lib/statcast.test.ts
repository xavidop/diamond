import { describe, it, expect } from "vitest";
import { extractBattedBalls, battedBallLeaders } from "./statcast";

const feed = {
  liveData: {
    plays: {
      allPlays: [
        {
          result: { event: "Home Run", description: "Judge homers" },
          about: { inning: 3 },
          matchup: { batter: { fullName: "Aaron Judge" } },
          playEvents: [
            { isPitch: true, pitchData: {} },
            { hitData: { launchSpeed: 118.2, launchAngle: 29, totalDistance: 451 } },
          ],
        },
        {
          result: { event: "Groundout", description: "Soto grounds out" },
          about: { inning: 4 },
          matchup: { batter: { fullName: "Juan Soto" } },
          playEvents: [{ hitData: { launchSpeed: 92.1, launchAngle: -5, totalDistance: 12 } }],
        },
        {
          result: { event: "Walk", description: "walk" },
          about: { inning: 5 },
          matchup: { batter: { fullName: "X" } },
          playEvents: [{ isPitch: true, pitchData: {} }], // no hitData -> skipped
        },
      ],
    },
  },
};

describe("extractBattedBalls", () => {
  it("pulls one ball per play that has hitData", () => {
    const balls = extractBattedBalls(feed);
    expect(balls.map((b) => b.batter)).toEqual(["Aaron Judge", "Juan Soto"]);
    expect(balls[0].ev).toBe(118.2);
    expect(balls[0].distance).toBe(451);
  });
  it("returns [] for empty feed", () => {
    expect(extractBattedBalls({})).toEqual([]);
  });
});

describe("battedBallLeaders", () => {
  it("finds hardest hit and longest", () => {
    const l = battedBallLeaders(extractBattedBalls(feed));
    expect(l.hardestHit?.batter).toBe("Aaron Judge");
    expect(l.longest?.batter).toBe("Aaron Judge");
    expect(l.balls.length).toBe(2);
  });
  it("handles empty", () => {
    const l = battedBallLeaders([]);
    expect(l.hardestHit).toBeNull();
    expect(l.longest).toBeNull();
  });
});
