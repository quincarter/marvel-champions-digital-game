import { expect, test, type Page } from "@playwright/test";
import { findText, settle, waitFor } from "./helpers.js";
import { routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Issue #544: the deck builder's narrow layout is three tabs (Pool, Deck, From your games) under a fixed tab row, one
 * thing scrolling at a time. These drive it as a phone does (390 x 844, real touch): Pool fills the screen and adds a
 * card, the Deck tab's count and list follow, the name field shows on Deck only, Save is pinned on screen, and a swipe
 * that lifts over the tab row presses nothing (issue #227's standing rule).
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const stops = async (page: Page): Promise<{ key: string; rect: Rect }[]> =>
  (await routeStops(page, "DeckBuilder"))?.stops ?? [];
const stop = async (page: Page, key: string): Promise<{ key: string; rect: Rect } | undefined> =>
  (await stops(page)).find((s) => s.key === key);
const hasKey = async (page: Page, key: string): Promise<boolean> => (await stop(page, key)) !== undefined;
const centre = (r: Rect): { x: number; y: number } => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

async function tapStop(page: Page, key: string): Promise<void> {
  const at = await waitFor(async () => (await stop(page, key)) ?? null, `control "${key}"`, 15_000);
  await settle(page, { quietMs: 200, maxMs: 800 });
  const now = (await stop(page, key)) ?? at;
  const { x, y } = centre(now.rect);
  await page.touchscreen.tap(x, y);
  await settle(page, { quietMs: 200, maxMs: 800 });
}

/** A finger drag from `from` to `to`, lifted at `to` (a real touch sequence over CDP). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const steps = 10;
  const at = (i: number) => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(i), id: 1 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page, { quietMs: 250, maxMs: 1000 });
}

const deckTabText = async (page: Page): Promise<string> => {
  // The button draws its words in capitals.
  const found = [...(await findText(page, "DECK ", "DeckBuilder")), ...(await findText(page, "Deck ", "DeckBuilder"))];
  return found.map((m) => m.text.trim()).find((t) => /^deck \d+(\/\d+)?$/i.test(t)) ?? "";
};

async function openBuilder(page: Page): Promise<void> {
  await openApp(page, "screen=deck-builder&unlock=all", { landing: "DeckBuilder" });
  await settle(page);
}

test.describe("deck builder tabs on a phone", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1000, "the narrow layout is the phone's");

  test("Pool fills the screen and adds a card; Deck counts and lists it; the name field is on Deck only; Save is on screen", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openBuilder(page);
    const viewport = page.viewportSize()!;

    // The tab row, and only the Pool tab's controls.
    for (const key of ["tab:pool", "tab:deck", "tab:games"]) expect(await hasKey(page, key), key).toBe(true);
    for (const key of ["name", "save", "preconstructed", "clear"]) expect(await hasKey(page, key), key).toBe(false);
    expect(await hasKey(page, "filters-toggle")).toBe(true);
    // The pool list fills the screen: its first card starts under the search and Filters rows, and the Filters chip is a
    // fold, not an always-open block.
    const firstCard = (await stops(page)).find((s) => s.key.startsWith("card:"))!;
    expect(firstCard.rect.y).toBeLessThan(260);
    expect(await hasKey(page, "type:ally")).toBe(false);

    // Start the deck small so the count is visibly short of the minimum, then add from the pool.
    await tapStop(page, "tab:deck");
    // Clear sits at the end of the scrolling deck region: swipe to it.
    await swipe(page, { x: viewport.width / 2, y: viewport.height - 200 }, { x: viewport.width / 2, y: 150 });
    await swipe(page, { x: viewport.width / 2, y: viewport.height - 200 }, { x: viewport.width / 2, y: 150 });
    await tapStop(page, "clear");
    await waitFor(
      async () => (/deck \d+\/40/i.test(await deckTabText(page)) ? true : null),
      "a short deck count",
      10_000,
    );
    const before = await deckTabText(page);
    await tapStop(page, "tab:pool");
    expect(await hasKey(page, "name")).toBe(false);
    const card = (await stops(page)).find((s) => s.key.startsWith("card:") && s.rect.y > 150 && s.rect.y < 500)!;
    // The cell's "+" is at its foot, right-hand end.
    await page.touchscreen.tap(card.rect.x + card.rect.width - 24, card.rect.y + card.rect.height - 26);
    await settle(page, { quietMs: 250, maxMs: 1000 });
    const after = await deckTabText(page);
    expect(after, "the Deck tab counts the added card").not.toBe(before);
    // A card added from Pool stays on Pool.
    expect(await hasKey(page, "tab:pool")).toBe(true);
    expect((await stops(page)).some((s) => s.key.startsWith("card:"))).toBe(true);
    expect(await hasKey(page, "save")).toBe(false);

    // Deck: the aspect picker, name, the list with the added card, and Save pinned on screen.
    await tapStop(page, "tab:deck");
    for (const key of ["name", "preconstructed", "clear", "save"]) expect(await hasKey(page, key), key).toBe(true);
    expect((await stops(page)).some((s) => s.key.startsWith("card:"))).toBe(false);
    expect(await hasKey(page, "filter-text")).toBe(false);
    const save = (await stop(page, "save"))!;
    expect(save.rect.y).toBeGreaterThan(viewport.height * 0.7);
    expect(save.rect.y + save.rect.height).toBeLessThanOrEqual(viewport.height);

    // The name field is a DOM input over the canvas: on Deck it is there to type in, off Deck it is gone.
    // Each tab keeps its own scroll, and this one was swiped down to Clear: back up to the name.
    await swipe(page, { x: viewport.width / 2, y: 200 }, { x: viewport.width / 2, y: viewport.height - 180 });
    await swipe(page, { x: viewport.width / 2, y: 200 }, { x: viewport.width / 2, y: viewport.height - 180 });
    const nameField = page.locator('input[placeholder=""]');
    await expect(nameField).toBeVisible();
    await nameField.fill("Tabs deck");
    expect(await findText(page, "Tabs deck", "DeckBuilder")).toBeDefined();
    await tapStop(page, "tab:pool");
    await expect(nameField).toBeHidden();
    await expect(page.getByPlaceholder("Search, or o:2 t:ally")).toBeVisible();
    await tapStop(page, "tab:deck");
    await expect(nameField).toBeVisible();
    await expect(nameField).toHaveValue("Tabs deck");
    await expect(page.getByPlaceholder("Search, or o:2 t:ally")).toBeHidden();

    // From your games: its own tab, with neither field.
    await tapStop(page, "tab:games");
    await expect(nameField).toBeHidden();
    await expect(page.getByPlaceholder("Search, or o:2 t:ally")).toBeHidden();
    for (const key of ["name", "save", "filter-text"]) expect(await hasKey(page, key), key).toBe(false);
    expect((await stops(page)).some((s) => s.key.startsWith("card:"))).toBe(false);

    // Back on Deck, Save is reachable and presses.
    await tapStop(page, "tab:deck");
    await tapStop(page, "save");
    await waitFor(
      async () => ((await findText(page, "Saved to your decks", "DeckBuilder")).length > 0 ? true : null),
      "the saved line",
      15_000,
    );
  });

  test("the Filters chip opens the filters in place of the list and counts what is on", async ({ page }) => {
    test.setTimeout(90_000);
    await openBuilder(page);
    await tapStop(page, "filters-toggle");
    expect(await hasKey(page, "type:ally")).toBe(true);
    expect(await hasKey(page, "pack:sort")).toBe(true);
    expect((await stops(page)).some((s) => s.key.startsWith("card:"))).toBe(false);
    await tapStop(page, "type:ally");
    await tapStop(page, "pack:sort");
    expect((await findText(page, "Filters · 2", "DeckBuilder")).length).toBeGreaterThan(0);
    await tapStop(page, "filters-toggle");
    expect((await stops(page)).some((s) => s.key.startsWith("card:"))).toBe(true);
    expect(await hasKey(page, "type:ally")).toBe(false);
  });

  test("a swipe of a tab's list that lifts over the tab row presses nothing", async ({ page }) => {
    test.setTimeout(120_000);
    await openBuilder(page);
    const viewport = page.viewportSize()!;
    const mid = viewport.width / 2;

    // Pool: scroll the list, then swipe down and lift on the Deck tab.
    const poolTop = async (): Promise<number> => (await stops(page)).find((s) => s.key.startsWith("card:"))!.rect.y;
    const startY = await poolTop();
    await swipe(page, { x: mid, y: viewport.height - 120 }, { x: mid, y: 300 });
    expect(await poolTop(), "the pool list scrolled").toBeLessThan(startY);
    const deckTab = centre((await stop(page, "tab:deck"))!.rect);
    await swipe(page, { x: mid, y: 400 }, deckTab);
    expect(await hasKey(page, "tab:pool")).toBe(true);
    expect(
      (await stops(page)).some((s) => s.key.startsWith("card:")),
      "still on Pool",
    ).toBe(true);
    expect(await hasKey(page, "name")).toBe(false);

    // Deck: scroll the region, then lift on the Pool tab.
    await tapStop(page, "tab:deck");
    const regionTop = async (): Promise<number> => (await stop(page, "preconstructed"))!.rect.y;
    const before = await regionTop();
    await swipe(page, { x: mid, y: viewport.height - 200 }, { x: mid, y: 260 });
    expect(await regionTop(), "the deck region scrolled").toBeLessThan(before);
    const poolTab = centre((await stop(page, "tab:pool"))!.rect);
    await swipe(page, { x: mid, y: 400 }, poolTab);
    expect(await hasKey(page, "name"), "still on Deck").toBe(true);
    expect((await stops(page)).some((s) => s.key.startsWith("card:"))).toBe(false);

    // From your games: lift on the Pool tab.
    await tapStop(page, "tab:games");
    await swipe(page, { x: mid, y: 600 }, centre((await stop(page, "tab:pool"))!.rect));
    expect(await hasKey(page, "name")).toBe(false);
    expect(
      (await stops(page)).some((s) => s.key.startsWith("card:")),
      "still on From your games",
    ).toBe(false);
    expect(await hasKey(page, "tab:games")).toBe(true);
  });
});
