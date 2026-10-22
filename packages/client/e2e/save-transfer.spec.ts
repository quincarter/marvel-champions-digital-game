import { expect, test } from "@playwright/test";
import { activeScenes, clickText, findText, hasText, isSceneUp, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import {
  fakeSync,
  KEY_PART,
  openSaveData,
  ROOM,
  SAVE_DATA,
  sealedSample,
  waitForSaveText,
  waitForStop,
} from "./save-transfer-helpers.js";

/**
 * Settings ▸ Save data ▸ Send to / Receive from another device (issue #276, step 1), against a fake sync service
 * (`page.route` on the dev server's sync URL). Desktop only here; `save-transfer-touch.spec.ts` is the phone's.
 */

test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== "desktop", "the phone's case is save-transfer-touch.spec.ts");
});

const stopKeys = async (page: Parameters<typeof routeStops>[0]): Promise<string[]> =>
  (await routeStops(page, SAVE_DATA))?.stops.map((s) => s.key) ?? [];

test("Send shows the code, the countdown and a QR; Copy copies the code and Back returns to the menu", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = trackPageErrors(page);
  const sync = await fakeSync(page);
  await openApp(page);
  await openSaveData(page);
  expect(await stopKeys(page)).toEqual(expect.arrayContaining(["row:export", "row:import", "row:send", "row:receive"]));

  await clickStop(page, "row:send", SAVE_DATA);
  await waitForSaveText(page, "ABCD-EFGH-");
  const [code] = await findText(page, "ABCD-EFGH-", SAVE_DATA);
  expect(code!.text).toMatch(/^ABCD-EFGH-[2-9A-HJKMN-Z]{4}$/);
  expect(sync.requests).toEqual([{ method: "POST", path: "/transfer" }]);
  expect(await hasText(page, "Expires in 1", SAVE_DATA)).toBe(true);

  await clickStop(page, "copy", SAVE_DATA);
  await waitForSaveText(page, "Code copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code!.text);

  await clickStop(page, "back-menu", SAVE_DATA);
  await waitForStop(page, "row:send");
  expect(errors).toEqual([]);
});

test("Receive: a typed code fetches the save and lands on the replace confirm", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page);
  const sync = await fakeSync(page, { download: await sealedSample(page) });
  await openSaveData(page);

  await clickStop(page, "row:receive", SAVE_DATA);
  await waitForStop(page, "receive");
  // Typing starts in the field (desktop focuses it); lower case and a space are fine.
  await page.keyboard.type(`${ROOM.toLowerCase()} ${KEY_PART.toLowerCase()}`);
  await page.keyboard.press("Enter");
  await waitForSaveText(page, "Replace everything on this device?");
  expect(sync.requests).toEqual([{ method: "GET", path: `/transfer/${ROOM}` }]);
  expect(await hasText(page, "3 saved games", SAVE_DATA)).toBe(true);

  // Cancel goes back to the menu and writes nothing.
  await clickStop(page, "cancel", SAVE_DATA);
  await waitForStop(page, "row:receive");
  expect(errors).toEqual([]);
});

test("Receive: a wrong code says what may be wrong; a malformed one never asks the service", async ({ page }) => {
  await openApp(page);
  const sync = await fakeSync(page);
  await openSaveData(page);
  await clickStop(page, "row:receive", SAVE_DATA);
  await waitForStop(page, "receive");

  await page.keyboard.type("ABCD");
  await clickStop(page, "receive", SAVE_DATA);
  await waitForSaveText(page, "That isn't a transfer code.");
  expect(sync.requests).toEqual([]);

  await page.locator("input").fill(`${ROOM}${KEY_PART}`);
  await clickStop(page, "receive", SAVE_DATA);
  await waitForSaveText(
    page,
    "That code didn't work. It may be mistyped, already used, or expired (codes last 15 minutes).",
  );
  expect(sync.requests).toHaveLength(1);
});

test("an unreachable service says so and points at Export, on Send and on Receive", async ({ page }) => {
  await openApp(page);
  await fakeSync(page, { download: "abort" });
  await openSaveData(page);

  const unavailable = "Online transfer is unavailable right now. You can still export a save file.";
  await clickStop(page, "row:receive", SAVE_DATA);
  await waitForStop(page, "receive");
  await page.keyboard.type(`${ROOM}${KEY_PART}`);
  await clickStop(page, "receive", SAVE_DATA);
  await waitForSaveText(page, unavailable);
  await waitForStop(page, "status-export");

  await clickStop(page, "back-menu", SAVE_DATA);
  await waitForStop(page, "row:send");
  await clickStop(page, "row:send", SAVE_DATA);
  await waitForSaveText(page, unavailable);
  await waitForStop(page, "status-export");
  expect(await stopKeys(page)).toContain("row:export");
});

test("a #receive= link opens Receive with the code filled in and clears the hash", async ({ page }) => {
  const errors = trackPageErrors(page);
  const sync = await fakeSync(page, { download: undefined });
  await openApp(page, `unlock=all#receive=${ROOM}.${KEY_PART}`, { landing: "Title" });
  await waitFor(async () => ((await activeScenes(page)).includes(SAVE_DATA) ? true : null), "Save data opens", 30000);
  await waitForStop(page, "receive");
  await settle(page);

  expect(await page.locator("input").inputValue()).toBe("ABCD-EFGH-JKMN");
  expect(await page.evaluate(() => location.hash)).toBe("");
  // Filled in, not fetched: the player presses Receive.
  expect(sync.requests).toEqual([]);

  // Escape backs out of Receive to the menu, then closes the overlay.
  await page.keyboard.press("Escape");
  await settle(page);
  await page.keyboard.press("Escape");
  await waitFor(async () => ((await activeScenes(page)).includes(SAVE_DATA) ? null : true), "Save data closes", 10000);

  // The code was taken once: Settings closed and opened again does not reopen Receive.
  await page.keyboard.press("Escape");
  await waitFor(
    async () => ((await activeScenes(page)).includes("SettingsOverlay") ? null : true),
    "Settings closes",
    10000,
  );
  await clickText(page, "SETTINGS", { sceneKey: "Title", until: () => isSceneUp(page, "SettingsOverlay") });
  await settle(page);
  expect(await activeScenes(page)).not.toContain(SAVE_DATA);
  expect(errors).toEqual([]);
});

test("an unparseable #receive= link just clears the hash", async ({ page }) => {
  await openApp(page, "unlock=all#receive=nonsense");
  await settle(page);
  expect(await page.evaluate(() => location.hash)).toBe("");
  expect(await activeScenes(page)).not.toContain(SAVE_DATA);
});
