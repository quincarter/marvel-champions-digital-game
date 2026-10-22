import { expect, test, type Page } from "@playwright/test";
import { hasText, settle, trackPageErrors } from "./helpers.js";
import { routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { fakeSync, openSaveData, SAVE_DATA, waitForSaveText, waitForStop } from "./save-transfer-helpers.js";

/**
 * The "no tap on finger lift" rule (issue #227) for the Save data overlay's transfer controls: on a phone, a swipe that
 * lifts over Send, Receive or Copy presses nothing; a real tap on the same control does.
 */

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

const center = (r: { x: number; y: number; width: number; height: number }) => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});

const hasStop = async (page: Page, key: string): Promise<boolean> =>
  !!(await routeStops(page, SAVE_DATA))?.stops.some((s) => s.key === key);

test("a swipe that lifts over Send, Receive or Copy presses nothing; a tap does", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  const errors = trackPageErrors(page);
  const sync = await fakeSync(page);
  await openApp(page);
  await openSaveData(page);

  // Swipes upward from well below each button and lifts on it.
  const send = center(await waitForStop(page, "row:send"));
  await touchSwipe(page, { x: send.x, y: send.y + 90 }, send);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(sync.requests, "a swipe lifting on Send uploads nothing").toEqual([]);
  expect(await hasStop(page, "row:send"), "and stays on the menu").toBe(true);

  const receive = center(await waitForStop(page, "row:receive"));
  await touchSwipe(page, { x: receive.x, y: receive.y - 90 }, receive);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await hasStop(page, "receive"), "a swipe lifting on Receive opens nothing").toBe(false);

  // A tap on Send does open the code screen.
  await page.touchscreen.tap(send.x, send.y);
  await waitForSaveText(page, "ABCD-EFGH-");
  expect(sync.requests).toHaveLength(1);

  // On the code screen, a swipe that lifts on Copy copies nothing.
  const copy = center(await waitForStop(page, "copy"));
  await touchSwipe(page, { x: copy.x, y: copy.y - 90 }, copy);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await hasText(page, "Code copied.", SAVE_DATA)).toBe(false);
  expect(await hasText(page, "Problem:", SAVE_DATA)).toBe(false);

  // And one that lifts on Back stays on the code screen.
  const back = center(await waitForStop(page, "back-menu"));
  await touchSwipe(page, { x: back.x, y: back.y - 90 }, back);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(await hasStop(page, "copy"), "still showing the code").toBe(true);
  await page.touchscreen.tap(back.x, back.y);
  await waitForStop(page, "row:send");
  expect(errors).toEqual([]);
});
