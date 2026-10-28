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
const START = 9;
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

/** The game loop's frame count: the pad is read once a frame, and a busy machine runs the game at a few frames a second. */
const frameOf = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __mcGame: { loop: { frame: number } } }).__mcGame.loop.frame);

/** Waits until the game has run `frames` more frames than `from` (up to `capMs`). */
async function framesSince(page: Page, from: number, frames: number, capMs = 8000): Promise<void> {
  for (let waited = 0; waited < capMs; waited += 50) {
    if ((await frameOf(page)) >= from + frames) return;
    await page.waitForTimeout(50);
  }
}

/** Waits until every running scene's pad plugin has read the button as let go (a slow page reads the pad late). */
async function untilPadSeenUp(page: Page, index: number): Promise<void> {
  for (let waited = 0; waited < 10_000; waited += 50) {
    const up = await page.evaluate((i) => {
      const game = (
        window as unknown as {
          __mcGame: {
            scene: {
              scenes: {
                sys: { isActive(): boolean };
                input?: { gamepad?: { getPad(n: number): { buttons: { pressed: boolean }[] } | undefined } };
              }[];
            };
          };
        }
      ).__mcGame;
      return game.scene.scenes
        .filter((scene) => scene.sys.isActive())
        .every((scene) => !scene.input?.gamepad?.getPad(0)?.buttons[i]?.pressed);
    }, index);
    if (up) return;
    await page.waitForTimeout(50);
  }
}

/**
 * Holds a button until `done` (the pad is read once a frame), then lets go and waits until the game has seen it let go:
 * a press and a release inside one slow frame look like nothing, and two quick presses of one button like one.
 */
async function press(page: Page, index: number, done?: () => Promise<boolean>): Promise<void> {
  const start = await frameOf(page);
  await setButton(page, index, true);
  if (!done) {
    await page.waitForTimeout(300);
    await framesSince(page, start, 3);
  } else {
    for (let i = 0; i < 30; i += 1) {
      await page.waitForTimeout(100);
      if (await done()) break;
    }
  }
  const release = await frameOf(page);
  await setButton(page, index, false);
  await framesSince(page, release, 4);
  await untilPadSeenUp(page, index);
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

/** Leaving a screen waits for Title's chunk: have the dev server transform it now, so the B that leaves is not the slow one. */
async function warmTitle(page: Page): Promise<void> {
  await page.evaluate(() => import(/* @vite-ignore */ "/src/scenes/title.ts").then(() => true));
}

/** Every Trophy Room family open (they start folded, #479), so the rows are there to walk. Mirrors `ACHIEVEMENT_FAMILIES`. */
async function openEveryFamily(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const expanded = ["wins", "villains", "campaigns", "heroes", "expert", "feats", "decks", "teamups", "funny"];
    localStorage.setItem("mc-trophy-room-view", JSON.stringify({ sort: "category", descending: false, expanded }));
  });
}

async function openScreen(page: Page, query: string, landing: string): Promise<void> {
  await installPad(page);
  await openApp(page, query, { landing });
  // The left trigger does nothing alone: it wakes the pad plugin without moving focus.
  await press(page, LT);
  // The first pad press raises the "Controller connected" note, which takes the next B; let it go first.
  await waitFor(sceneGone(page, "PadToast"), "the pad note is gone", 30_000);
}

