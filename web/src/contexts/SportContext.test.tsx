import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { SportProvider, useSport } from "./SportContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SportProvider>{children}</SportProvider>
);

describe("SportContext league filter", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to MLB with no league filter", () => {
    const { result } = renderHook(() => useSport(), { wrapper });
    expect(result.current.sportId).toBe(1);
    expect(result.current.leagueId).toBeNull();
  });

  it("ignores a league filter on single-competition sports like MLB", () => {
    const { result } = renderHook(() => useSport(), { wrapper });
    act(() => result.current.setLeagueId(103));
    expect(result.current.leagueId).toBeNull();
    expect(window.localStorage.getItem("diamond.leagueId.1")).toBeNull();
  });

  it("remembers the league per sport and restores it when switching back", () => {
    const { result } = renderHook(() => useSport(), { wrapper });
    act(() => result.current.setSportId(17));
    expect(result.current.leagueId).toBeNull();

    act(() => result.current.setLeagueId(131));
    expect(result.current.leagueId).toBe(131);
    expect(window.localStorage.getItem("diamond.leagueId.17")).toBe("131");

    act(() => result.current.setSportId(1));
    expect(result.current.leagueId).toBeNull();

    act(() => result.current.setSportId(17));
    expect(result.current.leagueId).toBe(131);
  });

  it("clears the stored league when set back to all", () => {
    const { result } = renderHook(() => useSport(), { wrapper });
    act(() => result.current.setSportId(17));
    act(() => result.current.setLeagueId(135));
    act(() => result.current.setLeagueId(null));
    expect(result.current.leagueId).toBeNull();
    expect(window.localStorage.getItem("diamond.leagueId.17")).toBeNull();
  });

  it("hydrates the league filter from storage on mount", () => {
    window.localStorage.setItem("diamond.sportId", "17");
    window.localStorage.setItem("diamond.leagueId.17", "132");
    const { result } = renderHook(() => useSport(), { wrapper });
    expect(result.current.sportId).toBe(17);
    expect(result.current.leagueId).toBe(132);
  });
});
