import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/mlb";
import { Card, SectionTitle } from "./Primitives";

export default function CoachingStaff({ teamId }: { teamId: number | string }) {
  const { data } = useQuery({
    queryKey: ["coaches", String(teamId)],
    queryFn: () => api.teamCoaches(teamId, new Date().getFullYear()),
    staleTime: 24 * 60 * 60_000,
  });

  const staff = (data?.roster ?? []) as any[];
  if (staff.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionTitle title="Coaching Staff" />
      <Card pad={false}>
        <ul className="divide-y divide-white/5">
          {staff.map((c, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 shrink-0 text-right font-mono text-xs text-pitch-300">
                {c.jerseyNumber || ""}
              </span>
              <span className="flex-1 font-medium text-white">{c.person?.fullName}</span>
              <span className="text-xs text-pitch-300">{c.title || c.job}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
