// web/src/api/espn.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchNews, fetchArticle, timeAgo } from "./espn";

const SAMPLE = {
  articles: [
    {
      id: 123,
      headline: "Yankees win",
      description: "A recap",
      published: "2026-06-30T08:02:23Z",
      type: "Recap",
      images: [{ type: "Media", name: "x", url: "https://img/x.png" }],
      links: { web: { href: "https://espn.com/story" } },
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe("fetchNews", () => {
  it("normalizes ESPN articles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => SAMPLE })
    );
    const out = await fetchNews({ limit: 5 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "123",
      headline: "Yankees win",
      type: "Recap",
      webUrl: "https://espn.com/story",
      imageUrl: "https://img/x.png",
    });
  });

  it("adds the team param when espnTeamId is given", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => SAMPLE });
    vi.stubGlobal("fetch", f);
    await fetchNews({ espnTeamId: 10 });
    expect(String(f.mock.calls[0][0])).toContain("team=10");
  });

  it("filters a team feed to that team and drops league-wide roundups", async () => {
    const wide = Array.from({ length: 30 }, (_, i) => ({
      type: "team",
      teamId: i + 1,
    }));
    const TEAM_FEED = {
      articles: [
        {
          id: 1,
          headline: "Yankees news",
          links: { web: { href: "a" } },
          categories: [{ type: "team", teamId: 10 }],
        },
        {
          id: 2,
          headline: "Yankees vs Tigers",
          links: { web: { href: "b" } },
          categories: [
            { type: "team", teamId: 10 },
            { type: "team", team: { id: 6 } },
          ],
        },
        {
          id: 3,
          headline: "League power rankings",
          links: { web: { href: "c" } },
          categories: wide,
        },
        {
          id: 4,
          headline: "Red Sox news",
          links: { web: { href: "d" } },
          categories: [{ type: "team", teamId: 2 }],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => TEAM_FEED })
    );
    const out = await fetchNews({ espnTeamId: 10 });
    expect(out.map((a) => a.headline)).toEqual([
      "Yankees news",
      "Yankees vs Tigers",
    ]);
  });
});

describe("timeAgo", () => {
  it("formats recent times", () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(timeAgo(fiveMinAgo)).toMatch(/m ago|min/);
  });
});

describe("fetchArticle", () => {
  const CONTENT = {
    headlines: [
      {
        headline: "Big win",
        byline: "Jane Doe",
        description: "A recap",
        published: "2026-06-30T08:02:23Z",
        story: "<p>The team won.</p>",
        links: { web: { href: "https://espn.com/story" } },
        images: [{ url: "https://img/a.png", caption: "cap" }, { url: "" }],
      },
    ],
  };

  it("normalizes the content API response", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => CONTENT });
    vi.stubGlobal("fetch", f);
    const out = await fetchArticle("123");
    expect(String(f.mock.calls[0][0])).toContain("/sports/news/123");
    expect(out).toMatchObject({
      id: "123",
      headline: "Big win",
      byline: "Jane Doe",
      description: "A recap",
      storyHtml: "<p>The team won.</p>",
      webUrl: "https://espn.com/story",
    });
    expect(out.images).toEqual([
      { url: "https://img/a.png", caption: "cap", credit: undefined, alt: undefined },
    ]);
  });

  it("throws when there is no headline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ headlines: [] }) })
    );
    await expect(fetchArticle("1")).rejects.toThrow();
  });

  it("normalizes and de-dupes related stories", async () => {
    const withRelated = {
      headlines: [
        {
          headline: "Main",
          story: "<p>x</p>",
          related: [
            {
              id: 222,
              type: "Recap",
              headline: "Rel A",
              images: [{ url: "https://img/r.png" }],
              links: { web: { href: "https://espn.com/a" } },
            },
            { id: 222, type: "Recap", headline: "Dup" },
            { id: 333, headline: "Rel B" }, // no type → defaults to Story
            { id: 444 }, // no headline → dropped
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => withRelated })
    );
    const out = await fetchArticle("1");
    expect(out.related).toHaveLength(2);
    expect(out.related[0]).toMatchObject({
      id: "222",
      headline: "Rel A",
      type: "Recap",
      imageUrl: "https://img/r.png",
    });
    expect(out.related[1]).toMatchObject({ id: "333", type: "Story" });
  });
});
