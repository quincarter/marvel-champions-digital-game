import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, trackPageErrors, waitFor } from "./helpers.js";
import { clickStop, routeStops, waitForScene } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame } from "./wave6-helpers-b.js";

/**
 * Controller gaps from #735.
 *
 * On a replay, the d-pad's down pauses it and hands the pad to the table: the d-pad moves the focus, Y inspects, and
 * nothing the table does moves the replay on. B gives the pad back to the bar (which then plays on A) without leaving.
 *
 * On the table of a game, the dark mode button is a stop on the focus route, and A flips the theme. On a screen where it
 * floats alone at the top centre, it is off the route (Tab never walks to it), and Up from the top reaches it.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const A = 0;
const B = 1;
const Y = 3;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const SHOTS = process.env.SHOT_DIR ?? "";

interface ReplayState {
  position: number;
  playing: boolean;
  inspecting: boolean;
}

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const button = () => ({ pressed: false, touched: false, value: 0 });
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, button),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        pad.timestamp = performance.now();
        return [pad];
      },
      configurable: true,
    });
  }, PAD_ID);
}

async function setButton(page: Page, index: number, on: boolean): Promise<void> {
  await page.evaluate(
    ([i, down]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: down, touched: down, value: down ? 1 : 0 };
    },
    [index, on] as const,
  );
}

/** Holds a button until `done` is true (the pad is read once a frame), then lets it go. */
async function tap(page: Page, index: number, done: () => Promise<boolean>): Promise<void> {
  await setButton(page, index, true);
  for (let i = 0; i < 30 && !(await done()); i += 1) await page.waitForTimeout(100);
  await setButton(page, index, false);
  await page.waitForTimeout(250);
}

const replayState = (page: Page): Promise<ReplayState | null> =>
  page.evaluate(
    () => (window as unknown as { __mcReplayDebug?: { state(): ReplayState } }).__mcReplayDebug?.state() ?? null,
  );

const focusedKey = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug?: { focusedKey(): string | null } }).__mcBoardDebug?.focusedKey() ?? null,
  );

const scheme = (page: Page): Promise<string> =>
  page.evaluate(() =>
    (window as unknown as { __mcThemeButtonDebug: { scheme(): string } }).__mcThemeButtonDebug.scheme(),
  );

/** `startGame` stops every running scene: the top bar's buttons come back as Boot launches them. */
async function runChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    const game = (window as unknown as { __mcGame: { scene: { run(key: string): void } } }).__mcGame;
    for (const key of ["ReportButton", "MusicButton", "LanguageButton", "ThemeButton"]) game.scene.run(key);
  });
  await page.waitForTimeout(500);
}

async function isActive(page: Page, scene: string): Promise<boolean> {
  return (await activeScenes(page)).includes(scene);
}

async function savedGames(page: Page): Promise<{ id: string; commandCount: number }[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<{ id: string; commandCount: number; createdAt: number }[]>((resolve) => {
      const request = db.transaction("games").objectStore("games").getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return all.sort((a, b) => a.createdAt - b.createdAt).map(({ id, commandCount }) => ({ id, commandCount }));
  });
}

/** Ends a saved game as a win, as the engine's last write would, so the games list offers its replay. */
async function markWon(page: Page, id: string): Promise<void> {
  await page.evaluate(async (gameId) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mc-saves", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const game = await new Promise<Record<string, unknown>>((resolve) => {
      const request = store.get(gameId);
      request.onsuccess = () => resolve(request.result);
    });
    store.put({ ...game, status: "won", outcome: { result: "win", reason: "villainDefeated" } });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, id);
}

