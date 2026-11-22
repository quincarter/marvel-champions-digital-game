import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle, waitFor } from "./helpers.js";
import { routeStops, trackErrors, waitForScene, type Stop } from "./wave6-helpers-a.js";
import { hook, openApp } from "./wave6-helpers-b.js";
import { swipeOver } from "./global-stats-helpers.js";

/**
 * GitHub #958: on a phone or tablet, Decks & Collection shows one pane at a time, so a tap on a deck that only
 * selected it looked like it did nothing. A tap now opens the deck's options (Play, Edit, View cards, Stats, Check,
 * Duplicate, Delete). Desktop keeps a click as a plain select, with every pane already on screen.
 */

interface DeckRow {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly selected: boolean;
  readonly status: string;
}

const SHEET = "DeckActionsSheet";
const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 1280;
const decks = async (page: Page): Promise<readonly DeckRow[]> =>
  (await hook<DeckRow[]>(page, "__mcDecksDebug", "decks")) ?? [];

async function stopOf(page: Page, scene: string, key: string): Promise<Stop> {
  return waitFor(
    async () => (await routeStops(page, scene))?.stops.find((stop) => stop.key === key) ?? null,
    `${key} on ${scene}`,
    30_000,
  );
}

async function tap(page: Page, scene: string, key: string): Promise<void> {
  await stopOf(page, scene, key);
  await settle(page, { quietMs: 200, maxMs: 1200 });
  const { rect } = await stopOf(page, scene, key);
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  if (isPhone(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function openDecks(page: Page): Promise<readonly DeckRow[]> {
  await openApp(page, "unlock=all&screen=decks", { landing: "Decks" });
  return waitFor(async () => ((await decks(page)).length > 1 ? decks(page) : null), "the deck list", 30_000);
}

const sheetUp = async (page: Page): Promise<boolean> => (await activeScenes(page)).includes(SHEET);
const waitForSheet = (page: Page, up: boolean): Promise<true> =>
  waitFor(
    async () => ((await sheetUp(page)) === up ? true : null),
    up ? "the deck's options" : "the sheet closed",
    15_000,
  );

test.describe("tapping a deck (#958)", () => {
  test("desktop: a click selects the deck and opens nothing over it", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "the three-pane layout");
    const errors = trackErrors(page);
    const list = await openDecks(page);
    const other = list.find((deck) => !deck.selected)!;
    await tap(page, "Decks", `deck:${other.id}`);
    await waitFor(
      async () => ((await decks(page)).find((deck) => deck.id === other.id)?.selected ? true : null),
      "the clicked deck selected",
    );
    await settle(page);
    expect(await sheetUp(page)).toBe(false);
    expect(errors).toEqual([]);
  });

  test("phone: a tap opens the deck's options, and each one does what it says", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "touch layout");
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    const list = await openDecks(page);
    const precon = list.find((deck) => deck.source === "precon" && !deck.selected)!;

    // A precon: Play, Edit a copy, the hidden panes, Check, Duplicate, and no Delete.
    await tap(page, "Decks", `deck:${precon.id}`);
    await waitForSheet(page, true);
    const keys = (await routeStops(page, SHEET))!.stops.map((stop) => stop.key);
    expect(keys).toEqual([
      "action:play",
      "action:edit",
      "action:cards",
      "action:stats",
      "action:check",
      "action:duplicate",
      "back",
    ]);
    expect((await decks(page)).find((deck) => deck.id === precon.id)?.selected, "the tap selected it too").toBe(true);

    // View cards: the sheet closes on the Cards tab.
    await tap(page, SHEET, "action:cards");
    await waitForSheet(page, false);
    expect(await hook(page, "__mcDecksDebug", "tab")).toBe("cards");

    // Back on the Decks tab, a tap outside the box closes the sheet without doing anything.
    await tap(page, "Decks", "tab:decks");
    await waitFor(async () => ((await hook(page, "__mcDecksDebug", "tab")) === "decks" ? true : null), "Decks tab");
    await tap(page, "Decks", `deck:${precon.id}`);
    await waitForSheet(page, true);
    await page.touchscreen.tap(8, 8);
    await waitForSheet(page, false);
    expect(await hook(page, "__mcDecksDebug", "tab")).toBe("decks");

    // Duplicate makes a deck of the player's own, which has Delete, behind a second press.
    const before = (await decks(page)).length;
    await tap(page, "Decks", `deck:${precon.id}`);
    await waitForSheet(page, true);
    await tap(page, SHEET, "action:duplicate");
    await waitForSheet(page, false);
    const copy = await waitFor(async () => {
      const now = await decks(page);
      return now.length === before + 1 ? (now.find((deck) => deck.selected && deck.source !== "precon") ?? null) : null;
    }, "the copy, selected");
    await tap(page, "Decks", `deck:${copy.id}`);
    await waitForSheet(page, true);
    expect((await routeStops(page, SHEET))!.stops.map((stop) => stop.key)).toContain("action:delete");
    await tap(page, SHEET, "action:delete");
    await settle(page);
    expect(await sheetUp(page), "one press only arms Delete").toBe(true);
    expect((await decks(page)).some((deck) => deck.id === copy.id)).toBe(true);
    await tap(page, SHEET, "action:delete");
    await waitForSheet(page, false);
    await waitFor(
      async () => ((await decks(page)).some((deck) => deck.id === copy.id) ? null : true),
      "the copy deleted",
    );

    // Edit opens the deck's card list in the deck builder. The list sits where the copy was: tap a deck in view.
    const height = page.viewportSize()!.height;
    const inView = await waitFor(
      async () =>
        (await routeStops(page, "Decks"))?.stops.find(
          (stop) => stop.key.startsWith("deck:") && stop.rect.y > 250 && stop.rect.y + stop.rect.height < height - 180,
        ) ?? null,
      "a deck in view",
    );
    await tap(page, "Decks", inView.key);
    await waitForSheet(page, true);
    await tap(page, SHEET, "action:edit");
    await waitForScene(page, "DeckBuilder");
    expect(errors).toEqual([]);
  });

  test("phone: a swipe on the deck list that lifts over a deck opens nothing", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "touch only");
    const errors = trackErrors(page);
    const list = await openDecks(page);
    const second = (await stopOf(page, "Decks", `deck:${list[1]!.id}`)).rect;
    const third = (await stopOf(page, "Decks", `deck:${list[2]!.id}`)).rect;
    await settle(page);
    await swipeOver(page, third, second);
    await settle(page);
    expect(await sheetUp(page)).toBe(false);
    expect(errors).toEqual([]);
  });
});

