package ui

import (
	"fmt"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/xavidop/diamond/cli/internal/mlb"
	"github.com/xavidop/diamond/cli/internal/version"
)

// ViewID identifies which content view is active.
type ViewID int

const (
	ViewMenu ViewID = iota // sentinel: "back" → focus the sidebar (no content of its own)
	ViewHome
	ViewScores
	ViewGame
	ViewStandings
	ViewLeaders
	ViewTeam
	ViewPlayer
	ViewAwards
	ViewPostseason
	ViewStreaks
	ViewCompare
	ViewTeamCompare
	ViewTransactions
	ViewHistory
	ViewDraft
	ViewVenues
	ViewFavorites
	ViewGlossary
	ViewDiamondGPT
	ViewNews
)

// NavigateMsg switches the active content view. View==ViewMenu means "go back":
// pop the drill stack if non-empty, else focus the sidebar. A drill is a
// NavigateMsg whose View is a detail leaf carrying an id (ViewGame+GamePk or
// ViewPlayer+PlayerID).
type NavigateMsg struct {
	View     ViewID
	GamePk   int
	Query    string
	PlayerID int
}

type SportChangedMsg struct{ Sport mlb.Sport }
type ErrMsg struct{ Err error }
type TickMsg struct{}

// updateAvailableMsg is sent when a newer CLI version is found on GitHub.
type updateAvailableMsg struct{ Latest string }

func Tick(d time.Duration) tea.Cmd {
	return tea.Tick(d, func(time.Time) tea.Msg { return TickMsg{} })
}

type notifyTickMsg struct{}
type notifyScoresMsg struct{ games []mlb.Game }

// ToggleNotifyMsg toggles background score notifications for a game. It is
// emitted by the Scores view and handled by the App, which owns the
// subscription set so alerts fire regardless of the active view.
type ToggleNotifyMsg struct{ GamePk int }

func notifyTick() tea.Cmd {
	return tea.Tick(30*time.Second, func(time.Time) tea.Msg { return notifyTickMsg{} })
}

// notifyPollCmd fetches the day's games (plus yesterday's still-live ones) for
// the given sport so the App can diff scores for subscribed games.
func notifyPollCmd(sportID int) tea.Cmd {
	return func() tea.Msg {
		c := mlb.DefaultClient()
		now := time.Now()
		today, _ := c.Schedule(now.Format("2006-01-02"), sportID)
		yest, _ := c.Schedule(now.AddDate(0, 0, -1).Format("2006-01-02"), sportID)
		return notifyScoresMsg{games: mlb.MergeRecentSpillover(today, yest, now)}
	}
}

// checkForUpdate queries GitHub for the latest release in the background.
func checkForUpdate() tea.Cmd {
	return func() tea.Msg {
		latest := version.CheckLatest()
		if version.IsNewer(version.Version, latest) {
			return updateAvailableMsg{Latest: latest}
		}
		return nil
	}
}

type focusZone int

const (
	focusSidebar focusZone = iota
	focusContent
)

// SuppressUpdateCheck disables the background new-version check when set to
// true before creating the App (e.g. via --no-update-notifier flag).
var SuppressUpdateCheck bool

// sidebarMinTotal is the terminal width below which the sidebar auto-collapses.
const sidebarMinTotal = 96

// App is the root Bubble Tea model: a persistent sidebar + a content area.
type App struct {
	view          ViewID
	focus         focusZone
	collapsed     bool
	autoCollapsed bool
	sport         mlb.Sport
	width         int
	height        int
	showLeague    bool
	showHelp      bool

	navStack []ViewID // back-stack of views to return to; top is most recent

	// Background score notifications: GamePks the user opted into and their
	// last-seen scores. Polled by notifyTick so alerts fire from any view.
	notifySubs map[int]bool
	notifyPrev map[int][2]int

	// Update notification: non-empty when a newer release is available.
	updateBanner string

	sidebar      Sidebar
	leaguePicker LeaguePickerModel
	home         HomeModel
	scores       ScoresModel
	game         GameModel
	standings    StandingsModel
	leaders      LeadersModel
	team         TeamModel
	player       PlayerModel
	awards       AwardsModel
	postseason   PostseasonModel
	streaks      StreaksModel
	compare      CompareModel
	teamCompare  TeamCompareModel
	transactions TransactionsModel
	news         NewsModel
	history      HistoryModel
	draft        DraftModel
	venues       VenuesModel
	favorites    FavoritesModel
	glossary     GlossaryModel
	diamondGPT   DiamondGPTModel
}

