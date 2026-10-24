import { expect, test, type Page } from "@playwright/test";
import { findText, installPageHelpers } from "./helpers.js";

/**
 * Cross-screen controller and keyboard focus: the music note and the bug are D-pad stops on every screen, LB / RB switch
 * Settings' tabs, the focus ring hides when the mouse takes over, and the music player answers the pad.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const B = 1;
const A = 0;
const LB = 4;
const RB = 5;
const START = 9;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_RIGHT = 15;

interface FocusState {
  focus: string | null;
  ringShown: boolean;
  ringRect: { x: number; y: number; width: number; height: number } | null;
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

/** Holds a button until `done` is true (the pad is read once a frame, and a loaded runner can run none in a short press). */
async function tap(page: Page, index: number, done?: () => Promise<boolean>, pollMs = 100): Promise<void> {
  await setButton(page, index, true);
  if (!done) await page.waitForTimeout(500);
  else {
    for (let i = 0; i < 3000 / pollMs; i += 1) {
      await page.waitForTimeout(pollMs);
      if (await done()) break;
    }
  }
  await setButton(page, index, false);
  await page.waitForTimeout(250);
}

/** One D-pad step: holds the button until the focus changes, in the page itself (frame by frame), so a held direction never repeats. */
async function stepPad(page: Page, index: number, scene: string): Promise<string[]> {
  const visited = await page.evaluate(
    ([i, key]) =>
      new Promise<string[]>((resolve) => {
        const w = window as unknown as {
          __fakePad: { buttons: unknown[] };
          __mcFocusState: Record<string, () => { focus: string | null }>;
        };
        const was = w.__mcFocusState[key as string]!().focus;
        const set = (on: boolean) =>
          (w.__fakePad.buttons[i as number] = { pressed: on, touched: on, value: on ? 1 : 0 });
        set(true);
        const seen: string[] = [];
        const start = performance.now();
        const frame = () => {
          const now = w.__mcFocusState[key as string]!().focus;
          if (now && now !== was && !seen.includes(now)) seen.push(now);
          if (now !== was || performance.now() - start > 3000) {
            set(false);
            resolve(seen);
          } else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    [index, scene] as const,
  );
  await page.waitForTimeout(250);
  return visited;
}

const stateOf = (page: Page, scene: string): Promise<FocusState | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState?: Record<string, () => FocusState> }).__mcFocusState?.[key]?.() ?? null,
    scene,
  );

const isActive = (page: Page, scene: string): Promise<boolean> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcGame: { scene: { isActive(k: string): boolean } } }).__mcGame.scene.isActive(key),
    scene,
  );

async function openTitle(page: Page, path = "/"): Promise<void> {
  await installPad(page);
  await page.goto(path);
  await page.waitForFunction(
    () => (window as unknown as { __mcFocusRoutes?: object }).__mcFocusRoutes !== undefined,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1500);
}

/** The "Controller connected" toast hides the top-bar buttons for a few seconds: wait for the note's stop to be on the route. */
async function waitForChrome(page: Page, scene: string): Promise<void> {
  await page.waitForFunction(
    (key) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string }[]> }).__mcFocusRoutes[key]?.().some(
        (stop) => stop.key === "chrome:music",
      ),
    scene,
    { timeout: 30_000 },
  );
}

async function stopRect(
  page: Page,
  scene: string,
  key: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const rect = await page.evaluate(
    ([s, k]) =>
      (
        window as unknown as {
          __mcFocusRoutes: Record<
            string,
            () => { key: string; rect: { x: number; y: number; width: number; height: number } }[]
          >;
        }
      ).__mcFocusRoutes[s!]!().find((stop) => stop.key === k)?.rect,
    [scene, key] as const,
  );
  if (!rect) throw new Error(`no stop ${key} in ${scene}`);
  return rect;
}

