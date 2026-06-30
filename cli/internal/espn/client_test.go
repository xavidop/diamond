package espn

import "testing"

const sampleJSON = `{"articles":[
  {"id":123,"headline":"Yankees win","description":"recap","type":"Recap",
   "published":"2026-06-30T08:02:23Z",
   "images":[{"url":"https://img/x.png"}],
   "links":{"web":{"href":"https://espn.com/story"}},
   "categories":[{"type":"league","leagueId":10},
                 {"type":"team","teamId":10},
                 {"type":"team","team":{"id":6}}]}
]}`

func TestParseArticles(t *testing.T) {
	arts, err := parseArticles([]byte(sampleJSON))
	if err != nil {
		t.Fatalf("parseArticles: %v", err)
	}
	if len(arts) != 1 {
		t.Fatalf("want 1 article, got %d", len(arts))
	}
	a := arts[0]
	if a.Headline != "Yankees win" || a.Type != "Recap" {
		t.Fatalf("bad headline/type: %+v", a)
	}
	if a.WebURL != "https://espn.com/story" {
		t.Fatalf("bad web url: %q", a.WebURL)
	}
	if a.ImageURL != "https://img/x.png" {
		t.Fatalf("bad image url: %q", a.ImageURL)
	}
	if a.Published.Year() != 2026 {
		t.Fatalf("bad published: %v", a.Published)
	}
	// team categories → TeamIDs (teamId and nested team.id), league cat ignored
	if len(a.TeamIDs) != 2 || a.TeamIDs[0] != 10 || a.TeamIDs[1] != 6 {
		t.Fatalf("bad TeamIDs: %v", a.TeamIDs)
	}
}

func TestFilterByTeam(t *testing.T) {
	// league-wide roundup: tagged with many teams (must be dropped)
	wide := make([]int, 0, 30)
	for i := 1; i <= 30; i++ {
		wide = append(wide, i)
	}
	arts := []Article{
		{Headline: "Yankees news", TeamIDs: []int{10}},           // keep
		{Headline: "Yankees vs Tigers", TeamIDs: []int{10, 6}},   // keep (game)
		{Headline: "League power rankings", TeamIDs: wide},       // drop (league-wide)
		{Headline: "Red Sox news", TeamIDs: []int{2}},            // drop (other team)
		{Headline: "Untagged", TeamIDs: nil},                     // drop (no team)
	}
	got := filterByTeam(arts, 10)
	if len(got) != 2 {
		t.Fatalf("want 2 Yankees articles, got %d: %+v", len(got), got)
	}
	for _, a := range got {
		if a.Headline == "League power rankings" || a.Headline == "Red Sox news" {
			t.Fatalf("unexpected article survived filter: %q", a.Headline)
		}
	}
}
