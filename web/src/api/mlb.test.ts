import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "./mlb";

afterEach(() => vi.restoreAllMocks());

function captureUrl() {
  const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", spy);
  return () => new URL(spy.mock.calls[0][0] as string);
}

describe("api.daySchedule", () => {
  it("requests probable pitcher season stats", async () => {
    const url = captureUrl();
    await api.daySchedule({ date: "2026-07-23", sportId: 1 });
    const hydrate = url().searchParams.get("hydrate") ?? "";
    expect(hydrate).toContain("probablePitcher(stats(group=pitching,type=season))");
    expect(hydrate).toContain("linescore");
    expect(hydrate).toContain("decisions");
    expect(url().searchParams.get("date")).toBe("2026-07-23");
  });
});

describe("api.schedule", () => {
  it("keeps its lean hydrate so range callers are not inflated", async () => {
    const url = captureUrl();
    await api.schedule({ teamId: 116, startDate: "2026-04-01", endDate: "2026-09-30" });
    expect(url().searchParams.get("hydrate")).toBe("team,linescore,probablePitcher,decisions");
  });
});
