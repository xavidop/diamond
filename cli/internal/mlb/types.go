package mlb

// Sport represents a baseball league/level (MLB, AAA, KBO, etc.)
type Sport struct {
	ID           int    `json:"id"`
	Code         string `json:"code"`
	Name         string `json:"name"`
	Abbreviation string `json:"abbreviation"`
}

// AllSports is the hardcoded catalog mirroring the web app's sports.ts.
var AllSports = []Sport{
	{ID: 1, Code: "mlb", Name: "Major League Baseball", Abbreviation: "MLB"},
	{ID: 11, Code: "aaa", Name: "Triple-A", Abbreviation: "AAA"},
	{ID: 12, Code: "aax", Name: "Double-A", Abbreviation: "AA"},
	{ID: 13, Code: "afa", Name: "High-A", Abbreviation: "High-A"},
	{ID: 14, Code: "afx", Name: "Single-A", Abbreviation: "Single-A"},
	{ID: 16, Code: "rok", Name: "Rookie", Abbreviation: "ROK"},
	{ID: 17, Code: "win", Name: "Winter Leagues", Abbreviation: "WIN"},
	{ID: 6004, Code: "kbo", Name: "Korean Baseball Organization", Abbreviation: "KBO"},
	{ID: 6005, Code: "jpb", Name: "Nippon Professional Baseball", Abbreviation: "NPB"},
	{ID: 22, Code: "bbc", Name: "College Baseball", Abbreviation: "COL"},
}

type Team struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Abbreviation string `json:"abbreviation"`
	TeamName     string `json:"teamName"`
	LocationName string `json:"locationName"`
	League       struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"league"`
	Division struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"division"`
}

type TeamGameInfo struct {
	Team struct {
		ID           int    `json:"id"`
		Name         string `json:"name"`
		Abbreviation string `json:"abbreviation"`
		League       struct {
			Name string `json:"name"`
		} `json:"league"`
	} `json:"team"`
	Score        int  `json:"score"`
	IsWinner     bool `json:"isWinner"`
	LeagueRecord struct {
		Wins   int `json:"wins"`
		Losses int `json:"losses"`
	} `json:"leagueRecord"`
	ProbablePitcher *struct {
		FullName string `json:"fullName"`
	} `json:"probablePitcher,omitempty"`
}

type InningHalf struct {
	Runs   *int `json:"runs"`
	Hits   *int `json:"hits"`
	Errors *int `json:"errors"`
}

type Inning struct {
	Num  int        `json:"num"`
	Home InningHalf `json:"home"`
	Away InningHalf `json:"away"`
}

type Game struct {
	GamePk int `json:"gamePk"`
	Status struct {
		AbstractGameState string `json:"abstractGameState"`
		DetailedState     string `json:"detailedState"`
		StatusCode        string `json:"statusCode"`
	} `json:"status"`
	Teams struct {
		Away TeamGameInfo `json:"away"`
		Home TeamGameInfo `json:"home"`
	} `json:"teams"`
	Linescore struct {
		CurrentInning        int      `json:"currentInning"`
		CurrentInningOrdinal string   `json:"currentInningOrdinal"`
		InningState          string   `json:"inningState"`
		Innings              []Inning `json:"innings"`
		Balls                int      `json:"balls"`
		Strikes              int      `json:"strikes"`
		Outs                 int      `json:"outs"`
	} `json:"linescore"`
	GameDate string `json:"gameDate"`
	Venue    struct {
		Name string `json:"name"`
	} `json:"venue"`
}

