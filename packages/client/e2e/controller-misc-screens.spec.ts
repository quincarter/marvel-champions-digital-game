import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, trackPageErrors, waitFor } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Controller and keyboard on the screens that had no pass yet (owner: "Trophy room is not navigatable via controller"):
 * - The Trophy Room: the D-pad walks the achievement rows (the list follows), A opens one in a sheet, B closes the sheet
 *   and then leaves; LB / RB jump between families.
 * - How to win: the glossary term is a stop, A opens its tooltip, B closes that and then leaves; Start presses Start the
 *   fight.
 */

const PAD_ID = "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)";
const A = 0;
const B = 1;
const LB = 4;
const RB = 5;
const LT = 6;
const UP = 12;
const DOWN = 13;

async function installPad(page: Page): Promise<void> {
  await page.addInitScript((id) => {
    const button = () => ({ pressed: false, touched: false, value: 0 });
    const pad = {
      connected: true,
      id,
      index: 0,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, button),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __fakePad: unknown }).__fakePad = pad;
    Object.defineProperty(navigator, "getGamepads", {
      value: () => {
        pad.timestamp = performance.now();
        return [pad];
      },
      configurable: true,
    });
  }, PAD_ID);
}

async function setButton(page: Page, index: number, on: boolean): Promise<void> {
  await page.evaluate(
    ([i, down]) => {
      const pad = (window as unknown as { __fakePad: { buttons: unknown[] } }).__fakePad;
      pad.buttons[i as number] = { pressed: down, touched: down, value: down ? 1 : 0 };
    },
    [index, on] as const,
  );
}

/** Holds a button until `done` (the pad is read once a frame), then lets go. */
async function press(page: Page, index: number, done?: () => Promise<boolean>): Promise<void> {
  await setButton(page, index, true);
  if (!done) await page.waitForTimeout(400);
  else {
    for (let i = 0; i < 30; i += 1) {
      await page.waitForTimeout(100);
      if (await done()) break;
    }
  }
  await setButton(page, index, false);
  await page.waitForTimeout(300);
}

const sceneIs = (page: Page, key: string) => async () => (await activeScenes(page)).includes(key);
const sceneGone = (page: Page, key: string) => async () => !(await activeScenes(page)).includes(key);

const focusOf = (page: Page, scene: string): Promise<string | null> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState?: Record<string, () => { focus: string | null }> }).__mcFocusState?.[
        key
      ]?.().focus ?? null,
    scene,
  );

const stopsOf = (page: Page, scene: string): Promise<string[]> =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusRoutes?: Record<string, () => { key: string }[]> }).__mcFocusRoutes?.[
        key
      ]?.().map((stop) => stop.key) ?? [],
    scene,
  );

async function openScreen(page: Page, query: string, landing: string): Promise<void> {
  await installPad(page);
  await openApp(page, query, { landing });
  // The left trigger does nothing alone: it wakes the pad plugin without moving focus.
  await press(page, LT);
  // The first pad press raises the "Controller connected" note, which takes the next B; let it go first.
  await waitFor(sceneGone(page, "PadToast"), "the pad note is gone", 30_000);
}

