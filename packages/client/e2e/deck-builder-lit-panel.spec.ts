import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { installWave6Helpers, routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The deck builder's two pop-up sheets are elements (`mc-search-help`, `mc-pool-pick`) over the canvas (`scenes/search-help-sheet.ts`,
 * `scenes/pool-pick-sheet.ts`): the "?" search cheat sheet (Use puts an example in the search, Copy copies it) and the
 * pack and wave picker. Their lists scroll natively, their buttons are taps, and the keyboard walks the same stops with
 * the DOM focus ring (Escape closes). The builder screen itself is a Lit panel too (`scenes/deck-builder.ts`): one
 * page element, `mc-deck-builder-page`, with real search inputs, native scrolling and a windowed pool list.
 */

const sheetOf = (page: Page, scene: string) => page.locator(`#mc-ui [data-scene="${scene}"]`);

const focusOf = (page: Page, scene: string) =>
  page.evaluate(
    (key) =>
      (window as unknown as { __mcFocusState: Record<string, () => { focus: string | null; ringShown: boolean }> })
        .__mcFocusState[key]!(),
    scene,
  );

async function openBuilder(page: Page): Promise<void> {
  await installWave6Helpers(page);
  await openApp(page, "screen=deck-builder", { landing: "DeckBuilder" });
  await page.waitForTimeout(800);
}

async function pressBuilderStop(page: Page, key: string): Promise<void> {
  const stop = await waitFor(
    async () => (await routeStops(page, "DeckBuilder"))?.stops.find((s) => s.key === key) ?? null,
    `the ${key} control`,
    15_000,
  );
  await page.mouse.click(stop.rect.x + stop.rect.width / 2, stop.rect.y + stop.rect.height / 2);
}

test("the ? cheat sheet is a panel over the builder: rows scroll, Use fills the search, Escape closes", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the phone folds the search behind its filters");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openBuilder(page);
  await pressBuilderStop(page, "filter-help");
  const help = sheetOf(page, "SearchHelpSheet");
  await expect(help).toBeVisible();
  await expect(help.locator("mc-search-help mc-dialog").first()).toBeVisible();
  // The rows have Use and Copy buttons in the list; the first example is the cost term.
  await expect(help.locator('[data-stop="use:6"]')).toBeVisible();
  await expect(help.locator('[data-stop="copy:6"]')).toBeVisible();
  // The keyboard walks the stops with the DOM ring (the first one is the first Use).
  await pressKey(page, "Tab");
  expect((await focusOf(page, "SearchHelpSheet")).focus).toBe("use:6");
  expect((await focusOf(page, "SearchHelpSheet")).ringShown).toBe(true);
  // Escape closes the sheet and leaves the builder as it was.
  await pressKey(page, "Escape");
  await waitFor(
    async () => (!(await activeScenes(page)).includes("SearchHelpSheet") ? true : null),
    "the sheet closes",
  );
  await expect(help).toHaveCount(0);
  // Use puts the example in the search and closes the sheet.
  await pressBuilderStop(page, "filter-help");
  await expect(help.locator('[data-stop="use:6"]')).toBeVisible();
  await help.locator('[data-stop="use:6"]').click();
  await waitFor(
    async () => (!(await activeScenes(page)).includes("SearchHelpSheet") ? true : null),
    "the sheet closes",
  );
  expect(await page.locator("input").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toContain(
    "o:2",
  );
  await settle(page);
  expect(errors).toEqual([]);
});

test("the pack picker is a panel: rows toggle, All clears, Done closes", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the pack name sits in the wide layout's pool column");
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openBuilder(page);
  await pressBuilderStop(page, "pack:name");
  const picker = sheetOf(page, "PoolPickSheet");
  await expect(picker).toBeVisible();
  await expect(picker.locator('[data-stop="pick:all"]')).toHaveAttribute("selected", "");
  const first = picker.locator('mc-button[data-stop^="pick:"]:not([data-stop="pick:all"])').first();
  await first.click();
  await expect(first).toHaveAttribute("selected", "");
  await expect(picker.locator('[data-stop="pick:all"]')).not.toHaveAttribute("selected", "");
  await picker.locator('[data-stop="pick:all"]').click();
  await expect(picker.locator('[data-stop="pick:all"]')).toHaveAttribute("selected", "");
  await picker.locator('[data-stop="done"]').click();
  await waitFor(async () => (!(await activeScenes(page)).includes("PoolPickSheet") ? true : null), "the picker closes");
  expect(errors).toEqual([]);
});

// ---- The builder screen itself ----------------------------------------------------------------------------------

const builderSheet = (page: Page) => page.locator('#mc-ui [data-scene="DeckBuilder"]');
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
const stopsOfBuilder = async (page: Page): Promise<{ key: string; rect: Box }[]> =>
  (await routeStops(page, "DeckBuilder"))?.stops ?? [];
