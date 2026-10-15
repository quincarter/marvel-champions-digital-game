import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressAt, settle, waitFor, zoneRect } from "./helpers.js";
import { installWave6Helpers, skipVillainPhase, visibleTexts } from "./wave6-helpers-a.js";
import { declineMulligans, hook, type Rect } from "./wave6-helpers-b.js";
import {
  answerPreferDecline,
  choiceRects,
  openTitle,
  pressBoardText,
  pressFocus,
  shot,
  startFixture,
} from "./wave7-screens-helpers.js";

/**
 * Two layout reports from play:
 *
 * - Issue #119: with thirteen cards in play the play area shrank each one to a sliver its own "▶ EXHAUST" strip
 *   covered. The row now keeps its cards at a readable size and scrolls sideways.
 * - Issue #125: on the defend sheet an option's last line ("2-5 of 10 HP") ran out of the bottom of its card.
 */

const fixture = async (page: Page, which: string): Promise<void> => {
  await installWave6Helpers(page);
  await openTitle(page);
  await startFixture(page, "dev-qa-screens-game.ts", "startScreensQaGame", which);
};

const board = <T>(page: Page, method: string, ...args: unknown[]): Promise<T | null> =>
  hook<T>(page, "__mcBoardDebug", method, ...args);
const scrollOf = async (page: Page): Promise<{ scrollX: number; maxScroll: number }> =>
  (await board<{ scrollX: number; maxScroll: number }>(page, "playAreaScroll"))!;
/** Where the padded play area's cards are drawn right now, by pad index. */
const padRects = async (page: Page): Promise<Map<number, Rect>> => {
  const all = (await board<[string, Rect][]>(page, "allFocusRects")) ?? [];
  return new Map(
    all.flatMap(([key, rect]): [number, Rect][] => {
      const match = /^card:padp-(\d+)$/.exec(key);
      return match ? [[Number(match[1]), rect]] : [];
    }),
  );
};

test("issue #119: a crowded play area keeps its cards readable and scrolls sideways", async ({ page }) => {
  test.setTimeout(180_000);
  await fixture(page, "restricted");
  const zone = (await zoneRect(page, "playArea"))!;

  // A few cards: they all fit, and nothing scrolls.
  await board(page, "setBoardPad", { playArea: 4 });
  await settle(page);
  expect((await scrollOf(page)).maxScroll).toBe(0);

  await board(page, "setBoardPad", { playArea: 13 });
  await settle(page);
  await shot(page, "play-area-13-start");
  const start = await scrollOf(page);
  expect(start.maxScroll).toBeGreaterThan(0);
  expect(start.scrollX).toBe(0);
  let rects = await padRects(page);
  expect(rects.has(12), "the last card is off the right edge").toBe(false);
  for (const rect of rects.values()) {
    expect(rect.x).toBeGreaterThanOrEqual(zone.x);
    expect(rect.x + rect.width).toBeLessThanOrEqual(zone.x + zone.width);
    expect(rect.height, "a card keeps a readable height").toBeGreaterThanOrEqual(120);
  }

  // The wheel over the identity panel leaves the row alone; over the row it scrolls it to its end.
  const me = (await zoneRect(page, "me"))!;
  await page.mouse.move(me.x + me.width / 2, me.y + me.height / 2);
  await page.mouse.wheel(0, 400);
  await settle(page);
  expect((await scrollOf(page)).scrollX).toBe(0);
  await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2);
  await page.mouse.wheel(0, 5000);
  await settle(page);
  const end = await scrollOf(page);
  expect(end.scrollX).toBe(end.maxScroll);
  rects = await padRects(page);
  const last = rects.get(12)!;
  expect(last, "the last card is on screen at the end of the row").toBeTruthy();
  expect(last.x + last.width).toBeLessThanOrEqual(zone.x + zone.width);
  await shot(page, "play-area-13-end");

  // The chevron on the left edge is a button: one click pages the row back.
  await page.mouse.click(zone.x + 22, zone.y + zone.height / 2 + 8);
  await settle(page);
  expect((await scrollOf(page)).scrollX).toBeLessThan(end.maxScroll);
});