func NewApp(startView ViewID, gamePk int, sport mlb.Sport, query ...string) App {
	q := ""
	if len(query) > 0 {
		q = query[0]
	}
	scores := NewScoresModel(sport)
	if startView == ViewScores && q != "" {
		if t, err := time.Parse("2006-01-02", q); err == nil {
			scores.date = t
		}
	}
	standings := NewStandingsModel(sport)
	if startView == ViewStandings && q != "" {
		standings.season = q
	}
	leaders := NewLeadersModel(sport)
	if startView == ViewLeaders && q != "" && (q == "hitting" || q == "pitching") {
		leaders.group = q
	}
	notifySubs := map[int]bool{}
	scores.notifySubs = notifySubs
	a := App{
		sport:        sport,
		focus:        focusSidebar,
		sidebar:      NewSidebar(),
		leaguePicker: NewLeaguePickerModel(sport),
		home:         NewHomeModel(),
		scores:       scores,
		standings:    standings,
		leaders:      leaders,
		team:         NewTeamModel(sport, q),
		player:       NewPlayerModel(sport, q),
		awards:       NewAwardsModel(),
		postseason:   NewPostseasonModel(),
		streaks:      NewStreaksModel(sport),
		compare:      NewCompareModel(sport),
		teamCompare:  NewTeamCompareModel(sport),
		transactions: NewTransactionsModel(),
		news:         NewNewsModel(sport),
		history:      NewHistoryModel(),
		draft:        NewDraftModel(),
		venues:       NewVenuesModel(),
		favorites:    NewFavoritesModel(),
		glossary:     NewGlossaryModel(),
		diamondGPT:   NewDiamondGPTModel(),

		notifySubs: notifySubs,
		notifyPrev: map[int][2]int{},
	}
	if startView == ViewMenu {
		a.view, a.focus = ViewHome, focusSidebar
	} else {
		a.view, a.focus = startView, focusContent
	}
	if startView == ViewGame {
		a.game = NewGameModel(gamePk, sport)
	}
	a.sidebar.cursor = navIndexFor(a.view)
	return a
}

func (a App) Init() tea.Cmd {
	cmds := []tea.Cmd{animTick(), a.home.Init(), notifyTick()}
	if !SuppressUpdateCheck {
		cmds = append(cmds, checkForUpdate())
	}
	if a.view != ViewHome {
		if c := a.activeInit(); c != nil {
			cmds = append(cmds, c)
		}
	}
	return tea.Batch(cmds...)
}

func (a App) contentWidth() int {
	if a.collapsed {
		return a.width
	}
	w := a.width - sidebarWidth
	if w < 24 {
		w = 24
	}
	return w
}

