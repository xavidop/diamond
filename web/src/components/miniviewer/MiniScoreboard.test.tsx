import { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MiniScoreboard from "./MiniScoreboard";
import { MiniViewerProvider } from "../../contexts/MiniViewerContext";
import { ThemeProvider } from "../../contexts/ThemeContext";
import { SportProvider } from "../../contexts/SportContext";
import { writeGamePk } from "../../lib/miniStorage";
import * as mlb from "../../api/mlb";

const GAMES = [
  {
    gamePk: 2,
    status: { abstractGameState: "Live" },
    teams: {
      away: { team: { id: 118, abbreviation: "KC" }, score: 3 },
      home: { team: { id: 116, abbreviation: "DET" }, score: 5 },
    },
    linescore: {
      currentInningOrdinal: "7th", isTopInning: true, balls: 1, strikes: 2, outs: 2,
      scheduledInnings: 9, innings: [], teams: {},
      offense: { batter: { id: 10, fullName: "B. Witt Jr." } },
      defense: { pitcher: { id: 20, fullName: "T. Skubal" } },
    },
  },
  {
    gamePk: 4,
    gameDate: "2026-07-23T23:07:00Z",
    status: { abstractGameState: "Preview", detailedState: "Scheduled" },
    teams: { away: { team: { abbreviation: "TB" } }, home: { team: { abbreviation: "TOR" } } },
  },
];

// The client must be created once per test render, not on every re-render of
// the wrapper — a fresh instance per render would drop the cache and could
// trigger refetch loops or flaky assertions. `useState`'s lazy initializer
// runs exactly once per mounted instance (i.e. once per `render()` call
// below), which is what we want. Named `Wrapper` (not `wrapper`) so the
// react-hooks lint rule recognizes it as a component allowed to call hooks;
// it is still passed under RTL's `wrapper` render option below.
function Wrapper({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <SportProvider>
          <MiniViewerProvider>{children}</MiniViewerProvider>
        </SportProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(mlb.api, "daySchedule").mockResolvedValue({ dates: [{ games: GAMES }] });
  vi.spyOn(mlb.api, "gameLinescore").mockResolvedValue(GAMES[0].linescore);
  vi.spyOn(mlb.api, "gameBoxscore").mockResolvedValue({ teams: { home: { players: {} }, away: { players: {} } } });
});

// vi.spyOn on an already-spied method reuses the same mock instance rather
// than replacing it, so its call history otherwise leaks across tests (e.g.
// the "does not fetch a boxscore" assertion below would see boxscore calls
// from earlier tests). Restore after each test so every `vi.spyOn` above
// starts a fresh mock with an empty call history.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("MiniScoreboard", () => {
  it("defaults to focus mode on the first live game", async () => {
    render(<MiniScoreboard />, { wrapper: Wrapper });
    expect(await screen.findByText("T. Skubal")).toBeTruthy();
  });

  it("switches to slate mode from the header toggle", async () => {
    render(<MiniScoreboard />, { wrapper: Wrapper });
    await screen.findByText("T. Skubal");
    fireEvent.click(screen.getByRole("button", { name: "Slate" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Live · 1" })).toBeTruthy());
  });

  it("discards a stored game that is not in today's slate", async () => {
    writeGamePk(999999);
    render(<MiniScoreboard />, { wrapper: Wrapper });
    // falls back to pickDefaultGame -> the live game
    expect(await screen.findByText("T. Skubal")).toBeTruthy();
  });

  it("does not fetch a boxscore for a scheduled game", async () => {
    writeGamePk(4);
    render(<MiniScoreboard />, { wrapper: Wrapper });
    await screen.findByText("TB");
    expect(mlb.api.gameBoxscore).not.toHaveBeenCalled();
  });
});
