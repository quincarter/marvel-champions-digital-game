import { expect, test, type Page } from "@playwright/test";
import { activeScenes, clickText, pressHookStop, pressKey, settle, trackPageErrors, waitFor } from "./helpers.js";
import { dealToFirstTurn, findVisibleText, gameFacts, hook, openApp, type Rect } from "./wave6-helpers-b.js";

/**
 * Community decks on Decks & Collection: the tested public MarvelCDB decklists, listed beside the precons as
 * recommendations. A deck is previewed (its cards open in Inspect), added as the player's own editable copy, and that
 * copy is seated for a game. A deck whose hero the player has not unlocked is shown but cannot be added. The rows are
 * read from `__mcDecksDebug`: the same offers, status and lock the screen draws.
 *
 * `COMMUNITY_DECKS_SHOTS=<dir>` also saves a screenshot at each step.
 */

interface Offer {
  readonly id: string;
  readonly marvelcdbId: number;
  readonly name: string;
  readonly hero: string;
  readonly author: string;
  readonly url: string;
  readonly status: string;
  readonly lock: string | null;
  readonly added: boolean;
  readonly selected: boolean;
}
interface DeckRow {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly selected: boolean;
  readonly legal: boolean;
  readonly cardCount: number;
}
interface Stop extends Rect {
  readonly key: string;
}

/** Spider-Man with Core cards only: open to a new player. */
const SPIDER_MAN = { id: 103, name: "Spider-Man and Friends (Solo Play, Expert Mode)" };
/** Nova (wave 5), by a named author. */
const NOVA = { id: 19596, name: "Nova champion aerial supremacy", author: "CVdantespeak" };
/** Magneto (wave 8): locked for a new player. */
const MAGNETO = { id: 43978, name: "Magneto Was Right [GMW Expert Campaign]", author: "Web-Warrior Fanatic" };

const offers = async (page: Page): Promise<Offer[]> => (await hook<Offer[]>(page, "__mcDecksDebug", "community")) ?? [];
const offer = async (page: Page, id: number): Promise<Offer> => {
  const found = (await offers(page)).find((o) => o.marvelcdbId === id);
  if (!found) throw new Error(`community deck ${id} is not offered`);
  return found;
};
const ownDecks = async (page: Page): Promise<DeckRow[]> =>
  ((await hook<DeckRow[]>(page, "__mcDecksDebug", "decks")) ?? []).filter((d) => d.source !== "precon");
const stops = async (page: Page): Promise<Stop[]> => (await hook<Stop[]>(page, "__mcDecksDebug", "stops")) ?? [];
const statusLine = async (page: Page): Promise<{ text: string; tone: string } | null> =>
  hook<{ text: string; tone: string }>(page, "__mcDecksDebug", "status");

async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env.COMMUNITY_DECKS_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

async function openDecks(page: Page, query: string): Promise<void> {
  await openApp(page, query);
  await clickText(page, "Decks");
  await waitFor(async () => ((await activeScenes(page)).includes("Decks") ? true : null), "Decks opens", 8000);
  await waitFor(async () => ((await offers(page)).length > 0 ? true : null), "the community decks are listed", 15000);
  // The first visit's deck statuses come from the search worker (#226); the rows say "Checking…" until it answers.
  await waitFor(
    async () => ((await hook<boolean>(page, "__mcDecksDebug", "checking")) === false ? true : null),
    "every deck is checked",
    15000,
  );
  await settle(page);
}

/** Types into the deck search (replacing what was there), which is how a player reaches one deck among many. */
async function search(page: Page, text: string): Promise<void> {
  await pressHookStop(page, "__mcDecksDebug", "deck-search");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text);
  await settle(page);
}

/**
 * Presses a deck row and waits for `done`. The search runs in a worker and the list redraws when its answer lands, which
 * can swallow a press made just before, so the press is repeated (every few seconds) until the screen shows the result.
 */
async function pressDeckRow(page: Page, key: string, done: () => Promise<boolean>): Promise<void> {
  let last = 0;
  await waitFor(
    async () => {
      if (await done()) return true;
      if (Date.now() - last > 2500) {
        last = Date.now();
        await pressHookStop(page, "__mcDecksDebug", key);
        await settle(page);
      }
      return null;
    },
    `${key} pressed`,
    30000,
  );
}