test("the Trophy Room: D-pad walks the rows, A opens one, B closes the sheet", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackPageErrors(page);
  await openEveryFamily(page);
  await openScreen(page, "screen=trophies&unlock=all", "TrophyRoom");
  await waitFor(async () => (await stopsOf(page, "TrophyRoom")).length > 3, "rows are stops", 30_000);
  const stops = await stopsOf(page, "TrophyRoom");
  expect(stops[0]).toBe("back");
  expect(stops.filter((key) => key.startsWith("row:")).length).toBeGreaterThan(10);

  await press(page, DOWN, async () => (await focusOf(page, "TrophyRoom")) !== null);
  const first = await focusOf(page, "TrophyRoom");
  expect(first, "the D-pad lands on something").not.toBeNull();
  // Walk down until a row is focused, then one more row (the keyboard's arrows step exactly once, however slow the page).
  for (let i = 0; i < 6 && !(await focusOf(page, "TrophyRoom"))?.startsWith("row:"); i += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
  }
  const row = await focusOf(page, "TrophyRoom");
  expect(row).toMatch(/^row:/);
  await page.keyboard.press("ArrowDown");
  await waitFor(async () => (await focusOf(page, "TrophyRoom")) !== row, "ArrowDown moves on", 10_000);
  const next = await focusOf(page, "TrophyRoom");
  expect(next).not.toBe(row);
  await page.keyboard.press("ArrowUp");
  await waitFor(async () => (await focusOf(page, "TrophyRoom")) === row, "ArrowUp moves back", 10_000);
  expect(await focusOf(page, "TrophyRoom")).toBe(row);

  // RB jumps to the next family's heading, LB comes back to this family's heading.
  await press(page, RB, async () => (await focusOf(page, "TrophyRoom")) !== row);
  const family = await focusOf(page, "TrophyRoom");
  // The keyboard walk above made the pad the "new" device again, so this first pad press raised the "Controller connected" note, which takes a B: let it go.
  await waitFor(sceneGone(page, "PadToast"), "the pad note is gone", 30_000);
  expect(family).toMatch(/^sec:/);
  expect(family).not.toBe("sec:wins");
  await press(page, LB, async () => (await focusOf(page, "TrophyRoom")) !== family);
  // LB lands on the heading of the family it was in, not somewhere in between.
  expect(await focusOf(page, "TrophyRoom")).toBe("sec:wins");
  await press(page, DOWN, async () => (await focusOf(page, "TrophyRoom")) === "row:wins-1");

  // A opens the sheet, B closes it and focus returns to the row it was opened from.
  const before = await focusOf(page, "TrophyRoom");
  await press(page, A, async () => (await stopsOf(page, "TrophyRoom")).join() === "close");
  expect(await stopsOf(page, "TrophyRoom")).toEqual(["close"]);
  await press(page, B, async () => (await stopsOf(page, "TrophyRoom")).length > 1);
  expect(await sceneIs(page, "TrophyRoom")()).toBe(true);
  expect(await focusOf(page, "TrophyRoom")).toBe(before);
  expect(errors).toEqual([]);
});

test("the Trophy Room on a phone: the sheet fits and Close works", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 780 });
  await openEveryFamily(page);
  await openScreen(page, "screen=trophies&unlock=all", "TrophyRoom");
  await waitFor(async () => (await stopsOf(page, "TrophyRoom")).length > 3, "rows are stops", 30_000);
  await press(page, RB, async () => ((await focusOf(page, "TrophyRoom")) ?? "").startsWith("sec:"));
  await press(page, DOWN, async () => ((await focusOf(page, "TrophyRoom")) ?? "").startsWith("row:"));
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
  await waitFor(async () => (await stopsOf(page, "TrophyRoom")).length > 1, "A on Close closes the sheet", 10_000);
});

test("How to win: the glossary term is a stop, A opens its tooltip, B closes it", async ({ page }) => {
  test.setTimeout(300_000);
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
  // The keyboard's Tab made the pad the "new" device again, so the first pad press raised its note once more.
  await waitFor(sceneGone(page, "PadToast"), "the pad note is gone", 30_000);
  // B closes the tooltip first, and the screen is still up.
  await press(page, B);
  expect(await sceneIs(page, "HowToWin")()).toBe(true);
  expect(errors).toEqual([]);
});