func (a App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case animTickMsg:
		animFrame++
		return a, animTick()

	case updateAvailableMsg:
		a.updateBanner = fmt.Sprintf("Update available: v%s → v%s  (brew upgrade diamond)", version.Version, msg.Latest)
		return a, nil

	case notifyTickMsg:
		// Keep the heartbeat alive; only hit the network when something is subscribed.
		if len(a.notifySubs) == 0 {
			return a, notifyTick()
		}
		return a, tea.Batch(notifyTick(), notifyPollCmd(a.sport.ID))

	case notifyScoresMsg:
		for _, g := range msg.games {
			if !a.notifySubs[g.GamePk] {
				continue
			}
			as, hs := g.Teams.Away.Score, g.Teams.Home.Score
			if prev, seen := a.notifyPrev[g.GamePk]; seen {
				if g.Status.AbstractGameState == "Final" && prev[0]+prev[1] < as+hs {
					NotifyFinal(g.Teams.Away.Team.Name, g.Teams.Home.Team.Name, as, hs)
				} else if as != prev[0] || hs != prev[1] {
					NotifyRun(g.Teams.Away.Team.Name, g.Teams.Home.Team.Name, as, hs)
				}
			}
			a.notifyPrev[g.GamePk] = [2]int{as, hs}
		}
		return a, nil

	case ToggleNotifyMsg:
		if a.notifySubs[msg.GamePk] {
			delete(a.notifySubs, msg.GamePk)
			return a, nil
		}
		a.notifySubs[msg.GamePk] = true
		return a, notifyPollCmd(a.sport.ID) // seed a baseline so the next change alerts

	case tea.WindowSizeMsg:
		a.width, a.height = msg.Width, msg.Height
		if a.width < sidebarMinTotal {
			if !a.collapsed {
				a.collapsed, a.autoCollapsed, a.focus = true, true, focusContent
			}
		} else if a.autoCollapsed {
			a.collapsed, a.autoCollapsed = false, false
		}
		na, c := a.applySize()
		return na, c

	case NavigateMsg:
		na, c := a.navigate(msg)
		return na, c

	case SportChangedMsg:
		a.sport = msg.Sport
		a.showLeague = false
		a.scores = NewScoresModel(a.sport)
		a.scores.notifySubs = a.notifySubs
		a.standings = NewStandingsModel(a.sport)
		a.leaders = NewLeadersModel(a.sport)
		a.team = NewTeamModel(a.sport)
		a.player = NewPlayerModel(a.sport)
		a.streaks = NewStreaksModel(a.sport)
		a.compare = NewCompareModel(a.sport)
		a.teamCompare = NewTeamCompareModel(a.sport)
		a.news = NewNewsModel(a.sport)
		a.home = NewHomeModel()
		na, szc := a.applySize()
		return na, tea.Batch(szc, na.home.Init(), na.activeInit())

	case tea.KeyMsg:
		// While a view captures free text (chat / search), only Esc is special —
		// every other key (L, ?, Ctrl+B, q, …) is typed into the field.
		tc := a.capturesText()
		if !tc {
			switch msg.String() {
			case "L":
				a.showLeague = !a.showLeague
				return a, nil
			case "?":
				a.showHelp = !a.showHelp
				return a, nil
			case "ctrl+b":
				a.collapsed = !a.collapsed
				a.autoCollapsed = false
				if a.collapsed {
					a.focus = focusContent
				} else {
					a.focus = focusSidebar
					a.sidebar.cursor = navIndexFor(a.view)
				}
				na, c := a.applySize()
				return na, c
			}
		}

		if a.showHelp {
			switch msg.String() {
			case "?", "esc", "q":
				a.showHelp = false
			}
			return a, nil
		}
		if a.showLeague {
			var cmd tea.Cmd
			a.leaguePicker, cmd = a.leaguePicker.Update(msg)
			return a, cmd
		}

		// Focus routing.
		if a.focus == focusSidebar && !a.collapsed {
			switch msg.String() {
			case "up", "k":
				if a.sidebar.cursor > 0 {
					a.sidebar.cursor--
				}
			case "down", "j":
				if a.sidebar.cursor < len(navItems)-1 {
					a.sidebar.cursor++
				}
			case "enter", " ", "right", "l":
				a.navStack = nil // picking a section is a fresh root
				na, c := a.navigate(NavigateMsg{View: navItems[a.sidebar.cursor].view})
				return na, c
			case "q":
				return a, tea.Quit
			}
			return a, nil
		}

		// Content focused (or sidebar collapsed).
		if msg.String() == "q" && !tc {
			return a, tea.Quit
		}
		na, c := a.updateActive(msg)
		return na, c
	}

	// Non-key async messages: home runs in the background (sidebar live count),
	// and the active view processes its own loads/ticks.
	na, c := a.routeMsg(msg)
	return na, c
}

