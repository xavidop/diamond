import { describe, it, expect } from "vitest";
import {
  parseGameContent,
  durationToSeconds,
  pickVideoUrl,
  pickThumbnail,
} from "./highlights";

describe("durationToSeconds", () => {
  it("parses HH:MM:SS", () => {
    expect(durationToSeconds("00:07:34")).toBe(454);
    expect(durationToSeconds("00:00:32")).toBe(32);
  });
  it("returns 0 on garbage", () => {
    expect(durationToSeconds("")).toBe(0);
    expect(durationToSeconds("nope")).toBe(0);
  });
});

describe("pickVideoUrl", () => {
  it("prefers mp4Avc", () => {
    const url = pickVideoUrl([
      { name: "hlsCloud", url: "x.m3u8" },
      { name: "mp4Avc", url: "good.mp4" },
    ]);
    expect(url).toBe("good.mp4");
  });
  it("falls back to first .mp4 url", () => {
    expect(pickVideoUrl([{ name: "highBit", url: "fallback.mp4" }])).toBe("fallback.mp4");
  });
  it("returns null when no mp4", () => {
    expect(pickVideoUrl([{ name: "hlsCloud", url: "x.m3u8" }])).toBeNull();
  });
});

describe("pickThumbnail", () => {
  it("picks the cut closest to 640px", () => {
    const src = pickThumbnail([
      { width: 1920, src: "big.jpg" },
      { width: 640, src: "mid.jpg" },
      { width: 320, src: "small.jpg" },
    ]);
    expect(src).toBe("mid.jpg");
  });
  it("returns empty string with no cuts", () => {
    expect(pickThumbnail([])).toBe("");
  });
});

describe("parseGameContent", () => {
  const raw = {
    highlights: {
      highlights: {
        items: [
          {
            id: "1",
            title: "Condensed Game: LAD@NYY",
            description: "cond",
            duration: "00:07:34",
            image: { cuts: [{ width: 640, src: "c.jpg" }] },
            playbacks: [{ name: "mp4Avc", url: "cond.mp4" }],
          },
          {
            id: "2",
            title: "Freeman's grand slam",
            description: "walk-off",
            duration: "00:00:45",
            image: { cuts: [{ width: 640, src: "gs.jpg" }] },
            playbacks: [{ name: "mp4Avc", url: "gs.mp4" }],
          },
          {
            id: "3",
            title: "No video clip",
            duration: "00:00:10",
            image: { cuts: [] },
            playbacks: [{ name: "hlsCloud", url: "x.m3u8" }],
          },
        ],
      },
    },
    editorial: { recap: { mlb: { headline: "Dodgers win", body: "<p>Body</p>" } } },
  };

  it("extracts condensed, recap, and playable clips (dropping no-video clips)", () => {
    const gc = parseGameContent(raw);
    expect(gc.condensed?.videoUrl).toBe("cond.mp4");
    expect(gc.recap?.headline).toBe("Dodgers win");
    expect(gc.recap?.bodyHtml).toBe("<p>Body</p>");
    // clip "3" dropped (no mp4); condensed excluded from clips list
    expect(gc.clips.map((c) => c.id)).toEqual(["2"]);
    expect(gc.clips[0].durationSec).toBe(45);
  });

  it("returns empty structure for empty payload", () => {
    const gc = parseGameContent({});
    expect(gc).toEqual({ condensed: null, recap: null, clips: [] });
  });
});
