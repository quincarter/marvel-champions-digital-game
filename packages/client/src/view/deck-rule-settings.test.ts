import { describe, expect, test } from "vitest";
import { CORE_CARDS, type AnyCard, type CardId } from "@mc/content";
import { requiredIdentitySet } from "@mc/engine";
import { addCard, deckRuleRefusal, identityOptions, newDeck, setAspects } from "./deck-builder-model.js";

const spiderMan = identityOptions(CORE_CARDS).find((c) => c.name === "Spider-Man")!;
const deck = setAspects(newDeck(spiderMan, CORE_CARDS, "d1", "poolv1", "2026-10-29T00:00:00.000Z"), ["justice"]);
const signature = requiredIdentitySet(spiderMan, CORE_CARDS)[0]!.cardId;
const byName = (name: string): AnyCard => CORE_CARDS.find((c) => c.name === name)!;
const times = (n: number, id: CardId) => Array.from({ length: n }).reduce<typeof deck>((d) => addCard(d, id), deck);

describe("deck-building rule settings (issue #531)", () => {
  test("free: nothing is refused, as the builder has always been", () => {
    const rules = { signature: "free", copyLimits: false } as const;
    expect(deckRuleRefusal(deck, spiderMan, CORE_CARDS, signature, 1, rules)).toBeNull();
    expect(deckRuleRefusal(deck, spiderMan, CORE_CARDS, signature, -1, rules)).toBeNull();
    const forJustice = byName("For Justice!").id;
    expect(deckRuleRefusal(times(3, forJustice), spiderMan, CORE_CARDS, forJustice, 1, rules)).toBeNull();
  });

  test("standard and hidden keep signature cards at their set's count, both ways", () => {
    for (const signatureRule of ["standard", "hidden"] as const) {
      const rules = { signature: signatureRule, copyLimits: false };
      expect(deckRuleRefusal(deck, spiderMan, CORE_CARDS, signature, 1, rules)).toMatch(/signature/i);
      expect(deckRuleRefusal(deck, spiderMan, CORE_CARDS, signature, -1, rules)).toMatch(/signature/i);
      expect(deckRuleRefusal(deck, spiderMan, CORE_CARDS, byName("For Justice!").id, 1, rules)).toBeNull();
    }
  });

  test("a signature card off its set count can still move back toward it, never past it", () => {
    const rules = { signature: "standard", copyLimits: false } as const;
    const setCount = requiredIdentitySet(spiderMan, CORE_CARDS)[0]!.quantity;
    const extra = addCard(deck, signature);
    expect(deckRuleRefusal(extra, spiderMan, CORE_CARDS, signature, -1, rules)).toBeNull();
    expect(deckRuleRefusal(extra, spiderMan, CORE_CARDS, signature, 1, rules)).not.toBeNull();
    const fewer = {
      ...deck,
      cards: deck.cards.map((line) => (line.cardId === signature ? { ...line, quantity: setCount - 1 } : line)),
    };
    expect(deckRuleRefusal(fewer, spiderMan, CORE_CARDS, signature, 1, rules)).toBeNull();
    expect(deckRuleRefusal(fewer, spiderMan, CORE_CARDS, signature, -1, rules)).not.toBeNull();
  });

  test("copy limits refuse a fourth copy by title and a second of a Max 1 per deck card", () => {
    const rules = { signature: "free", copyLimits: true } as const;
    const forJustice = byName("For Justice!").id;
    expect(deckRuleRefusal(times(2, forJustice), spiderMan, CORE_CARDS, forJustice, 1, rules)).toBeNull();
    expect(deckRuleRefusal(times(3, forJustice), spiderMan, CORE_CARDS, forJustice, 1, rules)).not.toBeNull();
    const maxOne = CORE_CARDS.find(
      (c) => "deckLimit" in c && c.deckLimit === 1 && "aspect" in c && c.aspect === "justice",
    )!;
    expect(maxOne).toBeDefined();
    expect(deckRuleRefusal(deck, spiderMan, CORE_CARDS, maxOne.id, 1, rules)).toBeNull();
    expect(deckRuleRefusal(times(1, maxOne.id), spiderMan, CORE_CARDS, maxOne.id, 1, rules)).not.toBeNull();
    // Removing is never a copy-limit question.
    expect(deckRuleRefusal(times(3, forJustice), spiderMan, CORE_CARDS, forJustice, -1, rules)).toBeNull();
  });
});
