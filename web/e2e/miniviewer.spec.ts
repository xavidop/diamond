import { test, expect } from "@playwright/test";

test.describe("mini viewer", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`renders in ${theme} mode`, async ({ page }) => {
      await page.addInitScript((t) => {
        window.localStorage.setItem("diamond.theme", t);
        // Chromium supports Document Picture-in-Picture, which would move the
        // mini viewer into a window this page cannot address. Removing the API
        // makes getDocPip() return undefined, forcing the in-page panel — the
        // same MiniScoreboard tree.
        delete (window as unknown as Record<string, unknown>).documentPictureInPicture;
      }, theme);

      await page.goto("/");

      await page.getByRole("button", { name: "Open mini scoreboard" }).click();

      const panel = page.locator(".diamond-mini");
      await expect(panel).toBeVisible();
      await expect(panel.getByText("Mini Viewer")).toBeVisible();
      // Wait for the slate to load so the screenshot is not of a spinner.
      await expect(panel.getByRole("button", { name: "Slate" })).toBeVisible();

      await expect(panel).toHaveScreenshot(`miniviewer-focus-${theme}.png`);

      await panel.getByRole("button", { name: "Slate" }).click();
      await expect(panel.getByRole("heading").first()).toBeVisible();
      await expect(panel).toHaveScreenshot(`miniviewer-slate-${theme}.png`);
    });
  }
});
