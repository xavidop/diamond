package mlb

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

func (c *Client) Schedule(date string, sportID int) ([]Game, error) {
	url := fmt.Sprintf("%s/schedule?sportId=%d&date=%s&hydrate=team,linescore,probablePitcher", c.v1, sportID, date)
	var resp struct {
		Dates []struct {
			Games []Game `json:"games"`
		} `json:"dates"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	if len(resp.Dates) == 0 {
		return nil, nil
	}
	return resp.Dates[0].Games, nil
}

// spilloverWindow bounds how far back a finished adjacent-day game can have
// started and still count as part of "today". MLB's game day spans US evening
// into the early morning; a single slate's games all start within ~12h, so 12h
// keeps the current/just-past slate without dragging in a full stale slate.
const spilloverWindow = 12 * time.Hour

// MergeRecentSpillover returns primary plus any game from adjacent that is part
// of the same rolling game window and not already present: still Live, or
// started within spilloverWindow of now. The MLB schedule files a game under
// the US date it's played, so for a user east of the US (e.g. Spain) a game
// that started before their local midnight lands under the previous local date.
// Keying off the game's absolute start time (gameDate, UTC) rather than the
// local calendar date keeps those games — live OR just-finished — visible on
// "today" regardless of the viewer's timezone, instead of vanishing at local
// midnight in favor of the next slate.
func MergeRecentSpillover(primary, adjacent []Game, now time.Time) []Game {
	seen := make(map[int]bool, len(primary))
	for _, g := range primary {
		seen[g.GamePk] = true
	}
	out := append([]Game{}, primary...)
	cutoff := now.Add(-spilloverWindow)
	for _, g := range adjacent {
		if seen[g.GamePk] {
			continue
		}
		keep := g.Status.AbstractGameState == "Live"
		if !keep {
			// A non-live adjacent game counts only if it actually started
			// within the window (covers games that just went Final).
			if start, err := time.Parse(time.RFC3339, g.GameDate); err == nil {
				keep = !start.Before(cutoff) && !start.After(now)
			}
		}
		if keep {
			out = append(out, g)
			seen[g.GamePk] = true
		}
	}
	return out
}

// leagueIDs discovers the league IDs for a sport (used to build standings
// queries for non-MLB levels, which have their own leagues).
func (c *Client) leagueIDs(sportID int) (string, error) {
	endpoint := fmt.Sprintf("%s/leagues?sportId=%d", c.v1, sportID)
	var resp struct {
		Leagues []struct {
			ID int `json:"id"`
		} `json:"leagues"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return "", err
	}
	ids := make([]string, 0, len(resp.Leagues))
	for _, l := range resp.Leagues {
		ids = append(ids, strconv.Itoa(l.ID))
	}
	return strings.Join(ids, ","), nil
}

