import { expect, test, type Page } from "@playwright/test";
import { settle, trackPageErrors, waitFor } from "./helpers.js";
import { routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The title screen's temporary Shadowland notice bar (`view/shadowland-notice.ts`): a tap anywhere on it opens
 * `shadowland-info.html` in a new tab, and on a phone a swipe that lifts over it opens nothing (`ui/tap.ts`).
 */

const stopRect = (page: Page, key: string) =>
  waitFor(
    async () => (await routeStops(page, "Title"))?.stops.find((s) => s.key === key)?.rect ?? null,
    `Title control ${key}`,
    10000,
  );

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

test("the notice bar sits across the top of Title and opens the Shadowland page", async ({ page, context }, info) => {
  const phone = info.project.name === "phone";
  const errors = trackPageErrors(page);
  await openApp(page);
  await settle(page, { quietMs: 500, maxMs: 4000 });

  const bar = await stopRect(page, "shadowland-notice");
  const width = page.viewportSize()!.width;
  expect(bar).toMatchObject({ x: 0, y: 0, width });
  // Nothing else on Title starts under it.
  const others = (await routeStops(page, "Title"))!.stops.filter((s) => s.key !== "shadowland-notice");
  for (const stop of others) expect(stop.rect.y, stop.key).toBeGreaterThanOrEqual(bar.y + bar.height);

  const opened: string[] = [];
  context.on("page", (popup) => opened.push(popup.url()));
  if (phone) {
    // A swipe up the menu that lifts on the bar presses nothing.
    const newGame = await stopRect(page, "new-game");
    await touchSwipe(
      page,
      { x: width / 2, y: newGame.y + newGame.height / 2 },
      { x: width / 2, y: bar.y + bar.height / 2 },
    );
    await settle(page, { quietMs: 600, maxMs: 2500 });
    expect(opened, "a swipe lifting on the bar opened nothing").toEqual([]);
    expect(await routeStops(page, "Title")).not.toBeNull();
  }

  const popup = context.waitForEvent("page");
  if (phone) await page.touchscreen.tap(bar.x + bar.width / 2, bar.y + bar.height / 2);
  // One plain click: `clickStop` presses again when the screen does not change, and a new tab is no screen change.
  else await page.mouse.click(bar.x + bar.width / 2, bar.y + bar.height / 2);
  const tab = await popup;
  expect(tab.url()).toMatch(/\/shadowland-info\.html$/);
  await settle(page, { quietMs: 400, maxMs: 2000 });
  expect(opened, "one press opens one tab").toHaveLength(1);
  await tab.waitForLoadState("domcontentloaded");
  await expect(tab.locator("h1")).toHaveText("Where did the Shadowland content go?");
  expect(errors).toEqual([]);
});
