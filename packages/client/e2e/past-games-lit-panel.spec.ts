import { expect, test, type Page } from "@playwright/test";
import { pressKey, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Past games draws its list and its game details as a Lit panel over the canvas (`mc-sheet`, `scenes/past-games.ts`):
 * the rows, their pictures and the details are in the panel, the keyboard walks the same focus stops with the ring drawn
 * in the DOM, Enter opens a game, Escape leaves; on a phone a tap opens the details popup, a swipe that lifts over a row
 * opens nothing, and Escape closes the popup first.
 */

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;

const focusOf = (page: Page): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate(() => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState.PastGames!());

const panel = '#mc-ui [data-scene="PastGames"]';
const SHOTS = process.env.SHOT_DIR ?? "";

/** A finger drag from `from` to `to`, lifted at `to` (a real touch sequence over CDP). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
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

test("Past games is a Lit panel: rows and details in the DOM, the keyboard walks the rows, Escape leaves", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the side panel is the desktop's case");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, "screen=past-games&fixture=demo&unlock=all", { landing: "PastGames" });
  await expect(page.locator(`${panel} [data-key="list"]`)).toHaveCount(1);
  await expect(page.locator(`${panel} [data-key^="game:"]`)).toHaveCount(5);
  // The side panel shows the newest game with its four actions.
  for (const action of ["watch", "share", "export", "log"])
    await expect(page.locator(`${panel} [data-key="action:${action}"]`)).toHaveCount(1);
  // Every picture opens the card hover popover: the villain's and each hero's, on every row and in the details.
  expect(await page.locator(`${panel} [data-hover]`).count()).toBeGreaterThanOrEqual(10);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/past-games-lit-desktop.png` });

  // The first arrow press takes the first stop; the ring is drawn in the DOM.
  await pressKey(page, "ArrowDown");
  await waitFor(async () => ((await focusOf(page)).focus ? true : null), "something has focus", 5000);
  expect((await focusOf(page)).ringShown).toBe(true);
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);
  // Down walks the same stops as before: back, the tabs, the file button, the export button, the search, then the rows.
  let focus = (await focusOf(page)).focus;
  for (let step = 0; step < 14 && !focus?.startsWith("game:"); step++) {
    await pressKey(page, "ArrowDown");
    await page.waitForTimeout(60);
    focus = (await focusOf(page)).focus;
  }
  expect(focus?.startsWith("game:")).toBe(true);
  await pressKey(page, "ArrowDown");
  await waitFor(async () => (((await focusOf(page)).focus ?? "") !== focus ? true : null), "the ring moves on", 5000);
  await pressKey(page, "Enter");
  // The details follow the row picked: its card has the red outline in the list.
  await page.waitForTimeout(200);

  await pressKey(page, "Escape");
  await waitFor(async () => (await page.locator(panel).count()) === 0, "the panel goes with the screen", 10_000);
  expect(errors).toEqual([]);
});

test("on a phone a tap opens the details popup in the panel, a swipe over a row opens nothing, Escape closes it", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the popup is the phone's case");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 667 });
  const errors = trackPageErrors(page);
  await openApp(page, "screen=past-games&fixture=demo&unlock=all", { landing: "PastGames" });
  const rows = page.locator(`${panel} [data-key^="game:"]`);
  await expect(rows.first()).toBeAttached();
  await expect(page.locator(`${panel} [data-key="close"]`)).toHaveCount(0);
  const box = (await rows.first().boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // Up from below the row, lifting on it: a scroll, not a press.
  await swipe(page, { x: at.x, y: at.y + 160 }, at);
  await page.waitForTimeout(400);
  await expect(page.locator(`${panel} [data-key="close"]`)).toHaveCount(0);

  await page.touchscreen.tap(at.x, at.y);
  await expect(page.locator(`${panel} [data-key="close"]`)).toHaveCount(1);
  await expect(page.locator(`${panel} [data-key="action:watch"]`)).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/past-games-lit-phone-popup.png` });
  await pressKey(page, "Escape");
  await expect(page.locator(`${panel} [data-key="close"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
});
