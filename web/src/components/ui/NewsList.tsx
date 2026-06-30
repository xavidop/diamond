import type { Article } from "../../api/espn";
import { timeAgo } from "../../api/espn";
import { Card, Empty, ErrorBox, Spinner } from "./Primitives";

export default function NewsList({
  articles,
  isLoading,
  error,
  compact,
}: {
  articles?: Article[];
  isLoading?: boolean;
  error?: unknown;
  compact?: boolean;
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

  return (
    <div
      className={
        compact
          ? "space-y-3"
          : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
      }
    >
      {articles.map((a) => (
        <a
          key={a.id}
          href={a.webUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <Card pad={false} className="overflow-hidden h-full hover:border-white/20 transition-colors">
            {!compact && a.imageUrl && (
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
              <div className="mb-1 flex items-center gap-2">
                <span className="pill">{a.type}</span>
                <span className="text-[11px] text-pitch-300/60">
                  {timeAgo(a.published)}
                </span>
              </div>
              <div className="font-display font-bold text-sm leading-snug text-white group-hover:text-volt-500 transition-colors">
                {a.headline}
              </div>
              {!compact && a.description && (
                <p className="mt-1 text-xs text-pitch-300/80 line-clamp-3">
                  {a.description}
                </p>
              )}
            </div>
          </Card>
        </a>
      ))}
    </div>
  );
}
