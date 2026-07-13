import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, teamLogoUrl } from "../../api/mlb";
import { parseAffiliates } from "../../lib/affiliates";
import { Card, SectionTitle } from "./Primitives";

type TeamLike = {
  id: number;
  sport?: { id?: number };
  parentOrgId?: number;
  parentOrgName?: string;
};

export default function FarmSystem({ team }: { team: TeamLike }) {
  const isMlb = team.sport?.id === 1;

  const { data } = useQuery({
    queryKey: ["affiliates", team.id],
    queryFn: () => api.teamAffiliates(team.id, new Date().getFullYear()),
    enabled: isMlb,
    staleTime: 24 * 60 * 60_000,
  });

  // Minor-league club → link back up to the parent organization.
  if (!isMlb) {
    if (!team.parentOrgId) return null;
    return (
      <div className="space-y-3">
        <SectionTitle title="Organization" />
        <Card>
          <Link
            to={`/teams/${team.parentOrgId}`}
            className="text-sm text-pitch-300 hover:text-white transition-colors"
          >
            Affiliate of{" "}
            <span className="font-semibold text-white">{team.parentOrgName}</span>
          </Link>
        </Card>
      </div>
    );
  }

  const affiliates = data ? parseAffiliates(data) : [];
  if (affiliates.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionTitle title="Farm System" subtitle="Minor-league affiliates" />
      <Card pad={false}>
        <ul className="divide-y divide-white/5">
          {affiliates.map((a) => (
            <li key={a.id}>
              <Link
                to={`/teams/${a.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5"
              >
                <span className="pill w-14 shrink-0 justify-center">{a.level}</span>
                <img
                  src={teamLogoUrl(a.id)}
                  alt=""
                  className="h-6 w-6 shrink-0 object-contain"
                  onError={(e) => {
                    // Affiliate has no logo → fall back to the parent MLB club's
                    // logo; if that fails too, hide the image.
                    const img = e.currentTarget as HTMLImageElement;
                    const parentLogo = teamLogoUrl(team.id);
                    if (!img.dataset.fellBack && img.src !== parentLogo) {
                      img.dataset.fellBack = "1";
                      img.src = parentLogo;
                    } else {
                      img.style.display = "none";
                    }
                  }}
                />
                <span className="flex-1 font-medium text-white">{a.name}</span>
                <span className="text-xs text-pitch-300">{a.league}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
