import { expect, test, type Page } from "@playwright/test";
import { activeScenes, focusRect, isPhonePage, pressUntil, settle, waitFor } from "./helpers.js";
import { installWave6Helpers, trackErrors } from "./wave6-helpers-a.js";
import { findVisibleText, openApp, type Rect } from "./wave6-helpers-b.js";
import { texts } from "./wave7-deck-builder-helpers.js";
import { press } from "./x-men-helpers.js";

/**
 * Issue #548: a card in the victory display gets a pile in the encounter column, a tap fans it out as a discard pile
 * does and a pad reaches it; the deck builder's type chips include player side schemes.
 */

const OVERLAY = "PileViewOverlay";

const victoryPile = (page: Page): Promise<Rect | null> =>
  page.evaluate(() => {
    const debug = (window as unknown as { __mcBoardDebug: { allPileRects(): [string, Rect][] } }).__mcBoardDebug;
    return debug.allPileRects().find(([key]) => key === "victoryDisplay")?.[1] ?? null;
  });

const pileCount = (page: Page): Promise<number | null> =>
  page.evaluate(
    () => (window as unknown as { __mcPileViewDebug?: { count(): number } }).__mcPileViewDebug?.count() ?? null,
  );

const center = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

test("the victory display's pile opens its cards on a tap", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await installWave6Helpers(page);
  await openApp(page, "screen=board&fixture=victory", { landing: "Board" });
  const phone = isPhonePage(page);
  // The phone board shows one tab at a time, and the encounter column rides on Enemies.
  if (phone && (await victoryPile(page)) === null) {
    const tab = await waitFor(async () => (await findVisibleText(page, "ENEMIES"))[0] ?? null, "the Enemies tab");
    await press(page, phone, tab!.x, tab!.y);
    await settle(page, { quietMs: 300, maxMs: 3000 });
  }
  const rect = (await waitFor(() => victoryPile(page), "the victory display pile"))!;
  const { x, y } = center(rect);
  expect(await focusRect(page, "victoryDisplay"), "a pad stop on the pile").not.toBeNull();
  if (!phone) {
    // A redraw under a still pointer drops a pending popover, so the pointer moves again until it shows.
    let nudge = 0;
    await pressUntil(
      page,
      () => page.mouse.move(x + (nudge++ % 2) * 4, y, { steps: 2 }),
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __mcBoardDebug: { hoverShown(): string | null } }).__mcBoardDebug.hoverShown() !==
            null,
        ),
      "the hover popover over the pile",
    );
  }
  if (!phone) {
    // Keyboard and pad reach the pile on the focus route; Enter opens it, Escape closes it.
    await pressUntil(
      page,
      () => page.keyboard.press("Tab"),
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __mcBoardDebug: { focusedKey(): string | null } }).__mcBoardDebug.focusedKey() ===
            "victoryDisplay",
        ),
      "Tab reaches the pile",
      { minWaitMs: 100, timeoutMs: 40_000 },
    );
    await page.keyboard.press("Enter");
    await waitFor(async () => ((await activeScenes(page)).includes(OVERLAY) ? true : null), "Enter opens the pile");
    await settle(page, { quietMs: 300, maxMs: 3000 });
    await page.keyboard.press("Escape");
    await waitFor(async () => ((await activeScenes(page)).includes(OVERLAY) ? null : true), "Escape closes the pile");
  }
  await pressUntil(
    page,
    () => press(page, phone, x, y),
    async () => (await activeScenes(page)).includes(OVERLAY),
    "a tap on the pile opens it",
  );
  await waitFor(() => pileCount(page), "the pile view");
  expect(await pileCount(page)).toBe(1);
  expect(errors).toEqual([]);
});

test("the Side scheme chip narrows the pool to player side schemes", async ({ page }) => {
  test.setTimeout(120_000);
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  const phone = isPhonePage(page);
  const stopRect = (key: string): Promise<Rect | null> =>
    page.evaluate(
      (k) =>
        (window as unknown as { __mcFocusRoutes: Record<string, () => { key: string; rect: Rect }[]> }).__mcFocusRoutes[
          "DeckBuilder"
        ]!().find((stop) => stop.key === k)?.rect ?? null,
      key,
    );
  const poolCount = async (): Promise<number> => {
    const line = (await texts(page, "DeckBuilder")).find((t) => /^(pool\s+—\s+)?\d+\s+cards?$/i.test(t));
    return Number(/(\d+)/.exec(line ?? "")?.[1] ?? NaN);
  };
  const all = await waitFor(async () => {
    const count = await poolCount();
    return Number.isFinite(count) && count > 0 ? count : null;
  }, "the pool count");
  // A phone keeps the filters behind the Filters chip.
  if (phone) {
    const toggle = await waitFor(() => stopRect("filters-toggle"), "the Filters chip", 15_000);
    await press(page, phone, ...(Object.values(center(toggle)) as [number, number]));
    await page.waitForTimeout(500);
  }
  const chip = (await waitFor(() => stopRect("type:scheme"), "the Side scheme chip", 15_000))!;
  await press(page, phone, ...(Object.values(center(chip)) as [number, number]));
  const filtered = await waitFor(async () => {
    const count = await poolCount();
    return count < all ? count : null;
  }, "the chip filters the pool");
  expect(filtered).toBeGreaterThan(0);
});
