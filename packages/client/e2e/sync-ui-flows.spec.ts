import { expect, test, type Browser, type Page } from "@playwright/test";
import { activeScenes, hasText, installPageHelpers, pressAt, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp, quietGuide, startGame } from "./wave6-helpers-b.js";
import {
  SYNC_DATA,
  appendCommand,
  fakeSyncServer,
  gameCount,
  gameIds,
  openSyncScreen,
  storedSyncCode,
  syncStop,
  typeIntoJoinField,
  waitForSyncText,
} from "./sync-ui-helpers.js";

/**
 * Device sync flows around the screens (#276): a scanned #link= opens the join question and joins nothing by itself;
 * Continue with sync on says it is checking; a conflict raised while a game is on the table waits until the player leaves.
 */

const KEY = "K".repeat(22);

async function press(page: Page, scene: string, key: string): Promise<void> {
  await syncStop(page, scene, key);
  await clickStop(page, key, scene);
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

test("opening a #link= address asks before joining, asks nothing of the service, and clears the hash", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await installPageHelpers(page);
  await quietGuide(page);
  await page.goto(`/?unlock=all#link=ABCDEFGH.${KEY}`);
  await waitForScene(page, SYNC_DATA, 30000);
  await waitForSyncText(page, "Join this device to your synced saves?");
  expect(await page.evaluate(() => location.hash)).toBe("");
  await settle(page, { quietMs: 500, maxMs: 2500 });
  expect(
    cloud.requests.filter((r) => r.includes("/sync/")),
    "nothing joins by itself",
  ).toEqual([]);
  expect(await storedSyncCode(page)).toBeNull();

  // Join asks the room; the stand-in has no such room, so the player is told the link is no good, and nothing syncs.
  await press(page, SYNC_DATA, "join-link");
  await waitForSyncText(page, "expired or was already used");
  expect(await storedSyncCode(page)).toBeNull();
  expect(errors).toEqual([]);
});

test("Continue with sync on says it is checking the other devices", async ({ page, context }) => {
  test.setTimeout(180_000);
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
  await press(page, SYNC_DATA, "ack");
  await waitForSyncText(page, "Status: Synced");
  await clickStop(page, "back", SYNC_DATA);
  await settle(page);
  // Escape backs out one overlay at a time: until Settings is gone.
  await waitFor(
    async () => {
      if (!(await activeScenes(page)).includes("SettingsOverlay")) return true;
      await page.keyboard.press("Escape");
      return null;
    },
    "Settings closed",
    15000,
  );

  cloud.latencyMs = 700;
  const row = await waitFor(
    async () => (await routeStops(page, "Title"))?.stops.find((s) => s.key === "continue")?.rect ?? null,
    "Continue",
  );
  await pressAt(page, row.x + row.width / 2, row.y + row.height / 2);
  await waitFor(
    async () => ((await hasText(page, "Checking your other devices", "SyncPrompt")) ? true : null),
    "the busy line",
    10000,
  );
  cloud.latencyMs = 0;
  // A game still in its mulligans resumes on the deal screen.
  await waitFor(
    async () => ((await activeScenes(page)).some((s) => s === "Board" || s === "SetupDeal") ? true : null),
    "the game opened",
    30000,
  );
  expect(errors).toEqual([]);
});

test("a conflict about another game waits while a game is on the table, then asks once the player leaves", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(300_000);
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
  const [shared] = await gameIds(b);

  // Both play the shared game on; then B opens a different game and sits at its table.
  await appendCommand(page, "play-on-a");
  await appendCommand(b, "play-on-b", shared);
  await press(page, SYNC_DATA, "sync:now");
  await waitForSyncText(page, "Status: Synced");
  await clickStop(b, "back", SYNC_DATA);
  await settle(b);
  await b.keyboard.press("Escape");
  await startGame(b, { scenarioId: "klaw", decks: ["core-she-hulk-aggression"], seed: 5 });
  // The helper stops every scene to jump to the Board, the watcher included; a real game never does.
  await b.evaluate(() =>
    (window as unknown as { __mcGame: { scene: { run: (k: string) => void } } }).__mcGame.scene.run("SyncPrompt"),
  );
  await settle(b);

  // Syncing from the table: the shared game's question is put off, not asked over the board.
  await b.evaluate(async () => {
    const wiring = (await import("/src/sync/sync-wiring.ts")) as unknown as {
      syncService: () => { syncNow: () => Promise<unknown> };
    };
    await wiring.syncService().syncNow();
  });
  await settle(b, { quietMs: 600, maxMs: 3000 });
  expect(await activeScenes(b)).toContain("Board");
  expect(await activeScenes(b)).not.toContain("SyncConflictOverlay");

  // Leaving the table raises it.
  await b.evaluate(() => {
    const game = (
      window as unknown as { __mcGame: { scene: { stop: (k: string) => void; start: (k: string) => void } } }
    ).__mcGame;
    game.scene.stop("Board");
    game.scene.start("Title");
  });
  await waitForScene(b, "SyncConflictOverlay", 30000);
  await waitForSyncText(b, "Which copy do you want to keep?", "SyncConflictOverlay");
  await clickStop(b, "keep-local", "SyncConflictOverlay");
  await waitFor(async () => ((await activeScenes(b)).includes("SyncConflictOverlay") ? null : true), "prompt closed");
  expect(await hasText(b, "Which copy", "SyncConflictOverlay")).toBe(false);
  expect(errors).toEqual([]);
  await b.context().close();
});
