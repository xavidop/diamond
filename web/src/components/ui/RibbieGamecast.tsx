import { useEffect, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { Card, SectionTitle } from "./Primitives";

/**
 * How long to wait for the embed before assuming it will never arrive. A
 * cross-origin frame can't be inspected, so a frame that's blocked (or a Ribbie
 * that's down) looks exactly like one that's still loading — this timeout is
 * the only signal we get.
 */
const LOAD_TIMEOUT_MS = 8000;

/**
 * Kill switch. Ribbie is someone else's project and their legal notes ask people
 * not to "republish" it — an embed is a friendlier read than that, but if they'd
 * rather we didn't, flipping this to `false` removes the section everywhere.
 */
export const RIBBIE_ENABLED = true;

const gameUrl = (gamePk: string) => `https://ribbie.tv/watch/game/${gamePk}`;

/**
 * Ribbie's pixel-art gamecast for a live game, embedded on demand.
 *
 * Ribbie keys its URLs by MLB gamePk — the same id we already have — so there's
 * nothing to map. Nothing loads from ribbie.tv until the user clicks Watch:
 * that keeps their servers out of every page view we serve, and makes the click
 * itself the consent for the third-party analytics their embed runs.
 */
export default function RibbieGamecast({
  gamePk,
  awayName,
  homeName,
  enabled = RIBBIE_ENABLED,
}: {
  gamePk: string;
  awayName?: string;
  homeName?: string;
  enabled?: boolean;
}) {
  const [watching, setWatching] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!watching || loaded) return;
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [watching, loaded]);

  if (!enabled) return null;

  const matchup = `${awayName ?? "Away"} at ${homeName ?? "Home"}`;

  return (
    <div>
      <SectionTitle
        title="Watch in 8-Bit"
        subtitle="Ribbie's pixel-art gamecast"
      />
      <Card pad={false}>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          {timedOut ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-pitch-800 to-black px-6 text-center">
              <p className="text-sm text-pitch-300/70">
                Couldn't load the gamecast.
              </p>
              <a
                href={gameUrl(gamePk)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-accent"
              >
                <ExternalLink size={14} /> Open on ribbie.tv
              </a>
            </div>
          ) : watching ? (
            <iframe
              src={gameUrl(gamePk)}
              title={`Ribbie 8-bit gamecast — ${matchup}`}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups"
              allowFullScreen
              onLoad={() => setLoaded(true)}
            />
          ) : (
            <>
              {posterFailed ? (
                <div className="h-full w-full bg-gradient-to-br from-pitch-800 to-black" />
              ) : (
                <img
                  src={`${gameUrl(gamePk)}/og`}
                  alt={`Ribbie's pixel-art view of ${matchup}`}
                  className="h-full w-full object-cover"
                  onError={() => setPosterFailed(true)}
                />
              )}
              <button
                onClick={() => setWatching(true)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 motion-safe:transition-colors hover:bg-black/25"
              >
                <span className="btn btn-accent pointer-events-none">
                  <Play size={14} /> Watch
                </span>
              </button>
            </>
          )}
        </div>
      </Card>

      <div className="mt-2 flex flex-col gap-1 text-xs text-pitch-300/60 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Powered by{" "}
          <a
            href={gameUrl(gamePk)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/25 underline-offset-2 hover:text-white"
          >
            Ribbie
          </a>{" "}
          — an independent fan project, not affiliated with MLB.
        </span>
        {!watching && (
          <span className="shrink-0">
            Watching loads ribbie.tv, which uses its own{" "}
            <a
              href="https://ribbie.tv/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/25 underline-offset-2 hover:text-white"
            >
              analytics
            </a>
            .
          </span>
        )}
      </div>
    </div>
  );
}
