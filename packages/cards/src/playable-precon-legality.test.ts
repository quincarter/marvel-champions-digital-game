/**
 * Every precon in the playable pool, checked against the whole pool rather than its own pack
 * (docs/custom-deck-testing.md, "Deck builder start state"). The per-wave precon tests
 * (`wave1-`, `wave3-`, `wave4-precon-legality.test.ts`) check each wave against its own cards; Core and wave 2 had no
 * such test, and a player's deck is always validated against the full pool. For each precon:
 * - it is legal under `validateDeck`;
 * - the deck builder's start state for its identity (`requiredIdentitySet`) is exactly the precon's own signature
 *   cards, so a new deck for that hero opens with the right cards;
 * - it can be seated: nothing in it, its obligation or its nemesis set is unscripted (`unscriptedCards`).
 * Wave 5 joined this list once it was wired into the playable pool (PR #64 step 5); `wave5-precon-legality.test.ts`
 * still covers it against wave 5's own pool alone.
 */
import {
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE1_STARTER_DECKS,
  WAVE2_STARTER_DECKS,
  WAVE3_STARTER_DECKS,
  WAVE4_STARTER_DECKS,
  WAVE5_STARTER_DECKS,
  type DeckContents,
  type HeroIdentityCard,
  type StarterDeck,
} from "@mc/content";
import { requiredIdentitySet, unscriptedCards, validateDeck } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS } from "./playable/index.js";

const PRECONS: readonly StarterDeck[] = [
  ...CORE_STARTER_DECKS,
  ...WAVE1_STARTER_DECKS,
  ...WAVE2_STARTER_DECKS,
  ...WAVE3_STARTER_DECKS,
  ...WAVE4_STARTER_DECKS,
  ...WAVE5_STARTER_DECKS,
];

const byId = new Map(PLAYABLE_CARDS.map((card) => [card.id as string, card]));

const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});

describe("every playable precon, against the whole playable pool", () => {
  it("every playable hero has at least one precon", () => {
    // A progressing identity's later versions (Ironheart, docs/phase7-wave5.md §1.4/§3.23) are reached only by
    // in-game Level Up, never chosen at deck-build time (`@mc/engine`'s `validateDeck` "unsupported_identity" for
    // any version but `progressingIdentity.versions[0]`) — so only the first version needs a precon of its own.
    const identities = (PLAYABLE_CARDS.filter((card) => card.type === "hero_identity") as HeroIdentityCard[]).filter(
      (card) => card.progressingIdentity === undefined || card.progressingIdentity.versions[0] === card.id,
    );
    const withoutPrecon = identities.filter((card) => !PRECONS.some((deck) => deck.identityCardId === card.id));
    expect(withoutPrecon.map((card) => `${card.id} ${card.name}`)).toEqual([]);
  });

  describe.each(PRECONS.map((deck) => [deck.id, deck] as const))("%s", (_id, deck) => {
    it("is legal", () => {
      expect(validateDeck(contentsOf(deck), PLAYABLE_CARDS)).toEqual({ ok: true });
    });

    it("the deck builder starts its identity with exactly the precon's signature cards", () => {
      const identity = byId.get(deck.identityCardId) as HeroIdentityCard;
      const listed = new Map(deck.cards.map((entry) => [entry.cardId as string, entry.quantity]));
      for (const entry of requiredIdentitySet(identity, PLAYABLE_CARDS)) {
        expect([entry.cardId, listed.get(entry.cardId)]).toEqual([entry.cardId, entry.quantity]);
      }
    });

    it("can be seated: nothing it brings into the game is unscripted", () => {
      expect(unscriptedCards(contentsOf(deck), PLAYABLE_CARDS, PLAYABLE_DEPS)).toEqual([]);
    });
  });
});
