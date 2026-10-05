import { describe, it, expect } from "vitest";
import { anyClinched, hasPostseasonClubs, resolvePostseasonSeason } from "./postseason";

const team = (id: number, division?: number) => ({
  team: division ? { id, division: { id: division } } : { id },
});
const schedule = (...games: any[]) => ({ dates: [{ games }] });
const real = { teams: { away: team(143, 204), home: team(144, 204) } };
const placeholder = { teams: { away: team(5525), home: team(5517) } };
const standings = (clinched: boolean) => ({ records: [{ teamRecords: [{ clinched }] }] });
const NOW = new Date(2026, 9, 5);

describe("hasPostseasonClubs", () => {
  it("ignores seed placeholders", () => {
    expect(hasPostseasonClubs(schedule(placeholder))).toBe(false);
    expect(hasPostseasonClubs(schedule(placeholder, real))).toBe(true);
    expect(hasPostseasonClubs(undefined)).toBe(false);
  });
});

describe("anyClinched", () => {
  it("detects a clinched team", () => {
    expect(anyClinched(standings(true))).toBe(true);
    expect(anyClinched(standings(false))).toBe(false);
  });
});

describe("resolvePostseasonSeason", () => {
  it("uses the current year once real clubs are in the bracket", async () => {
    const s = await resolvePostseasonSeason(NOW, async () => schedule(real), async () => standings(false));
    expect(s).toBe("2026");
  });

  it("uses the current year when only placeholders exist but a club clinched", async () => {
    const s = await resolvePostseasonSeason(NOW, async () => schedule(placeholder), async () => standings(true));
    expect(s).toBe("2026");
  });

  it("falls back to last year otherwise", async () => {
    expect(await resolvePostseasonSeason(NOW, async () => schedule(placeholder), async () => standings(false))).toBe("2025");
    expect(await resolvePostseasonSeason(NOW, async () => ({ dates: [] }))).toBe("2025");
    expect(
      await resolvePostseasonSeason(NOW, async () => {
        throw new Error("down");
      })
    ).toBe("2025");
  });
});
