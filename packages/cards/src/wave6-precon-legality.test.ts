/**
 * Wave 6 (Mutant Genesis) hero-pack precon legality: Cyclops, Phoenix, Wolverine, Storm, Gambit and Rogue (docs/phase7-wave6-data-survey.md §9 step 7).
 *
 * Mirrors `wave5-precon-legality.test.ts`: each precon passes `validateDeck`, and `requiredIdentitySet` returns the
 * deck's hero-set cards exactly. Lives in `@mc/cards` because `@mc/content` must not import `@mc/engine`.
 */
import {
  CYCLOPS_CARDS,
  CYCLOPS_STARTER_DECKS,
  GAMBIT_CARDS,
  GAMBIT_STARTER_DECKS,
  PHOENIX_CARDS,
  PHOENIX_STARTER_DECKS,
  ROGUE_CARDS,
  ROGUE_STARTER_DECKS,
  STORM_CARDS,
  STORM_STARTER_DECKS,
  WOLV_CARDS,
  WOLV_STARTER_DECKS,
  type AnyCard,
  type DeckContents,
  type HeroIdentityCard,
  type StarterDeck,
} from "@mc/content";
import { requiredIdentitySet, validateDeck } from "@mc/engine";

const packs: readonly {
  readonly label: string;
  readonly cards: readonly AnyCard[];
  readonly decks: readonly StarterDeck[];
}[] = [
  { label: "Cyclops", cards: CYCLOPS_CARDS, decks: CYCLOPS_STARTER_DECKS },
  { label: "Phoenix", cards: PHOENIX_CARDS, decks: PHOENIX_STARTER_DECKS },
  { label: "Wolverine", cards: WOLV_CARDS, decks: WOLV_STARTER_DECKS },
  { label: "Storm", cards: STORM_CARDS, decks: STORM_STARTER_DECKS },
  { label: "Gambit", cards: GAMBIT_CARDS, decks: GAMBIT_STARTER_DECKS },
  { label: "Rogue", cards: ROGUE_CARDS, decks: ROGUE_STARTER_DECKS },
];

const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});

/** Everything `validateDeck`'s own size/quantity/deck-limit check does (wave4-precon-legality.test.ts), standalone. */
function checkBoxQuantityAndSize(deck: StarterDeck, byId: Map<string, AnyCard>): void {
  const total = deck.cards.reduce((n, e) => n + e.quantity, 0);
  expect(total).toBeGreaterThanOrEqual(40);
  expect(total).toBeLessThanOrEqual(50);
  for (const e of deck.cards) {
    const card = byId.get(e.cardId as string);
    expect(card && "deckLimit" in card, e.cardId as string).toBe(true);
    if (!card || !("deckLimit" in card)) continue;
    expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(Math.min(card.quantityInSet, card.deckLimit));
  }
}

/** Everything `validateDeck`'s own hero-set-completeness check does, standalone. */
function checkRequiredIdentitySet(deck: StarterDeck, cards: readonly AnyCard[], byId: Map<string, AnyCard>): void {
  const identity = byId.get(deck.identityCardId as string);
  expect(identity?.type).toBe("hero_identity");
  if (identity?.type !== "hero_identity") return;
  const required = requiredIdentitySet(identity as HeroIdentityCard, cards);
  const inDeck = new Map(deck.cards.map((e) => [e.cardId as string, e.quantity]));
  for (const req of required) {
    expect(inDeck.get(req.cardId as string), `${deck.id}: missing/short ${req.cardId}`).toBe(req.quantity);
  }
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
}

describe("wave 6 precons — Cyclops, Phoenix, Wolverine, Storm, Gambit and Rogue hero packs", () => {
  it("ids: cyclops-leadership, gambit-justice, phoenix-justice, rogue-protection, storm-leadership, wolverine-aggression", () => {
    expect(packs.flatMap((p) => p.decks.map((d) => d.id)).sort()).toEqual([
      "cyclops-leadership",
      "gambit-justice",
      "phoenix-justice",
      "rogue-protection",
      "storm-leadership",
      "wolverine-aggression",
    ]);
  });

  it("sizes: Cyclops 40 player cards, Phoenix 41, Wolverine 41, Storm 44, Gambit 40, Rogue 41", () => {
    const size = (d: StarterDeck) => d.cards.reduce((n, e) => n + e.quantity, 0);
    expect(size(CYCLOPS_STARTER_DECKS[0]!)).toBe(40);
    expect(size(PHOENIX_STARTER_DECKS[0]!)).toBe(41);
    expect(size(WOLV_STARTER_DECKS[0]!)).toBe(41);
    expect(size(STORM_STARTER_DECKS[0]!)).toBe(44);
    expect(size(GAMBIT_STARTER_DECKS[0]!)).toBe(40);
    expect(size(ROGUE_STARTER_DECKS[0]!)).toBe(41);
  });

  for (const pack of packs) {
    const byId = new Map(pack.cards.map((c) => [c.id as string, c]));

    it.each(pack.decks.map((d) => [d.id, d] as const))(`${pack.label} %s: sources are verified`, (_id, deck) => {
      expect(deck.provenance.verified).toBe(true);
      expect(deck.provenance.sources.length).toBeGreaterThan(0);
    });

    it.each(pack.decks.map((d) => [d.id, d] as const))(
      `${pack.label} %s: within box quantity and deck limit, and legal size (RRG 1.8 p. 50: 40-50)`,
      (_id, deck) => checkBoxQuantityAndSize(deck, byId),
    );

    it.each(pack.decks.map((d) => [d.id, d] as const))(
      `${pack.label} %s: validateDeck reports no problems`,
      (_id, deck) => {
        const result = validateDeck(contentsOf(deck), pack.cards);
        expect(result.ok ? [] : result.problems, JSON.stringify(result, null, 2)).toEqual([]);
      },
    );

    it.each(pack.decks.map((d) => [d.id, d] as const))(
      `${pack.label} %s: requiredIdentitySet matches the deck's signature cards exactly`,
      (_id, deck) => checkRequiredIdentitySet(deck, pack.cards, byId),
    );
  }
});
