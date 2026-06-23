package ui

import (
	"strings"
	"testing"
)

func TestFilterGlossary(t *testing.T) {
	all := glossaryTerms
	if len(all) < 30 {
		t.Fatalf("expected the full glossary (~42 terms), got %d", len(all))
	}
	// case-insensitive match on abbreviation
	got := filterGlossary(all, "OPS")
	if len(got) == 0 || !strings.EqualFold(got[0].Abbr, "ops") {
		t.Fatalf("query 'OPS' should match the OPS term, got %+v", got)
	}
	// match on definition text
	got = filterGlossary(all, "on-base")
	found := false
	for _, x := range got {
		if strings.EqualFold(x.Abbr, "obp") {
			found = true
		}
	}
	if !found {
		t.Fatalf("query 'on-base' should match OBP via its definition")
	}
	// empty query returns everything
	if len(filterGlossary(all, "")) != len(all) {
		t.Fatalf("empty query should return all terms")
	}
	// no match returns empty
	if len(filterGlossary(all, "zzzzz")) != 0 {
		t.Fatalf("nonsense query should return no terms")
	}
}
