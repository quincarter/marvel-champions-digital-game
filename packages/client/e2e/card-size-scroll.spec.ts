import { expect, test, type Page } from "@playwright/test";
import { settle, zoneRect } from "./helpers.js";
import { installWave6Helpers } from "./wave6-helpers-a.js";
import { openTitle, startFixture } from "./wave7-screens-helpers.js";

/**
 * The global Card size setting on the table: at Extra large the zones are laid out taller than the window between the
 * chrome and the hand and the table scrolls (wheel on a desktop, a swipe on a phone), while the chrome, the hand and
 * the action bar stay where they are. At Standard nothing scrolls.
 */

const start = async (page: Page, cardSize: string): Promise<void> => {
  await page.addInitScript((size) => localStorage.setItem("mc-settings", JSON.stringify({ cardSize: size })), cardSize);
  await installWave6Helpers(page);
  await openTitle(page);
  await startFixture(page, "dev-qa-screens-game.ts", "startScreensQaGame", "restricted");
  await settle(page, { quietMs: 800, maxMs: 6000 });
};

/** A finger drag from (x, y0) to (x, y1) on the page, as a real touch sequence. */
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
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("Extra large: the table scrolls under a pinned chrome, hand and action bar", async ({ page, isMobile }) => {
  test.setTimeout(180_000);
  await start(page, "xlarge");
  const size = page.viewportSize()!;
  const before = {
    play: (await zoneRect(page, "playArea"))!,
    hand: (await zoneRect(page, "hand"))!,
    actionBar: (await zoneRect(page, "actionBar"))!,
    chrome: (await zoneRect(page, "chrome"))!,
  };
  // The hand is bigger than Standard's and the play area is taller than the room it has on screen.
  expect(before.play.y + before.play.height).toBeGreaterThan(before.hand.y);

  const x = size.width / 2;
  const y = before.chrome.height + 90;
  if (isMobile) await swipe(page, x, y + 160, y);
  else {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 120);
  }
  await settle(page, { quietMs: 400, maxMs: 3000 });
  const moved = (await zoneRect(page, "playArea"))!;
  expect(moved.y, "scrolled up").toBeLessThan(before.play.y);
  expect(moved.height, "the zone is not squeezed").toBe(before.play.height);
  for (const name of ["hand", "actionBar", "chrome"] as const) {
    expect(await zoneRect(page, name), `${name} stays put`).toEqual(before[name]);
  }

  // The end of the scroll shows the whole play area above the hand.
  for (let i = 0; i < 6; i++) {
    if (isMobile) await swipe(page, x, y + 200, y);
    else await page.mouse.wheel(0, 2000);
    await settle(page, { quietMs: 300, maxMs: 2000 });
  }
  const end = (await zoneRect(page, "playArea"))!;
  const hand = (await zoneRect(page, "hand"))!;
  expect(end.y + end.height).toBeLessThanOrEqual(hand.y + 1);
});

test("Standard: nothing scrolls", async ({ page, isMobile }) => {
  test.setTimeout(180_000);
  await start(page, "standard");
  const before = (await zoneRect(page, "playArea"))!;
  const hand = (await zoneRect(page, "hand"))!;
  expect(before.y + before.height).toBeLessThanOrEqual(hand.y);
  const size = page.viewportSize()!;
  if (isMobile) await swipe(page, size.width / 2, 300, 200);
  else {
    await page.mouse.move(size.width / 2, 200);
    await page.mouse.wheel(0, 400);
  }
  await settle(page, { quietMs: 400, maxMs: 3000 });
  expect(await zoneRect(page, "playArea")).toEqual(before);
});