type Standing struct {
	Team struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"team"`
	Wins                      int    `json:"wins"`
	Losses                    int    `json:"losses"`
	WinningPercentage         string `json:"winningPercentage"`
	GamesBack                 string `json:"gamesBack"`
	StreakCode                string `json:"streakCode"`
	WildCardGamesBack         string `json:"wildCardGamesBack"`
	WildCardRank              string `json:"wildCardRank"`
	WildCardEliminationNumber string `json:"wildCardEliminationNumber"`
	WildCardLeader            bool   `json:"wildCardLeader"`
	RunsScored                int    `json:"runsScored"`
	RunsAllowed               int    `json:"runsAllowed"`
	Records                   struct {
		OverallRecords []struct {
			Wins   int    `json:"wins"`
			Losses int    `json:"losses"`
			Type   string `json:"type"`
		} `json:"overallRecords"`
	} `json:"records"`
}

type StandingsRecord struct {
	Division struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"division"`
	League struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"league"`
	TeamRecords []Standing `json:"teamRecords"`
}

type Leader struct {
	Rank   int    `json:"rank"`
	Value  string `json:"value"`
	Person struct {
		ID       int    `json:"id"`
		FullName string `json:"fullName"`
	} `json:"person"`
	Team struct {
		Name         string `json:"name"`
		Abbreviation string `json:"abbreviation"`
	} `json:"team"`
}

type Player struct {
	ID              int    `json:"id"`
	FullName        string `json:"fullName"`
	PrimaryNumber   string `json:"primaryNumber"`
	BirthDate       string `json:"birthDate"`
	BirthCity       string `json:"birthCity"`
	BirthCountry    string `json:"birthCountry"`
	Height          string `json:"height"`
	Weight          int    `json:"weight"`
	PrimaryPosition struct {
		Code         string `json:"code"`
		Name         string `json:"name"`
		Abbreviation string `json:"abbreviation"`
	} `json:"primaryPosition"`
	CurrentTeam struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"currentTeam"`
	BatSide struct {
		Code string `json:"code"`
	} `json:"batSide"`
	PitchHand struct {
		Code string `json:"code"`
	} `json:"pitchHand"`
	Stats []StatGroup `json:"stats"`
}

type StatGroup struct {
	Type struct {
		DisplayName string `json:"displayName"`
	} `json:"type"`
	Group struct {
		DisplayName string `json:"displayName"`
	} `json:"group"`
	Splits []StatSplit `json:"splits"`
}

type StatSplit struct {
	Season string `json:"season"`
	Date   string `json:"date"`
	IsHome bool   `json:"isHome"`
	Game   struct {
		GamePk int `json:"gamePk"`
	} `json:"game"`
	Team struct {
		Name string `json:"name"`
	} `json:"team"`
	Opponent struct {
		Name string `json:"name"`
	} `json:"opponent"`
	Stat map[string]interface{} `json:"stat"`
}

type BoxscoreBatter struct {
	Person struct {
		ID       int    `json:"id"`
		FullName string `json:"fullName"`
	} `json:"person"`
	Position struct {
		Abbreviation string `json:"abbreviation"`
	} `json:"position"`
	Stats struct {
		Batting struct {
			AtBats      int    `json:"atBats"`
			Runs        int    `json:"runs"`
			Hits        int    `json:"hits"`
			Rbi         int    `json:"rbi"`
			BaseOnBalls int    `json:"baseOnBalls"`
			StrikeOuts  int    `json:"strikeOuts"`
			Avg         string `json:"avg"`
		} `json:"batting"`
		Pitching struct {
			InningsPitched  string `json:"inningsPitched"`
			Hits            int    `json:"hits"`
			Runs            int    `json:"runs"`
			EarnedRuns      int    `json:"earnedRuns"`
			BaseOnBalls     int    `json:"baseOnBalls"`
			StrikeOuts      int    `json:"strikeOuts"`
			Era             string `json:"era"`
			NumberOfPitches int    `json:"numberOfPitches"`
		} `json:"pitching"`
	} `json:"stats"`
	BattingOrder string `json:"battingOrder"`
}

type BoxscorePitcher struct {
	Person struct {
		ID       int    `json:"id"`
		FullName string `json:"fullName"`
	} `json:"person"`
	Stats struct {
		Pitching struct {
			InningsPitched  string `json:"inningsPitched"`
			Hits            int    `json:"hits"`
			Runs            int    `json:"runs"`
			EarnedRuns      int    `json:"earnedRuns"`
			BaseOnBalls     int    `json:"baseOnBalls"`
			StrikeOuts      int    `json:"strikeOuts"`
			Era             string `json:"era"`
			NumberOfPitches int    `json:"numberOfPitches"`
		} `json:"pitching"`
	} `json:"stats"`
}

type BoxscoreTeam struct {
	Players  map[string]BoxscoreBatter `json:"players"`
	Pitchers []int                     `json:"pitchers"`
	Batters  []int                     `json:"batters"`
	Team     struct {
		Name string `json:"name"`
	} `json:"team"`
	TeamStats struct {
		Batting struct {
			Runs   int `json:"runs"`
			Hits   int `json:"hits"`
			Errors int `json:"errors"`
		} `json:"batting"`
	} `json:"teamStats"`
}

type PlayResult struct {
	Description string `json:"description"`
	Event       string `json:"event"`
	Rbi         int    `json:"rbi"`
}