test("the Trophy Room: D-pad walks the rows, A opens one, B closes the sheet and then leaves", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "screen=trophies&unlock=all", "TrophyRoom");
  await waitFor(async () => (await stopsOf(page, "TrophyRoom")).length > 3, "rows are stops", 30_000);
  const stops = await stopsOf(page, "TrophyRoom");
  expect(stops[0]).toBe("back");
  expect(stops.filter((key) => key.startsWith("row:")).length).toBeGreaterThan(10);

  await press(page, DOWN, async () => (await focusOf(page, "TrophyRoom")) !== null);
  const first = await focusOf(page, "TrophyRoom");
  expect(first, "the D-pad lands on something").not.toBeNull();
  // Walk down until a row is focused, then one more row.
  for (let i = 0; i < 4 && !(await focusOf(page, "TrophyRoom"))?.startsWith("row:"); i += 1) {
    await press(page, DOWN);
  }
  const row = await focusOf(page, "TrophyRoom");
  expect(row).toMatch(/^row:/);
  await press(page, DOWN, async () => (await focusOf(page, "TrophyRoom")) !== row);
  const next = await focusOf(page, "TrophyRoom");
  expect(next).not.toBe(row);
  await press(page, UP, async () => (await focusOf(page, "TrophyRoom")) === row);
  expect(await focusOf(page, "TrophyRoom")).toBe(row);

  // RB jumps a family ahead, LB comes back to this family's start.
  await press(page, RB, async () => (await focusOf(page, "TrophyRoom")) !== row);
  const family = await focusOf(page, "TrophyRoom");
  expect(Number(family!.slice(4))).toBeGreaterThan(Number(row!.slice(4)));
  await press(page, LB, async () => (await focusOf(page, "TrophyRoom")) !== family);

  // A opens the sheet, B closes it (focus returns to the row), B again leaves.
  const before = await focusOf(page, "TrophyRoom");
  await press(page, A, async () => (await stopsOf(page, "TrophyRoom")).join() === "close");
  expect(await stopsOf(page, "TrophyRoom")).toEqual(["close"]);
  await press(page, B, async () => (await stopsOf(page, "TrophyRoom")).length > 1);
  expect(await sceneIs(page, "TrophyRoom")()).toBe(true);
  expect(await focusOf(page, "TrophyRoom")).toBe(before);
  // Leaving waits for Title's chunk, which a cold dev server takes a while to serve.
  await press(page, B);
  await waitFor(sceneGone(page, "TrophyRoom"), "B leaves the Trophy Room", 90_000);
  expect(errors).toEqual([]);
});

test("the Trophy Room on a phone: the sheet fits and Close works", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 780 });
  await openScreen(page, "screen=trophies&unlock=all", "TrophyRoom");
  await waitFor(async () => (await stopsOf(page, "TrophyRoom")).length > 3, "rows are stops", 30_000);
  await press(page, RB, async () => ((await focusOf(page, "TrophyRoom")) ?? "").startsWith("row:"));
  await press(page, A, async () => (await stopsOf(page, "TrophyRoom")).join() === "close");
  const close = await page.evaluate(
    () =>
      (
        window as unknown as {
          __mcFocusRoutes: Record<
            string,
            () => { key: string; rect: { x: number; y: number; width: number; height: number } }[]
          >;
        }
      ).__mcFocusRoutes.TrophyRoom!()[0]!.rect,
  );
  expect(close.x).toBeGreaterThanOrEqual(0);
  expect(close.x + close.width).toBeLessThanOrEqual(390);
  expect(close.y + close.height).toBeLessThanOrEqual(780);
  await press(page, A, async () => (await stopsOf(page, "TrophyRoom")).length > 1);
  expect((await stopsOf(page, "TrophyRoom")).length).toBeGreaterThan(1);
});

test("How to win: the glossary term is a stop, A opens its tooltip, B closes it and then leaves", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "screen=howtowin", "HowToWin");
  await waitFor(async () => (await stopsOf(page, "HowToWin")).length >= 3, "stops are up", 30_000);
  const stops = await stopsOf(page, "HowToWin");
  expect(stops[0]).toBe("close");
  expect(stops.some((key) => key.startsWith("term:"))).toBe(true);
  expect(stops.slice(-2)).toEqual(["tell-me-more", "start-the-fight"]);

  // Tab walks the route (the keyboard's twin of a pad step): the close first, then the term.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  expect(await focusOf(page, "HowToWin")).toMatch(/^term:/);
  await press(page, A);
  expect((await findText(page, "RULES GLOSSARY", "HowToWin")).length).toBeGreaterThan(0);
  // B closes the tooltip first, and the screen is still up; the next B leaves.
  await press(page, B);
  expect(await sceneIs(page, "HowToWin")()).toBe(true);
  await press(page, B);
  await waitFor(sceneGone(page, "HowToWin"), "B leaves How to win", 90_000);
  expect(errors).toEqual([]);
});
