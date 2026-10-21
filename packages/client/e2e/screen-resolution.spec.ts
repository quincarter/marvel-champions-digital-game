import { expect, test, type Page } from "@playwright/test";
import { clickText, settle, waitFor } from "./helpers.js";
import { routeStops, trackErrors, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { SHOT } from "./x-men-helpers.js";

/**
 * The Android app's screen settings (`platform/screen-settings.ts`). A player's report showed the Android build drawing
 * 360 x 788 pixels on a 3x phone and stretching them; it now draws at the screen's own density, with Resolution and
 * Frame rate under Settings > Display > Screen. `?renderscale=on` draws as the Android app does, in a 3x phone here.
 * The rows sit in the Settings body's scroll region, so a swipe that lifts on one of their segments must press nothing
 * (issue #227).
 */

test.use({ viewport: { width: 360, height: 788 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

const canvas = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector("canvas")!;
    return { width: c.width, height: c.height, cssWidth: c.getBoundingClientRect().width };
  });

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("mc-settings") ?? "{}"));

const fpsLimit = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mcGame: { loop: { fpsLimit: number } } }).__mcGame.loop.fpsLimit);

async function stopRect(page: Page, key: string) {
  return waitFor(
    async () => (await routeStops(page, "SettingsOverlay"))?.stops.find((s) => s.key === key)?.rect ?? null,
    key,
    10_000,
  );
}

async function tap(page: Page, key: string): Promise<void> {
  const rect = await stopRect(page, key);
  await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await settle(page, { quietMs: 200, maxMs: 1500 });
}

/** A finger swipe from `from` to `to`, lifted at `to`, through CDP so it is a real touch sequence. */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 10;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    const at = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("a 3x phone draws at 1080 x 2364, and Display > Screen changes the resolution and frame rate", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await openApp(page, "unlock=all&renderscale=on");
  expect(await canvas(page)).toEqual({ width: 1080, height: 2364, cssWidth: 360 });

  await settle(page);
  await clickText(page, "SETTINGS", { sceneKey: "Title" });
  await waitForScene(page, "SettingsOverlay");
  await settle(page);
  await tap(page, "tab:display");
  await stopRect(page, "row:render-scale:native");
  if (SHOT) await page.screenshot({ path: `${SHOT}/screen-settings-${info.project.name}.png` });

  // A swipe up the body that lifts on the 360p segment presses nothing.
  const lowest = await stopRect(page, "row:render-scale:1x");
  const before = await stored(page);
  await swipe(
    page,
    { x: lowest.x + lowest.width / 2, y: lowest.y + lowest.height / 2 + 120 },
    { x: lowest.x + lowest.width / 2, y: lowest.y + lowest.height / 2 },
  );
  await settle(page);
  expect(await stored(page), "a swipe that lifted on a segment changed nothing").toEqual(before);
  expect((await canvas(page)).width).toBe(1080);
  // Back to the top of the body, so the row sits below the tabs again.
  await swipe(page, { x: 100, y: 300 }, { x: 100, y: 700 });
  await settle(page);
  expect(await stored(page)).toEqual(before);

  // A tap on 360p draws at 1x; Native puts the screen's own resolution back.
  await tap(page, "row:render-scale:1x");
  expect((await stored(page)).renderScale).toBe("1x");
  expect(await canvas(page)).toEqual({ width: 360, height: 788, cssWidth: 360 });
  await tap(page, "row:render-scale:native");
  expect(await canvas(page)).toEqual({ width: 1080, height: 2364, cssWidth: 360 });

  // Frame rate: no cap by default, 30 fps on a tap.
  expect(await fpsLimit(page)).toBe(0);
  await tap(page, "row:frame-rate:30");
  expect((await stored(page)).frameRate).toBe("30");
  expect(await fpsLimit(page)).toBe(30);
  expect(errors).toEqual([]);
});

test("the web keeps drawing at 1x and shows no Screen section", async ({ page }) => {
  test.setTimeout(90_000);
  await openApp(page, "unlock=all");
  expect((await canvas(page)).width).toBe(360);
  await settle(page);
  await clickText(page, "SETTINGS", { sceneKey: "Title" });
  await waitForScene(page, "SettingsOverlay");
  await tap(page, "tab:display");
  const keys = (await routeStops(page, "SettingsOverlay"))?.stops.map((s) => s.key) ?? [];
  expect(keys.some((key) => key.startsWith("row:render-scale"))).toBe(false);
});