// HitData holds batted-ball coordinates and trajectory for one contact event.
type HitData struct {
	Coordinates struct {
		CoordX float64 `json:"coordX"`
		CoordY float64 `json:"coordY"`
	} `json:"coordinates"`
	Trajectory  string  `json:"trajectory"`
	LaunchSpeed float64 `json:"launchSpeed"`
}

// PitchData holds the strike-zone coordinates and speed for one pitch.
type PitchData struct {
	Coordinates struct {
		PX float64 `json:"pX"`
		PZ float64 `json:"pZ"`
	} `json:"coordinates"`
	StartSpeed float64 `json:"startSpeed"`
	Breaks     struct {
		SpinRate float64 `json:"spinRate"`
	} `json:"breaks"`
}

// PlayEventDetail is a single event within a play — a pitch or a ball in play.
// HitData/PitchData live here (on playEvents), NOT on the parent play.
type PlayEventDetail struct {
	Details struct {
		Type struct {
			Description string `json:"description"`
		} `json:"type"`
		Description string `json:"description"`
		Call        struct {
			Description string `json:"description"`
		} `json:"call"`
		Code string `json:"code"`
	} `json:"details"`
	HitData   *HitData   `json:"hitData,omitempty"`
	PitchData *PitchData `json:"pitchData,omitempty"`
	IsPitch   bool       `json:"isPitch"`
}

type PlayEvent struct {
	Result PlayResult `json:"result"`
	About  struct {
		Inning     int    `json:"inning"`
		HalfInning string `json:"halfInning"`
		IsComplete bool   `json:"isComplete"`
	} `json:"about"`
	Matchup struct {
		Batter struct {
			ID int `json:"id"`
		} `json:"batter"`
		Pitcher struct {
			ID int `json:"id"`
		} `json:"pitcher"`
	} `json:"matchup"`
	PlayEvents []PlayEventDetail `json:"playEvents"`
}

type LiveFeed struct {
	GameData struct {
		Status struct {
			AbstractGameState string `json:"abstractGameState"`
		} `json:"status"`
		Teams struct {
			Away Team `json:"away"`
			Home Team `json:"home"`
		} `json:"teams"`
		Venue struct {
			Name string `json:"name"`
		} `json:"venue"`
		Weather struct {
			Condition string `json:"condition"`
			Temp      string `json:"temp"`
			Wind      string `json:"wind"`
		} `json:"weather"`
		GameInfo struct {
			Attendance          int    `json:"attendance"`
			FirstPitch          string `json:"firstPitch"`
			GameDurationMinutes int    `json:"gameDurationMinutes"`
		} `json:"gameInfo"`
	} `json:"gameData"`
	LiveData struct {
		Linescore struct {
			CurrentInning        int      `json:"currentInning"`
			CurrentInningOrdinal string   `json:"currentInningOrdinal"`
			InningState          string   `json:"inningState"`
			Innings              []Inning `json:"innings"`
			Balls                int      `json:"balls"`
			Strikes              int      `json:"strikes"`
			Outs                 int      `json:"outs"`
		} `json:"linescore"`
		Boxscore struct {
			Info []struct {
				Label string `json:"label"`
				Value string `json:"value"`
			} `json:"info"`
			Officials []struct {
				OfficialType string `json:"officialType"`
				Official     struct {
					FullName string `json:"fullName"`
				} `json:"official"`
			} `json:"officials"`
			Teams struct {
				Away BoxscoreTeam `json:"away"`
				Home BoxscoreTeam `json:"home"`
			} `json:"teams"`
		} `json:"boxscore"`
		Plays struct {
			AllPlays []PlayEvent `json:"allPlays"`
		} `json:"plays"`
	} `json:"liveData"`
}

type WinProbability struct {
	AtBatIndex             int     `json:"atBatIndex"`
	HomeTeamWinProbability float64 `json:"homeTeamWinProbability"`
	AwayTeamWinProbability float64 `json:"awayTeamWinProbability"`
}

type SearchResult struct {
	ID              int    `json:"id"`
	FullName        string `json:"fullName"`
	PrimaryPosition struct {
		Code         string `json:"code"`
		Abbreviation string `json:"abbreviation"`
		Type         string `json:"type"`
	} `json:"primaryPosition"`
}

type RosterPlayer struct {
	Person struct {
		ID       int    `json:"id"`
		FullName string `json:"fullName"`
	} `json:"person"`
	Position struct {
		Abbreviation string `json:"abbreviation"`
		Name         string `json:"name"`
	} `json:"position"`
	JerseyNumber string `json:"jerseyNumber"`
	Status       struct {
		Description string `json:"description"`
	} `json:"status"`
}

