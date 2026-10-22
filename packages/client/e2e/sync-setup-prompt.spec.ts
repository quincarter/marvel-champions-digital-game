import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, hasText, isSceneUp, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp, startGame } from "./wave6-helpers-b.js";
import { KEY_PART, ROOM } from "./save-transfer-helpers.js";
import { SYNC_DATA, fakeSyncServer, storedSyncCode, syncStop, waitForSyncText } from "./sync-ui-helpers.js";

/**
 * The one-time "Set up cross-device sync?" prompt (#276, step 2) over Title, against the fake sync Worker. Title makes
 * the call itself (`maybeShowSyncSetupPrompt`), so these specs only arrange the device and load Title.
 * `SHOT_DIR` saves screenshots.
 */

const PROMPT = "SyncSetupPromptOverlay";
const NOTICE = "SyncSetupNotice";
const CONFLICT = "SyncConflictOverlay";
const SETTINGS = "SettingsOverlay";
const SHOTS = process.env.SHOT_DIR ?? "";

async function shot(page: Page, phone: boolean, name: string): Promise<void> {
  if (!SHOTS) return;
  await settle(page, { quietMs: 400, maxMs: 2500 });
  await page.screenshot({ path: `${SHOTS}/prompt-${phone ? "phone-375x812" : "desktop-1280x800"}-${name}.png` });
}

const viewportOf = (phone: boolean) => (phone ? { width: 375, height: 812 } : { width: 1280, height: 800 });

let loads = 0;

/** Loads Title afresh (the page keeps its storage), with an optional hash. */
async function loadTitle(page: Page, hash = ""): Promise<void> {
  // A fresh query each time, so a hash-only difference is still a new page load.
  await page.goto(`/?unlock=all&load=${++loads}${hash}`);
  await waitForScene(page, "Title", 30000);
}

/** One saved game on a device whose Title has not been shown since. */
async function seedSavedGame(page: Page): Promise<void> {
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await settle(page);
}

const marker = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const promptedMarker = (page: Page) => marker(page, "mcsync.prompted");
const seenMarker = (page: Page) => marker(page, "mcsync.seen");

async function waitForPrompt(page: Page): Promise<void> {
  await waitFor(async () => ((await activeScenes(page)).includes(PROMPT) ? true : null), "the prompt is up", 20000);
  await settle(page, { quietMs: 300, maxMs: 2000 });
}

/** Long enough for Title's checks (storage reads and the status probe) to have finished and acted. */
const quiet = (page: Page) => settle(page, { quietMs: 1500, maxMs: 6000 });

const stopRect = (page: Page, key: string, scene = PROMPT) =>
  waitFor(
    async () => (await routeStops(page, scene))?.stops.find((s) => s.key === key)?.rect ?? null,
    `${scene} control ${key}`,
    10000,
  );

async function press(page: Page, phone: boolean, key: string, scene = PROMPT): Promise<void> {
  const rect = await stopRect(page, key, scene);
  const at = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (phone) await page.touchscreen.tap(at.x, at.y);
  else await clickStop(page, key, scene);
}

const gone = (page: Page, scene: string, label: string) =>
  waitFor(async () => (!(await activeScenes(page)).includes(scene) ? true : null), label, 10000);

