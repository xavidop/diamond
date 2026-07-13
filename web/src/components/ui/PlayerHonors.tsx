import { filterAwards, educationLine, type Award } from "../../lib/playerHonors";
import { Card, SectionTitle } from "./Primitives";

export default function PlayerHonors({
  awards,
  education,
}: {
  awards?: Award[];
  education?: any;
}) {
  const honors = filterAwards(awards);
  const edu = educationLine(education);
  if (honors.length === 0 && !edu) return null;

  return (
    <div className="space-y-3">
      <SectionTitle title="Honors & Background" />
      <Card>
        {honors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {honors.map((a, i) => (
              <span key={i} className="pill">
                {a.name}
                {a.season ? ` '${String(a.season).slice(-2)}` : ""}
              </span>
            ))}
          </div>
        )}
        {edu && (
          <div className="mt-3 text-sm text-pitch-300">
            School: <span className="text-white">{edu}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
