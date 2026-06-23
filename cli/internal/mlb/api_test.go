package mlb_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/xavidop/diamond/cli/internal/mlb"
)

func TestSchedule(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/schedule" {
			http.NotFound(w, r)
			return
		}
		resp := map[string]interface{}{
			"dates": []map[string]interface{}{
				{"games": []map[string]interface{}{
					{"gamePk": 1234, "status": map[string]string{"abstractGameState": "Live"}},
				}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := mlb.NewClient(server.URL, server.URL)
	games, err := c.Schedule("2025-06-19", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(games) != 1 {
		t.Fatalf("expected 1 game, got %d", len(games))
	}
	if games[0].GamePk != 1234 {
		t.Errorf("expected gamePk 1234, got %d", games[0].GamePk)
	}
}
