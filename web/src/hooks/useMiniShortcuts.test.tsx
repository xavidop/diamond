import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { useMiniShortcuts } from "./useMiniShortcuts";

const games = [{ gamePk: 1 }, { gamePk: 2 }, { gamePk: 3 }];

function setup(overrides: Partial<Parameters<typeof useMiniShortcuts>[0]> = {}) {
  const onSelect = vi.fn();
  const setMode = vi.fn();
  const onClose = vi.fn();
  renderHook(() =>
    useMiniShortcuts({
      doc: document,
      games,
      selectedGamePk: 2,
      onSelect,
      mode: "focus",
      setMode,
      onClose,
      ...overrides,
    })
  );
  return { onSelect, setMode, onClose };
}

describe("useMiniShortcuts", () => {
  it("moves to the next game with ArrowDown and j", () => {
    const { onSelect } = setup();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenCalledWith(3);
    fireEvent.keyDown(document, { key: "j" });
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("moves to the previous game with ArrowUp and k", () => {
    const { onSelect } = setup();
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(onSelect).toHaveBeenCalledWith(1);
    fireEvent.keyDown(document, { key: "k" });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("clamps at the ends of the list", () => {
    const { onSelect } = setup({ selectedGamePk: 1 });
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("toggles the mode with t", () => {
    const { setMode } = setup();
    fireEvent.keyDown(document, { key: "t" });
    expect(setMode).toHaveBeenCalledWith("slate");
  });

  it("closes on Escape", () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("ignores keys with modifiers", () => {
    const { setMode } = setup();
    fireEvent.keyDown(document, { key: "t", metaKey: true });
    expect(setMode).not.toHaveBeenCalled();
  });

  it("ignores keys typed into an input", () => {
    const { setMode } = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "t" });
    expect(setMode).not.toHaveBeenCalled();
    input.remove();
  });
});
