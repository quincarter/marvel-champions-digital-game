import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";
import { texts } from "./wave7-deck-builder-helpers.js";

/**
 * Deck builder (issue #531): the ? beside the search opens the cheat sheet, Use puts an example in the search and
 * closes it, and a swipe of the sheet's list that lifts over Use does nothing (the no-tap-on-finger-lift rule).
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const stopRect = (page: Page, scene: string, key: string): Promise<Rect | null> =>
  page.evaluate(
    ([s, k]) =>
      (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Rect }[]> }).__mcFocusRoutes[
        s!
      ]?.().find((stop) => stop.key === k)?.rect ?? null,
    [scene, key],
  );

async function pressStop(page: Page, scene: string, key: string): Promise<void> {
  const r = await waitFor(() => stopRect(page, scene, key), `the ${key} stop`, 15_000);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}

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

/** The pool's card count, from its "N cards" label. */
async function poolCount(page: Page): Promise<number> {
  const label = (await texts(page, "DeckBuilder")).find((t) => /\d+\s+cards?$/i.test(t) && !/legal/i.test(t));
  return Number(/(\d+)\s+card/i.exec(label ?? "")?.[1] ?? NaN);
}

test("the ? opens the cheat sheet, and Use puts an example in the search", async ({ page }) => {
  test.setTimeout(120_000);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  const all = await waitFor(async () => {
    const count = await poolCount(page);
    return Number.isFinite(count) && count > 0 ? count : null;
  }, "the pool count");
  await pressStop(page, "DeckBuilder", "filter-help");
  await waitFor(async () => ((await activeScenes(page)).includes("SearchHelpSheet") ? true : null), "the sheet opens");
  await settle(page);
  expect((await texts(page, "SearchHelpSheet")).join("\n")).toContain("t:ally o<3");

  // The first example is row 4, after the top heading, two notes and the Try these heading.
  await pressStop(page, "SearchHelpSheet", "use:4");
  await waitFor(
    async () => (!(await activeScenes(page)).includes("SearchHelpSheet") ? true : null),
    "the sheet closes",
  );
  const filtered = await waitFor(async () => {
    const count = await poolCount(page);
    return count < all ? count : null;
  }, "the example filters the pool");
  expect(filtered).toBeGreaterThan(0);
  await expect(page.locator("input").filter({ visible: true }).first()).toBeVisible();
  expect(await page.locator("input").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toContain(
    "t:ally o<3",
  );
});

test("a swipe of the cheat sheet that lifts over Use does nothing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the finger-lift rule is a phone rule");
  test.setTimeout(120_000);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
  const help = await waitFor(() => stopRect(page, "DeckBuilder", "filter-help"), "the ? button", 15_000);
  await page.touchscreen.tap(help.x + help.width / 2, help.y + help.height / 2);
  await waitFor(async () => ((await activeScenes(page)).includes("SearchHelpSheet") ? true : null), "the sheet opens");
  await settle(page);
  const use = await waitFor(() => stopRect(page, "SearchHelpSheet", "use:5"), "a Use button", 15_000);
  const centre = { x: use.x + use.width / 2, y: use.y + use.height / 2 };
  await swipe(page, centre, { x: centre.x, y: centre.y - 140 });
  await page.waitForTimeout(300);
  await swipe(page, { x: centre.x, y: centre.y - 140 }, centre);
  await page.waitForTimeout(500);
  expect(await activeScenes(page)).toContain("SearchHelpSheet");
});
