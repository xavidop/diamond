import type { Article } from "../../api/espn";
import { timeAgo } from "../../api/espn";
import { Card, Empty, ErrorBox, Spinner } from "./Primitives";
import { Link } from "react-router-dom";

type Layout = "grid" | "list";

export default function NewsList({
  articles,
  isLoading,
  error,
  compact,
  layout = "grid",
}: {
  articles?: Article[];
  isLoading?: boolean;
  error?: unknown;
  /** Narrow vertical list (no images) for sidebars/rails. */
  compact?: boolean;
  /** Full-width presentation: "grid" of boxes or a denser horizontal "list". */
  layout?: Layout;
}) {
  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  if (error) return <ErrorBox error={error} />;
  if (!articles || articles.length === 0)
    return <Empty message="No news right now." />;

  // Compact rail: badge + time + headline, no images, no description.
  if (compact) {
    return (
      <div className="space-y-3">
        {articles.map((a) => (
          <ArticleLink key={a.id} a={a}>
            <Card pad={false} className="h-full hover:border-white/20 transition-colors">
              <div className="p-4">
                <Meta a={a} />
                <Headline a={a} />
              </div>
            </Card>
          </ArticleLink>
        ))}
      </div>
    );
  }

  // List: horizontal rows — thumbnail + headline + 1-line description.
  if (layout === "list") {
    return (
      <div className="space-y-3">
        {articles.map((a) => (
          <ArticleLink key={a.id} a={a}>
            <Card pad={false} className="overflow-hidden hover:border-white/20 transition-colors">
              <div className="flex gap-4">
                {a.imageUrl && (
                  <img
                    src={a.imageUrl}
                    alt=""
                    loading="lazy"
                    className="hidden sm:block h-24 w-40 shrink-0 object-cover bg-pitch-800"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div className="min-w-0 flex-1 py-3 pr-4 sm:pl-0 pl-4">
                  <Meta a={a} />
                  <Headline a={a} className="text-base" />
                  {a.description && (
                    <p className="mt-1 text-xs text-pitch-300/80 line-clamp-2">
                      {a.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </ArticleLink>
        ))}
      </div>
    );
  }

  // Grid of boxes (default).
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {articles.map((a) => (
        <ArticleLink key={a.id} a={a}>
          <Card pad={false} className="overflow-hidden h-full hover:border-white/20 transition-colors">
            {a.imageUrl && (
              <img
                src={a.imageUrl}
                alt=""
                loading="lazy"
                className="h-40 w-full object-cover bg-pitch-800"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="p-4">
              <Meta a={a} />
              <Headline a={a} />
              {a.description && (
                <p className="mt-1 text-xs text-pitch-300/80 line-clamp-3">
                  {a.description}
                </p>
              )}
            </div>
          </Card>
        </ArticleLink>
      ))}
    </div>
  );
}

function ArticleLink({ a, children }: { a: Article; children: React.ReactNode }) {
  // Read the story in-app. Fall back to the external ESPN page when we have no
  // id to build an in-app route (rare).
  if (!a.id) {
    return (
      <a
        href={a.webUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={`/news/${encodeURIComponent(a.id)}`} className="group block">
      {children}
    </Link>
  );
}

function Meta({ a }: { a: Article }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="pill">{a.type}</span>
      <span className="text-[11px] text-pitch-300/60">{timeAgo(a.published)}</span>
    </div>
  );
}

function Headline({ a, className }: { a: Article; className?: string }) {
  return (
    <div
      className={`font-display font-bold leading-snug text-white group-hover:text-volt-500 transition-colors ${
        className ?? "text-sm"
      }`}
    >
      {a.headline}
    </div>
  );
}
