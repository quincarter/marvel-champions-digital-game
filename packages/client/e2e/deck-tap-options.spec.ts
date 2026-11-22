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

    // Edit opens the deck's card list in the deck builder.
    await tap(page, "Decks", `deck:${precon.id}`);
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
