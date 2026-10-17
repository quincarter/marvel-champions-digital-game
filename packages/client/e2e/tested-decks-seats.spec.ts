import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, pressHookStop, settle, trackPageErrors, waitFor } from "./helpers.js";
import { dealToFirstTurn, findVisibleText, gameFacts, hook, openApp, type Rect } from "./wave6-helpers-b.js";
import { clickStop, routeStops, scrollStopIntoView, seatDeckThroughTile } from "./wave6-helpers-a.js";

/**
 * Take your seats: the tested MarvelCDB community decks behind the TESTED chip (and under BUILT). A new player turns the
 * chip on, sees only community decks, picks the Core Spider-Man deck for seat 1, and plays a game with its cards. Controls
 * are read from `__mcSeatsDebug`, the same rects the screen draws.
 *
 * `TESTED_DECKS_SHOTS=<dir>` also saves a screenshot at each step.
 */

interface Stop extends Rect {
  readonly key: string;
}
const SPIDER_MAN = "hero:community:103";

const stops = async (page: Page): Promise<string[]> =>
  ((await hook<Stop[]>(page, "__mcSeatsDebug", "stops")) ?? []).map((s) => s.key);
const heroStops = async (page: Page): Promise<string[]> => (await stops(page)).filter((key) => key.startsWith("hero:"));

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.TESTED_DECKS_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

/** Whether the screen shows `text` in either case (tiles print their captions in capitals, the panel does not). */
async function shows(page: Page, text: string, scene: string): Promise<boolean> {
  return (
    (await findVisibleText(page, text, scene)).length > 0 ||
    (await findVisibleText(page, text.toUpperCase(), scene)).length > 0
  );
}

async function press(page: Page, key: string): Promise<void> {
  await pressHookStop(page, "__mcSeatsDebug", key);
  await settle(page);
}

async function pressUntilScene(page: Page, hookName: string, key: string, ...scenes: string[]): Promise<void> {
  let last = 0;
  await waitFor(
    async () => {
      if ((await activeScenes(page)).some((s) => scenes.includes(s))) return true;
      if (Date.now() - last > 2500) {
        last = Date.now();
        await pressHookStop(page, hookName, key);
        await settle(page);
      }
      return null;
    },
    `${scenes.join(" or ")} after "${key}"`,
    45000,
  );
}

test.describe("Take your seats: tested community decks", () => {
  test("TESTED lists the community decks, BUILT includes them, and a picked one is played", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await openApp(page, "screen=seats", { landing: "Seats" });
    await waitFor(async () => ((await heroStops(page)).length > 0 ? true : null), "the hero list", 30000);
    await settle(page);
    await shot(page, "01-seats");

    // Without a chip, the list is the precons and the community decks together: one tile per hero, and the community
    // decks sit behind their hero's tile (its "Pick a deck" sheet), so the Spider-Man tile opens a sheet listing both.
    const all = await heroStops(page);
    expect(all.some((k) => k.startsWith("hero:precon:"))).toBe(true);
    await scrollStopIntoView(page, "hero:precon:core-spider-man-justice", "Seats");
    await press(page, "hero:precon:core-spider-man-justice");
    await waitFor(
      async () => ((await activeScenes(page)).includes("HeroDecksSheet") ? true : null),
      "Pick a deck",
      15000,
    );
    const sheetDecks = ((await routeStops(page, "HeroDecksSheet"))?.stops ?? []).map((s) => s.key);
    expect(sheetDecks).toContain("deck:precon:core-spider-man-justice");
    expect(sheetDecks).toContain(SPIDER_MAN.replace("hero:", "deck:"));
    await clickStop(page, "back", "HeroDecksSheet");
    await waitFor(
      async () => (!(await activeScenes(page)).includes("HeroDecksSheet") ? true : null),
      "sheet closed",
      15000,
    );

    // TESTED: only community decks.
    await press(page, "hero-chip:source:tested");
    const tested = await heroStops(page);
    expect(tested.length).toBeGreaterThan(20);
    expect(tested.filter((k) => !k.startsWith("hero:community:") && !k.startsWith("hero-rec:community:"))).toEqual([]);
    await shot(page, "02-tested-chip");

    // BUILT also lists them (TESTED_COUNTS_AS_BUILT); IMPORTED does not.
    await press(page, "hero-chip:source:tested");
    await press(page, "hero-chip:source:userBuilt");
    expect(await heroStops(page)).toContain(SPIDER_MAN);
    await press(page, "hero-chip:source:imported");
    expect((await heroStops(page)).some((k) => k.includes("community:"))).toBe(false);
    await press(page, "hero-chip:source:imported");
    await press(page, "hero-chip:source:tested");

    // The search finds a deck by its author.
    await pressHookStop(page, "__mcSeatsDebug", "hero-search");
    await page.keyboard.type("nungunz");
    await settle(page);
    expect((await heroStops(page)).filter((k) => k.startsWith("hero:"))).toContain(SPIDER_MAN);

    // Pick it for seat 1: the panel credits the author, and the seat is filled with that deck.
    await scrollStopIntoView(page, SPIDER_MAN, "Seats");
    await seatDeckThroughTile(page, SPIDER_MAN.replace("hero:", ""));
    expect(await shows(page, "by nungunz", "Seats")).toBe(true);
    await shot(page, "03-picked");

    // Deck check opens on that deck, and playing it deals its cards.
    await press(page, "deck-check");
    await waitFor(async () => ((await activeScenes(page)).includes("DeckCheck") ? true : null), "Deck check", 15000);
    await shot(page, "04-deck-check");
    expect(await shows(page, "Legal", "DeckCheck")).toBe(true);
    await clickText(page, "Start game", { sceneKey: "DeckCheck", timeoutMs: 30000 });
    await waitFor(async () => ((await activeScenes(page)).includes("Setup") ? true : null), "Table setup", 30000);
    await pressUntilScene(page, "__mcTableSetupDebug", "deal-it-out", "SetupDeal", "ScenarioIntro");
    await dealToFirstTurn(page);
    const turn = await gameFacts<{ round: number; heroes: string[]; cards: number }>(
      page,
      `(s) => ({ round: s.game.round, heroes: s.game.players.map((p) => s.game.cardPool[s.game.instances[p.identity.instanceId].cardId].name), cards: s.game.players[0].hand.length + s.game.players[0].deck.length + s.game.players[0].discard.length })`,
    );
    expect(turn).toMatchObject({ round: 1, heroes: ["Spider-Man"] });
    expect(turn.cards, "the game is played with the community deck's cards").toBeGreaterThan(39);
    expect(errors).toEqual([]);
  });
});
