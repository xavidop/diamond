import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import RibbieGamecast from "./RibbieGamecast";

const props = { gamePk: "824160", awayName: "Blue Jays", homeName: "Astros" };

describe("RibbieGamecast", () => {
  it("shows the poster and loads nothing from ribbie.tv until asked", () => {
    const { container } = render(<RibbieGamecast {...props} />);

    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "https://ribbie.tv/watch/game/824160/og"
    );
  });

  it("mounts the gamecast for this game when the watch button is clicked", () => {
    const { container } = render(<RibbieGamecast {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /watch/i }));

    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe(
      "https://ribbie.tv/watch/game/824160"
    );
  });

  it("tells the user that watching loads ribbie.tv before they click", () => {
    render(<RibbieGamecast {...props} />);

    expect(screen.getByText(/loads ribbie\.tv/i)).toBeTruthy();
  });

  it("credits ribbie.tv with a link that cannot reach back into Diamond", () => {
    render(<RibbieGamecast {...props} />);

    const link = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === "https://ribbie.tv/watch/game/824160");

    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders nothing at all when the feature is switched off", () => {
    const { container } = render(<RibbieGamecast {...props} enabled={false} />);

    expect(container.innerHTML).toBe("");
  });
});

describe("RibbieGamecast when Ribbie is unreachable", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("drops the broken poster but still lets the user try watching", () => {
    render(<RibbieGamecast {...props} />);

    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("button", { name: /watch/i })).toBeTruthy();
  });

  it("offers a way out to ribbie.tv when the gamecast never loads", () => {
    vi.useFakeTimers();
    render(<RibbieGamecast {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /watch/i }));

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.getByText(/couldn't load/i)).toBeTruthy();
  });

  it("leaves a gamecast that loads in time alone", () => {
    vi.useFakeTimers();
    const { container } = render(<RibbieGamecast {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /watch/i }));

    fireEvent.load(container.querySelector("iframe")!);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.queryByText(/couldn't load/i)).toBeNull();
    expect(container.querySelector("iframe")).toBeTruthy();
  });
});
