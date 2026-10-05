package mlb_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func psTeam(id, division int) map[string]interface{} {
	t := map[string]interface{}{"id": id, "name": "Team"}
	if division != 0 {
		t["division"] = map[string]int{"id": division}
	}
	return map[string]interface{}{"team": t}
}

// postseasonServer serves /schedule per season and /standings for the clinch
// fallback. A season missing from games has no postseason games at all.
func postseasonServer(t *testing.T, games map[string][]map[string]interface{}, clinched bool) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/schedule":
			season := r.URL.Query().Get("season")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"dates": []map[string]interface{}{{"games": games[season]}},
			})
		case "/standings":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"records": []map[string]interface{}{{
					"teamRecords": []map[string]interface{}{{"clinched": clinched}},
				}},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestCurrentPostseason(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	real := map[string]interface{}{"gamePk": 1, "teams": map[string]interface{}{"away": psTeam(143, 204), "home": psTeam(144, 204)}}
	placeholder := map[string]interface{}{"gamePk": 2, "teams": map[string]interface{}{"away": psTeam(5525, 0), "home": psTeam(5517, 0)}}
	lastYear := map[string]interface{}{"gamePk": 3, "teams": map[string]interface{}{"away": psTeam(119, 203), "home": psTeam(141, 201)}}

	cases := []struct {
		name     string
		games    map[string][]map[string]interface{}
		clinched bool
		want     string
		wantPk   int
	}{
		{"current bracket has real clubs", map[string][]map[string]interface{}{"2026": {placeholder, real}, "2025": {lastYear}}, false, "2026", 2},
		{"only placeholders but a club clinched", map[string][]map[string]interface{}{"2026": {placeholder}, "2025": {lastYear}}, true, "2026", 2},
		{"only placeholders, nobody clinched", map[string][]map[string]interface{}{"2026": {placeholder}, "2025": {lastYear}}, false, "2025", 3},
		{"no current postseason yet", map[string][]map[string]interface{}{"2025": {lastYear}}, false, "2025", 3},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := postseasonServer(t, tc.games, tc.clinched)
			season, games, err := mlb.NewClient(srv.URL, srv.URL).CurrentPostseason(now)
			if err != nil {
				t.Fatal(err)
			}
			if season != tc.want {
				t.Fatalf("season = %s, want %s", season, tc.want)
			}
			if len(games) == 0 || games[0].GamePk != tc.wantPk {
				t.Fatalf("games = %+v, want first gamePk %d", games, tc.wantPk)
			}
		})
	}
}