interface SheetAction {
  readonly id: string;
  readonly enabled: boolean;
  readonly reason?: string;
}

const sheetHook = <T>(page: Page, method: string): Promise<T | null> => hook<T>(page, "__mcDeckActionsDebug", method);
const sheetAction = async (page: Page, id: string): Promise<SheetAction | undefined> =>
  ((await sheetHook<SheetAction[]>(page, "actions")) ?? []).find((action) => action.id === id);
const sheetKeys = async (page: Page): Promise<readonly string[]> =>
  ((await routeStops(page, SHEET))?.stops ?? []).map((stop) => stop.key);

/** Opens a deck's options from its row. */
async function openOptions(page: Page, deckId: string): Promise<void> {
  await tap(page, "Decks", `deck:${deckId}`);
  await waitForSheet(page, true);
  await settle(page, { quietMs: 200, maxMs: 1000 });
}

/** Shows one of the deck lists alone (Preconstructed, Your decks, Community) from behind the Filters button. */
async function showList(page: Page, chip: string): Promise<void> {
  if (!(await routeStops(page, "Decks"))?.stops.some((stop) => stop.key === `deck-chip:${chip}`))
    await tap(page, "Decks", "filters-toggle");
  await tap(page, "Decks", `deck-chip:${chip}`);
  await settle(page);
}

/** Duplicates `deckId` from its options and returns the copy, which the list selects and brings into view. */
async function duplicate(page: Page, deckId: string): Promise<DeckRow> {
  const before = new Set((await decks(page)).map((deck) => deck.id));
  await openOptions(page, deckId);
  await tap(page, SHEET, "action:duplicate");
  await waitForSheet(page, false);
  return waitFor(
    async () => (await decks(page)).find((deck) => !before.has(deck.id) && deck.selected) ?? null,
    "the copy, selected",
  );
}

