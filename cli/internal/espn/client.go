package espn

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

const BaseURL = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb"

// contentBase builds the content API URL for a story id, used as a fallback
// when an article's links.api.self.href is missing.
const contentBase = "https://content.core.api.espn.com/v1/sports/news/"

// maxTeamsPerArticle drops league-wide roundups: ESPN tags those with many/all
// teams, while a genuine team article references only its team (+ opponent).
const maxTeamsPerArticle = 6

type Client struct {
	base string
	http *http.Client
}

func NewClient(base string) *Client {
	return &Client{base: base, http: &http.Client{Timeout: 15 * time.Second}}
}

func DefaultClient() *Client { return NewClient(BaseURL) }

// News returns league news, or team-specific news when espnTeamID is non-empty.
// For a team feed it over-fetches and then keeps only articles that actually
// reference that team (ESPN's team feed mixes in league-wide stories).
func (c *Client) News(espnTeamID string, limit int) ([]Article, error) {
	if limit <= 0 {
		limit = 30
	}
	fetchLimit := limit
	if espnTeamID != "" {
		fetchLimit = 50 // over-fetch so enough survive the team filter
	}
	url := fmt.Sprintf("%s/news?limit=%d", c.base, fetchLimit)
	if espnTeamID != "" {
		url += "&team=" + espnTeamID
	}
	resp, err := c.http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("GET %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GET %s: status %d", url, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	arts, err := parseArticles(body)
	if err != nil {
		return nil, err
	}
	if espnTeamID != "" {
		if tid, convErr := strconv.Atoi(espnTeamID); convErr == nil {
			arts = filterByTeam(arts, tid)
		}
	}
	if len(arts) > limit {
		arts = arts[:limit]
	}
	return arts, nil
}

// ArticleContent fetches the full body of a story from ESPN's content API
// (the URL captured in Article.APIURL). The body is HTML; callers render it.
func (c *Client) ArticleContent(apiURL string) (ArticleContent, error) {
	if apiURL == "" {
		return ArticleContent{}, fmt.Errorf("article has no content URL")
	}
	resp, err := c.http.Get(apiURL)
	if err != nil {
		return ArticleContent{}, fmt.Errorf("GET %s: %w", apiURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ArticleContent{}, fmt.Errorf("GET %s: status %d", apiURL, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ArticleContent{}, err
	}
	var feed espnContentFeed
	if err := json.Unmarshal(body, &feed); err != nil {
		return ArticleContent{}, err
	}
	if len(feed.Headlines) == 0 {
		return ArticleContent{}, fmt.Errorf("no story content")
	}
	h := feed.Headlines[0]
	content := ArticleContent{
		Headline:  h.Headline,
		Byline:    h.Byline,
		StoryHTML: h.Story,
	}
	for _, img := range h.Images {
		if img.URL != "" {
			content.Images = append(content.Images, img.URL)
		}
	}
	seen := map[string]bool{}
	for _, rel := range h.Related {
		id := rel.ID.String()
		if rel.Headline == "" || id == "" || seen[id] {
			continue
		}
		seen[id] = true
		art := Article{
			ID:       id,
			Headline: rel.Headline,
			Type:     rel.Type,
			WebURL:   rel.Links.Web.Href,
			APIURL:   rel.Links.API.Self.Href,
		}
		if art.Type == "" {
			art.Type = "Story"
		}
		if art.APIURL == "" {
			art.APIURL = contentBase + id
		}
		if len(rel.Images) > 0 {
			art.ImageURL = rel.Images[0].URL
		}
		content.Related = append(content.Related, art)
	}
	return content, nil
}

// filterByTeam keeps articles that reference teamID and are not league-wide
// roundups (which ESPN tags with many teams).
func filterByTeam(arts []Article, teamID int) []Article {
	out := make([]Article, 0, len(arts))
	for _, a := range arts {
		if len(a.TeamIDs) > maxTeamsPerArticle {
			continue
		}
		for _, id := range a.TeamIDs {
			if id == teamID {
				out = append(out, a)
				break
			}
		}
	}
	return out
}

func parseArticles(raw []byte) ([]Article, error) {
	var feed espnFeed
	if err := json.Unmarshal(raw, &feed); err != nil {
		return nil, err
	}
	out := make([]Article, 0, len(feed.Articles))
	for _, a := range feed.Articles {
		art := Article{
			ID:          a.ID.String(),
			Headline:    a.Headline,
			Description: a.Description,
			Type:        a.Type,
			WebURL:      a.Links.Web.Href,
			APIURL:      a.Links.API.Self.Href,
		}
		if art.Type == "" {
			art.Type = "Story"
		}
		if art.APIURL == "" && art.ID != "" {
			art.APIURL = contentBase + art.ID
		}
		if len(a.Images) > 0 {
			art.ImageURL = a.Images[0].URL
		}
		if t, err := time.Parse(time.RFC3339, a.Published); err == nil {
			art.Published = t
		}
		seen := map[int]bool{}
		for _, cat := range a.Categories {
			if cat.Type != "team" {
				continue
			}
			id := cat.TeamID
			if id == 0 {
				id = cat.Team.ID
			}
			if id != 0 && !seen[id] {
				seen[id] = true
				art.TeamIDs = append(art.TeamIDs, id)
			}
		}
		out = append(out, art)
	}
	return out, nil
}
