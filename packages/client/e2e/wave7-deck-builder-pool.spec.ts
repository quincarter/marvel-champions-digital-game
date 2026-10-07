import { expect, test } from "@playwright/test";
import { activeScenes, clickText, settle, waitFor } from "./helpers.js";
import {
  clickStop,
  driveToBoard,
  boardRound,
  hasStop,
  trackErrors,
  visibleTexts,
  waitForScene,
} from "./wave6-helpers-a.js";
import { hook } from "./wave6-helpers-b.js";
import { pressHookStop } from "./helpers.js";
import {
  PHONE,
  add,
  deckPanel,
  deckRows,
  fillPoolDeck,
  legalityLine,
  openDecks,
  poolIds,
  press,
  remove,
  search,
  shot,
  startNewDeck,
  stopOf,
  texts,
} from "./wave7-deck-builder-helpers.js";

/**
 * Wave 7 deck builder QA, part 1 (docs/phase7-wave7-qa-deck-builder.md): building 'Pool decks the way a player does
 * (Decks -> + New deck -> pick a hero -> choose an aspect -> search/filter/add -> Save), against RRG 1.8 Appendix I
 * "Deck Customization" (p. 50) and the Deadpool insert's "Using the 'Pool Aspect" (RRG 1.8 "Aspect Card", p. 8; FAQ p. 64).
 * Legality is `validateDeck` (`packages/cards/src/wave7/custom-decks.test.ts` covers the rules headlessly); this file
 * checks that the screen says what the validator says. Set MC_QA_PHONE=1 to run the same flows on a 390 x 844 touch viewport.
 */
if (PHONE) test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const POOL_CARD_IDS = ["44013", "44017", "44021", "44046", "44048"];

