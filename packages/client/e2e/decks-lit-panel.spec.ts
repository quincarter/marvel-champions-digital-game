import { expect, test, type Page } from "@playwright/test";
import { activeScenes, findText, trackPageErrors, waitFor, waitForText } from "./helpers.js";
import { routeStops } from "./wave6-helpers-a.js";
import { openApp } from "./wave6-helpers-b.js";

/**
 * Decks & Collection: the chrome and the deck list pane draw as a Lit panel over the canvas (`mc-sheet`: the top bar,
 * the tab rail, the real `<input>` search, the filter bar and the picture rows), while the card pool, the stats rail and
 * the Import/Export box stay Phaser, seen through holes in the panel. The keys of every stop are the ones the Phaser
 * screen had.
 */

type FocusStates = Record<string, () => { focus: string | null; ringShown: boolean }>;

const focusOf = (page: Page, scene: string): Promise<{ focus: string | null; ringShown: boolean }> =>
  page.evaluate((key) => (window as unknown as { __mcFocusState: FocusStates }).__mcFocusState[key]!(), scene);

const PANEL = `#mc-ui [data-scene="Decks"]`;
const search = (page: Page) => page.locator(`${PANEL} [data-key="deck-search"] input`);
const rows = (page: Page) => page.locator(`${PANEL} [data-stop^="deck:"]`);

async function openDecks(page: Page, query = "screen=decks"): Promise<void> {
  await openApp(page, query, { landing: "Decks" });
  await waitFor(async () => ((await rows(page).count()) > 3 ? true : null), "the deck rows", 30_000);
}

test("Decks draws its chrome and deck list as a Lit panel: rows, search through the worker, filters, Escape", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = trackPageErrors(page);
  await openDecks(page);
  expect(await findText(page, "DECKS & COLLECTION", "Decks")).not.toHaveLength(0);
  expect(await findText(page, "Your decks", "Decks")).not.toHaveLength(0);
  await expect(page.locator(`${PANEL} [data-stop="new-deck"]`)).toHaveCount(1);
  await expect(search(page)).toHaveAttribute("placeholder", "search decks…");
  const all = await rows(page).count();

  // Typing goes to the worker's fuzzy, accent-free ranking and narrows the rows.
  await search(page).click();
  await search(page).pressSequentially("captain marvel");
  await waitFor(
    async () => {
      const now = await rows(page).count();
      return now > 0 && now < all ? true : null;
    },
    "the search narrows the list",
    15_000,
  );
  // Escape takes the caret out and the screen stays; the clear button brings everything back.
  await page.keyboard.press("Escape");
  await expect(search(page)).not.toBeFocused();
  expect(await activeScenes(page)).toContain("Decks");
  await page.locator(`${PANEL} [data-key="deck-search"] .clear`).click();
  await waitFor(async () => ((await rows(page).count()) === all ? true : null), "the list is whole again", 15_000);

  // The Filters button opens the chips (each a stop); a chip narrows the list and a second press clears it.
  await page.locator(`${PANEL} [data-key="filters"]`).click();
  const chips = page.locator(`${PANEL} [data-key="deck-chips"]`);
  await expect(chips).toHaveCount(1);
  const stops = await waitFor(
    async () => {
      const found = (await routeStops(page, "Decks"))?.stops ?? [];
      return found.some((stop) => stop.key.startsWith("deck-chip:")) ? found : null;
    },
    "the chips are stops",
    10_000,
  );
  expect(stops.some((stop) => stop.key === "filters-toggle")).toBe(true);
  const legal = stops.find((stop) => stop.key === "deck-chip:legal-only")!.rect;
  await page.mouse.click(legal.x + legal.width / 2, legal.y + legal.height / 2);
  await waitFor(
    async () => ((await chips.locator("mc-filter-chip[selected]").count()) === 1 ? true : null),
    "Legal only is on",
    10_000,
  );
  expect(errors).toEqual([]);
});

test("the keyboard walks the same stops with the ring in the DOM, and Enter on the search puts the caret in", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await openDecks(page);
  await page.keyboard.press("Tab");
  await waitFor(async () => ((await focusOf(page, "Decks")).focus ? true : null), "something has focus", 5000);
  expect((await focusOf(page, "Decks")).focus).toBe("back");
  expect(await page.locator("#mc-ui .mc-focus-ring").isVisible()).toBe(true);
  for (let step = 0; step < 12 && (await focusOf(page, "Decks")).focus !== "deck-search"; step++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(80);
  }
  expect((await focusOf(page, "Decks")).focus).toBe("deck-search");
  await page.keyboard.press("Enter");
  await expect(search(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search(page)).not.toBeFocused();
  expect(await activeScenes(page)).toContain("Decks");
});