test("issue #119: Doctor Strange's Invocation deck keeps its column beside a crowded, scrolling play area", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await installWave6Helpers(page);
  await page.goto("/?screen=board&scenario=rhino&deck=drs-protection&seed=3");
  await waitFor(async () => ((await activeScenes(page)).includes("Board") ? true : null), "Board is up", 60_000);
  await declineMulligans(page);
  await settle(page, { quietMs: 1000, maxMs: 6000 });
  await board(page, "setBoardPad", { playArea: 13 });
  await settle(page);

  const zone = (await zoneRect(page, "playArea"))!;
  const piles = ((await board<[string, Rect][]>(page, "allPileRects")) ?? []).filter(([key]) =>
    key.startsWith("separate"),
  );
  expect(piles.length, "the Invocation deck and its discard are drawn").toBe(2);
  const columnLeft = Math.min(...piles.map(([, rect]) => rect.x));
  for (const [, rect] of piles) expect(rect.x + rect.width).toBeLessThanOrEqual(zone.x + zone.width);

  const clearOfColumn = async (): Promise<void> => {
    const rects = await padRects(page);
    expect(rects.size).toBeGreaterThan(0);
    for (const rect of rects.values()) {
      expect(rect.x).toBeGreaterThanOrEqual(zone.x);
      expect(rect.x + rect.width, "no card reaches under the Invocation deck").toBeLessThanOrEqual(columnLeft);
    }
  };
  expect((await scrollOf(page)).maxScroll).toBeGreaterThan(0);
  await clearOfColumn();
  await shot(page, "play-area-strange-start");

  // The wheel over the Invocation deck leaves the row alone; over the row it scrolls to the last card.
  const [, deck] = piles[0]!;
  await page.mouse.move(deck.x + deck.width / 2, deck.y + deck.height / 2);
  await page.mouse.wheel(0, 400);
  await settle(page);
  expect((await scrollOf(page)).scrollX).toBe(0);
  await page.mouse.move(zone.x + (columnLeft - zone.x) / 2, zone.y + zone.height / 2);
  await page.mouse.wheel(0, 5000);
  await settle(page);
  const end = await scrollOf(page);
  expect(end.scrollX).toBe(end.maxScroll);
  expect((await padRects(page)).has(12), "the last card is on screen").toBe(true);
  await clearOfColumn();
  await shot(page, "play-area-strange-end");
});

/** Every text that starts inside an option card must end inside it. */
async function overflowingOptionTexts(page: Page): Promise<string[]> {
  const options = (await choiceRects(page)).filter(([key]) => key.startsWith("option:")).map(([, rect]) => rect);
  const texts = (await visibleTexts(page)).filter((t) => t.scene === "ChoiceOverlay");
  const bad: string[] = [];
  for (const rect of options) {
    const bottom = rect.y + rect.height;
    for (const t of texts) {
      const top = t.y - t.h / 2;
      const inside = t.x > rect.x && t.x < rect.x + rect.width && top >= rect.y && top < bottom - 2;
      if (inside && t.y + t.h / 2 > bottom + 1) bad.push(`${t.text.trim()} (${Math.round(t.y + t.h / 2 - bottom)}px)`);
    }
  }
  return bad;
}

test("issue #125: a defend option's lines all sit inside its card, at every window size", async ({ page }) => {
  test.setTimeout(240_000);
  await fixture(page, "warpath");
  await pressFocus(page, false, "basic:endTurn");
  let onSheet = false;
  const began = Date.now();
  while (Date.now() - began < 90_000 && !onSheet) {
    const scenes = await activeScenes(page);
    if (scenes.includes("GameOver")) break;
    // The defend is answered in the docked villain phase; this test is about the full-screen sheet, so EXPAND opens it.
    const expand = await page.evaluate(
      () =>
        (
          window as unknown as { __mcVillainPhaseDebug?: { expandRect?: () => Rect | null } }
        ).__mcVillainPhaseDebug?.expandRect?.() ?? null,
    );
    if (expand) {
      await pressAt(page, expand.x + expand.width / 2, expand.y + expand.height / 2);
      await settle(page, { quietMs: 400, maxMs: 2000 });
    } else if (scenes.includes("EndTurnConfirmOverlay")) {
      await pressBoardText(page, false, /^end turn$/i, "EndTurnConfirmOverlay");
    } else if (scenes.includes("ChoiceOverlay")) {
      await settle(page, { quietMs: 500, maxMs: 2500 });
      const texts = (await visibleTexts(page)).filter((t) => t.scene === "ChoiceOverlay");
      onSheet = texts.some((t) => /^no defense$/i.test(t.text.trim()));
      if (!onSheet) await answerPreferDecline(page);
    } else if (scenes.includes("VillainPhaseOverlay")) {
      await skipVillainPhase(page);
    }
    await page.waitForTimeout(250); // loop pacing, not a blind wait
  }
  expect(onSheet, "the defend sheet opened").toBe(true);

  // The long table, a short desktop window, a tablet held upright, a narrow desktop window and a phone.
  const sizes = [
    [1440, 900],
    [1300, 600],
    [1024, 560],
    [853, 1100],
    [800, 620],
    [800, 520],
    [760, 420],
    [390, 844],
    [390, 600],
  ] as const;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await settle(page, { quietMs: 600, maxMs: 3000 });
    const options = (await choiceRects(page)).filter(([key]) => key.startsWith("option:"));
    expect(options.length, `${width}x${height}: the sheet shows its options`).toBeGreaterThan(1);
    expect(await overflowingOptionTexts(page), `${width}x${height}: text past the foot of its card`).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`defend-${width}x${height}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot(page, "defend-sheet");
});