test.describe("Deadpool, 'Pool aspect: flows 1, 7 and 8", () => {
  test("new deck, build to legal, save, reopen, export, delete, paste back, seat against Rhino", async ({
    page,
    context,
  }) => {
    test.setTimeout(540_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackErrors(page);
    await openDecks(page);

    // 1a. New deck -> Deadpool: the builder opens with exactly his 15 identity cards (RRG p. 50: "the exact quantity of each card").
    await startNewDeck(page, "44001a");
    const opening = await texts(page, "DeckBuilder");
    expect(opening).toContain("IDENTITY — DEADPOOL");
    expect(opening).toContain("ASPECT (CHOOSE 1)");
    expect(opening).toContain("HERO · 15");
    expect(await deckPanel(page), "his set, by name").toEqual(
      expect.arrayContaining([
        '"Yoo-Hoo!"',
        "Armed to the Teeth",
        "Cable",
        "Chimichanga Truck",
        "Deadpool's Katana",
        "Montage",
      ]),
    );
    expect(await legalityLine(page)).toContain("must choose exactly one aspect; this deck chooses none");
    await shot(page, "1-new-deadpool");

    // 1b. Choose 'Pool: its cards (and Frenemies, basic) join the list; with no aspect they were not offered.
    expect(await poolIds(page), "no 'Pool card before an aspect is chosen").not.toContain("44017");
    await press(page, "DeckBuilder", "aspect:pool");
    const withPool = await poolIds(page);
    for (const id of POOL_CARD_IDS) expect(withPool, `'Pool card ${id}`).toContain(id);
    expect(await legalityLine(page)).toBe(
      "1 problem: The deck has 15 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
    );

    // 1c. Search by name.
    expect(await search(page, "Break")).toEqual(["44046"]);
    expect(await search(page, "dogpool"), "name search ignores case").toEqual(["44013"]);
    expect(await search(page, "zzzz")).toEqual([]);
    expect(await texts(page, "DeckBuilder")).toContain("No cards match this filter.");
    await search(page, "");

    // 1d. Type filter: Ally shows allies only.
    await press(page, "DeckBuilder", "type:ally");
    const allyRows = (await texts(page, "DeckBuilder")).filter((t) =>
      /^(ally|event|upgrade|support|resource|player side scheme) · cost/.test(t),
    );
    expect(allyRows.length).toBeGreaterThan(PHONE ? 2 : 5);
    expect(
      allyRows.every((t) => t.startsWith("ally · cost")),
      allyRows.join(" | "),
    ).toBe(true);
    await press(page, "DeckBuilder", "type:all");

    // 1e. Copy limits (RRG p. 50: three copies by title; the card's own "Max 1 per deck"): refused with a message.
    await search(page, "Break Time");
    await add(page, "44046");
    await add(page, "44046");
    expect(await legalityLine(page)).toContain(
      "Break Time has 2 copies, but its deck limit is 1: no more than 1 copy may be in a deck.",
    );
    await remove(page, "44046");
    await search(page, "Barely");
    for (let i = 0; i < 4; i++) await add(page, "44017");
    expect(await legalityLine(page)).toContain(
      "Barely a Scratch has 4 copies; a deck may include no more than 3 copies of a non-unique card (by title).",
    );
    await remove(page, "44017");
    await shot(page, "1-copy-limit");

    // 1f. Fill to a legal deck: 15 set + 25 'Pool cards = 40.
    await search(page, "");
    await fillPoolDeck(page, ["44017", "44046"]); // the copy-limit steps above left 3 Barely a Scratch and 1 Break Time
    expect(await legalityLine(page)).toBe("Legal — 40 cards.");
    await shot(page, "1-legal");
    const panelBefore = await deckPanel(page);

    // 1g. Save, back to Decks: the deck is listed, legal, 40 cards.
    await press(page, "DeckBuilder", "save");
    if (!PHONE) expect(await texts(page, "DeckBuilder")).toContain("Saved."); // on the phone the saved deck on Decks is the proof
    await press(page, "DeckBuilder", "back");
    await waitForScene(page, "Decks", 15000);
    await settle(page);
    const mine = (await deckRows(page)).filter((d) => d.source === "userBuilt");
    expect(mine, "one saved deck").toHaveLength(1);
    expect(mine[0]).toMatchObject({
      name: "Deadpool (new deck)",
      status: "Legal",
      legal: true,
      cardCount: 40,
      problems: [],
    });
    await press(page, "Decks", `deck:${mine[0]!.id}`);
    expect((await texts(page, "Decks")).join("\n")).toContain("Deadpool · 'Pool · 40 cards");
    await shot(page, "1-decks");

    // 1h. Reopen: same cards, same aspect (the 'Pool cards are still offered), still legal.
    await press(page, "Decks", "stats-edit");
    await waitForScene(page, "DeckBuilder", 15000);
    await settle(page);
    expect(await legalityLine(page)).toBe("Legal — 40 cards.");
    expect(await deckPanel(page)).toEqual(panelBefore);
    expect(await poolIds(page)).toContain("44017");
    await press(page, "DeckBuilder", "back");
    await waitForScene(page, "Decks", 15000);
    await settle(page);

    // 7. Export, delete, paste it back: identical cards and legal.
    await press(page, "Decks", `deck:${mine[0]!.id}`);
    await press(page, "Decks", "ie-export");
    await waitFor(
      async () => ((await hook<{ tone: string }>(page, "__mcDecksDebug", "status"))?.tone === "success" ? true : null),
      "export status",
      10000,
    );
    const exported = await page.evaluate(() => navigator.clipboard.readText());
    expect(exported.split("\n").slice(0, 2)).toEqual(["Hero: Deadpool", "Aspect: Pool"]);
    const lines = exported.split("\n").slice(2);
    expect(
      lines.reduce((n, l) => n + Number(/^(\d+)x /.exec(l)?.[1] ?? 0), 0),
      "every copy is in the export",
    ).toBe(40);
    await press(page, "Decks", "stats-delete");
    await waitFor(
      async () => ((await deckRows(page)).some((d) => d.source === "userBuilt") ? null : true),
      "deleted",
      10000,
    );
    await press(page, "Decks", "ie-paste-toggle");
    await press(page, "Decks", "paste-field");
    await page.keyboard.type(exported);
    await settle(page);
    await press(page, "Decks", "paste-import");
    const back = await waitFor(
      async () => (await deckRows(page)).find((d) => d.source === "imported") ?? null,
      "the pasted deck",
      15000,
    );
    expect(back).toMatchObject({ status: "Legal", legal: true, cardCount: 40, problems: [] });
    await press(page, "Decks", `deck:${back.id}`);
    await press(page, "Decks", "ie-export");
    await waitFor(
      async () => ((await page.evaluate(() => navigator.clipboard.readText())) !== exported ? null : true),
      "re-export",
      10000,
    );
    expect(await page.evaluate(() => navigator.clipboard.readText()), "the round trip is identical").toBe(exported);
    await shot(page, "7-roundtrip");

    // 8. Seat it solo against Rhino from Title: Table setup lists the Dreadpool set as added; the board reaches round 1.
    await press(page, "Decks", "back");
    await waitForScene(page, "Title", 15000);
    await settle(page);
    await clickText(page, "NEW GAME", { sceneKey: "Title" });
    await waitForScene(page, "ScenarioSelect", 15000);
    await waitFor(
      async () => ((await hasStop(page, "scenario:rhino", "ScenarioSelect")) ? true : null),
      "scenario list",
      15000,
    );
    await settle(page);
    await clickStop(page, "scenario:rhino", "ScenarioSelect");
    await clickStop(page, "next", "ScenarioSelect");
    await waitForScene(page, "Seats", 15000);
    await settle(page);
    const tile = await waitFor(
      async () =>
        ((await hook<{ key: string }[]>(page, "__mcSeatsDebug", "stops")) ?? []).find(
          (s) => s.key === `hero:${back.id}`,
        ) ?? null,
      "the pasted deck's tile on Take your seats",
      15000,
    );
    await pressHookStop(page, "__mcSeatsDebug", tile.key);
    await settle(page);
    const seat = (await visibleTexts(page)).filter((t) => t.scene === "Seats").map((t) => t.text);
    expect(seat).toContain("Deadpool");
    await shot(page, "8-seats");
    await clickStop(page, "play", "Seats");
    await waitForScene(page, "Setup", 15000);
    await settle(page);
    const setup = (await visibleTexts(page)).filter((t) => t.scene === "Setup").map((t) => t.text);
    expect(setup.join("\n"), "Table setup lists the Dreadpool set as added").toMatch(/Dreadpool/);
    await shot(page, "8-setup");
    await clickStop(page, "deal-it-out", "Setup");
    await driveToBoard(page, { timeoutMs: 120_000 });
    expect(await boardRound(page)).toBe(1);
    await shot(page, "8-board-round-1");
    expect(await activeScenes(page)).toContain("Board");
    expect(errors, `no page or console errors (${JSON.stringify(errors)})`).toEqual([]);
  });
});

test.describe("Spider-Man (a Core hero) choosing 'Pool: flow 2", () => {
  test("'Pool is an aspect choice, its cards then appear, and a 'Pool Spider-Man deck is legal", async ({ page }) => {
    test.setTimeout(400_000);
    await openDecks(page);
    await startNewDeck(page, "01001a");
    expect(await texts(page, "DeckBuilder")).toEqual(
      expect.arrayContaining(["IDENTITY — SPIDER-MAN (PETER PARKER)", "'POOL", "HERO · 15"]),
    );
    expect(await stopOf(page, "DeckBuilder", "aspect:pool"), "'Pool is offered as an aspect").toBeDefined();
    expect(await poolIds(page)).not.toContain("44017");
    await press(page, "DeckBuilder", "aspect:pool");
    const ids = await poolIds(page);
    for (const id of POOL_CARD_IDS) expect(ids).toContain(id);
    expect(await legalityLine(page)).toContain("a deck must have between 40 and 50");
    expect(await search(page, "Break")).toEqual(["44046"]);
    await search(page, "");
    await fillPoolDeck(page);
    expect(await legalityLine(page)).toBe("Legal — 40 cards.");
    await shot(page, "2-spider-man-pool-legal");
    await press(page, "DeckBuilder", "save");
    await press(page, "DeckBuilder", "back");
    await waitForScene(page, "Decks", 15000);
    await settle(page);
    const mine = (await deckRows(page)).filter((d) => d.source === "userBuilt");
    expect(mine[0]).toMatchObject({ name: "Spider-Man (new deck)", status: "Legal", legal: true, cardCount: 40 });
  });
});

test.describe("Deadpool with another aspect: flow 3", () => {
  test("Aggression hides 'Pool cards, and a deck that already holds them is flagged card by card (the validator's own message)", async ({
    page,
  }) => {
    test.setTimeout(400_000);
    await openDecks(page);
    await startNewDeck(page, "44001a");
    await press(page, "DeckBuilder", "aspect:pool");
    await search(page, "Barely");
    await add(page, "44017");
    await search(page, "Dogpool");
    await add(page, "44013");
    expect(await legalityLine(page)).not.toContain("'Pool card, but");
    // Switch to Aggression (the picker replaces the single aspect: two aspects cannot be chosen for Deadpool).
    await press(page, "DeckBuilder", "aspect:aggression");
    await search(page, "");
    const ids = await poolIds(page);
    // Cards the deck holds stay listed so each can be removed; a 'Pool card it does not hold is not offered.
    expect(ids, "held 'Pool cards stay listed").toEqual(expect.arrayContaining(["44017", "44013"]));
    expect(ids, "other 'Pool cards are not offered under Aggression").not.toContain("44021");
    expect(ids, "his own set stays").toContain("44006");
    // The validator (custom-decks.test.ts "Deadpool's own deck with another aspect chosen") refuses each 'Pool card:
    const line = await legalityLine(page);
    expect(line).toContain(
      "Barely a Scratch is a 'Pool card, but this deck's aspect is Aggression; beyond its identity set a deck may only use its chosen aspect and basic cards.",
    );
    expect(line).toMatch(/Dogpool[^.]* is a 'Pool card, but this deck's aspect is Aggression;/);
    await shot(page, "3-deadpool-aggression");
    // A single aspect only: choosing Justice next replaces Aggression, never adds to it.
    await press(page, "DeckBuilder", "aspect:justice");
    expect(await legalityLine(page)).not.toContain("chooses Aggression and Justice");
    expect(await legalityLine(page)).not.toContain("must choose exactly one aspect");
  });

  test("a card the chosen aspect now refuses can still be found and removed from the pool list", async ({ page }) => {
    await openDecks(page);
    await startNewDeck(page, "44001a");
    await press(page, "DeckBuilder", "aspect:pool");
    await search(page, "Barely");
    await add(page, "44017");
    await press(page, "DeckBuilder", "aspect:aggression");
    expect(await search(page, "Barely")).toContain("44017");
    await remove(page, "44017");
    expect(await legalityLine(page)).not.toContain("Barely a Scratch is a 'Pool card");
  });
});

test.describe("Findings pinned from flow 1 (the aspect's name and a per player cost)", () => {
  test("a saved user-built deck's row names its aspect", async ({ page }) => {
    await openDecks(page);
    await startNewDeck(page, "44001a");
    await press(page, "DeckBuilder", "aspect:pool");
    await fillPoolDeck(page);
    await press(page, "DeckBuilder", "save");
    await press(page, "DeckBuilder", "back");
    await waitForScene(page, "Decks", 15000);
    await settle(page);
    // Back after Save opens Decks on the saved deck: its stats header names the aspect (its list row does too).
    expect((await deckRows(page)).find((d) => d.selected)?.source).toBe("userBuilt");
    expect((await texts(page, "Decks")).join("\n")).toContain("'POOL · 40 CARDS · MINIMUM 40 · LEGAL · BUILT");
  });

  test("every screen spells the aspect 'Pool, not Pool", async ({ page }) => {
    await openDecks(page);
    const precon = (await deckRows(page)).find((d) => d.source === "precon" && /deadpool/i.test(d.name));
    expect(precon, "a Deadpool precon").toBeTruthy();
    await press(page, "Decks", `deck:${precon!.id}`);
    expect((await texts(page, "Decks")).join("\n")).toContain("DEADPOOL / 'POOL");
  });

  test("the pool row of a per player cost card says so", async ({ page }) => {
    await openDecks(page);
    await startNewDeck(page, "44001a");
    await press(page, "DeckBuilder", "aspect:pool");
    await search(page, "Break Time");
    expect((await texts(page, "DeckBuilder")).join("\n")).toContain("event · 3 per player");
  });
});
