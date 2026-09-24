import { describe, expect, test } from "vitest";
import {
  CORE_CARDS,
  CORE_STARTER_DECKS,
  TRORS_CARDS,
  WAVE1_CARDS,
  cardId,
  deckFromStarterDeck,
  type Deck,
} from "@mc/content";
import {
  addCard,
  aspectCountFor,
  browsablePool,
  duplicateDeck,
  identityOptions,
  legalityOf,
  newDeck,
  removeCard,
  resetToIdentitySet,
  resetToPrecon,
  setAspects,
  setName,
  touch,
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

describe("wave 1 (PLAN.md Phase 7)", () => {
  test("identityOptions includes the wave 1 heroes alongside Core's", () => {
    const names = identityOptions(WAVE1_CARDS).map((c) => c.name);
    expect(names).toContain("Doctor Strange");
    expect(names).toContain("Captain America");
    expect(names).toContain("Spider-Man");
  });

  test("a basic card reprinted across several wave 1 packs (Energy) appears once, not once per printing", () => {
    const capIdentity = identityOptions(WAVE1_CARDS).find((c) => c.name === "Captain America")!;
    const pool = browsablePool(WAVE1_CARDS, capIdentity, ["leadership"]);
    const energyRows = pool.filter((c) => c.name === "Energy");
    expect(energyRows).toHaveLength(1);
    // The Core printing wins (pool is Core-first) so it matches what an existing Core deck already uses.
    const coreEnergy = CORE_CARDS.find((c) => c.name === "Energy");
    expect(energyRows[0]!.id).toBe(coreEnergy!.id);
  });

  test("Doctor Strange's Invocation cards never appear in the browsable pool — they come from his identity's separateDecks, not a deck list", () => {
    const drStrange = identityOptions(WAVE1_CARDS).find((c) => c.name === "Doctor Strange")!;
    expect(drStrange.separateDecks?.length).toBeGreaterThan(0);
    const invocationNames = new Set((drStrange.separateDecks ?? []).flatMap((d) => d.cards.map((c) => c.cardId)));
    const pool = browsablePool(WAVE1_CARDS, drStrange, ["protection"]);
    for (const card of pool) expect(invocationNames.has(card.id)).toBe(false);
    expect(pool.length).toBeGreaterThan(0);
  });

  test('a campaign-specific card (specificTo.kind === "campaign") never appears in the browsable pool, campaign or not — only a campaign grant can add it (MC10 p. 3)', () => {
    const hawkeye = identityOptions(TRORS_CARDS).find((c) => c.name === "Hawkeye")!;
    const adrenalStims = TRORS_CARDS.find((c) => c.name === "Adrenal Stims")!;
    expect("specificTo" in adrenalStims && adrenalStims.specificTo?.kind).toBe("campaign");
    // basic aspect — would otherwise be browseable regardless of chosen aspect.
    const pool = browsablePool(TRORS_CARDS, hawkeye, ["leadership"]);
    expect(pool.some((card) => card.id === adrenalStims.id)).toBe(false);
    // Ordinary basic cards are unaffected by the filter.
    expect(pool.some((card) => card.name === "Energy")).toBe(true);
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

describe("resetToIdentitySet", () => {
  test("drops every added card, keeping only the identity's signature set and everything else about the deck", () => {
    let deck = newDeck(spiderMan, CORE_CARDS, "id-1", "poolv1", NOW);
    deck = setAspects(deck, ["justice"]);
    deck = addCard(deck, cardId("01088")); // Energy — not part of the signature set
    const cleared = resetToIdentitySet(deck, spiderMan, CORE_CARDS);
    expect(cleared.cards).toEqual(SPIDER_MAN_SIGNATURE);
    expect(cleared.id).toBe(deck.id);
    expect(cleared.aspects).toEqual(["justice"]); // aspect choice survives a Clear
  });
});

describe("resetToPrecon", () => {
  test("resets aspects and cards to the identity's real precon, keeping the deck's own id/name", () => {
    let deck = newDeck(spiderMan, CORE_CARDS, "id-1", "poolv1", NOW);
    deck = setName(deck, "My Spider-Man");
    deck = setAspects(deck, ["aggression"]); // the wrong aspect on purpose — Preconstructed should overwrite it
    deck = addCard(deck, cardId("01088"));

    const reset = resetToPrecon(deck, spiderMan, CORE_STARTER_DECKS)!;
    expect(reset).not.toBeNull();
    expect(reset.id).toBe(deck.id);
    expect(reset.name).toBe("My Spider-Man");

    const starter = CORE_STARTER_DECKS.find((s) => (s.identityCardId as string) === (spiderMan.id as string))!;
    const precon = deckFromStarterDeck(starter, "poolv1");
    expect(reset.aspects).toEqual(precon.aspects);
    expect(reset.cards).toEqual(precon.cards);
    expect(legalityOf(reset, CORE_CARDS)).toEqual({ ok: true });
  });

  test("null when the identity has no published precon in the given list", () => {
    const deck = newDeck(spiderMan, CORE_CARDS, "id-1", "poolv1", NOW);
    expect(resetToPrecon(deck, spiderMan, [])).toBeNull();
  });
});

describe("touch", () => {
  test("stamps updatedAt without touching anything else", () => {
    const deck = newDeck(spiderMan, CORE_CARDS, "id-1", "poolv1", NOW);
    const later = "2026-09-14T00:00:00.000Z";
    const touched = touch(deck, later);
    expect(touched.updatedAt).toBe(later);
    expect({ ...touched, updatedAt: deck.updatedAt }).toEqual(deck);
  });
});

describe("duplicateDeck", () => {
  test("copies identity, aspects and cards under a new id, name and userBuilt source", () => {
    let deck = newDeck(spiderMan, CORE_CARDS, "id-1", "poolv1", NOW);
    deck = setName(deck, "My Spider-Man");
    deck = setAspects(deck, ["justice"]);
    deck = addCard(deck, cardId("01088"));

    const later = "2026-09-15T00:00:00.000Z";
    const copy = duplicateDeck(deck, "id-2", later);
    expect(copy.id).toBe("id-2");
    expect(copy.name).toBe("My Spider-Man (copy)");
    expect(copy.identityCardId).toBe(deck.identityCardId);
    expect(copy.aspects).toEqual(deck.aspects);
    expect(copy.cards).toEqual(deck.cards);
    expect(copy.poolVersion).toBe(deck.poolVersion);
    expect(copy.source).toEqual({ kind: "userBuilt", createdAt: later });
    expect(copy.updatedAt).toBe(later);
  });

  test("duplicating a precon produces an editable userBuilt deck, not a second precon", () => {
    const starter = CORE_STARTER_DECKS.find((s) => (s.identityCardId as string) === (spiderMan.id as string))!;
    const precon = deckFromStarterDeck(starter, "poolv1");
    const copy = duplicateDeck(precon, "id-3", NOW);
    expect(copy.source.kind).toBe("userBuilt");
    expect(copy.cards).toEqual(precon.cards);
  });
});

describe("legalityOf", () => {
  test("building the real Spider-Man precon from a new deck ends up legal", () => {
    let deck = newDeck(spiderMan, CORE_CARDS, "id-1", "poolv1", NOW);
    deck = setAspects(deck, ["justice"]);
    // The precon's Justice and basic cards, added one copy at a time through the builder's own
    // ops. The signature cards are already in the new deck.
    const precon: readonly [string, number][] = [
      ["01058", 1],
      ["01059", 1],
      ["01060", 2],
      ["01061", 2],
      ["01062", 2],
      ["01063", 2],
      ["01064", 2],
      ["01065", 2],
      ["01083", 1],
      ["01084", 1],
      ["01085", 1],
      ["01086", 1],
      ["01087", 1],
      ["01088", 1],
      ["01089", 1],
      ["01090", 1],
      ["01091", 1],
      ["01092", 1],
      ["01093", 1],
    ];
    for (const [code, qty] of precon) {
      for (let i = 0; i < qty; i++) deck = addCard(deck, cardId(code));
    }
    const verdict = legalityOf(deck, CORE_CARDS);
    expect(verdict).toEqual({ ok: true });
  });
});
