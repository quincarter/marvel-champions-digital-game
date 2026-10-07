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
  WAVE6_STARTER_DECKS,
  WAVE7_STARTER_DECKS,
  WAVE8_STARTER_DECKS,
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
  ...WAVE6_STARTER_DECKS,
  ...WAVE7_STARTER_DECKS,
  ...WAVE8_STARTER_DECKS,
];

/**
 * Wave 6 packs in the pool whose hero kits are not scripted yet (docs/phase7-wave6.md): their precons are legal but
 * cannot be seated, which the client already reports through `unscriptedCards` (it blocks such a deck at the seat).
 */
const UNSCRIPTED_WAVE6_PACKS: ReadonlySet<string> = new Set();

/**
 * Wave 7 packs in the pool whose kits are not scripted yet (docs/phase7-wave7.md): none.
 */
const UNSCRIPTED_WAVE7_PACKS: ReadonlySet<string> = new Set();

/**
 * Wave 8 packs in the pool whose kits are not scripted yet (docs/phase7-wave8.md): their precons are legal but cannot
 * be seated, which the client reports through `unscriptedCards` (it blocks such a deck at the seat). Remove a pack
 * from this set when its kit is scripted.
 */
const UNSCRIPTED_WAVE8_PACKS: ReadonlySet<string> = new Set(["aoa", "iceman", "jubilee", "ncrawler", "magneto"]);

/** Every pack whose precons are legal but cannot be seated yet. */
const UNSCRIPTED_PACKS: ReadonlySet<string> = new Set([
  ...UNSCRIPTED_WAVE6_PACKS,
  ...UNSCRIPTED_WAVE7_PACKS,
  ...UNSCRIPTED_WAVE8_PACKS,
]);

/** Wave 6 precon cards left unscripted on purpose (wave6/coverage.test.ts `KNOWN_SKIPPED`): none. */
const KNOWN_UNSCRIPTED: ReadonlySet<string> = new Set();

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
      (card) =>
        (card.progressingIdentity === undefined || card.progressingIdentity.versions[0] === card.id) &&
        !UNSCRIPTED_PACKS.has(card.setCode as string),
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
      const unscripted = unscriptedCards(contentsOf(deck), PLAYABLE_CARDS, PLAYABLE_DEPS);
      const pack = byId.get(deck.identityCardId)?.setCode as string;
      if (UNSCRIPTED_PACKS.has(pack)) {
        expect(unscripted.length).toBeGreaterThan(0);
        return;
      }
      // Only the known-skipped cards remain.
      const expected = unscripted.filter((id) => !KNOWN_UNSCRIPTED.has(id as string));
      expect(expected).toEqual([]);
    });
  });
});
