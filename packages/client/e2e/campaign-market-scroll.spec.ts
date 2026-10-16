import { expect, test, type Page } from "@playwright/test";
import { settle } from "./helpers.js";
import {
  clickStop,
  installWave6Helpers,
  routeStops,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";

/**
 * The campaign Market (#175): with the whole stall open, the shelf runs far past the screen, so it scrolls (a swipe
 * on a phone, the wheel on a desktop) and the last card on it can be reached and put in the cart. Before the fix the
 * shelf was drawn at fixed positions with nothing to scroll it, and a phone held sideways could not reach it at all.
 */

interface Stop {
  readonly key: string;
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

const stopsOf = async (page: Page): Promise<Stop[]> => (await routeStops(page, "CampaignMarket"))?.stops ?? [];

/** A finger drag from (x, y0) to (x, y1), as a real touch sequence. */
async function swipe(page: Page, x: number, y0: number, y1: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const point = (y: number): { x: number; y: number; id: number } => ({ x, y, id: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(y0)] });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(y0 + ((y1 - y0) * i) / steps)],
    });
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(150);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Scrolls the column `target` sits in by `dy` pixels (positive is down), the way the device would. */
async function scrollBy(page: Page, isMobile: boolean, target: Stop["rect"], dy: number): Promise<void> {
  const size = page.viewportSize()!;
  const x = target.x + target.width / 2;
  const middle = size.height / 2;
  if (isMobile) {
    // A slow drag that rests before lifting, so the scroll moves by the drag and no flick carries it further.
    await swipe(page, x, middle + dy / 2, middle - dy / 2);
  } else {
    await page.mouse.move(x, middle);
    await page.mouse.wheel(0, dy);
  }
  await settle(page, { quietMs: 200, maxMs: 1200 });
}

/**
 * Scrolls until `pick(stops)` sits wholly between the top bar and the action bar, and returns it: a control takes a
 * tap only while wholly inside the scrolling area.
 */
async function scrollTo(page: Page, isMobile: boolean, pick: (stops: readonly Stop[]) => Stop | undefined) {
  const size = page.viewportSize()!;
  for (let attempt = 0; attempt < 60; attempt++) {
    const stops = await stopsOf(page);
    const target = pick(stops);
    expect(target, "the control is on the Market").toBeTruthy();
    const { rect } = target!;
    const back = stops.find((stop) => stop.key === "back")!.rect;
    const done = stops.find((stop) => stop.key === "done")!.rect;
    const top = back.y + back.height + 16;
    const bottom = done.y - 32;
    if (rect.y >= top && rect.y + rect.height <= bottom) return target!;
    // At least 30px, so a drag never reads as a tap on the card under it.
    const wanted = rect.y < top ? rect.y - top - 8 : rect.y + rect.height - bottom + 8;
    const step = Math.sign(wanted) * Math.min(size.height * 0.3, Math.max(30, Math.abs(wanted)));
    await scrollBy(page, isMobile, rect, step);
  }
  throw new Error("the Market never scrolled the control into view");
}

async function openMarket(page: Page): Promise<string[]> {
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await page.goto("/?screen=campaign-market&units=20");
  await waitForScene(page, "CampaignMarket", 60_000);
  await expect
    .poll(async () => (await stopsOf(page)).some((stop) => stop.key === "full-stall"), { timeout: 60_000 })
    .toBe(true);
  await settle(page, { quietMs: 400, maxMs: 3000 });
  return errors;
}

async function buyTheLastCard(page: Page, isMobile: boolean): Promise<void> {
  await scrollTo(page, isMobile, (stops) => stops.find((stop) => stop.key === "full-stall"));
  await clickStop(page, "full-stall", "CampaignMarket");
  await settle(page, { quietMs: 400, maxMs: 2000 });
  const cards = (await stopsOf(page)).filter((stop) => stop.key.startsWith("cart:"));
  expect(cards.length, "the whole stall is on the shelf").toBeGreaterThan(10);
  const lastKey = cards.at(-1)!.key;
  await scrollTo(page, isMobile, (stops) => stops.find((stop) => stop.key === lastKey));
  await clickStop(page, lastKey, "CampaignMarket");
  await settle(page, { quietMs: 400, maxMs: 2000 });
  const texts = (await visibleTexts(page)).filter((text) => text.scene === "CampaignMarket").map((text) => text.text);
  expect(texts, "the last card went into the cart").toContain("IN YOUR CART");
}

test("the full stall scrolls and its last card can be bought", async ({ page, isMobile }) => {
  test.setTimeout(180_000);
  const errors = await openMarket(page);
  await buyTheLastCard(page, isMobile);
  expect(errors).toEqual([]);
});

test.describe("a phone held sideways", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("the shelf is reachable and the full stall scrolls", async ({ page, isMobile }) => {
    test.setTimeout(180_000);
    const errors = await openMarket(page);
    await buyTheLastCard(page, isMobile);
    expect(errors).toEqual([]);
  });
});
