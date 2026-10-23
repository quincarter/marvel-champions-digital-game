import { expect, test, type Browser, type Page } from "@playwright/test";
import { activeScenes, hasText, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp, startGame } from "./wave6-helpers-b.js";
import {
  SYNC_DATA,
  appendCommand,
  deckNames,
  fakeSyncServer,
  gameCount,
  openSyncScreen,
  putDeck,
  storedSyncCode,
  syncStop,
  typeIntoJoinField,
  waitForSyncText,
} from "./sync-ui-helpers.js";

/**
 * Device sync's screens (#276, step 2) against an in-memory stand-in for the sync Worker: set up shows the recovery
 * code once and needs the acknowledge; the status line; a second browser joins with the first one's code and receives
 * its deck and game; both changing a game asks which copy to keep; unlink forgets the code and keeps the saves.
 * `SHOT_DIR` saves screenshots of each screen.
 */

const SHOTS = process.env.SHOT_DIR ?? "";

async function shot(page: Page, phone: boolean, name: string): Promise<void> {
  if (!SHOTS) return;
  await settle(page, { quietMs: 400, maxMs: 2500 });
  await page.screenshot({ path: `${SHOTS}/${phone ? "phone-375x812" : "desktop-1280x800"}-${name}.png` });
}

async function newDevice(browser: Browser, page: Page): Promise<Page> {
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize() ?? { width: 1280, height: 800 },
    hasTouch: await page.evaluate(() => navigator.maxTouchPoints > 0),
    reducedMotion: "reduce",
  });
  return context.newPage();
}

async function press(page: Page, scene: string, key: string): Promise<void> {
  await syncStop(page, scene, key);
  await clickStop(page, key, scene);
}

test("set up shows the recovery code once; copy and the acknowledge work; the status line follows", async ({
  page,
  context,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await page.setViewportSize(phone ? { width: 375, height: 812 } : { width: 1280, height: 800 });
  const errors = trackPageErrors(page);
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await openApp(page);
  await openSyncScreen(page);

  await waitForSyncText(page, "Sync is off");
  await waitForSyncText(page, "Status: Off");
  await shot(page, phone, "1-sync-off");
  expect(await hasText(page, "More information", SYNC_DATA), "the guide link is on the screen").toBe(true);

  await press(page, SYNC_DATA, "sync:setup");
  await waitForSyncText(page, "Your recovery code");
  const code = await waitFor(async () => storedSyncCode(page), "the recovery code is saved");
  expect(code).toMatch(/^[2-9A-HJKMNP-Z]{25}$/);
  const grouped = code!.match(/.{5}/g)!.join("-");
  await waitForSyncText(page, grouped);
  await shot(page, phone, "2-setup-code");

  // Copy code, then I've saved my code, lands on the sync screen with sync on (the reported stuck dialog came after a
  // press on this screen).
  await press(page, SYNC_DATA, "copy");
  await settle(page, { quietMs: 300, maxMs: 1500 });
  expect(await activeScenes(page)).toContain(SYNC_DATA);
  await press(page, SYNC_DATA, "ack");
  await waitForSyncText(page, "Sync is on");
  await waitForSyncText(page, "Status: Synced");
  await shot(page, phone, "3-sync-on");
  expect(cloud.spaces.size).toBe(1);

  // Show recovery code shows the same code again.
  await press(page, SYNC_DATA, "sync:show-code");
  await waitForSyncText(page, grouped);
  await press(page, SYNC_DATA, "back-menu");

  // Link another device: a QR code and the typed code.
  await press(page, SYNC_DATA, "sync:link");
  await waitForSyncText(page, "Expires in");
  await waitForSyncText(page, "recovery code works there too");
  await shot(page, phone, "4-link-qr");
  await press(page, SYNC_DATA, "back-menu");

  // The service going away is said in words, and changes wait.
  cloud.down = true;
  await press(page, SYNC_DATA, "sync:now");
  await waitForSyncText(page, "Offline, changes waiting");
  cloud.down = false;
  expect(errors).toEqual([]);
});

test("a second browser joins with the recovery code and receives a deck and a game; unlink keeps the saves", async ({
  page,
  context,
  browser,
}, info) => {
  test.setTimeout(240_000);
  const phone = info.project.name === "phone";
  await page.setViewportSize(phone ? { width: 375, height: 812 } : { width: 1280, height: 800 });
  const errors = trackPageErrors(page);
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await settle(page);
  await putDeck(page, "deck-from-a", "Web Slinger Deck");
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30000);

  await openSyncScreen(page);
  await press(page, SYNC_DATA, "sync:setup");
  await waitForSyncText(page, "Your recovery code");
  const code = (await waitFor(async () => storedSyncCode(page), "the code is saved"))!;
  await press(page, SYNC_DATA, "ack");
  await waitForSyncText(page, "Status: Synced");

  // Device B: a fresh browser that has never seen any of it.
  const b = await newDevice(browser, page);
  await cloud.install(b.context());
  await openApp(b);
  expect(await deckNames(b)).toEqual([]);
  await openSyncScreen(b);
  await press(b, SYNC_DATA, "sync:join");
  await waitForSyncText(b, "Join with a recovery code");
  await shot(b, phone, "5-join");

  // A mistyped code that matches no synced saves says so, and creates nothing.
  const spaces = cloud.spaces.size;
  await typeIntoJoinField(b, "ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ");
  await press(b, SYNC_DATA, "join-go");
  await waitForSyncText(b, "didn't match any synced saves");
  expect(cloud.spaces.size).toBe(spaces);
  expect(await storedSyncCode(b)).toBeNull();

  // The right code, grouped as shown, joins.
  await typeIntoJoinField(b, code.match(/.{5}/g)!.join("-"));
  await press(b, SYNC_DATA, "join-go");
  await waitForSyncText(b, "Sync is on");
  expect(await storedSyncCode(b)).toBe(code);
  await press(b, SYNC_DATA, "sync:now");
  await waitFor(async () => ((await deckNames(b)).includes("Web Slinger Deck") ? true : null), "A's deck arrived on B");
  await waitForSyncText(b, "Status: Synced");

  // B's Title reads its saves again after the sync: Continue is there without a reload.
  await clickStop(b, "back", SYNC_DATA);
  await settle(b);
  await pressKey(b, "Escape");
  await waitFor(
    async () => ((await routeStops(b, "Title"))?.stops.some((s) => s.key === "continue") ? true : null),
    "B's Title offers Continue for A's game",
  );
  expect(await gameCount(b)).toBe(1);

  // Unlink on B: the code goes, the saves stay, the status is Off.
  await openSyncScreen(b);
  await press(b, SYNC_DATA, "sync:unlink");
  // Unlink asks first, and suggests looking at the recovery code.
  await waitForSyncText(b, "Unlink this device?");
  await waitForSyncText(b, "Show recovery code first");
  await press(b, SYNC_DATA, "confirm-unlink");
  await waitForSyncText(b, "Sync is off");
  expect(await storedSyncCode(b)).toBeNull();
  expect(await deckNames(b)).toContain("Web Slinger Deck");
  expect(await gameCount(b)).toBe(1);
  expect(errors).toEqual([]);
  await b.context().close();
});

