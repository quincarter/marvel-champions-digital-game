import { describe, expect, test } from "vitest";
import { CORE_CARDS, cardId, type Deck } from "@mc/content";
import {
  addCard,
  aspectCountFor,
  browsablePool,
  identityOptions,
  legalityOf,
  newDeck,
  removeCard,
  setAspects,
  setName,
} from "./deck-builder-model.js";

const spiderMan = identityOptions(CORE_CARDS).find((c) => c.name === "Spider-Man")!;
const NOW = "2026-09-13T00:00:00.000Z";
/** A deck with no cards at all, for exercising add/remove on their own. */
const emptyDeck = (): Deck => ({ ...newDeck(spiderMan, CORE_CARDS, "id-1", "poolv1", NOW), cards: [] });
/** Spider-Man's identity set as the Core precon prints it, sorted by code. */
const SPIDER_MAN_SIGNATURE = [
  { cardId: "01002", quantity: 1 },
  { cardId: "01003", quantity: 2 },
  { cardId: "01004", quantity: 2 },
  { cardId: "01005", quantity: 3 },
  { cardId: "01006", quantity: 1 },
  { cardId: "01007", quantity: 2 },
  { cardId: "01008", quantity: 2 },
  { cardId: "01009", quantity: 2 },
];

describe("identityOptions", () => {
  test("every Core hero identity is present, sorted by name", () => {
    const names = identityOptions(CORE_CARDS).map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain("Spider-Man");
    expect(names).toContain("Black Panther");
  });
});

describe("aspectCountFor", () => {
  test("defaults to 1 when the identity has no deckbuilding override", () => {
    expect(aspectCountFor(spiderMan)).toBe(1);
  });
});

describe("newDeck / setAspects / setName", () => {
  test("starts with the identity's signature cards at their set quantities, still illegal (no aspect, too few cards)", () => {
    const deck = newDeck(spiderMan, CORE_CARDS, "id-1", "poolv1", NOW);
    expect(deck.cards).toEqual(SPIDER_MAN_SIGNATURE);
    const verdict = legalityOf(deck, CORE_CARDS);
    expect(verdict.ok).toBe(false);
    // Nothing is reported missing from the identity set: the builder already put it in.
    if (!verdict.ok) expect(verdict.problems.map((p) => p.code)).not.toContain("identity_set_mismatch");

    const named = setName(deck, "My Deck");
    expect(named.name).toBe("My Deck");

    const withAspect = setAspects(deck, ["justice"]);
    expect(legalityOf(withAspect, CORE_CARDS).ok).toBe(false); // still too few cards
  });
});

describe("browsablePool", () => {
  test("basic cards and the chosen aspect's cards are browseable; other aspects are not", () => {
    const pool = browsablePool(CORE_CARDS, spiderMan, ["justice"]);
    expect(pool.some((c) => c.name === "Energy")).toBe(true); // basic
    expect(pool.some((c) => c.name === "For Justice!")).toBe(true); // justice
    expect(pool.some((c) => c.name === "Ready" && c.type === "event")).toBe(false);
    // Spider-Man's own signature cards are browseable regardless of chosen aspect.
    expect(pool.some((c) => c.name === "Web-Shooter")).toBe(true);
  });

  test("an aggression-only card is not browseable for a justice deck", () => {
    const pool = browsablePool(CORE_CARDS, spiderMan, ["justice"]);
    const aggressionOnly = pool.find((c) => "aspect" in c && (c as { aspect: string }).aspect === "aggression");
    expect(aggressionOnly).toBeUndefined();
  });

  test("filters by text, type and cost", () => {
    const pool = browsablePool(CORE_CARDS, spiderMan, ["justice"], { text: "energy" });
    expect(pool.map((c) => c.name)).toEqual(["Energy"]);

    const events = browsablePool(CORE_CARDS, spiderMan, ["justice"], { type: "event" });
    expect(events.every((c) => c.type === "event")).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe("addCard / removeCard", () => {
  test("adding a new card starts it at quantity 1; adding again increments", () => {
    let deck = emptyDeck();
    deck = addCard(deck, cardId("01088")); // Energy
    expect(deck.cards).toEqual([{ cardId: "01088", quantity: 1 }]);
    deck = addCard(deck, cardId("01088"));
    expect(deck.cards).toEqual([{ cardId: "01088", quantity: 2 }]);
  });

  test("removing below 1 drops the line entirely rather than going negative", () => {
    let deck = emptyDeck();
    deck = addCard(deck, cardId("01088"));
    deck = removeCard(deck, cardId("01088"));
    expect(deck.cards).toEqual([]);
    deck = removeCard(deck, cardId("01088"));
    expect(deck.cards).toEqual([]);
  });
});

describe("legalityOf", () => {
  test("building the real Spider-Man precon from a new deck ends up legal", () => {
    let deck = newDeck(spiderMan, CORE_CARDS, "id-1", "poolv1", NOW);
    deck = setAspects(deck, ["justice"]);
    // The precon's Justice and basic cards, added one copy at a time through the builder's own
    // ops. The signature cards are already in the new deck.
    const precon: readonly [string, number][] = [
      ["01058", 1], ["01059", 1], ["01060", 2], ["01061", 2], ["01062", 2], ["01063", 2], ["01064", 2], ["01065", 2],
      ["01083", 1], ["01084", 1], ["01085", 1], ["01086", 1], ["01087", 1], ["01088", 1], ["01089", 1], ["01090", 1],
      ["01091", 1], ["01092", 1], ["01093", 1],
    ];
    for (const [code, qty] of precon) {
      for (let i = 0; i < qty; i++) deck = addCard(deck, cardId(code));
    }
    const verdict = legalityOf(deck, CORE_CARDS);
    expect(verdict).toEqual({ ok: true });
  });
});
