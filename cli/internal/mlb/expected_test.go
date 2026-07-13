package mlb

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPlayerExpectedStats(t *testing.T) {
	body := `{"stats":[{"type":{"displayName":"expectedStatistics"},"splits":[{"stat":{"avg":".309","slg":".721","woba":".476","wobaCon":".615"}}]}]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(body))
	}))
	defer srv.Close()

	c := NewClient(srv.URL, srv.URL)
	es, err := c.PlayerExpectedStats(592450, "hitting", "2024")
	if err != nil {
		t.Fatal(err)
	}
	if es.XBA != ".309" || es.XwOBA != ".476" {
		t.Fatalf("got %+v", es)
	}
}

func TestPlayerExpectedStatsEmpty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"stats":[]}`))
	}))
	defer srv.Close()
	c := NewClient(srv.URL, srv.URL)
	if _, err := c.PlayerExpectedStats(1, "hitting", "2024"); err == nil {
		t.Fatal("expected error on empty splits")
	}
}
