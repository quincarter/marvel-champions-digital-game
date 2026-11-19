import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, installPageHelpers, waitForText } from "./helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { quietGuide } from "./wave6-helpers-b.js";
import { SYNC } from "./save-transfer-helpers.js";

/**
 * A shared replay's link (#858): the game opens on a loading screen for the replay, never the title menu; Cancel goes
 * to the menu, and a replay that can't be loaded says why there, with Main menu.
 */

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const ID = "abcdefghijkl";

async function openLink(page: Page, hash: string): Promise<void> {
  await installPageHelpers(page);
  await quietGuide(page);
  await page.goto(`/#replay=${hash}`);
}

test("a replay link loads on its own screen, and Cancel goes to the title menu", async ({ page }) => {
  // The replay service never answers: the loading screen stays up.
  await page.route(`${SYNC}/replay/**`, () => undefined);
  await openLink(page, ID);
  await waitForText(page, "Loading the shared replay", { timeoutMs: 30000 });
  expect(await activeScenes(page)).not.toContain("Title");
  await clickText(page, "CANCEL");
  await waitForScene(page, "Title");
});

test("an expired replay link says so, and Main menu goes to the title menu", async ({ page }) => {
  await page.route(`${SYNC}/replay/**`, (route) =>
    route.fulfill({
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "not-found", error: "not found" }),
    }),
  );
  await openLink(page, ID);
  await waitForText(page, "expired", { timeoutMs: 30000 });
  expect(await activeScenes(page)).not.toContain("Title");
  await clickText(page, "MAIN MENU");
  await waitForScene(page, "Title");
});

test("a replay link that names no replay says it isn't valid", async ({ page }) => {
  await openLink(page, "bad!");
  await waitForText(page, "isn't valid", { timeoutMs: 30000 });
  expect(await activeScenes(page)).not.toContain("Title");
});
