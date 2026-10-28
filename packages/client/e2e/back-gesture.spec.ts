import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, settle, waitFor } from "./helpers.js";
import { declineMulligans, openApp, startGame } from "./wave6-helpers-b.js";

/**
 * Issue #480: the platform's Back (here a browser's, `history.back()`) steps back a screen as Escape does, instead of
 * leaving the game. In a game it opens Pause; on Title, with nothing open, it leaves (the game's own history entry is
 * not put back). Android's back gesture reaches the same path through the app's plugin (`platform/back-gesture.ts`).
 */

const waitForScene = (page: Page, scene: string, present = true): Promise<true> =>
  waitFor(
    async () => ((await activeScenes(page)).includes(scene) === present ? true : null),
    `${scene} ${present ? "up" : "gone"}`,
    20_000,
  );

const back = (page: Page): Promise<void> => page.evaluate(() => history.back());

const trapped = (page: Page): Promise<boolean> =>
  page.evaluate(() => (history.state as { mcBack?: boolean } | null)?.mcBack === true);

test.describe("Back steps back a screen (#480)", () => {
  test("from the Trophy Room to Title, then out of the game at Title", async ({ page }) => {
    await openApp(page);
    await settle(page);
    expect(await trapped(page), "the game keeps a history entry of its own").toBe(true);

    await clickText(page, "Trophy Room", { sceneKey: "Title" });
    await waitForScene(page, "TrophyRoom");
    await settle(page);
    await back(page);
    await waitForScene(page, "Title");
    await waitForScene(page, "TrophyRoom", false);
    await settle(page);
    expect(await trapped(page), "the entry is back on after a Back the game took").toBe(true);

    // Title with nothing over it: Back leaves the game, for the page before it (the test's blank start page).
    await back(page);
    await page.waitForURL("about:blank", { timeout: 10_000 });
  });

  test("closes Settings over Title rather than leaving", async ({ page }) => {
    await openApp(page);
    await clickText(page, "Settings", { sceneKey: "Title" });
    await waitForScene(page, "SettingsOverlay");
    await settle(page);
    await back(page);
    await waitForScene(page, "SettingsOverlay", false);
    expect(await activeScenes(page)).toContain("Title");
    expect(await trapped(page)).toBe(true);
  });

  test("opens Pause in a game", async ({ page }) => {
    test.setTimeout(120_000);
    await openApp(page);
    await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
    await declineMulligans(page);
    await settle(page, { quietMs: 1000, maxMs: 6000 });
    await back(page);
    await waitForScene(page, "PauseOverlay");
    expect(await activeScenes(page)).toContain("Board");
  });
});
