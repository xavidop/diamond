package espn

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestArticleContent(t *testing.T) {
	const body = `{"headlines":[{"headline":"Big win","byline":"Jane Doe",
	  "story":"<p>The <a href=\"https://x\">team</a> won.</p>",
	  "images":[{"url":"https://img/a.png"},{"url":""}]}]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	c := NewClient(BaseURL)
	got, err := c.ArticleContent(srv.URL)
	if err != nil {
		t.Fatalf("ArticleContent: %v", err)
	}
	if got.Headline != "Big win" || got.Byline != "Jane Doe" {
		t.Fatalf("bad headline/byline: %+v", got)
	}
	if got.StoryHTML == "" {
		t.Fatal("empty story html")
	}
	if len(got.Images) != 1 || got.Images[0] != "https://img/a.png" {
		t.Fatalf("bad images: %v", got.Images)
	}
}

func TestArticleContentErrors(t *testing.T) {
	c := NewClient(BaseURL)
	if _, err := c.ArticleContent(""); err == nil {
		t.Fatal("want error for empty url")
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"headlines":[]}`))
	}))
	defer srv.Close()
	if _, err := c.ArticleContent(srv.URL); err == nil {
		t.Fatal("want error when no headlines")
	}
}

func TestArticleContentRelated(t *testing.T) {
	const body = `{"headlines":[{"headline":"Main","story":"<p>x</p>","related":[
	  {"id":222,"type":"Recap","headline":"Rel A",
	   "images":[{"url":"https://img/r.png"}],
	   "links":{"web":{"href":"https://espn.com/a"},
	            "api":{"self":{"href":"https://content.core.api.espn.com/v1/sports/news/222"}}}},
	  {"id":222,"type":"Recap","headline":"Dup (same id)"},
	  {"id":333,"headline":"Rel B (no type, api fallback)"}
	]}]}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	got, err := NewClient(BaseURL).ArticleContent(srv.URL)
	if err != nil {
		t.Fatalf("ArticleContent: %v", err)
	}
	if len(got.Related) != 2 {
		t.Fatalf("want 2 related (deduped), got %d: %+v", len(got.Related), got.Related)
	}
	a := got.Related[0]
	if a.ID != "222" || a.Headline != "Rel A" || a.Type != "Recap" {
		t.Fatalf("bad related[0]: %+v", a)
	}
	if a.APIURL != "https://content.core.api.espn.com/v1/sports/news/222" {
		t.Fatalf("bad related[0] APIURL: %q", a.APIURL)
	}
	b := got.Related[1]
	if b.Type != "Story" || b.APIURL != contentBase+"333" {
		t.Fatalf("bad related[1] type/APIURL fallback: %+v", b)
	}
}