test.describe("the deck's options (#958 review)", () => {
  test.beforeEach(({ browserName: _browser }, info) => test.skip(info.project.name !== "phone", "touch layout"));

  test("a deck still being checked opens with a Play that seats it", async ({ page }) => {
    // Hold back the worker that checks the whole list, so the deck tapped still reads Checking… until the tap.
    await page.route(/deck-search\.worker/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 25_000));
      await route.continue().catch(() => undefined);
    });
    const errors = trackErrors(page);
    await openDecks(page);
    const height = page.viewportSize()!.height;
    const target = await waitFor(async () => {
      const stops = (await routeStops(page, "Decks"))?.stops ?? [];
      const shown = (id: string): boolean =>
        stops.some(
          (stop) => stop.key === `deck:${id}` && stop.rect.y > 250 && stop.rect.y + stop.rect.height < height - 180,
        );
      return (await decks(page)).find((deck) => deck.status === "Checking…" && shown(deck.id)) ?? null;
    }, "a deck on screen still being checked");
    await openOptions(page, target.id);
    // The drawn Play button, pressed for real: it seats this deck.
    await tap(page, SHEET, "action:play");
    await waitForScene(page, "Seats");
    await waitFor(
      async () => ((await hook<string[]>(page, "__mcSeatsDebug", "seats")) ?? []).includes(target.id) || null,
      "the checked deck in seat one",
    );
    expect(errors).toEqual([]);
  });

  test("Play seats the deck it was opened on", async ({ page }) => {
    const list = await openDecks(page);
    const target = list.find((deck) => deck.source === "precon" && !deck.selected)!;
    await openOptions(page, target.id);
    await tap(page, SHEET, "action:play");
    await waitForScene(page, "Seats");
    await waitFor(
      async () => ((await hook<string[]>(page, "__mcSeatsDebug", "seats")) ?? []).includes(target.id) || null,
      "the deck in seat one",
    );
  });

  test("an illegal deck: Play stays shut and says why, the delete warning stays up, Escape closes", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const errors = trackErrors(page);
    await openDecks(page);
    await tap(page, "Decks", "ie-paste-toggle");
    await tap(page, "Decks", "paste-field");
    await page.keyboard.type("Hero: Gambit\nAspect: Justice\n2x Energy");
    await settle(page);
    await tap(page, "Decks", "paste-import");
    const illegal = await waitFor(
      async () => (await decks(page)).find((deck) => deck.source === "imported" && deck.selected) ?? null,
      "the imported deck",
    );
    await openOptions(page, illegal.id);
    expect(await sheetAction(page, "play")).toMatchObject({ enabled: false });

    await tap(page, SHEET, "action:delete");
    await waitFor(async () => (await sheetHook<boolean>(page, "armed")) || null, "Delete armed");
    const warning = await sheetHook<string>(page, "warning");
    expect(warning).toContain("can't be undone");
    await tap(page, SHEET, "action:play");
    await settle(page);
    expect(await sheetUp(page), "a press on a Play that can't go only says why").toBe(true);
    expect(await sheetHook<string>(page, "note")).toBeTruthy();
    expect(await sheetHook<string>(page, "warning"), "the delete warning is still up").toBe(warning);

    await page.keyboard.press("Escape");
    await waitForSheet(page, false);
    expect(await activeScenes(page)).toContain("Decks");
    expect(
      (await decks(page)).some((deck) => deck.id === illegal.id),
      "nothing was deleted",
    ).toBe(true);
    expect(errors).toEqual([]);
  });

  test("keys reach the sheet, not the screen under it", async ({ page }) => {
    const list = await openDecks(page);
    await openOptions(page, list[1]!.id);
    // G opens Your stats from Decks & Collection; with the sheet up it must not.
    await page.keyboard.press("g");
    await settle(page);
    expect(await activeScenes(page)).not.toContain("PlayerStats");
    expect(await sheetUp(page)).toBe(true);
    await page.keyboard.press("Escape");
    await waitForSheet(page, false);
    expect(await hook(page, "__mcDecksDebug", "tab")).toBe("decks");
  });

  test("a community deck's Add saves that deck", async ({ page }) => {
    interface Offer {
      readonly id: string;
      readonly lock: string | null;
      readonly added: boolean;
    }
    await openDecks(page);
    const offers = async (): Promise<readonly Offer[]> =>
      (await hook<Offer[]>(page, "__mcDecksDebug", "community")) ?? [];
    await showList(page, "community");
    const offer = await waitFor(
      async () => (await offers()).find((o) => o.lock === null && !o.added) ?? null,
      "an open community deck",
    );
    await openOptions(page, offer.id);
    expect(await sheetKeys(page)).toEqual(["action:add", "action:cards", "action:check", "back"]);
    const before = (await decks(page)).length;
    await tap(page, SHEET, "action:add");
    await waitForSheet(page, false);
    await waitFor(
      async () => (await offers()).find((o) => o.id === offer.id)?.added || null,
      "the community deck added",
    );
    expect((await decks(page)).length).toBe(before + 1);
  });

  test("Duplicate with Preconstructed alone shown brings the copy into view", async ({ page }) => {
    await openDecks(page);
    await showList(page, "list:precon");
    const precon = (await decks(page)).find((deck) => deck.source === "precon" && !deck.selected)!;
    const copy = await duplicate(page, precon.id);
    await openOptions(page, copy.id);
    expect(await sheetKeys(page)).toContain("action:delete");
  });

  test("a phone held sideways reaches every action and Back, with Delete armed too", async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    const list = await openDecks(page);
    const inView = async (): Promise<void> => {
      const stops = (await routeStops(page, SHEET))!.stops;
      expect(stops.map((stop) => stop.key)).toContain("back");
      for (const { key, rect } of stops) {
        expect(rect.y, `${key} starts on screen`).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height, `${key} ends on screen`).toBeLessThanOrEqual(375);
        expect(rect.x + rect.width, `${key} fits across`).toBeLessThanOrEqual(667);
      }
    };
    const copy = await duplicate(page, list[0]!.id);
    await openOptions(page, copy.id);
    await inView();
    await tap(page, SHEET, "action:delete");
    await waitFor(async () => (await sheetHook<boolean>(page, "armed")) || null, "Delete armed");
    await settle(page);
    await inView();
    await tap(page, SHEET, "back");
    await waitForSheet(page, false);
  });

  test("sideways, a long-named illegal deck shows both notes and keeps every control on screen", async ({ page }) => {
    test.setTimeout(150_000);
    // Imported upright, where the paste field has room, then turned sideways.
    await openDecks(page);
    await tap(page, "Decks", "ie-paste-toggle");
    await tap(page, "Decks", "paste-field");
    await page.keyboard.type(
      "Deck name: The Ragin' Cajun's Very Long Kinetic Card Throwing Justice Deck That Is Not Finished Yet\n" +
        "Hero: Gambit\nAspect: Justice\n2x Energy",
    );
    await settle(page);
    await tap(page, "Decks", "paste-import");
    const illegal = await waitFor(
      async () => (await decks(page)).find((deck) => deck.source === "imported" && deck.selected) ?? null,
      "the imported deck",
    );
    await page.setViewportSize({ width: 667, height: 375 });
    await settle(page);
    await openOptions(page, illegal.id);
    await tap(page, SHEET, "action:delete");
    await waitFor(async () => (await sheetHook<boolean>(page, "armed")) || null, "Delete armed");
    await tap(page, SHEET, "action:play");
    await waitFor(async () => (await sheetHook<string>(page, "note")) ?? null, "why Play did nothing");
    await settle(page);
    expect(await sheetHook<string>(page, "warning")).toContain("can't be undone");
    const stops = (await routeStops(page, SHEET))!.stops;
    expect(stops.map((stop) => stop.key)).toContain("back");
    for (const { key, rect } of stops) {
      expect(rect.y, `${key} starts on screen`).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height, `${key} ends on screen`).toBeLessThanOrEqual(375);
    }
    await tap(page, SHEET, "back");
    await waitForSheet(page, false);
  });
});