const centreOf = (r: Box) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const cardStops = async (page: Page): Promise<string[]> =>
  (await stopsOfBuilder(page)).filter((s) => s.key.startsWith("card:")).map((s) => s.key.slice(5));

test("the builder is one Lit panel: the search is a real input and the pool filters from it", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openBuilder(page);
  await expect(builderSheet(page)).toBeVisible();
  // The pool is a list the panel scrolls itself.
  await expect(builderSheet(page).locator("mc-pool-list mc-windowed-list")).toBeVisible();
  const all = (await cardStops(page)).length;
  expect(all).toBeGreaterThan(50);
  // The search is a real <input>.
  const input = builderSheet(page).locator('mc-search-field[data-stop="filter-text"] input');
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type("t:event rp:1");
  await waitFor(
    async () => {
      const count = (await cardStops(page)).length;
      return count > 0 && count < all ? count : null;
    },
    "the pool filters by the smart query",
    15_000,
  );
  // Clear (the field's own button) brings every card back.
  await builderSheet(page).locator('mc-search-field[data-stop="filter-text"] .clear').click();
  await waitFor(async () => ((await cardStops(page)).length === all ? true : null), "the pool is whole again", 15_000);
  expect(errors).toEqual([]);
});

test("the pool list is windowed: only the rows near the viewport are parts, and a scroll builds the next ones", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openBuilder(page);
  const list = builderSheet(page).locator("mc-pool-list mc-windowed-list");
  await expect(list).toBeVisible();
  const cards = await cardStops(page);
  const built = () => builderSheet(page).locator('[data-key^="open:"]').count();
  const first = await built();
  expect(first).toBeGreaterThan(0);
  expect(first).toBeLessThan(cards.length / 2);
  const last = cards[cards.length - 1]!;
  await expect(builderSheet(page).locator(`[data-key="open:${last}"]`)).toHaveCount(0);
  // Pictures are lazy images: none outside the window is even a part.
  expect(await builderSheet(page).locator('mc-pool-list mc-windowed-list img[loading="lazy"]').count()).toBeLessThan(
    cards.length / 2,
  );
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(builderSheet(page).locator(`[data-key="open:${last}"]`)).toHaveCount(1, { timeout: 15_000 });
  await expect(builderSheet(page).locator(`[data-key="open:${cards[0]}"]`)).toHaveCount(0);
  expect(await built()).toBeLessThan(cards.length / 2);
  // A card's stop sits where its tile is, scrolled to the end too.
  const stop = (await stopsOfBuilder(page)).find((s) => s.key === `card:${last}`)!;
  const view = await list.boundingBox();
  expect(stop.rect.y).toBeGreaterThanOrEqual(view!.y - 2);
  expect(stop.rect.y).toBeLessThan(view!.y + view!.height);
});

test("a card's plus and minus edit the deck, and a right-click on its picture opens Inspect", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "the right-click is a desktop press; the phone's hold is the same handler",
  );
  test.setTimeout(120_000);
  await openBuilder(page);
  const firstId = (await cardStops(page))[0]!;
  const quantity = builderSheet(page).locator(`[data-key="qty:${firstId}"]`);
  await expect(builderSheet(page).locator(`[data-key="plus:${firstId}"]`)).toBeVisible();
  await builderSheet(page).locator(`[data-key="plus:${firstId}"]`).click();
  await expect(quantity).toHaveText("×1");
  await builderSheet(page).locator(`[data-key="minus:${firstId}"]`).click();
  await expect(quantity).toHaveText("");
  await builderSheet(page).locator(`[data-key="open:${firstId}"]`).click({ button: "right" });
  await waitFor(async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect opens");
  await pressKey(page, "Escape");
  await waitFor(async () => (!(await activeScenes(page)).includes("InspectOverlay") ? true : null), "Inspect closes");
});

test("the keyboard walks the builder's stops with the DOM focus ring", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the ring follows a keyboard");
  test.setTimeout(120_000);
  await openBuilder(page);
  await pressKey(page, "Tab");
  const state = await focusOf(page, "DeckBuilder");
  expect(state.focus).not.toBeNull();
  expect(state.ringShown).toBe(true);
});

test("a swipe of the pool that lifts over a plus adds nothing (the tap rule)", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the finger-lift rule is a phone rule");
  test.setTimeout(120_000);
  await openBuilder(page);
  const id = (await cardStops(page))[0]!;
  const plus = await builderSheet(page).locator(`[data-key="plus:${id}"]`).boundingBox();
  const from = centreOf(plus!);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x, y: from.y - i * 12, id: 1 }],
    });
  for (let i = 10; i >= 0; i--)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x, y: from.y - i * 12, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(500);
  await expect(builderSheet(page).locator(`[data-key="qty:${id}"]`)).toHaveText("");
});
