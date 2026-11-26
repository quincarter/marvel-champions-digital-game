import { expect, test, type Page } from "@playwright/test";
import { pressKey, trackPageErrors } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Settings ▸ Save data draws as a Lit panel over the canvas (`mc-sheet`): the six action rows are DOM buttons, Receive
 * swaps to the code step (its field is a Phaser DOM element seen through a hole in the panel), Back and Escape step out
 * one level at a time, and the keyboard walks the buttons with the ring drawn in the panel layer.
 */

const sheet = (page: Page) => page.locator('#mc-ui [data-scene="SaveDataOverlay"] mc-sheet');
const key = (page: Page, id: string) => sheet(page).locator(`[data-key="${id}"]`);

test("Save data is a panel: Receive opens the code step, Back and Escape step out", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=save-data", { landing: "SaveDataOverlay" });
  await expect(sheet(page)).toBeVisible();
  for (const id of ["export", "import", "send", "receive", "sync", "global"]) {
    await expect(key(page, `row:${id}`)).toBeVisible();
  }

  await key(page, "row:receive").click();
  await expect(key(page, "receive")).toBeVisible();
  await expect(key(page, "row:export")).toHaveCount(0);
  await key(page, "back-menu").click();
  await expect(key(page, "row:export")).toBeVisible();

  // Down from the close button onto the rows: the ring is drawn over the panel.
  await pressKey(page, "ArrowDown");
  await expect(page.locator("#mc-ui .mc-focus-ring")).toBeVisible();

  await pressKey(page, "Escape");
  await expect(sheet(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Send without a sync service says so and offers Export", async ({ page }) => {
  await openApp(page, "screen=save-data", { landing: "SaveDataOverlay" });
  await key(page, "row:send").click();
  await expect(key(page, "status-export")).toBeVisible();
});
