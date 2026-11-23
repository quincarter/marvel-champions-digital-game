import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, hasText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { waitForScene } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * A browser with WebGL switched off (a Discord report: Firefox 157 on Windows, "Cannot create WebGL context,
 * aborting.") plays on the Canvas renderer instead (`platform/renderer-options.ts`), and Title says once how to turn
 * WebGL back on (`scenes/renderer-notice.ts`). Every `webgl` context request fails here, as `webgl.disabled` does.
 */

const NOTICE = "RendererNoticeOverlay";

async function switchWebglOff(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/.test(kind)) return null;
      return (getContext as (k: string, ...r: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
    } as typeof getContext;
  });
}

const rendererType = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __mcGame: { renderer: { type: number } } }).__mcGame.renderer.type);

test("without WebGL the game starts on Canvas and says once how to turn WebGL back on", async ({ page }) => {
  const errors = trackPageErrors(page);
  await switchWebglOff(page);
  await openApp(page);
  // Phaser.CANVAS is 1, Phaser.WEBGL 2.
  expect(await rendererType(page)).toBe(1);
  await waitForScene(page, NOTICE);
  expect(await hasText(page, "To turn WebGL back on", NOTICE)).toBe(true);
  // No failure panel over the game.
  expect(await page.evaluate(() => document.getElementById("mc-startup-failure") === null)).toBe(true);

  await clickText(page, "GOT IT", {
    sceneKey: NOTICE,
    until: async () => ((await activeScenes(page)).includes(NOTICE) ? null : true),
    untilLabel: "the notice closes",
  });
  expect(await page.evaluate(() => localStorage.getItem("mc-canvas-fallback-seen"))).toBe("1");

  // Closed once is closed on this device: the next launch goes straight to Title.
  await page.reload();
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "Title after reload", 30000);
  await settle(page);
  expect(await activeScenes(page)).not.toContain(NOTICE);
  expect(await rendererType(page)).toBe(1);
  expect(errors).toEqual([]);
});

test("Enter closes the notice and presses nothing on Title underneath", async ({ page }) => {
  await switchWebglOff(page);
  await openApp(page);
  await waitForScene(page, NOTICE);
  await settle(page);
  const before = await activeScenes(page);
  await page.keyboard.press("Enter");
  await waitFor(async () => ((await activeScenes(page)).includes(NOTICE) ? null : true), "the notice closes", 10000);
  await settle(page);
  // Title is still the screen: no New game, no other screen opened by the same press.
  expect((await activeScenes(page)).filter((key) => !before.includes(key))).toEqual([]);
});

test("a browser with WebGL never sees the notice", async ({ page }) => {
  await openApp(page);
  await settle(page);
  expect(await rendererType(page)).toBe(2);
  expect(await activeScenes(page)).not.toContain(NOTICE);
});
