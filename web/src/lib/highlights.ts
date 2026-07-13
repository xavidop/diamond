export type Clip = {
  id: string;
  title: string;
  description: string;
  durationSec: number;
  thumbnail: string;
  videoUrl: string;
};

export type GameContent = {
  condensed: Clip | null;
  recap: { headline: string; bodyHtml: string } | null;
  clips: Clip[];
};

export function durationToSeconds(hms: string): number {
  const parts = String(hms).split(":").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

export function pickVideoUrl(playbacks: any[]): string | null {
  const list = Array.isArray(playbacks) ? playbacks : [];
  const avc = list.find((p) => p?.name === "mp4Avc" && p?.url);
  if (avc) return avc.url as string;
  const mp4 = list.find((p) => typeof p?.url === "string" && p.url.endsWith(".mp4"));
  return mp4 ? (mp4.url as string) : null;
}

export function pickThumbnail(cuts: any[]): string {
  const list = Array.isArray(cuts) ? cuts : [];
  if (list.length === 0) return "";
  let best = list[0];
  for (const c of list) {
    if (Math.abs((c?.width ?? 0) - 640) < Math.abs((best?.width ?? 0) - 640)) best = c;
  }
  return best?.src ?? "";
}

function toClip(item: any): Clip | null {
  const videoUrl = pickVideoUrl(item?.playbacks);
  if (!videoUrl) return null;
  return {
    id: String(item?.id ?? item?.slug ?? videoUrl),
    title: item?.title ?? item?.headline ?? "Highlight",
    description: item?.description ?? item?.blurb ?? "",
    durationSec: durationToSeconds(item?.duration ?? ""),
    thumbnail: pickThumbnail(item?.image?.cuts),
    videoUrl,
  };
}

export function parseGameContent(raw: any): GameContent {
  const items: any[] = raw?.highlights?.highlights?.items ?? [];
  const clips: Clip[] = [];
  let condensed: Clip | null = null;

  for (const item of items) {
    const clip = toClip(item);
    if (!clip) continue;
    if (!condensed && /condensed/i.test(clip.title)) {
      condensed = clip;
      continue;
    }
    clips.push(clip);
  }

  const r = raw?.editorial?.recap?.mlb;
  const recap =
    r && (r.headline || r.body)
      ? { headline: r.headline ?? "", bodyHtml: r.body ?? "" }
      : null;

  return { condensed, recap, clips };
}
