import { expect, test, type Page } from "@playwright/test";
import { activeScenes, hasText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { routeStops } from "./wave6-helpers-a.js";
import { openApp, startGame } from "./wave6-helpers-b.js";

/**
 * Device sync (#276): a saved game says which platform it was last played on. The engine worker stamps `lastPlayedOn`
 * on every write; the Title's Continue row draws the platform mark beside its label. Older saves (no stamp) show none.
 * On a phone, a swipe that lifts over the Continue row (its icon included) presses nothing; a tap resumes the game.
 */

const SHOTS = process.env.SHOT_DIR ?? "";

type Platform = "web" | "windows" | "macos" | "linux" | "android" | "ios";
const LABELS: Record<Platform, string> = {
  web: "Played in a browser",
  windows: "Played on Windows",
  macos: "Played on macOS",
  linux: "Played on Linux",
  android: "Played on Android",
  ios: "Played on iOS",
};

/** Rewrites the stored game's `lastPlayedOn` (or removes it) the way another device's save would have arrived. */
async function setStamp(page: Page, platform: Platform | null): Promise<void> {
  await page.evaluate(async (wanted) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const all = await new Promise<Record<string, unknown>[]>((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });
    for (const game of all) {
      const { lastPlayedOn: _gone, ...rest } = game;
      store.put(wanted ? { ...rest, lastPlayedOn: { platform: wanted } } : rest);
    }
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, platform);
}

async function storedStamp(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<{ lastPlayedOn?: unknown }[]>((resolve) => {
      const request = db.transaction("games").objectStore("games").getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return all[0]?.lastPlayedOn ?? null;
  });
}

const continueRect = async (page: Page) =>
  waitFor(
    async () => (await routeStops(page, "Title"))?.stops.find((s) => s.key === "continue")?.rect ?? null,
    "Continue",
  );

async function touchSwipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10, id: 1 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("the worker stamps the platform; the Continue row shows each platform's mark and none for an old save", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await page.setViewportSize(phone ? { width: 375, height: 812 } : { width: 1280, height: 800 });
  const errors = trackPageErrors(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await settle(page);
  // A browser (headless Chromium here) is "web", stamped by the engine worker when it created the game.
  await waitFor(async () => ((await storedStamp(page)) ? true : null), "the game is stamped");
  // The worker also stamps the build and card pool that wrote it (mixed-version sync guard).
  expect(await storedStamp(page)).toMatchObject({
    platform: "web",
    appVersion: expect.stringMatching(/^\d+\.\d+\.\d+/),
    contentVersion: expect.any(String),
  });

  const order: (Platform | null)[] = ["windows", "macos", "linux", "android", "ios", "web", null];
  for (const platform of order) {
    await setStamp(page, platform);
    await page.goto("/?unlock=all");
    await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "Title");
    const row = await continueRect(page);
    await settle(page, { quietMs: 500, maxMs: 3000 });
    // The mark is drawn for this platform (a dev-only hook), on both projects.
    await waitFor(
      async () =>
        (await page
          .evaluate(
            (wanted) => (window as unknown as { __mcContinuePlatform?: string | null }).__mcContinuePlatform === wanted,
            platform,
          )
          .catch(() => false)) || null,
      `the Continue row draws the ${platform ?? "no"} mark`,
    );
    if (!phone) {
      await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2);
      if (platform) {
        await waitFor(async () => ((await hasText(page, LABELS[platform], "Title")) ? true : null), `tip ${platform}`);
      }
    }
    if (!platform) expect(await hasText(page, "Played", "Title"), "an old save shows no mark").toBe(false);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/${phone ? "phone-375x812" : "desktop-1280x800"}-${platform ?? "none"}.png`,
      });
  }
  expect(errors).toEqual([]);
});

test("a swipe lifting over the Continue row (its icon included) presses nothing; a tap resumes", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = trackPageErrors(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await settle(page);
  await setStamp(page, "android");
  await page.goto("/?unlock=all");
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "Title");
  const row = await continueRect(page);
  await settle(page, { quietMs: 500, maxMs: 3000 });

  const icon = { x: row.x + 28, y: row.y + row.height / 2 };
  await touchSwipe(page, { x: icon.x, y: icon.y + 120 }, icon);
  await touchSwipe(
    page,
    { x: row.x + row.width / 2, y: row.y + row.height + 120 },
    { x: row.x + row.width / 2, y: row.y + row.height / 2 },
  );
  await settle(page, { quietMs: 500, maxMs: 2500 });
  expect(await activeScenes(page), "the swipes resumed nothing").toContain("Title");
  expect(await activeScenes(page)).not.toContain("Board");
  expect(await activeScenes(page)).not.toContain("SetupDeal");

  await page.touchscreen.tap(row.x + row.width / 2, row.y + row.height / 2);
  await waitFor(
    async () => {
      // A game saved before its mulligans were taken resumes on the setup deal screen, otherwise the Board.
      const up = await activeScenes(page);
      return up.includes("Board") || up.includes("SetupDeal") ? true : null;
    },
    "a tap resumes the game",
    30000,
  );
  expect(errors).toEqual([]);
});
