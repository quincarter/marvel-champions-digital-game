/**
 * Wave 6 definition-of-done 4b (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The pieces") for Phoenix
 * (`phoenix` 34001a/b): the deck builder's start state and her deckbuilding rules.
 *
 * NOT COVERED: the "real public MarvelCDB decklist" piece. Of the 66 public Phoenix decklists in the 2026-10-02 by-date
 * dump, none imports with zero `unknown_card` problems against `WAVE6_CARDS`. Closest (one or two missing cards each):
 * 59977 "Blue phoenix" (45012 X-23, Age of Apocalypse), 60643 "Phoenix Misdirection" (48012 Rogue Nightcrawler),
 * 59553 "Phoenix justicia agresiva" (40028 The Power of the Mind, 45049 Stepford Cuckoos) and 61397 "Phoenix Aggression"
 * (40028, 40029 Psimitar, both NeXt Evolution). Add the fixture and import/legal/greedy-game tests once one of those
 * packs is in the pool; a decklist is never edited to fit.
 */
import { describe, expect, test } from "vitest";
import { requiredIdentitySet, validateDeck } from "@mc/engine";
import {
  CORE_CARDS,
  PHOENIX_STARTER_DECKS,
  type DeckContents,
  type HeroIdentityCard,
  type PlayerCard,
} from "@mc/content";
import { WAVE6_CARDS } from "../../cards.js";

const precon = (): DeckContents => {
  const deck = PHOENIX_STARTER_DECKS.find((d) => d.id === "phoenix-justice");
  if (!deck) throw new Error("no Phoenix starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};

describe("Phoenix: deck builder start state", () => {
  test("requiredIdentitySet is exactly her precon's signature cards (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
    const identity = WAVE6_CARDS.find((c) => c.id === "34001a") as HeroIdentityCard;
    expect(identity.type).toBe("hero_identity");
    const required = requiredIdentitySet(identity, WAVE6_CARDS);
    const heroSetInPrecon = precon()
      .cards.filter((line) => {
        const card = WAVE6_CARDS.find((c) => c.id === line.cardId);
        return card && "aspect" in card && card.aspect === "hero:34001a";
      })
      .map((line) => ({ cardId: line.cardId as string, quantity: line.quantity }));
    expect(heroSetInPrecon.length).toBeGreaterThan(0);
    expect(required.map((r) => ({ cardId: r.cardId as string, quantity: r.quantity }))).toEqual(heroSetInPrecon);
  });

  test("Phoenix Force (34002a, Permanent) is part of the required set: it is in the builder's start state, not the 40-50 count", () => {
    // The precon lists Phoenix Force as a hero-set card, and the engine counts it as a hero-set card like any other;
    // being Permanent only exempts it from the deck size (engine deck.ts: "the identity and permanent cards do not
    // count"), and the Jean Grey setup (34001b) puts it into play.
    const required = requiredIdentitySet(WAVE6_CARDS.find((c) => c.id === "34001a") as HeroIdentityCard, WAVE6_CARDS);
    expect(required.find((r) => (r.cardId as string) === "34002a")?.quantity).toBe(1);
    const force = WAVE6_CARDS.find((c) => c.id === "34002a") as PlayerCard;
    expect(force.keywords.map((k) => k.name)).toContain("permanent");
  });
});

describe("Phoenix: deckbuilding rules", () => {
  // Phoenix's identity card has no `deckbuilding` block (no off-aspect allowance, no kit or aspect-count rule); her
  // only deck-shape rule is the standard one (hero set + one aspect + basic cards, RRG 1.8 Appendix I p. 50). So this
  // asserts the plain legal precon and a plain illegal deck's message, as the Cyclops file does.
  test("her identity carries no special deckbuilding rule", () => {
    expect((WAVE6_CARDS.find((c) => c.id === "34001a") as HeroIdentityCard).deckbuilding).toBeUndefined();
  });

  test("her Justice precon is legal", () => {
    expect(validateDeck(precon(), WAVE6_CARDS)).toEqual({ ok: true });
  });

  test("an off-aspect card is rejected, with its player-readable message", () => {
    const support = CORE_CARDS.find(
      (c): c is PlayerCard => "deckLimit" in c && c.type === "support" && c.aspect === "aggression",
    );
    if (!support) throw new Error("no Core Aggression support");
    const deck = { ...precon(), cards: [...precon().cards, { cardId: support.id, quantity: 1 }] };
    const verdict = validateDeck(deck, [...WAVE6_CARDS, ...CORE_CARDS]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.problems.map((p) => p.code)).toEqual(["aspect_restriction"]);
    expect(verdict.problems[0]?.cardIds).toEqual([support.id]);
    expect(verdict.problems[0]?.message).toBe(
      `${support.name} is a Aggression card, but this deck's aspect is Justice; beyond its identity set a deck may only use its chosen aspect and basic cards.`,
    );
  });
});