test("the music note is reachable by the D-pad from Title, and A opens the player, B closes it", async ({ page }) => {
  await openTitle(page);
  await waitForChrome(page, "Title");
  const focusOf = async () => (await stateOf(page, "Title"))?.focus ?? null;
  // The keyboard walks down to the first button (a held D-pad repeats, so it is not used to count steps).
  for (let i = 0; i < 5 && (await focusOf()) !== "new-game"; i += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(150);
  }
  expect(await focusOf()).toBe("new-game");
  // Up from the first button reaches the note in a press or two.
  const seen: string[] = [];
  for (let i = 0; i < 3 && !seen.includes("chrome:music"); i += 1)
    seen.push(...(await stepPad(page, DPAD_UP, "Title")));
  expect(seen).toContain("chrome:music");
  // The keyboard settles on the note, and the pad presses it.
  for (let i = 0; i < 4 && (await focusOf()) !== "chrome:music"; i += 1) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
  }
  expect(await focusOf()).toBe("chrome:music");
  await tap(page, A, () => isActive(page, "MusicPlayerOverlay"));
  await page.waitForTimeout(400);
  expect(await isActive(page, "MusicPlayerOverlay")).toBe(true);
  // Nothing reaches Title behind it.
  const before = (await stateOf(page, "Title"))?.focus;
  await tap(page, DPAD_DOWN);
  expect((await stateOf(page, "Title"))?.focus).toBe(before);
  await tap(page, B, async () => !(await isActive(page, "MusicPlayerOverlay")));
  expect(await isActive(page, "MusicPlayerOverlay")).toBe(false);
});

test("the music player: RB changes the track, B closes it", async ({ page }) => {
  await openTitle(page, "/?unlock=all");
  await page.evaluate(() =>
    (window as unknown as { __mcGame: { scene: { getScene(k: string): { togglePlayer(): void } } } }).__mcGame.scene
      .getScene("MusicButton")
      .togglePlayer(),
  );
  await page.waitForTimeout(500);
  expect(await isActive(page, "MusicPlayerOverlay")).toBe(true);
  const playing = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __mcMusicPlayerDebug?: { nowPlaying?: () => string | null } }
        ).__mcMusicPlayerDebug?.nowPlaying?.() ?? null,
    );
  const first = await playing();
  await tap(page, RB, async () => (await playing()) !== first);
  const second = await playing();
  expect(second).not.toBeNull();
  expect(second).not.toBe(first);
  await tap(page, B, async () => !(await isActive(page, "MusicPlayerOverlay")));
  expect(await isActive(page, "MusicPlayerOverlay")).toBe(false);
});

test("LB / RB switch Settings' tabs, and the ring hides while the mouse moves", async ({ page }) => {
  await openTitle(page);
  const settings = await stopRect(page, "Title", "settings");
  await page.mouse.click(settings.x + settings.width / 2, settings.y + settings.height / 2);
  await page.waitForTimeout(800);
  expect(await isActive(page, "SettingsOverlay")).toBe(true);
  const tabKeys = async () =>
    (
      await page.evaluate(() =>
        (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: { x: number } }[]> })
          .__mcFocusRoutes.SettingsOverlay!(),
      )
    )
      .filter((stop) => stop.key.startsWith("tab:"))
      .map((stop) => stop.key);
  const tabs = await tabKeys();
  expect(tabs.length).toBeGreaterThan(2);
  // The body's row stops differ per tab.
  const rowsKey = async () =>
    (
      await page.evaluate(() =>
        (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string }[]> }).__mcFocusRoutes
          .SettingsOverlay!(),
      )
    )
      .filter((stop) => stop.key.startsWith("row:"))
      .map((stop) => stop.key)
      .join(",");
  const a = await rowsKey();
  await tap(page, RB, async () => (await rowsKey()) !== a);
  expect(await rowsKey()).not.toBe(a);
  await tap(page, LB, async () => (await rowsKey()) === a);
  expect(await rowsKey()).toBe(a);

  // Focus a row (by the keyboard, which is exact), then move the mouse: the ring goes; the next pad press brings it back on the same stop.
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  const focused = await stateOf(page, "SettingsOverlay");
  expect(focused?.focus).not.toBeNull();
  expect(focused?.ringShown).toBe(true);
  await page.mouse.move(300, 300);
  await page.mouse.move(340, 340);
  await page.waitForTimeout(300);
  expect((await stateOf(page, "SettingsOverlay"))?.ringShown).toBe(false);
  await tap(page, DPAD_RIGHT, async () => (await stateOf(page, "SettingsOverlay"))?.ringShown === true);
  const back = await stateOf(page, "SettingsOverlay");
  expect(back?.ringShown).toBe(true);
  expect(back?.focus).toBe(focused?.focus);
});

