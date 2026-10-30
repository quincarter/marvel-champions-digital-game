import { expect, test, type Page } from "@playwright/test";
import { waitFor } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";
import { texts } from "./wave7-deck-builder-helpers.js";

/**
 * Deck builder, phone (issue #531): the quick cost/icon chips sit in the scrolling deck region. A swipe of the region
 * that starts and lifts over chips filters nothing; a tap on a chip filters the pool, and a second tap clears it (the
 * no-tap-on-finger-lift rule).
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const stopRect = (page: Page, key: string): Promise<Rect | null> =>
  page.evaluate(
    (k) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Rect }[]> }).__mcFocusRoutes[
        "DeckBuilder"
      ]!().find((stop) => stop.key === k)?.rect ?? null,
    key,
  );

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 10;
  const cdp = await page.context().newCDPSession(page);
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** The pool's card count, from its "Pool — N cards" label. */
async function poolCount(page: Page): Promise<number> {
  const label = (await texts(page, "DeckBuilder")).find((t) => /pool\s+—\s+\d+\s+card/i.test(t));
  return Number(/(\d+)/.exec(label ?? "")?.[1] ?? NaN);
}

test("a swipe over the quick filter chips filters nothing; a tap filters and a second tap clears", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the finger-lift rule is a phone rule");
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  const all = await waitFor(async () => {
    const count = await poolCount(page);
    return Number.isFinite(count) && count > 0 ? count : null;
  }, "the pool count");
  const chip = await waitFor(() => stopRect(page, "quick:cost:2"), "the cost 2 chip", 15_000);
  const centre = { x: chip.x + chip.width / 2, y: chip.y + chip.height / 2 };

  // Up and back down, lifting over the same chip it started on: the region scrolls, no chip fires.
  await swipe(page, centre, { x: centre.x, y: centre.y - 120 });
  await page.waitForTimeout(300);
  await swipe(page, { x: centre.x, y: centre.y - 120 }, centre);
  await page.waitForTimeout(500);
  expect(await poolCount(page)).toBe(all);

  const again = (await stopRect(page, "quick:cost:2"))!;
  await page.touchscreen.tap(again.x + again.width / 2, again.y + again.height / 2);
  const filtered = await waitFor(async () => {
    const count = await poolCount(page);
    return count < all ? count : null;
  }, "a tap on the chip filters the pool");
  expect(filtered).toBeGreaterThan(0);

  const off = (await stopRect(page, "quick:cost:2"))!;
  await page.touchscreen.tap(off.x + off.width / 2, off.y + off.height / 2);
  await waitFor(async () => ((await poolCount(page)) === all ? true : null), "a second tap clears the chip");
});
