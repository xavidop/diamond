// web/src/contexts/MiniViewerContext.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MiniViewerProvider, useMiniViewer } from "./MiniViewerContext";
import { ThemeProvider } from "./ThemeContext";
import { writeMode, writeGamePk } from "../lib/miniStorage";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <MiniViewerProvider>{children}</MiniViewerProvider>
  </ThemeProvider>
);

describe("MiniViewerContext", () => {
  it("opens (panel path in jsdom — no PiP API) with a selected game", async () => {
    const { result } = renderHook(() => useMiniViewer(), { wrapper });
    expect(result.current.open).toBe(false);
    await act(async () => result.current.openMini(123));
    expect(result.current.open).toBe(true);
    expect(result.current.selectedGamePk).toBe(123);
    expect(result.current.usePanel).toBe(true); // jsdom has no documentPictureInPicture
    expect(result.current.pipWindow).toBeNull();
  });
  it("closeMini resets open/panel but keeps the selection", async () => {
    const { result } = renderHook(() => useMiniViewer(), { wrapper });
    await act(async () => result.current.openMini(5));
    act(() => result.current.closeMini());
    expect(result.current.open).toBe(false);
    expect(result.current.usePanel).toBe(false);
    expect(result.current.selectedGamePk).toBe(5);
  });
  it("selectGame updates the selection", () => {
    const { result } = renderHook(() => useMiniViewer(), { wrapper });
    act(() => result.current.selectGame(9));
    expect(result.current.selectedGamePk).toBe(9);
  });
});

describe("MiniViewerContext persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to focus mode", () => {
    const { result } = renderHook(() => useMiniViewer(), { wrapper });
    expect(result.current.mode).toBe("focus");
  });

  it("restores a stored mode and persists changes", () => {
    writeMode("slate");
    const { result } = renderHook(() => useMiniViewer(), { wrapper });
    expect(result.current.mode).toBe("slate");
    act(() => result.current.setMode("focus"));
    expect(result.current.mode).toBe("focus");
    expect(window.localStorage.getItem("diamond.mini.mode")).toBe("focus");
  });

  it("restores a stored game selection", () => {
    writeGamePk(4242);
    const { result } = renderHook(() => useMiniViewer(), { wrapper });
    expect(result.current.selectedGamePk).toBe(4242);
  });

  it("persists a new selection", () => {
    const { result } = renderHook(() => useMiniViewer(), { wrapper });
    act(() => result.current.selectGame(77));
    expect(window.localStorage.getItem("diamond.mini.gamePk")).toBe("77");
  });
});
