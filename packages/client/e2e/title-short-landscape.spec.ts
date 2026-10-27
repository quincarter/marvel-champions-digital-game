import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle } from "./helpers.js";
import { installWave6Helpers, routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * A phone held landscape (Edge on Android, about 1000 x 340 under its toolbars) was too short for the Title menu: it
 * ran off the bottom below Campaign with no way to reach Settings. The menu now scrolls under the logo. A swipe that
 * starts on one row and lifts on another presses neither (issue #227's rule); a tap on a row scrolled into view opens
 * it.
 */

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const stopRect = async (page: Page, key: string): Promise<Rect> => {
  const stop = (await routeStops(page, "Title"))?.stops.find((s) => s.key === key);
  expect(stop, `the Title's "${key}" control`).toBeTruthy();
  return stop!.rect;
};

/** A finger (phone) or mouse wheel (desktop) moving the menu up by `dy`, from a point on `from`. */
async function scrollMenu(page: Page, phone: boolean, from: Rect, dy: number): Promise<void> {
  const x = from.x + from.width / 2;
  const y0 = from.y + from.height / 2;
  if (!phone) {
    await page.mouse.move(x, y0);
    await page.mouse.wheel(0, dy);
  } else {
    const cdp = await page.context().newCDPSession(page);
    const point = (y: number) => ({ x, y, id: 1 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(y0)] });
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(y0 - (dy * i) / steps)] });
      await page.waitForTimeout(20);
    }
    // Rests before lifting, so no flick carries the scroll on.
    await page.waitForTimeout(150);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  }
  await settle(page, { quietMs: 200, maxMs: 1500 });
}

test("a Title menu too tall for a landscape phone scrolls; a swipe presses nothing, a tap opens Settings", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const phone = info.project.name === "phone";
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 844, height: 340 });
  await installWave6Helpers(page);
  await openApp(page);
  await settle(page);

  const height = page.viewportSize()!.height;
  const settings = await stopRect(page, "settings");
  expect(settings.y + settings.height, "Settings starts below the screen").toBeGreaterThan(height);
  if (SHOT) await page.screenshot({ path: `${SHOT}/title-short-landscape-${info.project.name}-top.png` });

  // New game scrolled half under the logo's rule: a tap on its hidden half, over the logo, presses nothing.
  const before = await activeScenes(page);
  const newGame = await stopRect(page, "new-game");
  const decks = await stopRect(page, "decks");
  await scrollMenu(page, phone, decks, Math.round(newGame.height / 2) + 2);
  const half = await stopRect(page, "new-game");
  expect(half.y, "New game has moved up under the rule").toBeLessThan(newGame.y - 4);
  const hidden = { x: half.x + half.width / 2, y: half.y + 3 };
  if (phone) await page.touchscreen.tap(hidden.x, hidden.y);
  else await pressAt(page, hidden.x, hidden.y);
  await settle(page);
  expect(await activeScenes(page), "a tap on a row's hidden part opens nothing").toEqual(before);

  // A swipe that starts on Decks & Collection and lifts on whatever row slides under the finger.
  await scrollMenu(page, phone, decks, 120);
  expect(await activeScenes(page), "a swipe over the menu opens nothing").toEqual(before);

  // Down to Settings: it comes wholly on screen, and a tap on it opens the overlay.
  for (let attempt = 0; attempt < 6; attempt++) {
    const rect = await stopRect(page, "settings");
    if (rect.y + rect.height <= height) break;
    // From the lower part of the menu, which stays on screen however far it has scrolled.
    await scrollMenu(page, phone, { x: decks.x, y: height - 100, width: decks.width, height: 40 }, 120);
  }
  const shown = await stopRect(page, "settings");
  expect(shown.y + shown.height, "Settings scrolls into view").toBeLessThanOrEqual(height);
  expect(await activeScenes(page)).toEqual(before);
  if (SHOT) await page.screenshot({ path: `${SHOT}/title-short-landscape-${info.project.name}-scrolled.png` });
  const x = shown.x + shown.width / 2;
  const y = shown.y + shown.height / 2;
  if (phone) await page.touchscreen.tap(x, y);
  else await pressAt(page, x, y);
  await waitForScene(page, "SettingsOverlay");
  expect(errors).toEqual([]);
});