test("a deck row selects its deck, the stats rail follows, and a thumbnail shows the hero hover on a mouse", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  await openDecks(page);
  const second = rows(page).nth(1);
  await expect(page.locator(`${PANEL} [data-key^="row:"] img`).first()).toHaveCount(1);
  if (info.project.name !== "phone") {
    // The mouse over a row's thumbnail opens the hero's card popover (a thumbnail is placed from the list's own left).
    const thumb = page.locator(`${PANEL} [data-key^="row:"]`).first().locator("mc-picture-tile").first();
    const box = (await thumb.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await waitFor(
      async () =>
        (await page.evaluate(
          () =>
            (window as unknown as { __mcDecksDebug?: { hoverShown(): string | null } }).__mcDecksDebug?.hoverShown() ??
            null,
        )) !== null
          ? true
          : null,
      "the hero popover over a row thumbnail",
      10_000,
    );
    await page.mouse.move(2, 2);
    // A click on a row of a precon opens its Check (the first look at a deck).
    await second.click();
    await waitFor(async () => ((await activeScenes(page)).includes("DeckCheck") ? true : null), "Check opens", 15_000);
  }
});

test("Decks reads in Spanish", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openDecks(page);
  await waitForText(page, "MAZOS Y COLECCIÓN", { sceneKey: "Decks" });
  await expect(search(page)).toHaveAttribute("placeholder", "buscar mazos…");
  await expect(page.locator(PANEL).getByText("Tus mazos").first()).toBeVisible();
});

test("Decks names the precons and their heroes in Spanish", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("mc-settings", '{"cardLanguage":"es"}'));
  await openDecks(page);
  await waitForText(page, "MAZOS Y COLECCIÓN", { sceneKey: "Decks" });
  const panel = page.locator(PANEL);
  // The names come from the Spanish card text, which loads after the screen: they show once it is in.
  await expect(panel).toContainText("Capitana Marvel", { timeout: 30_000 });
  await expect(panel).toContainText("Hulka");
  await expect(panel).toContainText("Ojo de Halcón");
  // A phone row has room for the product line; a desktop row keeps it for the stats rail.
  if (info.project.name === "phone") await expect(panel).toContainText("mazo inicial de la Caja básica");
  for (const english of ["Captain Marvel /"]) {
    await expect(panel).not.toContainText(english);
  }
});

test("on a phone, the tab rail switches panes and a swipe over the deck list opens nothing", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "a touch layout");
  test.setTimeout(150_000);
  await openDecks(page);
  await expect(page.locator(`${PANEL} mc-tab-rail`)).toHaveCount(1);
  const first = (await rows(page).nth(2).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = first.x + first.width / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: first.y + 20, id: 1 }] });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: first.y + 20 - i * 14, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(600);
  expect(await activeScenes(page)).toContain("Decks");
  expect(await activeScenes(page)).not.toContain("DeckActionsSheet");
  await page.locator(`${PANEL} [data-key="tab:cards"]`).tap();
  await waitFor(
    async () => (((await routeStops(page, "Decks"))?.stops ?? []).some((s) => s.key.startsWith("pool-")) ? true : null),
    "the Cards pane is up",
    15_000,
  );
});

test("the card pool's free-word search still narrows the pool on a second visit to Decks", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "the wide layout shows the pool beside the list");
  test.setTimeout(150_000);
  const errors = trackPageErrors(page);
  await openDecks(page);
  const cells = (): Promise<number> => page.locator(`${PANEL} [data-key^="cell:"]`).count();
  await waitFor(async () => ((await cells()) > 3 ? true : null), "the pool cards", 30_000);
  // Leave for the Title and come back: the scene (and its search worker) is made again.
  await page.locator(`${PANEL} [data-stop="back"]`).click();
  await waitFor(async () => ((await activeScenes(page)).includes("Title") ? true : null), "the Title", 30_000);
  // As the Title's own Decks row does (`goToScreen`): the Title is stopped, not left running under Decks, where the
  // letters typed below would reach its shortcuts.
  await page.evaluate(() => {
    const scenes = (window as unknown as { __mcGame: { scene: { stop(key: string): void; start(key: string): void } } })
      .__mcGame.scene;
    scenes.stop("Title");
    scenes.start("Decks");
  });
  await waitFor(async () => ((await rows(page).count()) > 3 ? true : null), "the deck rows again", 30_000);
  await waitFor(async () => ((await cells()) > 3 ? true : null), "the pool cards again", 30_000);
  const all = await cells();
  const field = page.locator(`${PANEL} mc-search-field[data-key="pool-search"] input`);
  // The panel may be drawn again (a status or a picture arriving) between the press and the typing: press until the
  // caret is in the field, so the letters never reach the screen's shortcuts.
  await waitFor(
    async () => {
      await field.click();
      return (await field.evaluate((el) => (el.getRootNode() as ShadowRoot).activeElement === el)) ? true : null;
    },
    "the caret is in the pool search field",
    15_000,
  );
  await page.keyboard.type("spider");
  await waitFor(
    async () => {
      const now = await cells();
      return now > 0 && now < all ? now : null;
    },
    "the free word narrows the pool",
    15_000,
  );
  expect(errors).toEqual([]);
});
