package mlb

import "sort"

// FilterAffiliates keeps only real playing levels (AAA→Rookie) from a raw
// affiliates response and sorts them by level, dropping MLB itself and umbrella
// pseudo-teams (Organization / Prospects / Alternate Training Site).
func FilterAffiliates(teams []Team) []Team {
	var out []Team
	for _, t := range teams {
		if _, ok := AffiliateLevels[t.Sport.ID]; ok {
			out = append(out, t)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		return AffiliateLevels[out[i].Sport.ID].Order < AffiliateLevels[out[j].Sport.ID].Order
	})
	return out
}