test("a returning player is asked once; Not now shows the notice, taps pass through it, and it never comes back", async ({
  page,
  context,
}, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await page.setViewportSize(viewportOf(phone));
  const errors = trackPageErrors(page);
  await fakeSyncServer().install(context);
  await seedSavedGame(page);
  expect(await promptedMarker(page)).toBeNull();
  await loadTitle(page);
  await waitForPrompt(page);

  expect(await hasText(page, "Set up cross-device sync?", PROMPT)).toBe(true);
  expect(
    await hasText(page, "You can set this up any time in Settings → More → Save data → Sync across devices.", PROMPT),
  ).toBe(true);
  for (const label of ["Set up", "Join with a code", "Not now"]) expect(await hasText(page, label, PROMPT)).toBe(true);
  expect(await seenMarker(page), "the first-launch chance is spent once the prompt has launched").not.toBeNull();
  await shot(page, phone, "1-prompt");

  await press(page, phone, "not-now");
  await waitFor(async () => ((await activeScenes(page)).includes(NOTICE) ? true : null), "the notice shows", 10000);
  await gone(page, PROMPT, "the prompt closes");
  expect(await hasText(page, "Cross-device sync is off", NOTICE)).toBe(true);
  expect(await hasText(page, "Settings → More → Save data", NOTICE)).toBe(true);
  expect(await promptedMarker(page)).not.toBeNull();
  expect(await storedSyncCode(page)).toBeNull();
  await shot(page, phone, "2-notice");

  // The notice takes no input: a tap on Title's Settings row, which it covers on a wide screen, reaches Title.
  await clickText(page, "SETTINGS", { sceneKey: "Title", until: () => isSceneUp(page, SETTINGS) });
  expect(await activeScenes(page)).toContain(NOTICE);

  await loadTitle(page);
  await quiet(page);
  expect(await activeScenes(page)).not.toContain(PROMPT);
  expect(errors).toEqual([]);
});

test("a brand-new player is not asked, even though Title and the toast write their own bookkeeping", async ({
  page,
  context,
}, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize(viewportOf(info.project.name === "phone"));
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await openApp(page);
  await quiet(page);
  await loadTitle(page);
  await quiet(page);
  expect(await activeScenes(page)).not.toContain(PROMPT);
  expect(await promptedMarker(page)).toBeNull();
  // Nothing was due, so the probe was never made and nothing was spent.
  expect(cloud.requests.filter((r) => r.includes("/sync/"))).toEqual([]);
  expect(await seenMarker(page)).toBeNull();
});

test("an existing player with progress but no saved game is asked once, then never", async ({
  page,
  context,
}, info) => {
  test.setTimeout(150_000);
  const phone = info.project.name === "phone";
  await page.setViewportSize(viewportOf(phone));
  await fakeSyncServer().install(context);
  await openApp(page);
  await quiet(page);
  await page.evaluate(() => localStorage.setItem("mc-unlocks", JSON.stringify({ version: 1 })));
  await loadTitle(page);
  await waitForPrompt(page);
  await press(page, phone, "not-now");
  await waitFor(async () => ((await activeScenes(page)).includes(NOTICE) ? true : null), "the notice shows", 10000);
  await loadTitle(page);
  await quiet(page);
  expect(await activeScenes(page)).not.toContain(PROMPT);
});

test("Escape closes the prompt as Not now", async ({ page, context }, info) => {
  test.skip(info.project.name === "phone", "keyboard case");
  test.setTimeout(180_000);
  await page.setViewportSize(viewportOf(false));
  await fakeSyncServer().install(context);
  await seedSavedGame(page);
  await loadTitle(page);
  await waitForPrompt(page);
  await pressKey(page, "Escape");
  await waitFor(async () => ((await activeScenes(page)).includes(NOTICE) ? true : null), "the notice shows", 10000);
  expect(await promptedMarker(page)).not.toBeNull();
});

