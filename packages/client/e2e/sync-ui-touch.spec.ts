import { expect, test, type Page } from "@playwright/test";
import { hasText, settle, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";
import {
  fakeSyncServer,
  openSyncScreen,
  storedSyncCode,
  syncStop,
  SYNC_DATA,
  waitForSyncText,
} from "./sync-ui-helpers.js";

/**
 * The "no tap on finger lift" rule (issue #227) for the device-sync screens: on a phone, a swipe that lifts over Set up
 * sync, Copy, I've saved my code, Unlink or Delete presses nothing; a real tap on the same control does.
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

/** Swipes upward from well below the control and lifts on it, then lets the screen settle. */
async function swipeOnto(page: Page, key: string): Promise<void> {
  const at = center(await syncStop(page, SYNC_DATA, key));
  await touchSwipe(page, { x: at.x, y: Math.min(at.y + 110, 800) }, at);
  await settle(page, { quietMs: 400, maxMs: 2000 });
}

async function tap(page: Page, key: string): Promise<void> {
  const at = center(await syncStop(page, SYNC_DATA, key));
  await page.touchscreen.tap(at.x, at.y);
}

test("a swipe that lifts over a sync control presses nothing; a tap does", async ({ page, context }, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = trackPageErrors(page);
  const cloud = fakeSyncServer();
  await cloud.install(context);
  await openApp(page);
  await openSyncScreen(page);

  await swipeOnto(page, "sync:setup");
  expect(
    cloud.requests.filter((r) => r.includes("/sync/")),
    "a swipe lifting on Set up sync creates nothing",
  ).toEqual([]);
  expect(await hasText(page, "Sync is off", SYNC_DATA)).toBe(true);

  await tap(page, "sync:setup");
  await waitForSyncText(page, "Your recovery code");
  expect(await storedSyncCode(page)).not.toBeNull();

  await swipeOnto(page, "copy");
  expect(await hasText(page, "Code copied.", SYNC_DATA)).toBe(false);
  expect(await hasText(page, "Problem:", SYNC_DATA)).toBe(false);

  await swipeOnto(page, "ack");
  expect(await hasText(page, "Your recovery code", SYNC_DATA), "a swipe lifting on the acknowledge stays").toBe(true);
  await tap(page, "ack");
  await waitForSyncText(page, "Sync is on");

  await swipeOnto(page, "sync:unlink");
  expect(await hasText(page, "Sync is on", SYNC_DATA), "a swipe lifting on Unlink stays linked").toBe(true);
  expect(await storedSyncCode(page)).not.toBeNull();

  await swipeOnto(page, "sync:delete");
  expect(await hasText(page, "Delete your cloud data?", SYNC_DATA)).toBe(false);
  await tap(page, "sync:delete");
  await waitForSyncText(page, "Delete your cloud data?");
  await swipeOnto(page, "confirm-delete");
  expect(
    cloud.requests.filter((r) => r.startsWith("DELETE")),
    "a swipe lifting on Delete deletes nothing",
  ).toEqual([]);
  expect(cloud.spaces.size).toBe(1);

  await tap(page, "cancel");
  await waitForSyncText(page, "Sync is on");
  await tap(page, "sync:delete");
  await waitForSyncText(page, "Delete your cloud data?");
  await tap(page, "confirm-delete");
  await waitFor(async () => (cloud.spaces.size === 0 ? true : null), "a tap on Delete deletes the cloud data");
  await waitForSyncText(page, "Sync is off");
  expect(await storedSyncCode(page)).toBeNull();
  expect(errors).toEqual([]);
});
