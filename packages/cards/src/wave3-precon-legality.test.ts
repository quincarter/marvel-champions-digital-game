/**
 * Wave 3 (cycle 2) hero-pack precon legality (PLAN.md Phase 7 / docs/phase7-wave3.md).
 *
 * Mirrors `wave1-precon-legality.test.ts`: lives in `@mc/cards` (not `@mc/content`'s own suite) because checking
 * legality means calling `@mc/engine`'s `validateDeck`/`requiredIdentitySet`, and `@mc/content` must never import
 * `@mc/engine` (`client → cards → engine → content`, CLAUDE.md). Uses `@mc/content`'s own `WAVE3_CARDS`/
 * `WAVE3_STARTER_DECKS` (not `packages/cards/src/wave3/cards.ts`'s `WAVE3_CARDS`, which is `PLAYABLE_CARDS` —
 * either pool has the same cards for this pack's purposes, but the content-side export is the one whose
 * provenance this test is actually checking).
 */
import {
  WAVE3_CARDS,
  WAVE3_STARTER_DECKS,
  type DeckContents,
  type HeroIdentityCard,
  type StarterDeck,
} from "@mc/content";
import { requiredIdentitySet, validateDeck } from "@mc/engine";

const byId = new Map(WAVE3_CARDS.map((c) => [c.id as string, c]));

const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});

describe("wave 3 precons — six hero packs (Groot, Rocket Raccoon, Star-Lord, Gamora, Drax, Venom)", () => {
  it("there are exactly six, one per wave 3 hero pack", () => {
    expect(WAVE3_STARTER_DECKS.map((d) => d.id).sort()).toEqual(
      [
        "groot-protection",
        "rocket-raccoon-aggression",
        "star-lord-leadership",
        "gamora-aggression",
        "drax-protection",
        "venom-justice",
      ].sort(),
    );
  });

  it.each(WAVE3_STARTER_DECKS.map((d) => [d.id, d] as const))("%s: validateDeck reports no problems", (_id, deck) => {
    const result = validateDeck(contentsOf(deck), WAVE3_CARDS);
    expect(result.ok, result.ok ? undefined : JSON.stringify((result as { problems: unknown }).problems, null, 2)).toBe(
      true,
    );
  });

  it.each(WAVE3_STARTER_DECKS.map((d) => [d.id, d] as const))("%s: sources are verified", (_id, deck) => {
    expect(deck.provenance.verified).toBe(true);
    expect(deck.provenance.sources.length).toBeGreaterThan(0);
  });

  it.each(WAVE3_STARTER_DECKS.map((d) => [d.id, d] as const))(
    "%s: exactly 40 cards, within box quantity and deck limit",
    (_id, deck) => {
      expect(deck.cards.reduce((n, e) => n + e.quantity, 0)).toBe(40);
      for (const e of deck.cards) {
        const card = byId.get(e.cardId as string);
        expect(card && "deckLimit" in card, e.cardId as string).toBe(true);
        if (!card || !("deckLimit" in card)) continue;
        expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(Math.min(card.quantityInSet, card.deckLimit));
      }
    },
  );

  it.each(WAVE3_STARTER_DECKS.map((d) => [d.id, d] as const))(
    "%s: requiredIdentitySet matches the deck's signature cards exactly",
    (_id, deck) => {
      const identity = byId.get(deck.identityCardId as string);
      expect(identity?.type).toBe("hero_identity");
      if (identity?.type !== "hero_identity") return;
      const required = requiredIdentitySet(identity as HeroIdentityCard, WAVE3_CARDS);
      const inDeck = new Map(deck.cards.map((e) => [e.cardId as string, e.quantity]));
      for (const req of required) {
        expect(inDeck.get(req.cardId as string), `${deck.id}: missing/short ${req.cardId}`).toBe(req.quantity);
      }
      // And nothing in the deck carries a hero-set aspect that isn't in `required` (separate-deck cards excepted).
      const requiredIds = new Set(required.map((r) => r.cardId as string));
      for (const e of deck.cards) {
        const card = byId.get(e.cardId as string);
        if (card && "aspect" in card && card.aspect === `hero:${identity.id}`) {
          expect(
            requiredIds.has(e.cardId as string),
            `${deck.id}: ${e.cardId} is a hero-set card missing from requiredIdentitySet`,
          ).toBe(true);
        }
      }
    },
  );

  it("Gamora's precon passes despite drawing First Hit (Protection)/Impede (Justice) via Skilled Tactician's off-aspect allowance", () => {
    const deck = WAVE3_STARTER_DECKS.find((d) => d.id === "gamora-aggression");
    expect(deck).toBeDefined();
    if (!deck) return;
    expect(deck.cards.some((e) => e.cardId === "18015")).toBe(true); // First Hit
    expect(deck.cards.some((e) => e.cardId === "18016")).toBe(true); // Impede
    const result = validateDeck(contentsOf(deck), WAVE3_CARDS);
    expect(result.ok).toBe(true);
  });
});
