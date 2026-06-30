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
	ImageURL    string
	Published   time.Time
	// TeamIDs are the ESPN team ids this article is tagged with (from its
	// categories); used to filter a team feed down to genuinely team news.
	TeamIDs []int
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
	} `json:"links"`
	Categories []struct {
		Type   string `json:"type"`
		TeamID int    `json:"teamId"`
		Team   struct {
			ID int `json:"id"`
		} `json:"team"`
	} `json:"categories"`
}
