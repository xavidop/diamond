// web/src/api/espn.ts
import { useQuery } from "@tanstack/react-query";

const ESPN_NEWS_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news";

// ESPN tags league-wide roundups (e.g. power rankings) with many/all teams.
// A genuinely team-specific article references only its own team plus, for a
// game story, the opponent — so we drop anything tagged with more teams.
const MAX_TEAMS_PER_ARTICLE = 6;

export type Article = {
  id: string;
  headline: string;
  description: string;
  published: string;
  type: string;
  webUrl: string;
  imageUrl?: string;
  /** ESPN team ids this article is tagged with (from its categories). */
  teamIds: number[];
};

type EspnArticle = {
  id?: number | string;
  headline?: string;
  description?: string;
  published?: string;
  type?: string;
  images?: Array<{ url?: string }>;
  links?: { web?: { href?: string } };
  categories?: Array<{ type?: string; teamId?: number; team?: { id?: number } }>;
};

function teamIdsOf(a: EspnArticle): number[] {
  const ids = new Set<number>();
  for (const c of a.categories ?? []) {
    if (c.type !== "team") continue;
    const id = c.teamId ?? c.team?.id;
    if (typeof id === "number") ids.add(id);
  }
  return [...ids];
}

function normalize(a: EspnArticle): Article {
  return {
    id: String(a.id ?? a.headline ?? Math.random()),
    headline: a.headline ?? "Untitled",
    description: a.description ?? "",
    published: a.published ?? "",
    type: a.type ?? "Story",
    webUrl: a.links?.web?.href ?? "",
    imageUrl: a.images?.find((i) => i.url)?.url,
    teamIds: teamIdsOf(a),
  };
}

export async function fetchNews(
  opts: { espnTeamId?: number; limit?: number } = {}
): Promise<Article[]> {
  const teamId = opts.espnTeamId;
  const want = opts.limit ?? 30;
  const url = new URL(ESPN_NEWS_BASE);
  // Over-fetch when filtering to a team so enough survive the team filter.
  url.searchParams.set("limit", String(teamId != null ? 50 : want));
  if (teamId != null) url.searchParams.set("team", String(teamId));
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ESPN news ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { articles?: EspnArticle[] };
  let articles = (data.articles ?? []).map(normalize);
  if (teamId != null) {
    // Keep only articles that actually reference this team and are not
    // league-wide roundups (which ESPN tags with many teams).
    articles = articles.filter(
      (a) =>
        a.teamIds.includes(teamId) &&
        a.teamIds.length <= MAX_TEAMS_PER_ARTICLE
    );
  }
  return articles.slice(0, want);
}

export function useNews(opts: { espnTeamId?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ["espn-news", opts.espnTeamId ?? "all", opts.limit ?? 30],
    queryFn: () => fetchNews(opts),
    staleTime: 5 * 60_000,
  });
}

export function timeAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
