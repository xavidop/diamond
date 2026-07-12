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
