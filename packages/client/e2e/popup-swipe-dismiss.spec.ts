import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";

/**
 * A pop-up on a phone is swiped away from its grab handle: a downward drag of the handle past a quarter of the box (or
 * a flick) closes it as Cancel does, a shorter one springs back, and a drag that starts on the box's body does nothing.
 * The finger lifting over a button fires nothing.
 */

test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

const launch = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const game = (window as any).__mcGame;
    (window as any).__cancelled = 0;
    (window as any).__confirmed = 0;
    game.scene.getScene("Board").scene.launch("EndTurnConfirmOverlay", {
      sentence: "You can still: play a card.",
      from: "Board",
      onConfirm: () => ((window as any).__confirmed += 1),
      onCancel: () => ((window as any).__cancelled += 1),
    });
  });

/** The grab handle's target and the box's body (below the handle), in page pixels. */
const handle = (page: Page): Promise<{ x: number; y: number; w: number; h: number } | null> =>
  page.evaluate(() => {
    const sheets = [...document.querySelectorAll("mc-sheet")] as any[];
    const grab = sheets.at(-1)?.elementOf("__grab") as HTMLElement | null | undefined;
    if (!grab) return null;
    const r = grab.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

async function swipe(page: Page, from: { x: number; y: number }, dy: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const steps = 8;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x, y: from.y + (dy * i) / steps, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const open = async (page: Page): Promise<void> => {
  await page.goto("/?screen=board&fixture=abilities");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "the board is up", 120_000);
  await settle(page, { quietMs: 600, maxMs: 5000 });
  await launch(page);
  await waitFor(
    async () => ((await activeScenes(page)).includes("EndTurnConfirmOverlay") ? true : null),
    "the confirm opens",
    15_000,
  );
  await settle(page, { quietMs: 400, maxMs: 3000 });
};

test("a swipe down from the grab handle closes the confirm as Cancel, once", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await open(page);
  const grab = await handle(page);
  expect(grab, "the phone draws a grab handle").not.toBeNull();
  expect(grab!.h, "the handle's target is at least 44px tall").toBeGreaterThanOrEqual(44);
  await swipe(page, { x: grab!.x + grab!.w / 2, y: grab!.y + grab!.h / 2 }, 300);
  await waitFor(
    async () => ((await activeScenes(page)).includes("EndTurnConfirmOverlay") ? null : true),
    "the swipe closes the confirm",
    10_000,
  );
  expect(await page.evaluate(() => (window as any).__cancelled as number), "Cancel answered once").toBe(1);
  expect(await page.evaluate(() => (window as any).__confirmed as number), "End turn was not pressed").toBe(0);
  expect(errors()).toEqual([]);
});

test("a short drag springs back, and a drag from the box body does nothing", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await open(page);
  const grab = await handle(page);
  expect(grab).not.toBeNull();
  await swipe(page, { x: grab!.x + grab!.w / 2, y: grab!.y + grab!.h / 2 }, 14);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await activeScenes(page), "a short drag leaves it open").toContain("EndTurnConfirmOverlay");

  // From the body, over the buttons' row: a long swipe closes nothing and presses nothing.
  await swipe(page, { x: grab!.x + grab!.w / 2, y: grab!.y + grab!.h + 40 }, 300);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await activeScenes(page), "a drag from the body leaves it open").toContain("EndTurnConfirmOverlay");
  expect(await page.evaluate(() => (window as any).__cancelled as number)).toBe(0);
  expect(await page.evaluate(() => (window as any).__confirmed as number)).toBe(0);
  expect(errors()).toEqual([]);
});
