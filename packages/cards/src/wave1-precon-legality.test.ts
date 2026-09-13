/**
 * Wave 1 hero-pack precon legality (PLAN.md Phase 7 / docs/phase7-wave1.md).
 *
 * This lives in `@mc/cards` rather than `@mc/content`'s own test suite because checking legality means calling
 * `@mc/engine`'s `validateDeck`/`requiredIdentitySet`, and `@mc/content` must never import `@mc/engine`
 * (`client → cards → engine → content`, CLAUDE.md). `@mc/cards` already depends on both, so the check belongs
 * here. It does not use anything else in `@mc/cards` (no `CORE_DEPS`, no ability registry): wave 1 is not wired
 * into the engine yet (docs/phase7-wave1.md §3 — "Nothing here is implemented yet"), so this is a data-legality
 * check only, not a playability/`createGame` check the way `core/deck-legality.test.ts` runs for Core.
 */
import { WAVE1_CARDS, WAVE1_STARTER_DECKS, type DeckContents, type HeroIdentityCard, type StarterDeck } from "@mc/content";
import { requiredIdentitySet, validateDeck } from "@mc/engine";

const byId = new Map(WAVE1_CARDS.map((c) => [c.id as string, c]));

const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});

const deckId = (id: string): StarterDeck => {
  const deck = WAVE1_STARTER_DECKS.find((d) => d.id === id);
  if (!deck) throw new Error(`no wave 1 starter deck ${id}`);
  return deck;
};

describe("wave 1 precons — six hero packs", () => {
  it("there are exactly six, one per wave 1 hero pack", () => {
    expect(WAVE1_STARTER_DECKS.map((d) => d.id).sort()).toEqual(
      ["bkw-justice", "cap-leadership", "drs-protection", "hlk-aggression", "msm-protection", "thor-aggression"].sort(),
    );
  });

  it.each(WAVE1_STARTER_DECKS.map((d) => [d.id, d] as const))("%s: validateDeck reports no problems", (_id, deck) => {
    const result = validateDeck(contentsOf(deck), WAVE1_CARDS);
    expect(result.ok, result.ok ? undefined : JSON.stringify((result as { problems: unknown }).problems, null, 2)).toBe(true);
  });

  it.each(WAVE1_STARTER_DECKS.map((d) => [d.id, d] as const))("%s: sources are verified", (_id, deck) => {
    expect(deck.provenance.verified).toBe(true);
    expect(deck.provenance.sources.length).toBeGreaterThan(0);
  });

  it.each(WAVE1_STARTER_DECKS.map((d) => [d.id, d] as const))("%s: exactly 40 cards, within box quantity and deck limit", (_id, deck) => {
    expect(deck.cards.reduce((n, e) => n + e.quantity, 0)).toBe(40);
    for (const e of deck.cards) {
      const card = byId.get(e.cardId as string);
      expect(card && "deckLimit" in card, e.cardId as string).toBe(true);
      if (!card || !("deckLimit" in card)) continue;
      expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(Math.min(card.quantityInSet, card.deckLimit));
    }
  });

  it.each(WAVE1_STARTER_DECKS.map((d) => [d.id, d] as const))("%s: requiredIdentitySet matches the deck's signature cards exactly", (_id, deck) => {
    const identity = byId.get(deck.identityCardId as string);
    expect(identity?.type).toBe("hero_identity");
    if (identity?.type !== "hero_identity") return;
    const required = requiredIdentitySet(identity as HeroIdentityCard, WAVE1_CARDS);
    const inDeck = new Map(deck.cards.map((e) => [e.cardId as string, e.quantity]));
    for (const req of required) {
      expect(inDeck.get(req.cardId as string), `${deck.id}: missing/short ${req.cardId}`).toBe(req.quantity);
    }
    // And nothing the deck carries a hero-set aspect that isn't in `required` (the exempted separate-deck
    // cards excepted, e.g. Doctor Strange's Invocation events).
    const requiredIds = new Set(required.map((r) => r.cardId as string));
    for (const e of deck.cards) {
      const card = byId.get(e.cardId as string);
      if (card && "aspect" in card && card.aspect === `hero:${identity.id}`) {
        expect(requiredIds.has(e.cardId as string), `${deck.id}: ${e.cardId} is a hero-set card missing from requiredIdentitySet`).toBe(true);
      }
    }
  });

  it("Doctor Strange's Invocation cards are never listed in the deck", () => {
    const deck = deckId("drs-protection");
    for (const invocationCode of ["09032", "09033", "09034", "09035", "09036"]) {
      expect(deck.cards.some((e) => e.cardId === invocationCode)).toBe(false);
    }
    const identity = byId.get(deck.identityCardId as string);
    expect(identity?.type).toBe("hero_identity");
    if (identity?.type !== "hero_identity") return;
    expect(identity.separateDecks?.[0]?.cards.map((c) => c.cardId).sort()).toEqual(
      ["09032", "09033", "09034", "09035", "09036"].sort(),
    );
  });
});
