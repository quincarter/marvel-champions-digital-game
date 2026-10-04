import { describe, expect, it } from "vitest";
import type { AnyCard, Deck, HeroIdentityCard } from "@mc/content";
import { cardsMatch, validateDeck } from "@mc/engine";
import { CARDS_BY_ID, POOL_CARDS } from "../content/pool.js";
import { preconDecks } from "./deck-list-model.js";
import { applyDeckSwaps } from "./name-conflicts.js";
import { recommendedReplacementOf, replacementCandidatesOf } from "./replacement-candidates.js";

const decks = preconDecks();
const precon = (id: string): Deck => decks.find((d) => (d.id as string) === `precon:${id}`)!;
const hero = (deck: Deck): HeroIdentityCard => CARDS_BY_ID.get(deck.identityCardId as string) as HeroIdentityCard;
const ON = { sameNameHeroAllyConflict: true } as const;

const colossus = precon("colossus-protection");
const shadowcat = precon("shadowcat-aggression");
const input = {
  deck: shadowcat,
  fromCardId: "32048",
  seatedHeroes: [hero(colossus), hero(shadowcat)],
  identity: hero(shadowcat),
  pool: POOL_CARDS,
  tableRules: ON,
};
const costOf = (card: AnyCard): number => ("cost" in card ? Number(card.cost) : 0);

describe("replacementCandidatesOf", () => {
  const found = replacementCandidatesOf(input);

  it("offers cards, and every one keeps the swapped deck legal", () => {
    expect(found.length).toBeGreaterThan(5);
    for (const { card } of found.slice(0, 40)) {
      const swapped = applyDeckSwaps(shadowcat, [
        { deckId: shadowcat.id as string, from: "32048", to: card.id as string },
      ]);
      expect(validateDeck(swapped, POOL_CARDS).ok, card.name).toBe(true);
    }
  });

  it("never offers the card itself, or one that matches a seated hero", () => {
    expect(found.some(({ card }) => card.name === "Colossus")).toBe(false);
    for (const { card } of found) {
      expect(cardsMatch(card, hero(colossus), ON), card.name).toBe(false);
    }
  });

  it("ranks allies of the old card's aspect first, then other allies, then other cards, nearest cost first", () => {
    const tiers = found.map((c) => c.tier);
    expect([...tiers].sort()).toEqual(tiers);
    expect(tiers[0]).toBe(0);
    expect(found[0]!.card.type).toBe("ally");
    const from = CARDS_BY_ID.get("32048")!;
    const tierZero = found.filter((c) => c.tier === 0).map((c) => Math.abs(costOf(c.card) - costOf(from)));
    expect([...tierZero].sort((a, b) => a - b)).toEqual(tierZero);
    expect(recommendedReplacementOf(found)).toBe(found[0]!.card.id);
  });

  it("leaves out cards the player's packs do not include or the build cannot play", () => {
    const first = found[0]!.card;
    const hidden = replacementCandidatesOf({ ...input, isUnlocked: (card) => card.id !== first.id });
    expect(hidden.some((c) => c.card.id === first.id)).toBe(false);
    const unplayable = replacementCandidatesOf({ ...input, isPlayable: () => false });
    expect(unplayable).toEqual([]);
    expect(recommendedReplacementOf(unplayable)).toBeNull();
  });

  it("is empty for a card the deck does not hold", () => {
    expect(replacementCandidatesOf({ ...input, fromCardId: "no-such-card" })).toEqual([]);
  });

  it("a replacement is never an ally that clashes with another seat's hero at a three-seat table", () => {
    const wolverine = precon("wolverine-aggression");
    const three = replacementCandidatesOf({
      ...input,
      seatedHeroes: [hero(colossus), hero(shadowcat), hero(wolverine)],
    });
    expect(three.some(({ card }) => card.name === "Wolverine")).toBe(false);
  });
});
