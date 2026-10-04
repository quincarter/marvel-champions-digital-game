import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, pressHookStop, settle, trackPageErrors, waitFor } from "./helpers.js";
import { dealToFirstTurn, findVisibleText, gameFacts, hook, openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * Decks & Collection import (wave 6 heroes): a real MarvelCDB decklist through the link field, with the network reply
 * served by `page.route` from the decklist fixture the hero's own tests use (no live request), then the deck played; and
 * the plain-text Paste path with small lists. The deck list and status line are read from `__mcDecksDebug`: the same
 * rows, status chip and message the screen shows.
 */

const fixture = (pack: string, hero: string, id: number): string =>
  fileURLToPath(
    new URL(`../../cards/src/wave6/${pack}/${hero}/fixtures/marvelcdb-decklist-${id}.json`, import.meta.url),
  );

interface DeckRow {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly selected: boolean;
  readonly status: string;
  readonly legal: boolean;
  readonly problems: string[];
  readonly warning: string | null;
  readonly cardCount: number;
}
interface Stop extends Rect {
  readonly key: string;
}

/** Presses a control by name once the screen has drawn it (a slow runner can be a moment behind a scene change). */
async function clickStop(page: Page, hookName: string, key: string): Promise<void> {
  await pressHookStop(page, hookName, key);
  await settle(page);
}

/** Presses a control until one of the named scenes is up: a press that lands while a screen is still laying out (a
 * throttled runner) does nothing, so it is pressed again every 2.5 s rather than once and then waited on. */
async function pressUntilScene(page: Page, hookName: string, key: string, ...scenes: string[]): Promise<void> {
  let last = 0;
  await waitFor(
    async () => {
      if ((await activeScenes(page)).some((s) => scenes.includes(s))) return true;
      if (Date.now() - last > 2500) {
        last = Date.now();
        await clickStop(page, hookName, key);
      }
      return null;
    },
    `${scenes.join(" or ")} after "${key}"`,
    45000,
  );
}

const imported = async (page: Page): Promise<DeckRow[]> =>
  ((await hook<DeckRow[]>(page, "__mcDecksDebug", "decks")) ?? []).filter((d) => d.source === "imported");
const statusLine = async (page: Page): Promise<{ text: string; tone: string } | null> =>
  hook<{ text: string; tone: string }>(page, "__mcDecksDebug", "status");

async function openDecks(page: Page): Promise<void> {
  await openApp(page);
  await clickText(page, "Decks");
  await waitFor(async () => ((await activeScenes(page)).includes("Decks") ? true : null), "Decks opens", 8000);
  await settle(page);
}

/** Serves the fixture for `decklist/<id>` and counts the requests, so a test can say the link field really asked. */
async function serveDecklist(page: Page, id: number, file: string): Promise<{ hits: () => number }> {
  let hits = 0;
  const body = readFileSync(file, "utf8");
  await page.route(`**/api/marvelcdb-import/decklist/${id}`, (route) => {
    hits++;
    return route.fulfill({ status: 200, contentType: "application/json", body });
  });
  return { hits: () => hits };
}

async function importByLink(page: Page, link: string): Promise<void> {
  await clickStop(page, "__mcDecksDebug", "ie-marvelcdb-toggle");
  await clickStop(page, "__mcDecksDebug", "marvelcdb-field");
  await page.keyboard.type(link);
  await settle(page);
  await clickStop(page, "__mcDecksDebug", "marvelcdb-import");
  await waitFor(async () => (await statusLine(page)) ?? null, "an import message", 10000);
}

/** The decklist's own card total: the sum of its slots. */
const slotTotal = (file: string): number =>
  Object.values((JSON.parse(readFileSync(file, "utf8")) as { slots: Record<string, number> }).slots).reduce(
    (sum, n) => sum + n,
    0,
  );

/** Play this deck -> Take your seats (it is seat 1) -> Table setup -> Deal it out -> Keep all -> the Board. */
async function playImportedDeck(page: Page): Promise<void> {
  await clickText(page, "Play this deck", { sceneKey: "Decks", timeoutMs: 30000 });
  await waitFor(async () => ((await activeScenes(page)).includes("Seats") ? true : null), "Take your seats", 30000);
  // The seated deck is drawn once the saved decks have loaded: wait for its tile, not for a guessed delay.
  await waitFor(
    async () =>
      ((await hook<Stop[]>(page, "__mcSeatsDebug", "stops")) ?? []).some((s) => s.key.startsWith("hero:"))
        ? true
        : null,
    "the hero list",
    30000,
  );
  await pressUntilScene(page, "__mcSeatsDebug", "play", "Setup");
  await pressUntilScene(page, "__mcTableSetupDebug", "deal-it-out", "SetupDeal", "ScenarioIntro");
  await dealToFirstTurn(page);
}

const turnFacts = (page: Page) =>
  gameFacts<{ round: number; phase: string; heroes: string[] }>(
    page,
    `(s) => ({ round: s.game.round, phase: s.game.step.phase, heroes: s.game.players.map((p) => s.game.cardPool[s.game.instances[p.identity.instanceId].cardId].name) })`,
  );

test.describe("Decks & Collection: import", () => {
  test("Storm by MarvelCDB link: imported, legal, with the right count; played, the Weather deck holds 3 and no Weather is in her hand or deck", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    const file = fixture("storm", "storm", 67363);
    const served = await serveDecklist(page, 67363, file);
    await openDecks(page);
    await importByLink(page, "https://marvelcdb.com/decklist/view/67363");

    expect(served.hits(), "the link field asked for that decklist").toBe(1);
    expect((await statusLine(page))?.tone).toBe("success");
    expect((await statusLine(page))?.text).toMatch(/^Imported "Stolen Thunder!"\.$/);
    expect(await findVisibleText(page, "Imported", "Decks"), "the message is on screen").not.toHaveLength(0);
    const [deck] = await imported(page);
    expect(deck, "one imported deck").toBeDefined();
    expect(deck!.selected, "and it is the selected one").toBe(true);
    expect(deck!.status).toBe("Legal");
    expect(deck!.legal).toBe(true);
    expect(deck!.problems, "no unknown-card or other problem").toEqual([]);
    expect(deck!.warning, "and no unscripted-card warning").toBeNull();
    expect(deck!.cardCount, "the card count is the decklist's own").toBe(slotTotal(file));
    expect(await findVisibleText(page, "Legal", "Decks"), "the panel says Legal").not.toHaveLength(0);

    await playImportedDeck(page);
    const turn = await turnFacts(page);
    expect(turn).toMatchObject({ round: 1, phase: "player", heroes: ["Storm"] });
    const facts = await gameFacts<{ hand: string[]; deck: string[]; weather: number[] }>(
      page,
      `(s) => { const g = s.game, p = g.players[0], n = (id) => g.cardPool[g.instances[id].cardId].name;
        return { hand: p.hand.map(n), deck: p.deck.map(n), weather: Object.values(p.separateDecks).map((d) => d.deck.length) }; }`,
    );
    expect(facts.weather, "the Weather deck holds 3 (one Weather is in play)").toEqual([3]);
    const WEATHER = ["Clear Skies", "Hurricane", "Thunderstorm", "Blizzard"];
    expect(
      facts.hand.filter((n) => WEATHER.includes(n)),
      "no Weather in her hand",
    ).toEqual([]);
    expect(
      facts.deck.filter((n) => WEATHER.includes(n)),
      "no Weather in her deck",
    ).toEqual([]);
    expect(await findVisibleText(page, "Weather", "Board"), "the Weather deck panel is on the table").not.toHaveLength(
      0,
    );
    expect(errors).toEqual([]);
  });

  test("Gambit by MarvelCDB link: imported, legal, with the right count, and played to the first player turn", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    const file = fixture("gambit", "gambit", 67364);
    const served = await serveDecklist(page, 67364, file);
    await openDecks(page);
    await importByLink(page, "67364");

    expect(served.hits()).toBe(1);
    expect((await statusLine(page))?.text).toMatch(/^Imported "Gambit \| MAZO DEFINITIVO"\.$/);
    const [deck] = await imported(page);
    expect(deck!.status).toBe("Legal");
    expect(deck!.problems).toEqual([]);
    expect(deck!.warning).toBeNull();
    expect(deck!.cardCount).toBe(slotTotal(file));

    await playImportedDeck(page);
    expect(await turnFacts(page)).toMatchObject({ round: 1, phase: "player", heroes: ["Gambit"] });
    expect(errors).toEqual([]);
  });

  test("Paste: quantity forms are read, a short list imports but is not legal, and an unknown card is refused by name", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = trackPageErrors(page);
    await openDecks(page);

    // The three quantity forms the parser documents: `2x Name`, `2 Name`, `Name x1`.
    await clickStop(page, "__mcDecksDebug", "ie-paste-toggle");
    await clickStop(page, "__mcDecksDebug", "paste-field");
    // A bare name with no quantity is one copy.
    await page.keyboard.type(
      "Hero: Gambit\nAspect: Justice\n2x Energy\n1 Genius\nStrength x1\nBeauty and the Thief\n???",
    );
    await settle(page);
    await clickStop(page, "__mcDecksDebug", "paste-import");
    await waitFor(async () => (await statusLine(page)) ?? null, "an import message", 10000);
    const status = await statusLine(page);
    expect(status?.tone, `Paste accepts the three quantity forms (${status?.text})`).toBe("success");
    expect(status?.text, "a line that cannot be read is named by its number, not dropped silently").toContain(
      "Could not read line 7: ???",
    );
    const [deck] = await imported(page);
    expect(deck!.name).toBe("Gambit (imported)");
    expect(deck!.cardCount, "2 + 1 + 1 + 1; the bare name is one copy").toBe(5);
    expect(deck!.legal, "five cards are not a legal deck").toBe(false);
    expect(deck!.status).toBe("Illegal");
    expect(deck!.problems.length, "and the deck says why").toBeGreaterThan(0);

    // An unknown card name is refused, naming the line, and nothing is saved.
    await clickStop(page, "__mcDecksDebug", "paste-field");
    await page.keyboard.type("Hero: Gambit\nAspect: Justice\n2x Definitely Not A Card");
    await clickStop(page, "__mcDecksDebug", "paste-import");
    await waitFor(async () => ((await statusLine(page))?.tone === "error" ? true : null), "an error message", 10000);
    expect((await statusLine(page))!.text).toContain("Definitely Not A Card");
    expect((await imported(page)).length, "the refused list saved nothing").toBe(1);
    expect(errors).toEqual([]);
  });
});
