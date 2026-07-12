package espn

import (
	"encoding/json"
	"time"
)

// Article is a trimmed ESPN news item.
type Article struct {
	ID          string
	Headline    string
	Description string
	Type        string
	WebURL      string
	// APIURL points at ESPN's content API for this story (the full body). It is
	// taken from links.api.self.href, falling back to a URL built from the ID.
	APIURL    string
	ImageURL  string
	Published time.Time
	// TeamIDs are the ESPN team ids this article is tagged with (from its
	// categories); used to filter a team feed down to genuinely team news.
	TeamIDs []int
}

// ArticleContent is the full body of a story, fetched from ESPN's content API.
type ArticleContent struct {
	Headline  string
	Byline    string
	StoryHTML string // the article body as HTML (may be empty for previews)
	Images    []string
}

// espnFeed mirrors the parts of the ESPN news JSON we consume.
type espnFeed struct {
	Articles []espnArticle `json:"articles"`
}

type espnArticle struct {
	ID          json.Number `json:"id"`
	Headline    string      `json:"headline"`
	Description string      `json:"description"`
	Type        string      `json:"type"`
	Published   string      `json:"published"`
	Images      []struct {
		URL string `json:"url"`
	} `json:"images"`
	Links struct {
		Web struct {
			Href string `json:"href"`
		} `json:"web"`
		API struct {
			Self struct {
				Href string `json:"href"`
			} `json:"self"`
		} `json:"api"`
	} `json:"links"`
	Categories []struct {
		Type   string `json:"type"`
		TeamID int    `json:"teamId"`
		Team   struct {
			ID int `json:"id"`
		} `json:"team"`
	} `json:"categories"`
}

// espnContentFeed mirrors the parts of ESPN's content API response we consume.
type espnContentFeed struct {
	Headlines []struct {
		Headline string `json:"headline"`
		Byline   string `json:"byline"`
		Story    string `json:"story"`
		Images   []struct {
			URL string `json:"url"`
		} `json:"images"`
	} `json:"headlines"`
}