// navigate switches content view, or (View==ViewMenu) returns focus to the sidebar.
func (a App) navigate(msg NavigateMsg) (App, tea.Cmd) {
	if msg.View == ViewMenu {
		// Back: pop the drill stack if we have a trail; restore the previous
		// view by reusing its still-live model (no rebuild, no re-fetch).
		if len(a.navStack) > 0 {
			prev := a.navStack[len(a.navStack)-1]
			a.navStack = a.navStack[:len(a.navStack)-1]
			a.view = prev
			a.focus = focusContent
			a.sidebar.cursor = navIndexFor(prev)
			return a.applySize() // re-feed size to all views; no Init → no refetch
		}
		// Root: existing focus-the-sidebar behavior.
		if !a.collapsed {
			a.focus = focusSidebar
			a.sidebar.cursor = navIndexFor(a.view)
			return a, nil
		}
		if a.width >= sidebarMinTotal {
			a.collapsed, a.autoCollapsed, a.focus = false, false, focusSidebar
			a.sidebar.cursor = navIndexFor(a.view)
			return a.applySize()
		}
		return a, nil
	}

	// A drill is a detail leaf carrying an id/query; push the source view to
	// return to (e.g. Standings → a team page, Esc returns to Standings).
	if (msg.View == ViewGame && msg.GamePk > 0) || (msg.View == ViewPlayer && msg.PlayerID > 0) ||
		(msg.View == ViewTeam && msg.Query != "") {
		a.navStack = append(a.navStack, a.view)
	}

	a.view = msg.View
	a.focus = focusContent
	a.sidebar.cursor = navIndexFor(msg.View)
	sizeMsg := tea.WindowSizeMsg{Width: a.contentWidth(), Height: a.height}

	switch msg.View {
	case ViewGame:
		a.game = NewGameModel(msg.GamePk, a.sport)
		a.game, _ = a.game.Update(sizeMsg)
		return a, a.game.Init()
	case ViewTeam:
		if msg.Query != "" {
			a.team = NewTeamModel(a.sport, msg.Query)
			a.team, _ = a.team.Update(sizeMsg)
		}
		return a, a.team.Init()
	case ViewPlayer:
		if msg.PlayerID > 0 {
			a.player = NewPlayerModelByID(a.sport, msg.PlayerID)
		} else if msg.Query != "" {
			a.player = NewPlayerModel(a.sport, msg.Query)
		}
		a.player, _ = a.player.Update(sizeMsg)
		return a, a.player.Init()
	case ViewAwards:
		a.awards = NewAwardsModel()
		a.awards, _ = a.awards.Update(sizeMsg)
		return a, a.awards.Init()
	case ViewGlossary:
		a.glossary = NewGlossaryModel()
		a.glossary, _ = a.glossary.Update(sizeMsg)
		return a, a.glossary.Init()
	case ViewPostseason:
		a.postseason = NewPostseasonModel()
		a.postseason, _ = a.postseason.Update(sizeMsg)
		return a, a.postseason.Init()
	case ViewHome:
		return a, nil // already fetched in the background
	default:
		return a, a.activeInit()
	}
}

func (a App) activeInit() tea.Cmd {
	switch a.view {
	case ViewHome:
		return a.home.Init()
	case ViewScores:
		return a.scores.Init()
	case ViewGame:
		return a.game.Init()
	case ViewStandings:
		return a.standings.Init()
	case ViewLeaders:
		return a.leaders.Init()
	case ViewTeam:
		return a.team.Init()
	case ViewPlayer:
		return a.player.Init()
	case ViewAwards:
		return a.awards.Init()
	case ViewPostseason:
		return a.postseason.Init()
	case ViewStreaks:
		return a.streaks.Init()
	case ViewCompare:
		return a.compare.Init()
	case ViewTeamCompare:
		return a.teamCompare.Init()
	case ViewTransactions:
		return a.transactions.Init()
	case ViewNews:
		return a.news.Init()
	case ViewHistory:
		return a.history.Init()
	case ViewDraft:
		return a.draft.Init()
	case ViewVenues:
		return a.venues.Init()
	case ViewFavorites:
		return a.favorites.Init()
	case ViewGlossary:
		return a.glossary.Init()
	case ViewDiamondGPT:
		return a.diamondGPT.Init()
	}
	return nil
}

