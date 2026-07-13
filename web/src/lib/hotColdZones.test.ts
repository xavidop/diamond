import { describe, it, expect } from "vitest";
import { parseHotColdZones, zoneGrid } from "./hotColdZones";

const raw = {
  stats: [
    {
      splits: [
        {
          stat: {
            name: "battingAverage",
            zones: [
              { zone: "01", color: "c1", temp: "cold", value: ".200" },
              { zone: "05", color: "c5", temp: "hot", value: ".350" },
              { zone: "11", color: "c11", temp: "cold", value: ".100" },
            ],
          },
        },
        { stat: { name: "onBasePercentage", zones: [] } }, // empty → skipped
      ],
    },
  ],
};

describe("parseHotColdZones", () => {
  it("keeps non-empty metrics, labels + orders them", () => {
    const m = parseHotColdZones(raw);
    expect(m.map((x) => x.label)).toEqual(["AVG"]);
    expect(m[0].zones).toHaveLength(3);
  });
  it("empty → []", () => {
    expect(parseHotColdZones({})).toEqual([]);
  });
});

describe("zoneGrid", () => {
  it("maps codes into the 3×3 inner grid + 4 outside quadrants", () => {
    const { inner, outside } = zoneGrid(parseHotColdZones(raw)[0].zones);
    expect(inner[0]?.value).toBe(".200"); // 01
    expect(inner[4]?.value).toBe(".350"); // 05 (center)
    expect(inner[1]).toBeUndefined(); // 02 not present
    expect(outside[0]?.value).toBe(".100"); // 11
  });
});
