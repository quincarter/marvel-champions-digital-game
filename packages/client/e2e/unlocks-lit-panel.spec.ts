import { expect, test, type Page } from "@playwright/test";
import { pressKey, trackPageErrors } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Settings ▸ Unlocks is one Lit element over the canvas (`mc-unlocks-page`): the bar buttons and the rows are DOM, the
 * keyboard walks them with the focus ring drawn in the panel layer, ✕ and Escape close it, and on a phone a swipe that
 * lifts over a row's switch only scrolls the list (CLAUDE.md, no tap on finger lift).
 */

const sheet = (page: Page) => page.locator('#mc-ui [data-scene="UnlocksOverlay"] mc-unlocks-page');
/** A focus stop (`data-stop`) or, for the scrolling regions, a `data-key`. */
const key = (page: Page, id: string) => sheet(page).locator(`[data-stop="${id}"], [data-key="${id}"]`);

test("Unlocks is a panel: the switches press, How it works swaps the view, Escape closes", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openApp(page, "screen=unlocks", { landing: "UnlocksOverlay" });
  await expect(sheet(page)).toBeVisible();
  await expect(key(page, "row:all")).toBeVisible();

  // The door to How it works swaps the switches for the text, and back.
  await key(page, "guide").click();
  await expect(sheet(page).locator('[data-key="guide-text"]')).toBeVisible();
  await expect(key(page, "row:all")).toHaveCount(0);
  await key(page, "guide").click();
  await expect(key(page, "row:all")).toBeVisible();

  // Down from the header onto a row: the ring is drawn over the panel.
  await pressKey(page, "ArrowDown");
  await pressKey(page, "ArrowDown");
  await expect(page.locator("#mc-ui .mc-focus-ring")).toBeVisible();

  await pressKey(page, "Escape");
  await expect(sheet(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a swipe that lifts over a campaign's switch only scrolls the list", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  await openApp(page, "screen=unlocks", { landing: "UnlocksOverlay" });
  const list = sheet(page).locator('[data-key="list"]');
  await expect(list).toBeVisible();
  const box = (await list.boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height - 20 };
  const to = { x: from.x, y: box.y + 30 };
  const before = await list.evaluate((el) => el.scrollTop);
  if (phone) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
    for (let i = 1; i <= 10; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x, y: from.y + ((to.y - from.y) * i) / 10, id: 1 }],
      });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.wheel(0, 200);
  }
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  // Nothing was asked: no confirm opened.
  await expect(page.locator('#mc-ui [data-scene="UnlockConfirmOverlay"]')).toHaveCount(0);
});
