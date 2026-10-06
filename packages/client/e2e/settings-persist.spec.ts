import { expect, test, type Page } from "@playwright/test";
import { clickText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Settings persistence (owner, 2026-10-05): a change on the Settings screen is written to `mc-settings` and is still
 * set after a reload. Export and import carry every `mc-*` entry, so the second half writes the stored record back
 * after clearing storage, as an import does, and reloads (the import itself reloads the page).
 */

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("mc-settings") ?? "null"));

async function openSettings(page: Page): Promise<void> {
  await waitForScene(page, "Title", 30000);
  await settle(page);
  await clickText(page, "SETTINGS", { sceneKey: "Title" });
  await waitForScene(page, "SettingsOverlay");
  await settle(page);
}

test("settings survive a reload and an import's storage restore", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "");
  await openSettings(page);
  await clickText(page, "OFF", { sceneKey: "SettingsOverlay", minY: 250, maxY: 300 });
  await clickText(page, "ON", { sceneKey: "SettingsOverlay", minY: 395, maxY: 420 });
  await waitFor(async () => ((await stored(page))?.largeCardText === true ? true : null), "write", 10000);
  const record = await stored(page);
  expect(record).toMatchObject({ version: 1, largeCardText: true, confirmBeforeEndTurn: false });
  // Never touched: stays out of the record so it keeps following the device.
  expect(record).not.toHaveProperty("reducedMotion");
  expect(record).not.toHaveProperty("textResolution");

  await page.reload();
  expect(await stored(page)).toEqual(record);
  await openSettings(page);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("mc-settings")!));
  expect(state).toEqual(record);

  // Clear storage, put the exported record back, reload: the settings are applied at startup.
  await page.evaluate((raw) => {
    localStorage.clear();
    localStorage.setItem("mc-settings", JSON.stringify(raw));
  }, record);
  await page.reload();
  await openSettings(page);
  // Toggling Large card text off again proves the loaded value was ON (a default start would turn it on).
  await clickText(page, "ON", { sceneKey: "SettingsOverlay", minY: 250, maxY: 300 });
  await waitFor(async () => ((await stored(page))?.largeCardText === false ? true : null), "toggled off", 10000);
  expect(errors).toEqual([]);
});
