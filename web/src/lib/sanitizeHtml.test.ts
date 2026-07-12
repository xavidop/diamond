// web/src/lib/sanitizeHtml.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeStoryHtml } from "./sanitizeHtml";

describe("sanitizeStoryHtml", () => {
  it("keeps safe formatting and links", () => {
    const out = sanitizeStoryHtml(
      `<p>The <a data-x="1" href="https://x/y">team</a> won ` +
        `<strong>big</strong>.</p><h3>Reaction</h3><ul><li>One</li></ul>`
    );
    expect(out).toContain("<p>");
    expect(out).toContain('href="https://x/y"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain("<strong>big</strong>");
    expect(out).toContain("<h3>Reaction</h3>");
    expect(out).toContain("<li>One</li>");
    // data-* attributes are stripped
    expect(out).not.toContain("data-x");
  });

  it("drops scripts and neutralizes javascript: urls", () => {
    const out = sanitizeStoryHtml(
      `<p>ok</p><script>alert(1)</script>` +
        `<a href="javascript:alert(1)">x</a>`
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("<p>ok</p>");
  });

  it("unwraps unknown/custom tags but keeps their text", () => {
    const out = sanitizeStoryHtml(`<p>a <alsosee>see this</alsosee> b</p>`);
    expect(out).not.toContain("alsosee");
    expect(out).toContain("see this");
  });

  it("returns empty for empty input", () => {
    expect(sanitizeStoryHtml("")).toBe("");
  });
});