func (c *Client) Standings(sportID int, season string) ([]StandingsRecord, error) {
	// MLB standings are the AL (103) + NL (104); other levels discover their
	// own leagues so the selected sport's standings load.
	leagueID := "103,104"
	if sportID != 1 {
		ids, err := c.leagueIDs(sportID)
		if err != nil {
			return nil, err
		}
		if ids == "" {
			return nil, nil
		}
		leagueID = ids
	}
	url := fmt.Sprintf("%s/standings?leagueId=%s&season=%s&hydrate=team,division", c.v1, leagueID, season)
	var resp struct {
		Records []StandingsRecord `json:"records"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	return resp.Records, nil
}

func (c *Client) Leaders(group, category string, sportID int, season string) ([]Leader, error) {
	url := fmt.Sprintf("%s/stats/leaders?leaderCategories=%s&sportId=%d&season=%s&leaderGameTypes=R&limit=20&hydrate=person,team", c.v1, category, sportID, season)
	_ = group
	var resp struct {
		LeagueLeaders []struct {
			Leaders []Leader `json:"leaders"`
		} `json:"leagueLeaders"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	if len(resp.LeagueLeaders) == 0 {
		return nil, nil
	}
	return resp.LeagueLeaders[0].Leaders, nil
}

func (c *Client) Teams(sportID int) ([]Team, error) {
	url := fmt.Sprintf("%s/teams?sportId=%d", c.v1, sportID)
	var resp struct {
		Teams []Team `json:"teams"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	return resp.Teams, nil
}

// TeamAffiliates returns a club's minor-league affiliates, filtered to real
// playing levels (AAA→Rookie) and sorted by level.
func (c *Client) TeamAffiliates(teamID int, season string) ([]Team, error) {
	url := fmt.Sprintf("%s/teams/%d/affiliates?season=%s", c.v1, teamID, season)
	var resp struct {
		Teams []Team `json:"teams"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	return FilterAffiliates(resp.Teams), nil
}

func (c *Client) TeamRoster(teamID int) ([]RosterPlayer, error) {
	url := fmt.Sprintf("%s/teams/%d/roster/active", c.v1, teamID)
	var resp struct {
		Roster []RosterPlayer `json:"roster"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	return resp.Roster, nil
}

func (c *Client) Person(personID int, season string) (*Player, error) {
	url := fmt.Sprintf("%s/people/%d?hydrate=awards,education,stats(group=[hitting,pitching],type=[yearByYear,career,season],season=%s)&season=%s", c.v1, personID, season, season)
	var resp struct {
		People []Player `json:"people"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	if len(resp.People) == 0 {
		return nil, fmt.Errorf("player %d not found", personID)
	}
	return &resp.People[0], nil
}

func (c *Client) PersonGameLog(personID int, group, season string) ([]StatSplit, error) {
	url := fmt.Sprintf("%s/people/%d/stats?stats=gameLog&group=%s&season=%s", c.v1, personID, group, season)
	var resp struct {
		Stats []StatGroup `json:"stats"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	if len(resp.Stats) == 0 || len(resp.Stats[0].Splits) == 0 {
		return nil, nil
	}
	return resp.Stats[0].Splits, nil
}

func (c *Client) LiveFeed(gamePk int) (*LiveFeed, error) {
	url := fmt.Sprintf("%s/game/%d/feed/live", c.v11, gamePk)
	var feed LiveFeed
	if err := c.get(url, &feed); err != nil {
		return nil, err
	}
	return &feed, nil
}

func (c *Client) WinProbability(gamePk int) ([]WinProbability, error) {
	url := fmt.Sprintf("%s/game/%d/winProbability", c.v1, gamePk)
	var probs []WinProbability
	if err := c.get(url, &probs); err != nil {
		return nil, err
	}
	return probs, nil
}

func (c *Client) TeamStats(teamID int, group, season string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/teams/%d/stats?stats=season&group=%s&season=%s", c.v1, teamID, group, season)
	var resp struct {
		Stats []StatGroup `json:"stats"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	if len(resp.Stats) == 0 || len(resp.Stats[0].Splits) == 0 {
		return nil, nil
	}
	return resp.Stats[0].Splits[0].Stat, nil
}

func (c *Client) AwardRecipients(awardID, season string) ([]AwardWinner, error) {
	url := fmt.Sprintf("%s/awards/%s/recipients?season=%s", c.v1, awardID, season)
	var resp struct {
		Awards []AwardWinner `json:"awards"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	return resp.Awards, nil
}

func (c *Client) PostseasonSchedule(season string) ([]PostseasonGame, error) {
	url := fmt.Sprintf("%s/schedule?sportId=1&gameType=F,D,L,W,C&season=%s&hydrate=team", c.v1, season)
	var resp struct {
		Dates []struct {
			Games []PostseasonGame `json:"games"`
		} `json:"dates"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	var games []PostseasonGame
	for _, d := range resp.Dates {
		games = append(games, d.Games...)
	}
	return games, nil
}

func (c *Client) WildCardStandings(sportID int, season string) ([]StandingsRecord, error) {
	// Wild card is an MLB construct; other levels have no wild-card standings.
	if sportID != 1 {
		return nil, nil
	}
	url := fmt.Sprintf("%s/standings?leagueId=103,104&season=%s&standingsTypes=wildCard&hydrate=team,division", c.v1, season)
	var resp struct {
		Records []StandingsRecord `json:"records"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	return resp.Records, nil
}

// StatsByDateRange powers Streaks: hot/cold leaders over a date window.
func (c *Client) StatsByDateRange(group, startDate, endDate, sortStat, order string, sportID int) ([]StreakSplit, error) {
	endpoint := fmt.Sprintf("%s/stats?stats=byDateRange&sportIds=%d&group=%s&startDate=%s&endDate=%s&sortStat=%s&order=%s&playerPool=All&limit=25",
		c.v1, sportID, group, startDate, endDate, sortStat, order)
	var resp struct {
		Stats []struct {
			Splits []StreakSplit `json:"splits"`
		} `json:"stats"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	if len(resp.Stats) == 0 {
		return nil, nil
	}
	return resp.Stats[0].Splits, nil
}

// PersonSplits returns situational splits (vs LHP/RHP, home/away, day/night, …).
func (c *Client) PersonSplits(personID int, group, season string) ([]SplitLine, error) {
	endpoint := fmt.Sprintf("%s/people/%d/stats?stats=statSplits&group=%s&season=%s&sitCodes=vl,vr,h,a,d,n,g,t,risp,loaded",
		c.v1, personID, group, season)
	var resp struct {
		Stats []struct {
			Splits []SplitLine `json:"splits"`
		} `json:"stats"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	if len(resp.Stats) == 0 {
		return nil, nil
	}
	return resp.Stats[0].Splits, nil
}

// Transactions returns the roster-move feed for a date range.
func (c *Client) Transactions(startDate, endDate string) ([]Transaction, error) {
	endpoint := fmt.Sprintf("%s/transactions?sportId=1&startDate=%s&endDate=%s", c.v1, startDate, endDate)
	var resp struct {
		Transactions []Transaction `json:"transactions"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	return resp.Transactions, nil
}

// TeamTransactions returns the roster-move feed for one team over a date range.
func (c *Client) TeamTransactions(teamID int, startDate, endDate string) ([]Transaction, error) {
	endpoint := fmt.Sprintf("%s/transactions?teamId=%d&startDate=%s&endDate=%s", c.v1, teamID, startDate, endDate)
	var resp struct {
		Transactions []Transaction `json:"transactions"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	return resp.Transactions, nil
}

// Draft returns all rounds + picks for a draft year.
func (c *Client) Draft(year string) ([]DraftRound, error) {
	endpoint := fmt.Sprintf("%s/draft/%s", c.v1, year)
	var resp struct {
		Drafts struct {
			Rounds []DraftRound `json:"rounds"`
		} `json:"drafts"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	return resp.Drafts.Rounds, nil
}

// Venues returns all ballparks (hydrated with location + field info).
func (c *Client) Venues() ([]Venue, error) {
	endpoint := fmt.Sprintf("%s/venues?sportIds=1&hydrate=location,fieldInfo", c.v1)
	var resp struct {
		Venues []Venue `json:"venues"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	return resp.Venues, nil
}

// Venue returns a single ballpark with full detail.
func (c *Client) Venue(venueID int) (*Venue, error) {
	endpoint := fmt.Sprintf("%s/venues/%d?hydrate=location,fieldInfo,timezone", c.v1, venueID)
	var resp struct {
		Venues []Venue `json:"venues"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	if len(resp.Venues) == 0 {
		return nil, fmt.Errorf("venue %d not found", venueID)
	}
	return &resp.Venues[0], nil
}

// Content fetches highlight clips + the written recap for a game.
func (c *Client) Content(gamePk int) (*GameContent, error) {
	url := fmt.Sprintf("%s/game/%d/content", c.v1, gamePk)
	var resp struct {
		Highlights struct {
			Highlights struct {
				Items []Highlight `json:"items"`
			} `json:"highlights"`
		} `json:"highlights"`
		Editorial struct {
			Recap struct {
				MLB *Recap `json:"mlb"`
			} `json:"recap"`
		} `json:"editorial"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	return &GameContent{
		Highlights: resp.Highlights.Highlights.Items,
		Recap:      resp.Editorial.Recap.MLB,
	}, nil
}

// PlayerExpectedStats fetches Statcast expected statistics for a player/season.
func (c *Client) PlayerExpectedStats(personID int, group, season string) (*ExpectedStats, error) {
	url := fmt.Sprintf("%s/people/%d/stats?stats=expectedStatistics&group=%s&season=%s", c.v1, personID, group, season)
	var resp struct {
		Stats []struct {
			Splits []struct {
				Stat struct {
					Avg     string `json:"avg"`
					Slg     string `json:"slg"`
					Woba    string `json:"woba"`
					WobaCon string `json:"wobaCon"`
				} `json:"stat"`
			} `json:"splits"`
		} `json:"stats"`
	}
	if err := c.get(url, &resp); err != nil {
		return nil, err
	}
	if len(resp.Stats) == 0 || len(resp.Stats[0].Splits) == 0 {
		return nil, fmt.Errorf("no expected stats for player %d", personID)
	}
	s := resp.Stats[0].Splits[0].Stat
	return &ExpectedStats{XBA: s.Avg, XSLG: s.Slg, XwOBA: s.Woba, XwOBACON: s.WobaCon}, nil
}

// PlayerRecentPlays fetches the player's last nGames games (by game log) and
// returns the plays involving the player, filtered by role ("hitting" → as
// batter, "pitching" → as pitcher). Game feeds are fetched concurrently
// through a bounded pool (max 6); a failed feed is skipped (counted in
// RecentMeta.Failures), and only an empty result with zero successes errors.
func (c *Client) PlayerRecentPlays(personID int, role string, nGames int) ([]PlayEvent, RecentMeta, error) {
	season := fmt.Sprintf("%d", time.Now().Year())
	log, err := c.PersonGameLog(personID, role, season)
	if err != nil {
		return nil, RecentMeta{}, err
	}
	pks := recentGamePks(log, nGames)
	meta := RecentMeta{GamesRequested: len(pks)}
	if len(pks) == 0 {
		return nil, meta, nil
	}

	type result struct {
		plays []PlayEvent
		err   error
	}
	results := make([]result, len(pks))
	sem := make(chan struct{}, 6)
	var wg sync.WaitGroup
	for i, pk := range pks {
		wg.Add(1)
		go func(i, pk int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			feed, err := c.LiveFeed(pk)
			if err != nil {
				results[i] = result{err: err}
				return
			}
			results[i] = result{plays: feed.LiveData.Plays.AllPlays}
		}(i, pk)
	}
	wg.Wait()

	var all []PlayEvent
	for _, r := range results {
		if r.err != nil {
			meta.Failures++
			continue
		}
		meta.GamesFetched++
		all = append(all, r.plays...)
	}
	if meta.GamesFetched == 0 {
		return nil, meta, fmt.Errorf("could not fetch any of %d recent games", len(pks))
	}
	if role == "pitching" {
		all = FilterPitcherPlays(all, personID)
	} else {
		all = FilterBatterPlays(all, personID)
	}
	return all, meta, nil
}

func (c *Client) Search(query string) ([]SearchResult, error) {
	endpoint := fmt.Sprintf("%s/people/search?names=%s&active=true", c.v1, url.QueryEscape(query))
	var resp struct {
		People []SearchResult `json:"people"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	return resp.People, nil
}

// PersonVsPlayer returns a batter-vs-pitcher matchup split set for personID
// against opponentID, in the given group ("hitting" or "pitching").
func (c *Client) PersonVsPlayer(personID, opponentID int, group string) ([]StatSplit, error) {
	endpoint := fmt.Sprintf("%s/people/%d/stats?stats=vsPlayer&opposingPlayerId=%d&group=%s",
		c.v1, personID, opponentID, group)
	var resp struct {
		Stats []struct {
			Splits []StatSplit `json:"splits"`
		} `json:"stats"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	if len(resp.Stats) == 0 {
		return nil, nil
	}
	return resp.Stats[0].Splits, nil
}

// TeamSchedule returns a team's games for a season (one request).
func (c *Client) TeamSchedule(teamID int, season string) ([]Game, error) {
	endpoint := fmt.Sprintf("%s/schedule?sportId=1&teamId=%d&startDate=%s-01-01&endDate=%s-12-31&hydrate=team,decisions",
		c.v1, teamID, season, season)
	var resp struct {
		Dates []struct {
			Games []Game `json:"games"`
		} `json:"dates"`
	}
	if err := c.get(endpoint, &resp); err != nil {
		return nil, err
	}
	var games []Game
	for _, d := range resp.Dates {
		games = append(games, d.Games...)
	}
	return games, nil
}
