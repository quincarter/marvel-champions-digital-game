import { expect, test, type Page } from "@playwright/test";
import { activeScenes, pressKey, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * The room deck picker draws as Lit panels over the canvas (`mc-sheet`, `src/dom/sheet-builder.ts`): the controls and the
 * grid or list of decks are one panel, the deck's details (a slide-out on a wide screen, a sheet on a phone) another
 * over it. Run against the dev preview of the picker (`?screen=room-deck-picker&as=guest`, `view/room-lobby-fixture.ts`),
 * whose Pick is recorded in `__mcRoomCalls` rather than sent. The keyboard walks the same stops with the DOM focus ring,
 * Escape closes the details and then leaves, a desktop mouse over a hero picture shows the card hover popover, and the
 * words follow the card language.
 */

const SCENE = "RoomDeckPicker";
const OPEN = "screen=room-deck-picker&as=guest";

const region = (page: Page, tag: string) => page.locator(`#mc-ui [data-scene="${SCENE}"] ${tag}`);
/** The controls: search, views, makers (made first). */
const main = (page: Page) => region(page, "mc-sheet").first();
/** The decks (tiles or rows). */
const grid = (page: Page) => region(page, "mc-deck-grid");
/** The details panel. */
const details = (page: Page) => region(page, "mc-deck-details");

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;
const focusOf = (page: Page): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate((key) => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState[key]!(), SCENE);

const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (globalThis as unknown as { __mcRoomCalls?: string[] }).__mcRoomCalls ?? []);

/** Presses `key` until the route's focus is a stop satisfying `want` (at most `tries` presses). */
async function walkTo(page: Page, want: (key: string | null) => boolean, key = "Tab", tries = 40): Promise<string> {
  for (let i = 0; i < tries; i++) {
    const { focus } = await focusOf(page);
    if (want(focus)) return focus!;
    await pressKey(page, key);
    await page.waitForTimeout(60);
  }
  throw new Error(`the focus never got where it was going: it is on ${(await focusOf(page)).focus}`);
}

test("the deck picker is a panel: a grid of decks, List switches the view, a deck opens its details and Use this deck chooses it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, OPEN, { landing: SCENE });
  const tiles = grid(page).locator('[data-key^="deck:"]');
  await waitFor(async () => ((await tiles.count()) > 5 ? true : null), "the grid lists the device's decks", 30_000);
  await expect(main(page).locator('[data-key="build"]')).toBeVisible();
  await expect(main(page).locator('[data-key="import"]')).toBeVisible();
  await expect(grid(page)).toContainText("Spider-Man");
  // Each tile says its deck's words, never a colour alone.
  await expect(grid(page)).toContainText("40 cards");

  // List: one row a deck with its own Pick button, and the choice is remembered.
  await main(page).locator('[data-key="view:list"]').click();
  await expect(grid(page).locator('[data-key^="pick:"]').first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("mc-room-deck-view"))).toBe("list");
  await main(page).locator('[data-key="view:grid"]').click();
  await expect(grid(page).locator('[data-key^="pick:"]')).toHaveCount(0);

  // A deck opens its details: the hero's words, the stats and the footer.
  await grid(page).locator('[data-key^="deck:"]').first().click();
  const panel = details(page);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Deck stats");
  await expect(panel).toContainText("Average cost");
  await expect(panel.locator('[data-key="panel:close"]')).toBeVisible();
  // Closing leaves the list as it was.
  await panel.locator('[data-key="panel:close"]').click();
  await expect(details(page)).toHaveCount(0);

  // Open again; once the deck is judged, Use this deck chooses it.
  await grid(page).locator('[data-key^="deck:"]').first().click();
  const use = details(page).locator('[data-key="panel:use"]');
  await expect(use).not.toHaveAttribute("disabled", "", { timeout: 30_000 });
  await use.click();
  await waitFor(async () => ((await calls(page)).length > 0 ? true : null), "the choice is recorded", 10_000);
  expect((await calls(page))[0]).toMatch(/^chooseDeck\(s1,/);
  expect(errors).toEqual([]);
});