test("the prompt holds Title's keys, and a conflict raised meanwhile keeps its own", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === "phone", "keyboard case");
  test.setTimeout(180_000);
  await page.setViewportSize(viewportOf(false));
  const errors = trackPageErrors(page);
  await fakeSyncServer().install(context);
  await seedSavedGame(page);
  await loadTitle(page);
  await waitForPrompt(page);

  // A conflict prompt over the setup prompt: Tab then Enter answer it (its default, Keep both), not the question.
  await page.evaluate(() => {
    const w = window as unknown as {
      __answers: string[];
      __mcGame: { scene: { getScene: (k: string) => { scene: { launch: (k: string, d: unknown) => void } } } };
    };
    w.__answers = [];
    w.__mcGame.scene.getScene("Title").scene.launch("SyncConflictOverlay", {
      pending: {
        conflict: {
          gameId: "g1",
          label: "Rhino · Spider-Man",
          local: { round: 3, updatedAt: Date.now() - 60_000 },
          remote: { round: 4, updatedAt: Date.now() - 30_000 },
          campaign: false,
        },
        answer: (choice: string) => w.__answers.push(choice),
      },
    });
  });
  await waitFor(async () => ((await activeScenes(page)).includes(CONFLICT) ? true : null), "the conflict is up", 10000);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  await pressKey(page, "Tab");
  await pressKey(page, "Enter");
  await waitFor(
    async () => {
      const answers = await page.evaluate(() => (window as unknown as { __answers: string[] }).__answers);
      return answers.length > 0 ? answers : null;
    },
    "the conflict took the keys",
    10000,
  );
  await gone(page, CONFLICT, "the conflict closes");
  expect(await activeScenes(page)).toContain(PROMPT);
  expect(await promptedMarker(page), "the question was not answered by those keys").toBeNull();

  // With the conflict gone the question has the keys again: Tab then Enter is Set up.
  await pressKey(page, "Tab");
  await pressKey(page, "Enter");
  await waitForScene(page, SYNC_DATA);
  await waitForSyncText(page, "Your recovery code");
  expect(await activeScenes(page)).not.toContain(SETTINGS);
  expect(errors).toEqual([]);
});

test("Set up shows the recovery code to acknowledge; Join opens the join field", async ({ page, context }, info) => {
  test.setTimeout(180_000);
  const phone = info.project.name === "phone";
  await page.setViewportSize(viewportOf(phone));
  const errors = trackPageErrors(page);
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await seedSavedGame(page);
  await loadTitle(page);
  await waitForPrompt(page);

  // Join first: backing out of it brings the question back, since sync is still off.
  await press(page, phone, "join");
  await waitForScene(page, SYNC_DATA);
  await waitForSyncText(page, "Join with a recovery code");
  await shot(page, phone, "3-join");
  await syncStop(page, SYNC_DATA, "join-go");
  await press(page, phone, "back-menu", SYNC_DATA);
  await waitForSyncText(page, "Sync is off");
  await press(page, phone, "back", SYNC_DATA);
  await gone(page, SYNC_DATA, "sync screen closes");
  await waitForPrompt(page);
  expect(await hasText(page, "Set up cross-device sync?", PROMPT)).toBe(true);

  await press(page, phone, "set-up");
  await waitForScene(page, SYNC_DATA);
  await waitForSyncText(page, "Your recovery code");
  const code = await waitFor(async () => storedSyncCode(page), "the recovery code is saved");
  expect(code).toMatch(/^[2-9A-HJKMNP-Z]{25}$/);
  await waitForSyncText(page, code!.match(/.{5}/g)!.join("-"));
  expect(cloud.spaces.size).toBe(1);
  await shot(page, phone, "4-setup-code");
  // Not dismissable until the code is acknowledged.
  await pressKey(page, "Escape");
  await settle(page, { quietMs: 300, maxMs: 1500 });
  expect(await hasText(page, "Your recovery code", SYNC_DATA)).toBe(true);

  await press(page, phone, "ack", SYNC_DATA);
  await waitForSyncText(page, "Sync is on");
  await press(page, phone, "back", SYNC_DATA);
  await gone(page, SYNC_DATA, "sync screen closes");
  await gone(page, PROMPT, "the prompt closes");
  expect(await promptedMarker(page)).not.toBeNull();
  expect(errors).toEqual([]);
});