test("Report an issue over the Trophy Room: B closes the panel only, the screen under it stays", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "screen=trophies&unlock=all", "TrophyRoom");
  await waitFor(async () => (await stopsOf(page, "TrophyRoom")).length > 3, "rows are stops", 30_000);
  await page.evaluate(() =>
    (
      window as unknown as {
        __mcGame: { scene: { getScene: (key: string) => { scene: { launch: (key: string) => void } } } };
      }
    ).__mcGame.scene
      .getScene("TrophyRoom")
      .scene.launch("ReportIssueOverlay"),
  );
  await waitFor(sceneIs(page, "ReportIssueOverlay"), "the panel is up", 30_000);
  // Hold B well past the frame that closes the panel: the held press must not reach the Trophy Room as a new one.
  await press(page, B, sceneGone(page, "ReportIssueOverlay"));
  await page.waitForTimeout(1500);
  expect(await sceneIs(page, "ReportIssueOverlay")()).toBe(false);
  expect(await sceneIs(page, "TrophyRoom")()).toBe(true);
  expect(errors).toEqual([]);
});

test("Trophy Room on a phone: a swipe that lifts over a row opens no sheet", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 780 });
  await openEveryFamily(page);
  await openScreen(page, "screen=trophies&unlock=all", "TrophyRoom");
  await waitFor(async () => (await stopsOf(page, "TrophyRoom")).length > 3, "rows are stops", 30_000);
  const rects = await page.evaluate(() =>
    (
      window as unknown as {
        __mcFocusRoutes: Record<
          string,
          () => { key: string; rect: { x: number; y: number; width: number; height: number } }[]
        >;
      }
    ).__mcFocusRoutes.TrophyRoom!(),
  );
  const rows = rects.filter((stop) => stop.key.startsWith("row:") && stop.rect.y > 250 && stop.rect.y < 600);
  expect(rows.length).toBeGreaterThan(1);
  const from = rows[0]!.rect;
  const x = from.x + from.width / 2;
  // Drag up from one row and lift over another: a scroll, not a press.
  await page.mouse.move(x, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(x, from.y + from.height / 2 - i * 12);
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect((await stopsOf(page, "TrophyRoom")).length, "no sheet opened").toBeGreaterThan(10);
  // A plain tap on a row does open it.
  const after = await page.evaluate(() =>
    (
      window as unknown as {
        __mcFocusRoutes: Record<
          string,
          () => { key: string; rect: { x: number; y: number; width: number; height: number } }[]
        >;
      }
    ).__mcFocusRoutes.TrophyRoom!(),
  );
  const target = after.find((stop) => stop.key.startsWith("row:") && stop.rect.y > 300 && stop.rect.y < 500)!;
  await page.mouse.click(target.rect.x + target.rect.width / 2, target.rect.y + target.rect.height / 2);
  await waitFor(async () => (await stopsOf(page, "TrophyRoom")).join() === "close", "a tap opens the sheet", 10_000);
});

test("How to win: Start presses Start the fight", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = trackPageErrors(page);
  await openScreen(page, "screen=howtowin", "HowToWin");
  await waitFor(async () => (await stopsOf(page, "HowToWin")).includes("start-the-fight"), "stops are up", 30_000);
  await press(page, START, async () => (await findText(page, "Suiting up", "HowToWin")).length > 0);
  // The button turns into "Suiting up…" the moment the tutorial game is being started (the game itself takes a
  // while to load on a cold dev server, so this does not wait for the Board).
  await waitFor(
    async () => (await findText(page, "Suiting up", "HowToWin")).length > 0,
    "Start presses Start the fight",
    30_000,
  );
  expect(errors).toEqual([]);
});

for (const [screen, scene] of [
  ["trophies&unlock=all", "TrophyRoom"],
  ["howtowin", "HowToWin"],
] as const) {
  test(`B leaves ${scene}`, async ({ page }) => {
    test.setTimeout(300_000);
    const errors = trackPageErrors(page);
    await openScreen(page, `screen=${screen}`, scene);
    await waitFor(async () => (await stopsOf(page, scene)).length >= 2, "stops are up", 30_000);
    await warmTitle(page);
    // Held until the screen goes: a short press can fall between two reads of a slow page.
    await press(page, B, sceneGone(page, scene));
    await waitFor(sceneGone(page, scene), `B leaves ${scene}`, 90_000);
    expect(errors).toEqual([]);
  });
}