test("the first D-pad press after a mouse move only brings the ring back", async ({ page }) => {
  await openTitle(page);
  await waitForChrome(page, "Title");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  const focus = (await stateOf(page, "Title"))?.focus;
  expect(focus).not.toBeNull();
  await page.mouse.move(300, 300);
  await page.mouse.move(340, 340);
  await page.waitForTimeout(300);
  expect((await stateOf(page, "Title"))?.ringShown).toBe(false);
  await tap(page, DPAD_DOWN, async () => (await stateOf(page, "Title"))?.ringShown === true);
  const after = await stateOf(page, "Title");
  expect(after?.ringShown).toBe(true);
  expect(after?.focus).toBe(focus);
});

test("the ring follows a Settings row that scrolls under it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 520 });
  await openTitle(page);
  const settings = await stopRect(page, "Title", "settings");
  await page.mouse.click(settings.x + settings.width / 2, settings.y + settings.height / 2);
  await page.waitForTimeout(800);
  const tab = await stopRect(page, "SettingsOverlay", "tab:display");
  await page.mouse.click(tab.x + 10, tab.y + 10);
  await page.waitForTimeout(600);
  for (let i = 0; i < 40 && (await stateOf(page, "SettingsOverlay"))?.focus !== "row:sharper-text"; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(60);
  }
  expect((await stateOf(page, "SettingsOverlay"))?.focus).toBe("row:sharper-text");
  // The wheel scrolls the body under the pointer; the keyboard then shows the ring again.
  await page.mouse.move(640, 300);
  await page.waitForTimeout(700);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.waitForTimeout(200);
  const before = (await stateOf(page, "SettingsOverlay"))?.ringRect;
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(600);
  const after = (await stateOf(page, "SettingsOverlay")) as FocusState;
  expect(after.ringShown).toBe(true);
  expect(after.ringRect).not.toEqual(before);
  // Still on the row it marks, wherever the list has scrolled it to.
  expect(after.ringRect).toEqual(await stopRect(page, "SettingsOverlay", after.focus!));
});

test("Start on Scenario select chooses heroes", async ({ page }) => {
  await installPad(page);
  await page.goto("/?screen=scenario-select&unlock=all");
  await page.waitForFunction(() => (window as unknown as { __mcGame?: object }).__mcGame !== undefined, undefined, {
    timeout: 30_000,
  });
  await page.waitForTimeout(2500);
  await tap(page, DPAD_DOWN);
  await tap(page, START, () => isActive(page, "Seats"));
  expect(await isActive(page, "Seats")).toBe(true);
});

test("PageDown on Take your seats never moves the seat", async ({ page }) => {
  await installPad(page);
  await installPageHelpers(page);
  await page.goto("/?screen=seats&unlock=all");
  await page.waitForFunction(() => (window as unknown as { __mcGame?: object }).__mcGame !== undefined, undefined, {
    timeout: 30_000,
  });
  await page.waitForTimeout(2500);
  const picking = async () => (await findText(page, "PICKING", "Seats")).map((m) => m.text).join("|");
  await tap(page, DPAD_DOWN); // the first press wakes the pad
  // RB (the pad tab button) steps to the other seat.
  await tap(page, RB, async () => (await picking()) !== "");
  const start = await picking();
  expect(start).toContain("SEAT");
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(300);
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(300);
  expect(await picking()).toBe(start);
});