type AwardWinner struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Date   string `json:"date"`
	Season string `json:"season"`
	Team   struct {
		ID int `json:"id"`
	} `json:"team"`
	Player struct {
		ID              int    `json:"id"`
		NameFirstLast   string `json:"nameFirstLast"`
		PrimaryPosition struct {
			Abbreviation string `json:"abbreviation"`
			Name         string `json:"name"`
		} `json:"primaryPosition"`
	} `json:"player"`
}

type PostseasonTeamInfo struct {
	Team struct {
		ID           int    `json:"id"`
		Name         string `json:"name"`
		Abbreviation string `json:"abbreviation"`
	} `json:"team"`
	Score        int  `json:"score"`
	IsWinner     bool `json:"isWinner"`
	LeagueRecord struct {
		Wins   int `json:"wins"`
		Losses int `json:"losses"`
	} `json:"leagueRecord"`
}

type PostseasonGame struct {
	GamePk            int    `json:"gamePk"`
	GameType          string `json:"gameType"`
	SeriesDescription string `json:"seriesDescription"`
	GameDate          string `json:"gameDate"`
	Status            struct {
		AbstractGameState string `json:"abstractGameState"`
		DetailedState     string `json:"detailedState"`
	} `json:"status"`
	Teams struct {
		Away PostseasonTeamInfo `json:"away"`
		Home PostseasonTeamInfo `json:"home"`
	} `json:"teams"`
}

// StreakSplit is one player row from the byDateRange stats endpoint (Streaks).
type StreakSplit struct {
	Player struct {
		ID       int    `json:"id"`
		FullName string `json:"fullName"`
	} `json:"player"`
	Team struct {
		ID           int    `json:"id"`
		Name         string `json:"name"`
		Abbreviation string `json:"abbreviation"`
	} `json:"team"`
	Stat map[string]interface{} `json:"stat"`
}

// SplitLine is one situational split (vs LHP, home/away, day/night, …).
type SplitLine struct {
	Split struct {
		Code        string `json:"code"`
		Description string `json:"description"`
	} `json:"split"`
	Stat map[string]interface{} `json:"stat"`
}

// Transaction is one roster move from the transactions feed.
type Transaction struct {
	ID          int    `json:"id"`
	Date        string `json:"date"`
	TypeCode    string `json:"typeCode"`
	TypeDesc    string `json:"typeDesc"`
	Description string `json:"description"`
	Person      struct {
		ID       int    `json:"id"`
		FullName string `json:"fullName"`
	} `json:"person"`
	FromTeam struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"fromTeam"`
	ToTeam struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"toTeam"`
}

// DraftPick is one selection within a draft round.
type DraftPick struct {
	PickNumber int    `json:"pickNumber"`
	PickRound  string `json:"pickRound"`
	Person     struct {
		ID              int    `json:"id"`
		FullName        string `json:"fullName"`
		PrimaryPosition struct {
			Abbreviation string `json:"abbreviation"`
		} `json:"primaryPosition"`
		BatSide struct {
			Code string `json:"code"`
		} `json:"batSide"`
		PitchHand struct {
			Code string `json:"code"`
		} `json:"pitchHand"`
	} `json:"person"`
	Team struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"team"`
	School struct {
		Name string `json:"name"`
	} `json:"school"`
}

type DraftRound struct {
	Round string      `json:"round"`
	Picks []DraftPick `json:"picks"`
}

// Venue is a ballpark (list + detail share this shape).
type Venue struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Active   *bool  `json:"active"`
	Location struct {
		City               string `json:"city"`
		State              string `json:"state"`
		StateAbbrev        string `json:"stateAbbrev"`
		Country            string `json:"country"`
		DefaultCoordinates struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"defaultCoordinates"`
	} `json:"location"`
	FieldInfo struct {
		Capacity    int    `json:"capacity"`
		TurfType    string `json:"turfType"`
		RoofType    string `json:"roofType"`
		LeftLine    int    `json:"leftLine"`
		LeftCenter  int    `json:"leftCenter"`
		Center      int    `json:"center"`
		RightCenter int    `json:"rightCenter"`
		RightLine   int    `json:"rightLine"`
	} `json:"fieldInfo"`
	TimeZone struct {
		ID string `json:"id"`
	} `json:"timeZone"`
}
