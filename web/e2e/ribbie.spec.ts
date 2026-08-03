import { test, expect } from "@playwright/test";

const GAME_PK = 824160;

/**
 * A live game feed, trimmed to what the page header and section ordering read.
 * The sections below the gamecast tolerate the missing data — they're not what
 * this spec is checking.
 */
const liveFeed = {
  gameData: {
    game: { season: "2026" },
    datetime: { dateTime: "2026-08-03T22:40:00Z", officialDate: "2026-08-03" },
    status: { abstractGameState: "Live", detailedState: "In Progress" },
    teams: {
      away: { id: 141, teamName: "Blue Jays", locationName: "Toronto" },
      home: { id: 117, teamName: "Astros", locationName: "Houston" },
    },
  },
  liveData: {
    linescore: {
      currentInningOrdinal: "3rd",
      inningState: "Top",
      balls: 1,
      strikes: 2,
      outs: 1,
      innings: [],
      teams: { away: { runs: 4 }, home: { runs: 2 } },
    },
    boxscore: { teams: {} },
    plays: { allPlays: [] },
  },
};

test.describe("Ribbie gamecast", () => {
  test.beforeEach(async ({ page }) => {
    // Force a live game — otherwise this spec only passes while a real game
    // happens to be in progress.
    await page.route(`**/game/${GAME_PK}/feed/live**`, (route) =>
      route.fulfill({ json: liveFeed })
    );

    // Never touch ribbie.tv from CI. Eric's project shouldn't absorb our test
    // traffic, and a real embed would make these screenshots non-deterministic.
    await page.route("https://ribbie.tv/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/og")) {
        // 1x1 transparent PNG.
        return route.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "base64"
          ),
        });
      }
      return route.fulfill({
        contentType: "text/html",
        body: "<html><body style='margin:0;background:#0a0d14'></body></html>",
      });
    });
  });

  test("frames nothing on a live game until the user asks for it", async ({
    page,
  }) => {
    await page.goto(`/game/${GAME_PK}`);

    await expect(
      page.getByRole("heading", { name: "Watch in 8-Bit" })
    ).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);

    await page.getByRole("button", { name: "Watch", exact: true }).click();

    const frame = page.locator("iframe");
    await expect(frame).toHaveAttribute(
      "src",
      `https://ribbie.tv/watch/game/${GAME_PK}`
    );
    await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
  });

  test("shows up before first pitch, for the countdown and lineups", async ({
    page,
  }) => {
    await page.route(`**/game/${GAME_PK}/feed/live**`, (route) =>
      route.fulfill({
        json: {
          ...liveFeed,
          gameData: {
            ...liveFeed.gameData,
            status: { abstractGameState: "Preview", detailedState: "Scheduled" },
          },
        },
      })
    );

    await page.goto(`/game/${GAME_PK}`);

    await expect(
      page.getByRole("heading", { name: "Watch in 8-Bit" })
    ).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("stays off a finished game", async ({ page }) => {
    await page.route(`**/game/${GAME_PK}/feed/live**`, (route) =>
      route.fulfill({
        json: {
          ...liveFeed,
          gameData: {
            ...liveFeed.gameData,
            status: { abstractGameState: "Final", detailedState: "Final" },
          },
        },
      })
    );

    await page.goto(`/game/${GAME_PK}`);

    // Head-to-Head proves the page actually rendered its sections, so the
    // absent gamecast below is a real absence rather than a blank page.
    await expect(
      page.getByRole("heading", { name: "Head-to-Head" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Watch in 8-Bit" })
    ).toHaveCount(0);
  });
});
