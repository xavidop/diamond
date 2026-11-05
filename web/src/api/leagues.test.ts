import { describe, it, expect } from "vitest";
import {
  WINTER_LEAGUES,
  filterGamesByLeague,
  gameLeagueId,
  leagueAbbr,
  mergeLeagues,
  normalizeLeague,
  sportHasSubleagues,
  standingsGamesBack,
} from "./leagues";

const game = (homeLeague?: number, awayLeague?: number) => ({
  teams: {
    home: { team: { league: homeLeague == null ? undefined : { id: homeLeague } } },
    away: { team: { league: awayLeague == null ? undefined : { id: awayLeague } } },
  },
});

describe("sportHasSubleagues", () => {
  it("is true for Winter Leagues and false for MLB", () => {
    expect(sportHasSubleagues(17)).toBe(true);
    expect(sportHasSubleagues(1)).toBe(false);
    expect(sportHasSubleagues(11)).toBe(false);
  });
});

describe("gameLeagueId / filterGamesByLeague", () => {
  it("reads the home team's league, falling back to away", () => {
    expect(gameLeagueId(game(131, 131))).toBe(131);
    expect(gameLeagueId(game(undefined, 135))).toBe(135);
    expect(gameLeagueId(game())).toBeUndefined();
    expect(gameLeagueId(undefined)).toBeUndefined();
  });

  it("returns every game when no league is selected", () => {
    const games = [game(131), game(135), game(119)];
    expect(filterGamesByLeague(games, null)).toBe(games);
    expect(filterGamesByLeague(games, undefined)).toBe(games);
  });

  it("keeps only the selected league", () => {
    const games = [game(131), game(135), game(131), game()];
    expect(filterGamesByLeague(games, 131)).toHaveLength(2);
    expect(filterGamesByLeague(games, 595)).toHaveLength(0);
  });
});

describe("normalizeLeague / mergeLeagues", () => {
  it("prefers fan-facing abbreviations over the API's", () => {
    expect(normalizeLeague({ id: 131, abbreviation: "DWL", name: "Liga de Beisbol Dominicano" }, 17).abbreviation).toBe("LIDOM");
    expect(normalizeLeague({ id: 135, abbreviation: "VWL" }, 17).abbreviation).toBe("LVBP");
    expect(normalizeLeague({ id: 133, abbreviation: "PWL" }, 17).abbreviation).toBe("LBPRC");
    expect(normalizeLeague({ id: 119, abbreviation: "AFL" }, 17).abbreviation).toBe("AFL");
  });

  it("uses the API abbreviation for sports without a snapshot", () => {
    const l = normalizeLeague({ id: 436, abbreviation: "ALPB", name: "Atlantic League" }, 23);
    expect(l).toMatchObject({ id: 436, sportId: 23, abbreviation: "ALPB", name: "Atlantic League" });
  });

  it("keeps API order and back-fills missing snapshot leagues", () => {
    const merged = mergeLeagues([{ id: 119, abbreviation: "AFL" }, { id: 132, abbreviation: "LMP" }], 17);
    expect(merged.slice(0, 2).map((l) => l.id)).toEqual([119, 132]);
    expect(merged).toHaveLength(WINTER_LEAGUES.length);
    expect(new Set(merged.map((l) => l.id)).size).toBe(WINTER_LEAGUES.length);
  });

  it("falls back to the snapshot when the API returns nothing", () => {
    expect(mergeLeagues(undefined, 17)).toEqual(WINTER_LEAGUES);
    expect(mergeLeagues([], 1)).toEqual([]);
  });

  it("drops inactive (defunct) leagues", () => {
    const merged = mergeLeagues(
      [{ id: 436, abbreviation: "ALPB", active: true }, { id: 999, abbreviation: "OLD", active: false }],
      23
    );
    expect(merged.map((l) => l.id)).toEqual([436]);
  });

  it("skips duplicate and malformed ids", () => {
    const merged = mergeLeagues([{ id: 436 }, { id: 436 }, { id: "x" }], 23);
    expect(merged.map((l) => l.id)).toEqual([436]);
  });
});

describe("standingsGamesBack", () => {
  it("keeps gamesBack inside a division", () => {
    expect(standingsGamesBack(true, { gamesBack: "4.5", leagueGamesBack: "9.0" })).toBe("4.5");
  });
  it("uses the behind-the-leader figure for division-less leagues", () => {
    expect(standingsGamesBack(false, { gamesBack: "-4.0", leagueGamesBack: "-" })).toBe("-");
    expect(standingsGamesBack(false, { gamesBack: "2.0", leagueGamesBack: "6.0" })).toBe("6.0");
  });
  it("falls back to gamesBack when the league figure is missing", () => {
    expect(standingsGamesBack(false, { gamesBack: "2.0" })).toBe("2.0");
    expect(standingsGamesBack(false, undefined)).toBeUndefined();
  });
});

describe("leagueAbbr", () => {
  it("resolves from the list, then overrides, then the fallback name", () => {
    expect(leagueAbbr(WINTER_LEAGUES, 131)).toBe("LIDOM");
    expect(leagueAbbr([], 135)).toBe("LVBP");
    expect(leagueAbbr([], 999, "Mystery League")).toBe("Mystery League");
    expect(leagueAbbr(WINTER_LEAGUES, undefined)).toBeUndefined();
  });
});