// applySize feeds the content width to every view and the height to the sidebar.
func (a App) applySize() (App, tea.Cmd) {
	cw := tea.WindowSizeMsg{Width: a.contentWidth(), Height: a.height}
	a.sidebar.height = a.height
	var cmds []tea.Cmd
	var c tea.Cmd
	a.home, c = a.home.Update(cw)
	cmds = append(cmds, c)
	a.scores, c = a.scores.Update(cw)
	cmds = append(cmds, c)
	a.game, c = a.game.Update(cw)
	cmds = append(cmds, c)
	a.standings, c = a.standings.Update(cw)
	cmds = append(cmds, c)
	a.leaders, c = a.leaders.Update(cw)
	cmds = append(cmds, c)
	a.team, c = a.team.Update(cw)
	cmds = append(cmds, c)
	a.player, c = a.player.Update(cw)
	cmds = append(cmds, c)
	a.awards, c = a.awards.Update(cw)
	cmds = append(cmds, c)
	a.postseason, c = a.postseason.Update(cw)
	cmds = append(cmds, c)
	a.streaks, c = a.streaks.Update(cw)
	cmds = append(cmds, c)
	a.compare, c = a.compare.Update(cw)
	cmds = append(cmds, c)
	a.teamCompare, c = a.teamCompare.Update(cw)
	cmds = append(cmds, c)
	a.transactions, c = a.transactions.Update(cw)
	cmds = append(cmds, c)
	a.news, c = a.news.Update(cw)
	cmds = append(cmds, c)
	a.history, c = a.history.Update(cw)
	cmds = append(cmds, c)
	a.draft, c = a.draft.Update(cw)
	cmds = append(cmds, c)
	a.venues, c = a.venues.Update(cw)
	cmds = append(cmds, c)
	a.favorites, c = a.favorites.Update(cw)
	cmds = append(cmds, c)
	a.glossary, c = a.glossary.Update(cw)
	cmds = append(cmds, c)
	a.diamondGPT, c = a.diamondGPT.Update(cw)
	cmds = append(cmds, c)
	return a, tea.Batch(cmds...)
}

// updateActive routes a (key) message to the active content view.
func (a App) updateActive(msg tea.Msg) (App, tea.Cmd) {
	var cmd tea.Cmd
	switch a.view {
	case ViewHome:
		a.home, cmd = a.home.Update(msg)
	case ViewScores:
		a.scores, cmd = a.scores.Update(msg)
	case ViewGame:
		a.game, cmd = a.game.Update(msg)
	case ViewStandings:
		a.standings, cmd = a.standings.Update(msg)
	case ViewLeaders:
		a.leaders, cmd = a.leaders.Update(msg)
	case ViewTeam:
		a.team, cmd = a.team.Update(msg)
	case ViewPlayer:
		a.player, cmd = a.player.Update(msg)
	case ViewAwards:
		a.awards, cmd = a.awards.Update(msg)
	case ViewPostseason:
		a.postseason, cmd = a.postseason.Update(msg)
	case ViewStreaks:
		a.streaks, cmd = a.streaks.Update(msg)
	case ViewCompare:
		a.compare, cmd = a.compare.Update(msg)
	case ViewTeamCompare:
		a.teamCompare, cmd = a.teamCompare.Update(msg)
	case ViewTransactions:
		a.transactions, cmd = a.transactions.Update(msg)
	case ViewNews:
		a.news, cmd = a.news.Update(msg)
	case ViewHistory:
		a.history, cmd = a.history.Update(msg)
	case ViewDraft:
		a.draft, cmd = a.draft.Update(msg)
	case ViewVenues:
		a.venues, cmd = a.venues.Update(msg)
	case ViewFavorites:
		a.favorites, cmd = a.favorites.Update(msg)
	case ViewGlossary:
		a.glossary, cmd = a.glossary.Update(msg)
	case ViewDiamondGPT:
		a.diamondGPT, cmd = a.diamondGPT.Update(msg)
	}
	return a, cmd
}

