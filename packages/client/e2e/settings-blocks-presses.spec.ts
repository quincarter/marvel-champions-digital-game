import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, isSceneUp, settle, trackPageErrors } from "./helpers.js";
import { routeStops, waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * A press on Settings never reaches Title underneath it (owner, 2026-10-16): on a phone, lifting a finger after
 * scrolling the Settings list opened Title's releases link behind the panel. Every press here lands right over a Title
 * menu button (New game) in the panel's blank margin, first as the end of a swipe and then as a plain tap, and Title must not answer either.
 */

const SETTINGS = "SettingsOverlay";

/** One finger pressed at (x, fromY), dragged straight to toY in small steps, and lifted there. */
async function touchSwipe(page: Page, x: number, fromY: number, toY: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: fromY }] });
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: fromY + ((toY - fromY) * i) / 10 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("presses on Settings never reach Title underneath", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  const errors = trackPageErrors(page);
  await openApp(page, "");
  await waitForScene(page, "Title", 30000);
  await settle(page);
  const newGame = (await routeStops(page, "Title"))?.stops.find((s) => s.key === "new-game")?.rect;
  expect(newGame, "Title draws a New game button").toBeDefined();
  await clickText(page, "SETTINGS", { sceneKey: "Title", until: () => isSceneUp(page, SETTINGS) });
  await settle(page);
  // The panel's own blank margin, left of its rows (each row is a tap target of its own), over New game.
  const row = (await routeStops(page, SETTINGS))?.stops.find((s) => s.key === "row:confirm-end-turn")?.rect;
  expect(row, "Settings draws its first row").toBeDefined();
  const x = row!.x - 8;
  const y = newGame!.y + newGame!.height / 2;
  expect(x, "the press lands over New game").toBeGreaterThan(newGame!.x);
  const before = await activeScenes(page);

  await touchSwipe(page, x, y + 160, y);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  await page.touchscreen.tap(x, y);
  await settle(page, { quietMs: 400, maxMs: 2000 });

  expect(await isSceneUp(page, SETTINGS), "Settings is still open").toBe(true);
  expect(await activeScenes(page), "no screen opened behind Settings").toEqual(before);
  expect(errors).toEqual([]);
});
