import { useNews } from "../api/espn";
import { SectionTitle, Empty } from "../components/ui/Primitives";
import NewsList from "../components/ui/NewsList";
import { useSport } from "../contexts/SportContext";

export default function NewsPage() {
  const { sportId } = useSport();
  const isMlb = sportId === 1;
  const q = useNews({ limit: 40 });

  return (
    <div className="space-y-6">
      <SectionTitle title="News" subtitle="Latest around the league" />
      {!isMlb ? (
        <Empty message="News is available for MLB only." />
      ) : (
        <NewsList
          articles={q.data}
          isLoading={q.isLoading}
          error={q.error}
        />
      )}
    </div>
  );
}
