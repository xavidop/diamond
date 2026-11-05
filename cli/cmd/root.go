package cmd

import (
	"fmt"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/spf13/cobra"
	"github.com/xavidop/diamond/cli/internal/mlb"
	"github.com/xavidop/diamond/cli/internal/ui"
	"github.com/xavidop/diamond/cli/internal/version"
)

var (
	noUpdateNotifier bool
	sportFlag        string
	leagueFlag       string
)

var rootCmd = &cobra.Command{
	Use:   "diamond",
	Short: "⚾ MLB stats in your terminal",
	Long: "Diamond — the beautiful game of baseball, in your terminal.\n\n" +
		"Website: https://diamond.xavidop.me\n" +
		"Made by @xavidop (https://github.com/xavidop)",
	Example: "  diamond                               # MLB\n" +
		"  diamond --sport win                   # all winter leagues, games tagged by league\n" +
		"  diamond scores --sport win --league lidom\n" +
		"  diamond standings --sport aaa\n\n" +
		"  Inside the TUI press L to switch sport / league and ? for help.",
	Version: fmt.Sprintf("%s (commit %s, built %s)", version.Version, version.Commit, version.Date),
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		ui.SuppressUpdateCheck = noUpdateNotifier || os.Getenv("DIAMOND_NO_UPDATE_NOTIFIER") != ""
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return runTUI(ui.ViewMenu, 0)
	},
}

// resolveSelection turns --sport / --league into a sport and an optional
// sub-league. Leagues are matched against the offline snapshot first and the
// live /league list second, so "lidom", "DWL", "Dominican" and "131" all work.
func resolveSelection(sportQ, leagueQ string) (mlb.Sport, mlb.League, error) {
	sport := mlb.AllSports[0] // default to MLB
	if sportQ != "" {
		s, ok := mlb.FindSport(sportQ)
		if !ok {
			codes := make([]string, 0, len(mlb.AllSports))
			for _, s := range mlb.AllSports {
				codes = append(codes, s.Code)
			}
			return sport, mlb.League{}, fmt.Errorf("unknown sport %q (try one of: %s)", sportQ, strings.Join(codes, ", "))
		}
		sport = s
	}
	if leagueQ == "" {
		return sport, mlb.League{}, nil
	}
	if !sport.HasSubleagues() {
		return sport, mlb.League{}, fmt.Errorf("--league only applies to multi-league sports such as --sport win (Winter Leagues); %s has no sub-leagues", sport.Abbreviation)
	}
	leagues := mlb.StaticLeagues(sport.ID)
	if l, ok := mlb.FindLeague(leagues, leagueQ); ok {
		return sport, l, nil
	}
	if live, err := mlb.DefaultClient().Leagues(sport.ID); err == nil {
		leagues = live
		if l, ok := mlb.FindLeague(leagues, leagueQ); ok {
			return sport, l, nil
		}
	}
	abbrs := make([]string, 0, len(leagues))
	for _, l := range leagues {
		abbrs = append(abbrs, l.Abbreviation)
	}
	return sport, mlb.League{}, fmt.Errorf("unknown league %q for %s (try one of: %s)", leagueQ, sport.Name, strings.Join(abbrs, ", "))
}

func runTUI(view ui.ViewID, gamePk int, query ...string) error {
	sport, league, err := resolveSelection(sportFlag, leagueFlag)
	if err != nil {
		return err
	}
	q := ""
	if len(query) > 0 {
		q = query[0]
	}
	app := ui.NewApp(view, gamePk, sport, q).WithLeague(league)
	p := tea.NewProgram(app, tea.WithAltScreen())
	_, err = p.Run()
	return err
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().BoolVar(&noUpdateNotifier, "no-update-notifier", false, "suppress new version notifications")
	rootCmd.PersistentFlags().StringVar(&sportFlag, "sport", "", "sport to open: mlb (default), aaa, aax, afa, afx, rok, win, kor, jml, bbc — or its id")
	rootCmd.PersistentFlags().StringVar(&leagueFlag, "league", "", "sub-league for multi-league sports, e.g. --sport win --league lidom (LIDOM, LVBP, LMP, LBPRC, AFL, ABL, CS)")
	rootCmd.AddCommand(scoresCmd, gameCmd, standingsCmd, leadersCmd, teamCmd, playerCmd, mcpCmd)
}
