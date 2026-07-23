import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Diamond from "./Diamond";
import Pips from "./Pips";
import TeamLogo from "./TeamLogo";

describe("Diamond", () => {
  it("labels which bases are occupied", () => {
    render(<Diamond bases={{ first: true, second: false, third: true }} />);
    expect(screen.getByLabelText("Runners on 1st and 3rd")).toBeTruthy();
  });
  it("labels an empty diamond", () => {
    render(<Diamond bases={{ first: false, second: false, third: false }} />);
    expect(screen.getByLabelText("Bases empty")).toBeTruthy();
  });
  it("labels the bases-loaded case", () => {
    render(<Diamond bases={{ first: true, second: true, third: true }} />);
    expect(screen.getByLabelText("Bases loaded")).toBeTruthy();
  });
  it("labels a runner on first only", () => {
    render(<Diamond bases={{ first: true, second: false, third: false }} />);
    expect(screen.getByLabelText("Runner on 1st")).toBeTruthy();
  });
  it("labels a runner on second only", () => {
    render(<Diamond bases={{ first: false, second: true, third: false }} />);
    expect(screen.getByLabelText("Runner on 2nd")).toBeTruthy();
  });
  it("labels a runner on third only", () => {
    render(<Diamond bases={{ first: false, second: false, third: true }} />);
    expect(screen.getByLabelText("Runner on 3rd")).toBeTruthy();
  });
});

describe("Pips", () => {
  it("renders count pips with the filled ones marked", () => {
    const { container } = render(<Pips count={3} filled={2} kind="out" label="2 out" />);
    expect(container.querySelectorAll("span[data-pip]")).toHaveLength(3);
    expect(container.querySelectorAll("span[data-pip='on']")).toHaveLength(2);
  });
  it("marks red pips for colour-blind remapping", () => {
    const { container } = render(<Pips count={3} filled={1} kind="out" label="1 out" />);
    expect(container.querySelector("span[data-pip='on']")?.hasAttribute("data-cb-bad")).toBe(true);
  });
  it("does not mark accent pips as bad", () => {
    const { container } = render(<Pips count={4} filled={1} kind="accent" label="1 ball" />);
    expect(container.querySelector("span[data-pip='on']")?.hasAttribute("data-cb-bad")).toBe(false);
  });
});

describe("TeamLogo", () => {
  it("renders nothing without an id", () => {
    const { container } = render(<TeamLogo id={undefined} />);
    expect(container.firstChild).toBeNull();
  });
  it("points at the MLB logo CDN", () => {
    const { container } = render(<TeamLogo id={116} />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("/team-logos/116.svg");
  });
});
