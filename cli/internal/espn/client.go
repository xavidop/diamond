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
		}
		if art.Type == "" {
			art.Type = "Story"
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
