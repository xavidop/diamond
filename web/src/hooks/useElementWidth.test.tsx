import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useElementWidth } from "./useElementWidth";

let trigger: ((entries: { contentRect: { width: number } }[]) => void) | null = null;

beforeEach(() => {
  trigger = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
        trigger = cb;
      }
      observe() {}
      disconnect() {}
    }
  );
});

function Probe() {
  const [ref, width] = useElementWidth();
  return <div ref={ref} data-testid="probe">{width}</div>;
}

describe("useElementWidth", () => {
  it("starts at zero and updates from the observer", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("0");
    act(() => trigger?.([{ contentRect: { width: 412 } }]));
    expect(screen.getByTestId("probe").textContent).toBe("412");
  });
});
