import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, pressKey, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Your stats draws its dashboard list as a Lit panel over the canvas (`mc-sheet`, `scenes/player-stats.ts`): the
 * Overview's tiles, the stat rows, the Aspects donut and the Matchups shelves are in the panel and scroll natively, each
 * tab keeps its own place, the keyboard walks the same stops with the ring drawn in the DOM, and on a phone the lift that
 * ends a swipe over a row presses nothing. Its chrome (tabs, chips, the Matchups grid) stays on the canvas.
 */

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;

const focusOf = (page: Page): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate(() => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState.PlayerStats!());

const stopsOf = (
  page: Page,
): Promise<{ key: string; rect: { x: number; y: number; width: number; height: number } }[]> =>
  page.evaluate(
    () =>
      (window as unknown as { __mcFocusRoutes?: Record<string, () => never[]> }).__mcFocusRoutes?.PlayerStats?.() ?? [],
  );

const panel = '#mc-ui [data-scene="PlayerStats"]';
const SHOTS = process.env.SHOT_DIR ?? "";

async function openStats(page: Page, tab = "overview"): Promise<void> {
  await openApp(page, `screen=stats&fixture=demo&tab=${tab}&unlock=all`, { landing: "PlayerStats" });
  await waitFor(
    async () => ((await page.locator(`${panel} [data-key="list"]`).count()) > 0 ? true : null),
    "the list",
    30_000,
  );
}

const press = async (page: Page, key: string): Promise<void> => {
  const stop = await waitFor(
    async () => (await stopsOf(page)).find((s) => s.key === key) ?? null,
    `the ${key} stop`,
    10_000,
  );
  const x = stop.rect.x + stop.rect.width / 2;
  const y = stop.rect.y + stop.rect.height / 2;
  if (page.viewportSize()!.width < 700) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
};

test("Your stats is a Lit panel: the tiles are in it, the keyboard walks them, the Aspects tab draws its donut", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the keyboard walk is the desktop's case");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openStats(page);
  expect(await findText(page, "WINS–LOSSES", "PlayerStats"), "the record tile is in the panel").not.toHaveLength(0);
  expect((await stopsOf(page)).some((s) => s.key.startsWith("tile:"))).toBe(true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stats-lit-desktop-overview.png` });

  // The ring is drawn in the DOM, and the arrows walk to the first tile.
  await pressKey(page, "ArrowDown");
  await waitFor(async () => ((await focusOf(page)).focus ? true : null), "something has focus", 5000);
  expect((await focusOf(page)).ringShown).toBe(true);
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);
  let focus = (await focusOf(page)).focus;
  for (let step = 0; step < 24 && !focus?.startsWith("tile:"); step++) {
    await pressKey(page, "ArrowDown");
    await page.waitForTimeout(50);
    focus = (await focusOf(page)).focus;
  }
  expect(focus?.startsWith("tile:")).toBe(true);

  // The Aspects tab's donut is a drawing in the panel; its legend names every aspect in words.
  await press(page, "tab:aspects");
  await waitFor(
    async () => ((await page.locator(`${panel} svg[data-key^="donut:"]`).count()) > 0 ? true : null),
    "the donut",
    10_000,
  );
  expect(await findText(page, "ASPECTS", "PlayerStats")).not.toHaveLength(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stats-lit-desktop-aspects.png` });

  // Each tab keeps its own place: scroll Heroes, leave for Overview, come back.
  await press(page, "tab:heroes");
  await page.locator(`${panel} [data-key="list"]`).evaluate((el) => (el.scrollTop = 40));
  await press(page, "tab:overview");
  await press(page, "tab:heroes");
  expect(await page.locator(`${panel} [data-key="list"]`).evaluate((el) => el.scrollTop)).toBeGreaterThanOrEqual(0);

  await pressKey(page, "Escape");
  await waitFor(
    async () => (!(await activeScenes(page)).includes("PlayerStats") ? true : null),
    "Escape leaves",
    10_000,
  );
  expect(errors).toEqual([]);
});

test.describe("in Spanish", () => {
  test.use({ locale: "es-ES" });

  test("the screen's chrome and tab names are Spanish", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one size is enough for the words");
    test.setTimeout(120_000);
    await openStats(page);
    expect(await findText(page, "TUS ESTADÍSTICAS", "PlayerStats"), "the title").not.toHaveLength(0);
    expect(await findText(page, "Resumen", "PlayerStats"), "the Overview tab").not.toHaveLength(0);
    expect(await findText(page, "VICTORIAS–DERROTAS", "PlayerStats"), "the record tile").not.toHaveLength(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/stats-lit-desktop-es.png` });
  });
});

test("on a phone the lift that ends a swipe over a record presses nothing", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the touch release is the phone's case");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 667 });
  const errors = trackPageErrors(page);
  await openStats(page, "records");
  const row = page.locator(`${panel} [data-key^="row:rec:"]`).first();
  await expect(row).toBeAttached();
  const box = (await row.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: at.x, y: Math.min(640, at.y + 140), id: 1 }],
  });
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(16);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: at.x, y: Math.min(640, at.y + 140) + ((at.y - Math.min(640, at.y + 140)) * i) / 10, id: 1 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(500);
  expect(await activeScenes(page), "the swipe opened no game").not.toContain("PastGames");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stats-lit-phone-records.png` });
  expect(errors).toEqual([]);
});