test("no prompt, and nothing spent, when online sync is down or switched off (503)", async ({
  page,
  context,
}, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize(viewportOf(info.project.name === "phone"));
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await seedSavedGame(page);

  cloud.down = true;
  await loadTitle(page);
  await quiet(page);
  expect(await activeScenes(page)).not.toContain(PROMPT);

  cloud.down = false;
  cloud.disabled = true;
  await loadTitle(page);
  await quiet(page);
  expect(await activeScenes(page)).not.toContain(PROMPT);
  expect(cloud.requests).toContain("GET /sync/status");
  expect(await promptedMarker(page)).toBeNull();
  expect(await seenMarker(page)).toBeNull();

  // Sync came back: the next launch asks.
  cloud.disabled = false;
  await loadTitle(page);
  await waitForPrompt(page);
});

test("the prompt stays away from a link's Settings and from anything else over Title, and spends nothing", async ({
  page,
  context,
}, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize(viewportOf(info.project.name === "phone"));
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await seedSavedGame(page);

  // Settings opened by a scanned #link= and by a #receive= link.
  await loadTitle(page, `#link=${ROOM}.${"a".repeat(22)}`);
  await waitFor(async () => (await isSceneUp(page, SETTINGS)) || null, "Settings opens for the link", 15000);
  await quiet(page);
  expect(await activeScenes(page)).not.toContain(PROMPT);
  await loadTitle(page, `#receive=${ROOM}.${KEY_PART}`);
  await waitFor(async () => (await isSceneUp(page, SETTINGS)) || null, "Settings opens for the link", 15000);
  await quiet(page);
  expect(await activeScenes(page)).not.toContain(PROMPT);
  expect(await seenMarker(page)).toBeNull();

  // Something opens over Title while the checks are still running (a slow Worker): the moment has passed.
  cloud.latencyMs = 3000;
  await loadTitle(page);
  await page.evaluate(() => {
    const w = window as unknown as {
      __mcGame: { scene: { getScene: (k: string) => { scene: { launch: (k: string) => void } } } };
    };
    w.__mcGame.scene.getScene("Title").scene.launch("SettingsOverlay");
  });
  await waitFor(async () => (await isSceneUp(page, SETTINGS)) || null, "an overlay is up over Title", 15000);
  await settle(page, { quietMs: 5000, maxMs: 9000 });
  expect(await activeScenes(page)).not.toContain(PROMPT);
  expect(await seenMarker(page), "the chance was not spent").toBeNull();
  expect(await promptedMarker(page)).toBeNull();
});

/** One finger pressed at `from`, dragged to `to` in small steps and lifted there. */
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

test("a swipe that lifts over Set up, Join or Not now presses nothing", async ({ page, context }, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  test.setTimeout(180_000);
  await page.setViewportSize(viewportOf(true));
  const errors = trackPageErrors(page);
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await seedSavedGame(page);
  await loadTitle(page);
  await waitForPrompt(page);

  for (const key of ["set-up", "join", "not-now"]) {
    const rect = await stopRect(page, key);
    const at = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    // Up from well below the control (inside the panel's scrim at least), lifting on the button.
    await touchSwipe(page, { x: at.x, y: Math.min(at.y + 90, 800) }, at);
    await settle(page, { quietMs: 400, maxMs: 2000 });
    const scenes = await activeScenes(page);
    expect(scenes, `a swipe lifting on ${key} leaves the prompt up`).toContain(PROMPT);
    expect(scenes).not.toContain(SYNC_DATA);
    expect(scenes).not.toContain(NOTICE);
    expect(await promptedMarker(page), `nothing was answered by the swipe on ${key}`).toBeNull();
  }
  expect(cloud.requests.filter((r) => r.includes("/sync/") && r !== "GET /sync/status")).toEqual([]);
  expect(await storedSyncCode(page)).toBeNull();

  // A real tap on Not now still works.
  await press(page, true, "not-now");
  await waitFor(async () => ((await activeScenes(page)).includes(NOTICE) ? true : null), "the notice shows", 10000);
  expect(errors).toEqual([]);
});
