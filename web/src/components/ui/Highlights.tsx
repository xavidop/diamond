import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/mlb";
import { parseGameContent, type Clip } from "../../lib/highlights";
import { sanitizeStoryHtml } from "../../lib/sanitizeHtml";
import { Card, SectionTitle } from "./Primitives";

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Player({ clip, autoPlay }: { clip: Clip; autoPlay: boolean }) {
  return (
    <video
      key={clip.videoUrl}
      className="w-full rounded-lg bg-black"
      src={clip.videoUrl}
      poster={clip.thumbnail || undefined}
      controls
      autoPlay={autoPlay}
      preload="none"
    />
  );
}

export default function Highlights({ gamePk }: { gamePk: string | number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["game-content", String(gamePk)],
    queryFn: () => api.gameContent(gamePk),
    staleTime: 5 * 60_000,
  });
  const content = useMemo(() => (data ? parseGameContent(data) : null), [data]);
  const [selected, setSelected] = useState<Clip | null>(null);
  const [showRecap, setShowRecap] = useState(true);
  const playerRef = useRef<HTMLDivElement>(null);

  // When the user picks a new clip, bring the player back into view.
  useEffect(() => {
    if (selected) {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selected]);

  if (isLoading) return null;
  if (!content) return null;
  const { condensed, recap, clips } = content;
  if (!condensed && !recap && clips.length === 0) return null;

  const active = selected ?? condensed ?? clips[0] ?? null;
  const gallery = condensed ? [condensed, ...clips] : clips;

  return (
    <div className="space-y-3">
      <SectionTitle title="Highlights" />
      <Card>
        <div ref={playerRef} style={{ scrollMarginTop: "1rem" }}>
          {active && <Player clip={active} autoPlay={selected != null} />}
        </div>
        {active && (
          <div className="mt-2 text-sm text-pitch-300">
            {active.title}
            {active.durationSec ? ` · ${fmtDur(active.durationSec)}` : ""}
          </div>
        )}

        {recap && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <button className="btn" onClick={() => setShowRecap((v) => !v)}>
              {showRecap ? "Hide recap" : "Read recap"}
            </button>
            {showRecap && (
              <div className="mt-2">
                <div className="font-semibold">{recap.headline}</div>
                <div
                  className="article-body prose prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizeStoryHtml(recap.bodyHtml) }}
                />
              </div>
            )}
          </div>
        )}

        {gallery.length > 1 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {gallery.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)} className="group text-left">
                <div className="relative overflow-hidden rounded-md bg-black/40 aspect-video">
                  {c.thumbnail && (
                    <img
                      src={c.thumbnail}
                      alt={c.title}
                      loading="lazy"
                      className="h-full w-full object-cover opacity-90 group-hover:opacity-100"
                    />
                  )}
                  {c.durationSec > 0 && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px]">
                      {fmtDur(c.durationSec)}
                    </span>
                  )}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-pitch-300">{c.title}</div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