// routeMsg handles non-key async messages: home always processes them (so its
// background fetch lands for the sidebar's live count), plus the active view.
func (a App) routeMsg(msg tea.Msg) (App, tea.Cmd) {
	var cmds []tea.Cmd
	var c tea.Cmd
	a.home, c = a.home.Update(msg)
	cmds = append(cmds, c)
	if a.view != ViewHome {
		a, c = a.updateActive(msg)
		cmds = append(cmds, c)
	}
	return a, tea.Batch(cmds...)
}

// capturesText reports whether the focused content view is awaiting free text
// (chat box, search, or filter). When true the app suppresses every shortcut
// except Esc so the keys are typed into the field.
func (a App) capturesText() bool {
	if a.focus != focusContent {
		return false
	}
	switch a.view {
	case ViewDiamondGPT:
		return a.diamondGPT.CapturesText()
	case ViewTeam:
		return a.team.CapturesText()
	case ViewPlayer:
		return a.player.CapturesText()
	case ViewVenues:
		return a.venues.CapturesText()
	case ViewGlossary:
		return a.glossary.CapturesText()
	case ViewNews:
		return a.news.CapturesText()
	case ViewCompare, ViewTeamCompare:
		return true
	}
	return false
}

func (a App) contentView() string {
	switch a.view {
	case ViewHome:
		return a.home.View()
	case ViewScores:
		return a.scores.View()
	case ViewGame:
		return a.game.View()
	case ViewStandings:
		return a.standings.View()
	case ViewLeaders:
		return a.leaders.View()
	case ViewTeam:
		return a.team.View()
	case ViewPlayer:
		return a.player.View()
	case ViewAwards:
		return a.awards.View()
	case ViewPostseason:
		return a.postseason.View()
	case ViewStreaks:
		return a.streaks.View()
	case ViewCompare:
		return a.compare.View()
	case ViewTeamCompare:
		return a.teamCompare.View()
	case ViewTransactions:
		return a.transactions.View()
	case ViewNews:
		return a.news.View()
	case ViewHistory:
		return a.history.View()
	case ViewDraft:
		return a.draft.View()
	case ViewVenues:
		return a.venues.View()
	case ViewFavorites:
		return a.favorites.View()
	case ViewGlossary:
		return a.glossary.View()
	case ViewDiamondGPT:
		return a.diamondGPT.View()
	}
	return ""
}

func (a App) View() string {
	if a.showHelp {
		return a.helpView()
	}
	if a.showLeague {
		return a.leaguePicker.View()
	}

	content := lipgloss.NewStyle().Width(a.contentWidth()).Render(a.contentView())
	if a.updateBanner != "" {
		banner := lipgloss.NewStyle().
			Foreground(lipgloss.Color("#e8ff47")).
			Bold(true).
			Padding(0, 1).
			Render("↑ " + a.updateBanner)
		content = content + "\n" + banner
	}
	if a.collapsed {
		return content
	}
	side := a.sidebar.View(a.focus == focusSidebar, a.sport, a.view, a.home.games)
	return lipgloss.JoinHorizontal(lipgloss.Top, side, content)
}

func (a App) helpView() string {
	help := StylePanel.Width(52).Render(
		StyleTitle.Render("Keyboard Shortcuts") + "\n\n" +
			StyleHeader.Render("Layout") + "\n" +
			"  Esc       back / focus the sidebar\n" +
			"  Enter     open selected / focus content\n" +
			"  ←/→       sidebar ⇄ content (also in views)\n" +
			"  Ctrl+B    show / hide the sidebar\n\n" +
			StyleHeader.Render("Global") + "\n" +
			"  L         league picker\n" +
			"  ?         toggle this help\n" +
			"  r         refresh current view\n" +
			"  q         quit\n\n" +
			StyleHeader.Render("Navigation") + "\n" +
			"  j / ↓     move down       k / ↑   move up\n" +
			"  Tab       next tab        f       favorite\n",
	)
	return lipgloss.Place(a.width, a.height, lipgloss.Center, lipgloss.Center, help)
}