test("a game both browsers changed asks which copy to keep", async ({ page, context, browser }, info) => {
  test.setTimeout(300_000);
  const phone = info.project.name === "phone";
  await page.setViewportSize(phone ? { width: 375, height: 812 } : { width: 1280, height: 800 });
  const errors = trackPageErrors(page);
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await settle(page);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30000);
  await openSyncScreen(page);
  await press(page, SYNC_DATA, "sync:setup");
  await waitForSyncText(page, "Your recovery code");
  const code = (await waitFor(async () => storedSyncCode(page), "the code is saved"))!;
  await press(page, SYNC_DATA, "ack");
  await waitForSyncText(page, "Status: Synced");

  const b = await newDevice(browser, page);
  await cloud.install(b.context());
  await openApp(b);
  await openSyncScreen(b);
  await press(b, SYNC_DATA, "sync:join");
  await typeIntoJoinField(b, code);
  await press(b, SYNC_DATA, "join-go");
  await waitForSyncText(b, "Status: Synced");
  await waitFor(async () => ((await gameCount(b)) === 1 ? true : null), "the game arrived on B");

  // Each plays on from the same point, differently.
  await appendCommand(page, "play-on-a");
  await appendCommand(b, "play-on-b");
  await press(page, SYNC_DATA, "sync:now");
  await waitForSyncText(page, "Status: Synced");

  await press(b, SYNC_DATA, "sync:now");
  await waitForScene(b, "SyncConflictOverlay");
  await waitForSyncText(b, "Which copy do you want to keep?", "SyncConflictOverlay");
  await waitForSyncText(b, "This device", "SyncConflictOverlay");
  await waitForSyncText(b, "The other device", "SyncConflictOverlay");
  await syncStop(b, "SyncConflictOverlay", "keep-both");
  await shot(b, phone, "6-conflict");
  await clickStop(b, "keep-both", "SyncConflictOverlay");
  await waitFor(async () => ((await activeScenes(b)).includes("SyncConflictOverlay") ? null : true), "prompt closed");
  // Keep both: the other device's game is kept as a second saved game.
  await waitFor(async () => ((await gameCount(b)) === 2 ? true : null), "both copies are on B");
  expect(errors).toEqual([]);
  await b.context().close();
});