/** Finds a community deck by search and selects its row. */
async function selectCommunityDeck(page: Page, deck: { id: number; name: string }, searchText: string): Promise<void> {
  await search(page, searchText);
  await pressDeckRow(page, `deck:community:${deck.id}`, async () => (await offer(page, deck.id)).selected);
  await settle(page);
}

test.describe("Decks & Collection: community decks", () => {
  test("a new player previews a Core community deck, adds it, and plays the copy; a locked hero's deck cannot be added", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = trackPageErrors(page);
    await openDecks(page, "");
    await shot(page, "01-decks-precon-selected");

    // Every offer is credited and linked; the Core deck is open, the wave 8 hero's is not.
    const all = await offers(page);
    expect(all.length).toBeGreaterThanOrEqual(68);
    for (const o of all) {
      expect(o.author.length, o.name).toBeGreaterThan(0);
      expect(o.url).toBe(`https://marvelcdb.com/decklist/view/${o.marvelcdbId}`);
    }
    expect(await offer(page, SPIDER_MAN.id)).toMatchObject({ status: "Tested", lock: null, added: false });
    expect((await offer(page, MAGNETO.id)).status).toBe("Locked");
    expect((await offer(page, MAGNETO.id)).lock).toMatch(/unlock/i);

    // Select it: the rail credits the author and says it is tested, and the middle pane is the deck's own list.
    await selectCommunityDeck(page, SPIDER_MAN, "Spider-Man and Friends");
    await shot(page, "02-community-deck-selected");
    expect(await findVisibleText(page, "COMMUNITY DECK", "Decks")).not.toHaveLength(0);
    expect(await findVisibleText(page, "by nungunz", "Decks")).not.toHaveLength(0);
    expect(await findVisibleText(page, "TESTED", "Decks")).not.toHaveLength(0);
    expect(await findVisibleText(page, "PUBLISHED NOV 6, 2019", "Decks")).not.toHaveLength(0);
    expect(await findVisibleText(page, "LAST UPDATED", "Decks"), "MarvelCDB's update date is not shown").toHaveLength(
      0,
    );
    expect(await findVisibleText(page, "DECK LIST", "Decks")).not.toHaveLength(0);
    expect(await findVisibleText(page, "marvelcdb.com/decklist/view/103", "Decks")).not.toHaveLength(0);
    const keys = (await stops(page)).map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["stats-copy-link", "stats-open-link", "stats-check", "stats-add"]));
    expect(keys, "a recommendation is not played or edited in place").not.toEqual(
      expect.arrayContaining(["stats-play"]),
    );
    const cards = keys.filter((key) => key.startsWith("pool-card:"));
    expect(cards.length, "the preview lists the deck's cards").toBeGreaterThanOrEqual(15);

    // A card in the preview opens in Inspect.
    await pressHookStop(page, "__mcDecksDebug", cards[0]!);
    await waitFor(
      async () => ((await activeScenes(page)).includes("InspectOverlay") ? true : null),
      "Inspect opens",
      10000,
    );
    await settle(page);
    await shot(page, "03-preview-card-in-inspect");
    await pressKey(page, "Escape");
    await waitFor(
      async () => ((await activeScenes(page)).includes("InspectOverlay") ? null : true),
      "Inspect closes",
      10000,
    );

    // Add it: the player's own copy, legal, selected, and editable like any deck.
    expect(await ownDecks(page)).toHaveLength(0);
    await pressHookStop(page, "__mcDecksDebug", "stats-add");
    await waitFor(async () => ((await ownDecks(page)).length === 1 ? true : null), "the copy is saved", 10000);
    await settle(page);
    const [copy] = await ownDecks(page);
    expect(copy).toMatchObject({ name: SPIDER_MAN.name, source: "imported", legal: true, selected: true });
    expect((await statusLine(page))?.tone).toBe("success");
    expect((await statusLine(page))?.text).toContain(`Added "${SPIDER_MAN.name}" by nungunz`);
    expect((await offer(page, SPIDER_MAN.id)).added).toBe(true);
    expect((await stops(page)).map((s) => s.key)).toEqual(
      expect.arrayContaining(["stats-edit", "stats-delete", "stats-play"]),
    );
    await shot(page, "04-copy-added");

    // The locked hero's deck is shown with what opens it, and Add does nothing.
    await selectCommunityDeck(page, MAGNETO, "Magneto Was Right");
    await shot(page, "05-locked-community-deck");
    expect(await findVisibleText(page, "LOCKED", "Decks")).not.toHaveLength(0);
    await pressHookStop(page, "__mcDecksDebug", "stats-add");
    await settle(page);
    expect(await ownDecks(page), "nothing was added").toHaveLength(1);

    // Seat the copy and deal a game with it.
    await search(page, "Spider-Man and Friends");
    await pressDeckRow(page, `deck:${copy!.id}`, async () =>
      ((await hook<DeckRow[]>(page, "__mcDecksDebug", "decks")) ?? []).some((d) => d.id === copy!.id && d.selected),
    );
    await settle(page);
    await clickText(page, "Play this deck", { sceneKey: "Decks", timeoutMs: 30000 });
    await waitFor(async () => ((await activeScenes(page)).includes("Seats") ? true : null), "Take your seats", 30000);
    await waitFor(
      async () =>
        ((await hook<Stop[]>(page, "__mcSeatsDebug", "stops")) ?? []).some((s) => s.key.startsWith("hero:"))
          ? true
          : null,
      "the hero list",
      30000,
    );
    const pressUntilScene = async (hookName: string, key: string, ...scenes: string[]): Promise<void> => {
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
    };
    await pressUntilScene("__mcSeatsDebug", "play", "Setup");
    await pressUntilScene("__mcTableSetupDebug", "deal-it-out", "SetupDeal", "ScenarioIntro");
    await dealToFirstTurn(page);
    const turn = await gameFacts<{ round: number; phase: string; heroes: string[]; cards: number }>(
      page,
      `(s) => ({ round: s.game.round, phase: s.game.step.phase, heroes: s.game.players.map((p) => s.game.cardPool[s.game.instances[p.identity.instanceId].cardId].name), cards: s.game.players[0].hand.length + s.game.players[0].deck.length + s.game.players[0].discard.length })`,
    );
    expect(turn).toMatchObject({ round: 1, phase: "player", heroes: ["Spider-Man"] });
    expect(turn.cards, "the game is being played with the copy's cards").toBe(copy!.cardCount);
    expect(errors).toEqual([]);
  });

  test("with everything unlocked, decks from three waves are offered by their authors, and building from scratch is still there", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = trackPageErrors(page);
    await openDecks(page, "unlock=all");
    for (const deck of [SPIDER_MAN, NOVA, MAGNETO]) {
      expect(await offer(page, deck.id), deck.name).toMatchObject({ status: "Tested", lock: null });
    }

    // Searching an author's name lists that author's decks.
    await selectCommunityDeck(page, NOVA, NOVA.author);
    expect(await findVisibleText(page, `by ${NOVA.author}`, "Decks")).not.toHaveLength(0);
    expect(await findVisibleText(page, "HOW IT PLAYS", "Decks")).not.toHaveLength(0);
    await shot(page, "06-wave5-deck-by-named-author");
    await selectCommunityDeck(page, MAGNETO, MAGNETO.author);
    expect(await findVisibleText(page, `by ${MAGNETO.author}`, "Decks")).not.toHaveLength(0);
    await shot(page, "07-wave8-deck-author-search");
    const byAuthor = (await offers(page)).filter((o) => o.author === MAGNETO.author).length;
    const listedCount = async (): Promise<number> =>
      (await stops(page)).filter((s) => s.key.startsWith("deck:community:")).length;
    // The worker's answer narrows the list; read it once it has.
    await waitFor(
      async () => ((await listedCount()) === byAuthor ? true : null),
      "only that author's decks are listed",
      15000,
    );
    expect(await listedCount(), "only that author's decks are listed").toBe(byAuthor);

    // The recommendation takes nothing away: "+ New deck", paste, the MarvelCDB link field and export are all there.
    await search(page, "");
    expect((await stops(page)).map((s) => s.key)).toEqual(
      expect.arrayContaining(["new-deck", "ie-paste-toggle", "ie-marvelcdb-toggle", "ie-export"]),
    );
    await pressHookStop(page, "__mcDecksDebug", "ie-marvelcdb-toggle");
    await settle(page);
    expect((await stops(page)).map((s) => s.key)).toEqual(
      expect.arrayContaining(["marvelcdb-field", "marvelcdb-import"]),
    );
    expect(await ownDecks(page), "previewing added nothing").toHaveLength(0);
    expect(errors).toEqual([]);
  });
});
