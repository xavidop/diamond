// cli/internal/mlb/team_transactions_test.go
package mlb

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTeamTransactionsURL(t *testing.T) {
	var gotPath, gotQuery string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotQuery = r.URL.Path, r.URL.RawQuery
		w.Write([]byte(`{"transactions":[{"id":1,"typeCode":"TR","description":"x"}]}`))
	}))
	defer srv.Close()

	c := NewClient(srv.URL, srv.URL)
	txns, err := c.TeamTransactions(147, "2026-01-01", "2026-06-30")
	if err != nil {
		t.Fatalf("TeamTransactions: %v", err)
	}
	if len(txns) != 1 || txns[0].TypeCode != "TR" {
		t.Fatalf("bad txns: %+v", txns)
	}
	if gotPath != "/transactions" {
		t.Fatalf("path = %q", gotPath)
	}
	for _, want := range []string{"teamId=147", "startDate=2026-01-01", "endDate=2026-06-30"} {
		if !contains(gotQuery, want) {
			t.Fatalf("query %q missing %q", gotQuery, want)
		}
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || indexOf(s, sub) >= 0)
}
func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
