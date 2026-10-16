import { expect, test, type Page } from "@playwright/test";
import { clickText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { routeStops, waitForScene } from "./wave6-helpers-a.js";
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

/**
 * Clicks a Settings row's own control, found by its focus stop (`row:<id>`) rather than a screen position, so the
 * spec doesn't depend on where the row sits in its section. Wheels the body first while the row is scrolled out of
 * view, then clicks until `done` reads true.
 */
async function pressRow(page: Page, id: string, done: () => Promise<boolean>): Promise<void> {
  const view = page.viewportSize()!;
  for (let attempt = 0; attempt < 30; attempt++) {
    const rect = (await routeStops(page, "SettingsOverlay"))?.stops.find((s) => s.key === `row:${id}`)?.rect;
    if (rect) {
      const middle = rect.y + rect.height / 2;
      if (middle < 110 || middle > view.height - 40) {
        await page.mouse.move(view.width / 2, view.height / 2);
        await page.mouse.wheel(0, middle < 110 ? -240 : 240);
        await settle(page, { quietMs: 150, maxMs: 600 });
        continue;
      }
      await page.mouse.click(rect.x + rect.width - 44, middle);
      try {
        await waitFor(async () => ((await done()) ? true : null), `row:${id} took the press`, 3000);
        return;
      } catch {
        // The press landed mid-scroll or before the row could take it; look again and retry.
      }
    }
    await settle(page, { quietMs: 150, maxMs: 600 });
  }
  throw new Error(`row:${id} never took a press`);
}

test("settings survive a reload and an import's storage restore", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "");
  await openSettings(page);
  await pressRow(page, "confirm-end-turn", async () => (await stored(page))?.confirmBeforeEndTurn === false);
  await pressRow(page, "large-card-text", async () => (await stored(page))?.largeCardText === true);
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
  await pressRow(page, "large-card-text", async () => (await stored(page))?.largeCardText === false);
  expect(errors).toEqual([]);
});
