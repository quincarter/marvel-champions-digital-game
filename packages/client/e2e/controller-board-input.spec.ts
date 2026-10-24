import { expect, test, type Page } from "@playwright/test";
import { settle, trackPageErrors, waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { declineMulligans, openApp, startGame } from "./wave6-helpers-b.js";

/**
 * Regression: the table once ignored every key and pad press (the achievement toast scene froze the board's input).
 * On the board, after the mulligan, Tab / an arrow move the focus ring, a standard gamepad's D-pad moves it too, and
 * holding RT (the shortcut layer) neither throws nor leaves the table deaf once released.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const BUTTON_RT = 7;
const BUTTON_DPAD_LEFT = 14;
const BUTTON_DPAD_RIGHT = 15;

interface FakePad {
  buttons: { pressed: boolean; touched: boolean; value: number }[];
}

const focusedKey = (page: Page): Promise<string | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcBoardDebug?: { focusedKey(): string | null } }).__mcBoardDebug?.focusedKey() ?? null,
  );

async function setButton(page: Page, index: number, down: boolean): Promise<void> {
  await page.evaluate(
    ([i, on]) => {
      const pad = (window as unknown as { __fakePad: FakePad }).__fakePad;
      pad.buttons[i as number] = { pressed: on as boolean, touched: on as boolean, value: on ? 1 : 0 };
    },
    [index, down] as const,
  );
}

/** Presses and releases one pad button, as a thumb would (long enough for a frame poll to see it). */
async function tapPadButton(page: Page, index: number): Promise<void> {
  await setButton(page, index, true);
  await page.waitForTimeout(150);
  await setButton(page, index, false);
  await page.waitForTimeout(100);
}

test("the table answers the keyboard and a gamepad, and survives a held trigger", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = trackPageErrors(page);
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
  await installWave6Helpers(page);
  await openApp(page);
  await startGame(page, { scenarioId: "rhino", decks: ["core-spider-man-justice"], seed: 3 });
  await declineMulligans(page);
  await settle(page, { quietMs: 600, maxMs: 5000 });

  // The keyboard: Tab walks the focus route, an arrow moves it spatially.
  await page.keyboard.press("Tab");
  const first = await waitFor(() => focusedKey(page), "Tab focuses a control", 10_000);
  await page.keyboard.press("Tab");
  const second = await waitFor(
    async () => ((await focusedKey(page)) !== first ? await focusedKey(page) : null),
    "Tab again moves focus",
    10_000,
  );
  expect(second).not.toBe(first);

  // The pad: D-pad right moves the focus (or left, when the ring already sits at the right-most stop).
  await tapPadButton(page, BUTTON_DPAD_RIGHT);
  let padMoved = (await focusedKey(page)) !== second;
  if (!padMoved) {
    await tapPadButton(page, BUTTON_DPAD_LEFT);
    padMoved = (await focusedKey(page)) !== second;
  }
  expect(padMoved, "the D-pad moves the focus ring").toBe(true);

  // RT held (the layer): the table keeps running; released, input is back.
  await setButton(page, BUTTON_RT, true);
  await page.waitForTimeout(500);
  await expect
    .poll(() => page.evaluate(() => !!(window as unknown as { __mcBoardDebug?: unknown }).__mcBoardDebug))
    .toBe(true);
  await setButton(page, BUTTON_RT, false);
  await page.waitForTimeout(300);
  const beforeKey = await focusedKey(page);
  await page.keyboard.press("Tab");
  await waitFor(
    async () => ((await focusedKey(page)) !== beforeKey ? true : null),
    "Tab still moves focus after RT",
    10_000,
  );
  expect(errors).toEqual([]);
});