test("on a replay the d-pad's down looks around the table read-only, and B gives the pad back to the bar", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the controller's case");
  test.setTimeout(300_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 43523 });
  await declineMulligans(page);
  await settle(page);
  const [game] = await savedGames(page);
  expect(game, "a game was saved").toBeTruthy();
  await markWon(page, game!.id);
  await page.goto("/?unlock=all");
  await waitForScene(page, "Title", 30000);
  await settle(page, { quietMs: 500, maxMs: 3000 });

  await clickStop(page, "past-games", "Title");
  await waitForScene(page, "PastGames");
  await waitFor(
    async () => ((await routeStops(page, "PastGames"))?.stops.some((s) => s.key === "action:watch") ? true : null),
    "the watch action",
  );
  await clickStop(page, "action:watch", "PastGames");
  await waitFor(() => replayState(page), "the replay opens on the board", 30000);
  await settle(page, { quietMs: 500, maxMs: 3000 });
  const at = (await replayState(page))!.position;

  // Down on the d-pad: paused, the bar's controls gone, and the table has the pad.
  await tap(page, DPAD_DOWN, async () => (await replayState(page))?.inspecting === true);
  expect(await replayState(page)).toMatchObject({ inspecting: true, playing: false });
  let moved = false;
  for (const button of [DPAD_RIGHT, DPAD_LEFT, DPAD_DOWN]) {
    if ((await focusedKey(page)) !== null) break;
    await tap(page, button, async () => (await focusedKey(page)) !== null);
  }
  const first = await focusedKey(page);
  expect(first, "the d-pad moves the focus on the table").not.toBeNull();
  await tap(page, DPAD_RIGHT, async () => (await focusedKey(page)) !== first);
  moved = (await focusedKey(page)) !== first;
  if (!moved) await tap(page, DPAD_LEFT, async () => (await focusedKey(page)) !== first);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/replay-inspect-desktop.png` });

  // Y reads the focused card where it is one; B closes it and the table keeps the pad.
  for (let i = 0; i < 12 && !(await focusedKey(page))?.startsWith("card:"); i += 1) {
    const before = await focusedKey(page);
    await tap(page, DPAD_RIGHT, async () => (await focusedKey(page)) !== before);
  }
  if ((await focusedKey(page))?.startsWith("card:")) {
    // A quick press: a held Y zooms instead.
    await setButton(page, Y, true);
    await page.waitForTimeout(120);
    await setButton(page, Y, false);
    await waitFor(async () => ((await isActive(page, "InspectOverlay")) ? true : null), "Y opens Inspect", 10_000);
    await tap(page, B, async () => !(await isActive(page, "InspectOverlay")));
    expect(await replayState(page)).toMatchObject({ inspecting: true });
    // A reads it too, a card in hand included (the read-only table plays nothing).
    await tap(page, A, () => isActive(page, "InspectOverlay"));
    expect(await isActive(page, "InspectOverlay")).toBe(true);
    await tap(page, B, async () => !(await isActive(page, "InspectOverlay")));
    expect(await replayState(page)).toMatchObject({ inspecting: true });
  }
  // Nothing on the table moved the replay.
  expect((await replayState(page))!.position).toBe(at);

  // B: the bar is back, the replay still open; A on the bar plays.
  await tap(page, B, async () => (await replayState(page))?.inspecting === false);
  expect(await replayState(page)).toMatchObject({ inspecting: false });
  expect(await isActive(page, "ReplayTransportOverlay")).toBe(true);
  expect(await focusedKey(page)).toBeNull();
  await tap(page, A, async () => (await replayState(page))?.playing === true);
  expect((await replayState(page))!.playing).toBe(true);
  expect(errors).toEqual([]);
});

test("on the table the dark mode button is a stop, and A flips the theme", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the controller's case");
  test.setTimeout(200_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await runChrome(page);
  await declineMulligans(page);
  await settle(page, { quietMs: 600, maxMs: 5000 });
  // Tab walks the table's route to the top bar's dark mode button, just before the music note.
  for (let i = 0; i < 80 && (await focusedKey(page)) !== "theme"; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(60);
  }
  expect(await focusedKey(page)).toBe("theme");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/board-theme-focus-desktop.png` });
  const before = await scheme(page);
  await tap(page, A, async () => (await scheme(page)) !== before);
  expect(await scheme(page)).not.toBe(before);
  expect(await focusedKey(page)).toBe("theme");
  await tap(page, A, async () => (await scheme(page)) === before);
  expect(errors).toEqual([]);
});

test("where the dark mode button floats alone, Up from the top reaches it and A flips the theme; Tab never does", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the controller's case");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await installPad(page);
  await page.goto("/?screen=scenario-select&unlock=all");
  await page.waitForFunction(
    () =>
      (window as unknown as { __mcFocusRoutes?: Record<string, unknown> }).__mcFocusRoutes?.ScenarioSelect !==
      undefined,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1500);
  // The pad's first press wakes it (glyphs and focus), as a player's first press does.
  await setButton(page, DPAD_DOWN, true);
  await page.waitForTimeout(120);
  await setButton(page, DPAD_DOWN, false);
  // The "controller connected" notice drops over the top bar for a few seconds, and the button waits under it.
  await page.waitForTimeout(5500);
  const focus = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __mcFocusState?: Record<string, () => { focus: string | null }> }
        ).__mcFocusState?.ScenarioSelect?.().focus ?? null,
    );
  const route = await page.evaluate(() =>
    (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string }[]> }).__mcFocusRoutes
      .ScenarioSelect!().map((stop) => stop.key),
  );
  expect(route).not.toContain("chrome:theme");
  for (let i = 0; i < 12 && (await focus()) !== "chrome:theme"; i += 1) {
    const before = await focus();
    await setButton(page, DPAD_UP, true);
    await page.waitForTimeout(120);
    await setButton(page, DPAD_UP, false);
    await page.waitForTimeout(150);
    if ((await focus()) === before) {
      await setButton(page, DPAD_RIGHT, true);
      await page.waitForTimeout(120);
      await setButton(page, DPAD_RIGHT, false);
      await page.waitForTimeout(150);
    }
  }
  expect(await focus()).toBe("chrome:theme");
  const before = await scheme(page);
  await tap(page, A, async () => (await scheme(page)) !== before);
  expect(await scheme(page)).not.toBe(before);
  // Down goes back to the screen.
  await setButton(page, DPAD_DOWN, true);
  await page.waitForTimeout(120);
  await setButton(page, DPAD_DOWN, false);
  await page.waitForTimeout(200);
  expect(await focus()).not.toBe("chrome:theme");
  expect(errors).toEqual([]);
});
