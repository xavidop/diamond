package mlb

import (
	"regexp"
	"sort"
)

// Award is a single honor a player has received.
type Award struct {
	Name   string `json:"name"`
	Season string `json:"season"`
}

var majorAwardRe = regexp.MustCompile(`(?i)MVP|All-Star|Silver Slugger|Gold Glove|Platinum|Rookie of the Year|Cy Young|Hank Aaron|Player of the (Month|Year)|Pitcher of the (Month|Year)|Reliever of the|Comeback|Roberto Clemente|World Series|Championship|Batting (Title|Champion)|Triple Crown`)

// FilterAwards surfaces the major honors (falling back to all awards when none
// match), most-recent first, capped at limit.
func FilterAwards(awards []Award, limit int) []Award {
	var major []Award
	for _, a := range awards {
		if majorAwardRe.MatchString(a.Name) {
			major = append(major, a)
		}
	}
	chosen := major
	if len(chosen) == 0 {
		chosen = awards
	}
	out := make([]Award, len(chosen))
	copy(out, chosen)
	sort.SliceStable(out, func(i, j int) bool { return out[i].Season > out[j].Season })
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}