test("the keyboard walks the picker with the DOM ring, Enter opens a deck, Escape closes it and then leaves", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, OPEN, { landing: SCENE });
  await waitFor(
    async () => ((await grid(page).locator('[data-key^="deck:"]').count()) > 5 ? true : null),
    "the decks",
    30_000,
  );
  // Back, the search field, the two views, the two makers, then the decks.
  const seen: string[] = [];
  for (let i = 0; i < 6; i++) {
    await pressKey(page, "Tab");
    const { focus } = await focusOf(page);
    if (focus) seen.push(focus);
  }
  expect(seen).toEqual(["back", "search", "view:grid", "view:list", "build", "import"]);
  expect((await focusOf(page)).ringShown).toBe(true);
  await expect(page.locator("#mc-ui .mc-focus-ring").last()).toBeVisible();

  const deck = await walkTo(page, (key) => key?.startsWith("deck:") ?? false);
  expect(deck).toMatch(/^deck:/);
  await pressKey(page, "Enter");
  await expect(details(page)).toBeVisible();
  // The focus is in the panel (a phone's sheet drops the deck's stop, so it may have to be walked to).
  await walkTo(page, (key) => key === "panel:use");
  await walkTo(page, (key) => key === "panel:close");

  // Escape closes the details first; the picker stays up. The next one leaves for the lobby.
  await pressKey(page, "Escape");
  await expect(details(page)).toHaveCount(0);
  expect(await activeScenes(page)).toContain(SCENE);
  await pressKey(page, "Escape");
  // The lobby is the way back (with no live room behind the dev preview it sends the player on again).
  await waitFor(async () => (!(await activeScenes(page)).includes(SCENE) ? true : null), "the picker is left", 15_000);
  await expect(region(page, "mc-sheet")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the search narrows the decks, and says so when none match", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackPageErrors(page);
  await openApp(page, OPEN, { landing: SCENE });
  const tiles = grid(page).locator('[data-key^="deck:"]');
  await waitFor(async () => ((await tiles.count()) > 5 ? true : null), "the decks", 30_000);
  const all = await tiles.count();
  const search = page.locator('input[placeholder^="Search your decks"]');
  await search.fill("wasp");
  // The precon and any community Wasp deck stay; the rest go.
  await waitFor(
    async () => {
      const now = await tiles.count();
      return now >= 1 && now < all ? true : null;
    },
    "the decks narrow to the Wasp ones",
    10_000,
  );
  await expect(grid(page)).toContainText("Wasp");
  await expect(grid(page)).not.toContainText("Spider-Man");
  await search.fill("zzzz-no-such-deck");
  await expect(grid(page)).toContainText("No deck matches that.");
  await expect(tiles).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("on a desktop, a hero picture shows the card hover popover, and so does a card line in the details", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "a mouse");
  test.setTimeout(120_000);
  await openApp(page, OPEN, { landing: SCENE });
  const tile = grid(page).locator('[data-key^="deck:"]').first();
  await expect(tile).toBeVisible({ timeout: 30_000 });
  const hoverKey = (): Promise<string | null> =>
    page.evaluate(
      () =>
        (window as unknown as { __mcDeckPickerDebug: { hoverKey(): string | null } }).__mcDeckPickerDebug.hoverKey() ??
        null,
    );
  const box = (await tile.boundingBox())!;
  // Resting the mouse on the tile's picture shows the popover (the panel passes the mouse on to Phaser).
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await waitFor(hoverKey, "the popover shows over a hero picture", 10_000);

  await tile.click();
  await expect(details(page)).toBeVisible();
  const line = details(page).getByText("Backflip", { exact: true }).first();
  await line.scrollIntoViewIfNeeded();
  const at = (await line.boundingBox())!;
  await page.mouse.move(at.x - 20, at.y + 40);
  await page.mouse.move(at.x + 5, at.y + at.height / 2);
  await waitFor(hoverKey, "the popover shows over a card line", 10_000);
});

test("the picker and its details read in Spanish", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openApp(page, OPEN, { landing: SCENE });
  await waitForText(page, "Crear un mazo", { sceneKey: SCENE });
  await expect(grid(page)).toContainText("40 cartas");
  await grid(page).locator('[data-key^="deck:"]').first().click();
  await expect(details(page)).toContainText("Estadísticas del mazo");
  await expect(details(page)).toContainText("Coste medio");
  await expect(details(page)).toContainText("Usar este mazo");
  await expect(details(page)).toContainText("Editar una copia");
});
