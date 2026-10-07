/**
 * Wave 7 (NeXt Evolution) precon legality: Cable and Domino from the box, plus the Psylocke, Angel, X-23 and Deadpool
 * hero packs (docs/phase7-wave7.md).
 *
 * Mirrors `wave6-precon-legality.test.ts`: each precon passes `validateDeck` against the wave 7 pool, has the printed
 * total, and `requiredIdentitySet` returns the deck's hero-set cards exactly. Lives in `@mc/cards` because
 * `@mc/content` must not import `@mc/engine`.
 */
import {
  WAVE7_CARDS,
  WAVE7_STARTER_DECKS,
  type AnyCard,
  type DeckContents,
  type HeroIdentityCard,
  type StarterDeck,
} from "@mc/content";
import { requiredIdentitySet, validateDeck } from "@mc/engine";

const byId = new Map<string, AnyCard>(WAVE7_CARDS.map((c) => [c.id as string, c]));

/** Printed deck totals, in `WAVE7_STARTER_DECKS` order: Cable, Domino, Psylocke, Angel, X-23, Deadpool. */
const EXPECTED_TOTALS: readonly (readonly [string, number])[] = [
  ["Cable", 40],
  ["Domino", 40],
  ["Psylocke", 42],
  ["Angel", 40],
  ["X-23", 41],
  ["Deadpool", 40],
];

const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});

const heroNameOf = (deck: StarterDeck): string => {
  const identity = byId.get(deck.identityCardId as string) as HeroIdentityCard;
  return identity.hero.faceName;
};

describe("wave 7 precons", () => {
  it("six starter decks, one per hero, with the printed totals", () => {
    expect(WAVE7_STARTER_DECKS).toHaveLength(6);
    const actual = WAVE7_STARTER_DECKS.map((d) => [heroNameOf(d), d.cards.reduce((n, e) => n + e.quantity, 0)]);
    expect(actual).toEqual(EXPECTED_TOTALS.map(([name, total]) => [expect.stringContaining(name), total]));
  });

  it.each(WAVE7_STARTER_DECKS.map((d) => [d.id, d] as const))("%s: validateDeck reports no problems", (_id, deck) => {
    const result = validateDeck(contentsOf(deck), WAVE7_CARDS);
    expect(result.ok ? [] : result.problems, JSON.stringify(result, null, 2)).toEqual([]);
  });

  it.each(WAVE7_STARTER_DECKS.map((d) => [d.id, d] as const))(
    "%s: requiredIdentitySet is the hero's signature cards, all in the deck",
    (_id, deck) => {
      const identity = byId.get(deck.identityCardId as string) as HeroIdentityCard;
      expect(identity.type).toBe("hero_identity");
      const required = requiredIdentitySet(identity, WAVE7_CARDS);
      expect(required.length).toBeGreaterThan(0);
      const inDeck = new Map(deck.cards.map((e) => [e.cardId as string, e.quantity]));
      for (const req of required) {
        expect(inDeck.get(req.cardId as string), `${deck.id}: missing/short ${req.cardId}`).toBe(req.quantity);
      }
      const requiredIds = new Set(required.map((r) => r.cardId as string));
      for (const e of deck.cards) {
        const card = byId.get(e.cardId as string);
        if (card && "aspect" in card && card.aspect === `hero:${identity.id}`) {
          expect(requiredIds.has(e.cardId as string), `${deck.id}: ${e.cardId} not in requiredIdentitySet`).toBe(true);
        }
      }
    },
  );
});
