import { useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useArticle, timeAgo } from "../api/espn";
import { sanitizeStoryHtml } from "../lib/sanitizeHtml";
import { Card, ErrorBox, Spinner, Empty, SectionTitle } from "../components/ui/Primitives";
import NewsList from "../components/ui/NewsList";

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const q = useArticle(id);

  const html = useMemo(
    () => sanitizeStoryHtml(q.data?.storyHtml ?? ""),
    [q.data?.storyHtml]
  );

  // Step back through the drill chain (article → previous article → … → the
  // News page). `location.key` is "default" only on a direct load with no
  // in-app history, in which case we land on the News list.
  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/news");
  };

  const backLink = (
    <button
      onClick={goBack}
      className="inline-flex items-center gap-1.5 text-sm text-pitch-300 hover:text-white transition-colors"
    >
      <ArrowLeft size={15} /> Back
    </button>
  );

  if (q.isLoading) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="space-y-6">
        {backLink}
        <ErrorBox error={q.error} />
      </div>
    );
  }

  const a = q.data;
  if (!a) {
    return (
      <div className="space-y-6">
        {backLink}
        <Empty message="Article not found." />
      </div>
    );
  }

  const lead = a.images[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {backLink}

      <article className="space-y-5">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-pitch-300/70">
            {a.byline && <span className="pill">{a.byline}</span>}
            {a.published && <span>{timeAgo(a.published)}</span>}
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl uppercase leading-tight tracking-tight text-white">
            {a.headline}
          </h1>
          {a.description && (
            <p className="text-lg text-pitch-300 leading-snug">{a.description}</p>
          )}
        </header>

        {lead && (
          <figure className="space-y-1">
            <img
              src={lead.url}
              alt={lead.alt ?? ""}
              className="w-full rounded-xl object-cover bg-pitch-800"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            {(lead.caption || lead.credit) && (
              <figcaption className="text-[11px] text-pitch-300/60">
                {lead.caption}
                {lead.credit ? ` (${lead.credit})` : ""}
              </figcaption>
            )}
          </figure>
        )}

        {html ? (
          <div
            className="article-body prose prose-invert max-w-none
              prose-p:leading-relaxed prose-a:text-volt-500 prose-a:no-underline hover:prose-a:underline
              prose-headings:font-display prose-headings:uppercase prose-headings:tracking-wide
              prose-strong:text-white prose-img:rounded-lg"
            // Content is sanitized to a safe subset by sanitizeStoryHtml.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <Card>
            <p className="text-sm text-pitch-300">
              The full story isn’t available to read here.
            </p>
          </Card>
        )}

        {a.webUrl && (
          <div className="pt-2 border-t border-white/[0.06]">
            <a
              href={a.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-pitch-300 hover:text-white transition-colors"
            >
              Read the original on ESPN <ExternalLink size={14} />
            </a>
          </div>
        )}

        {a.related.length > 0 && (
          <section className="pt-4">
            <SectionTitle title="Related" subtitle="More stories" />
            <NewsList articles={a.related.slice(0, 6)} layout="list" />
          </section>
        )}
      </article>
    </div>
  );
}
