export type Award = { id?: string; name: string; season?: string };

// Surface the honors fans care about, filtering out the long tail of
// minor-league weekly/monthly awards when major awards are present.
const MAJOR =
  /MVP|All-Star|Silver Slugger|Gold Glove|Platinum|Rookie of the Year|Cy Young|Hank Aaron|Player of the (Month|Year)|Pitcher of the (Month|Year)|Reliever of the|Comeback|Roberto Clemente|World Series|Championship|Batting (Title|Champion)|Triple Crown/i;

export function filterAwards(awards: Award[] | undefined, limit = 12): Award[] {
  const list = Array.isArray(awards) ? awards : [];
  const major = list.filter((a) => MAJOR.test(a.name ?? ""));
  const chosen = major.length ? major : list;
  return [...chosen]
    .sort((a, b) => String(b.season ?? "").localeCompare(String(a.season ?? "")))
    .slice(0, limit);
}

export function educationLine(education: any): string {
  const colleges = (education?.colleges ?? []).map((c: any) => c?.name).filter(Boolean);
  const highschools = (education?.highschools ?? []).map((h: any) => h?.name).filter(Boolean);
  const parts = [...colleges, ...highschools];
  return parts.join(" · ");
}
