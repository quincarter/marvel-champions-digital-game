import { describe, expect, it } from "vitest";
import { validateStarterDeck } from "../schema/index.js";
import { MAGNETO_CARDS } from "./magneto/cards.js";
import { MAGNETO_STARTER_DECKS } from "./magneto/starterDecks.js";
import { NCRAWLER_CARDS } from "./ncrawler/cards.js";
import { NCRAWLER_STARTER_DECKS } from "./ncrawler/starterDecks.js";

/** RRG 1.8 p. 69 errata for the Wave 8 hero packs: printed text is kept, current text follows the errata. */
const cases = [
  { cards: NCRAWLER_CARDS, id: "48012", printed: "printed THW and ATK", current: "base THW and ATK" },
  { cards: MAGNETO_CARDS, id: "49010", printed: "attached → deal 5 damage", current: "attached. Then, deal 5 damage" },
  {
    cards: MAGNETO_CARDS,
    id: "49028",
    printed: "equal to his total ATK.",
    current: "equal to his total ATK for that attack.",
  },
] as const;

describe("Wave 8 printed-versus-current errata (RRG 1.8 p. 69)", () => {
  for (const c of cases) {
    it(`${c.id} keeps the print and carries the errata'd text`, () => {
      const card = (c.cards as readonly { id: string; text: { printed: string; current: string } }[]).find(
        (x) => x.id === c.id,
      );
      expect(card).toBeDefined();
      expect(card!.text.printed).not.toBe(card!.text.current);
      expect(card!.text.printed).toContain(c.printed);
      expect(card!.text.current).toContain(c.current);
    });
  }

  it("records the non-text errata (48037 boost star, 49023 classification) as notes with unchanged text", () => {
    for (const [cards, id] of [
      [NCRAWLER_CARDS, "48037"],
      [MAGNETO_CARDS, "49023"],
    ] as const) {
      const card = (
        cards as readonly { id: string; text: { printed: string; current: string }; errata?: unknown }[]
      ).find((x) => x.id === id);
      expect(card?.errata).toBeDefined();
      expect(card!.text.printed).toBe(card!.text.current);
    }
  });
});

/** Printed decklist cards (owner's photos, 2026-10-07): section counts exclude identity, obligation and nemesis set. */
const deckCases = [
  {
    decks: NCRAWLER_STARTER_DECKS,
    cards: NCRAWLER_CARDS,
    id: "nightcrawler-protection",
    pack: "ncrawler",
    identity: "48001a",
    aspect: "protection",
    sections: { hero: 15, protection: 20, basic: 5 },
  },
  {
    decks: MAGNETO_STARTER_DECKS,
    cards: MAGNETO_CARDS,
    id: "magneto-leadership",
    pack: "magneto",
    identity: "49001a",
    aspect: "leadership",
    sections: { hero: 15, leadership: 17, basic: 8 },
  },
] as const;

describe("Wave 8 starter decks (printed decklist cards)", () => {
  for (const c of deckCases) {
    describe(c.id, () => {
      const cards = c.cards as readonly { id: string; aspect?: string; type?: string }[];
      const deck = c.decks[0]!;

      it("is the pack's only deck, valid, for the pack's identity", () => {
        expect(c.decks).toHaveLength(1);
        expect(deck.id as string).toBe(c.id);
        expect(deck.packCode as string).toBe(c.pack);
        expect(validateStarterDeck(deck).errors).toEqual([]);
        expect(deck.identityCardId as string).toBe(c.identity);
        expect(deck.aspects).toEqual([c.aspect]);
        expect(cards.some((x) => x.id === c.identity)).toBe(true);
      });

      it("has 40 cards, every id in the pack", () => {
        expect(deck.cards.reduce((n, e) => n + e.quantity, 0)).toBe(40);
        for (const e of deck.cards)
          expect(
            cards.some((x) => x.id === (e.cardId as string)),
            e.cardId as string,
          ).toBe(true);
      });

      it("has the printed section counts", () => {
        const counts: Record<string, number> = {};
        for (const e of deck.cards) {
          const a = cards.find((x) => x.id === (e.cardId as string))!.aspect ?? "?";
          const key = a.startsWith("hero:") ? "hero" : a;
          counts[key] = (counts[key] ?? 0) + e.quantity;
        }
        expect(counts).toEqual(c.sections);
      });
    });
  }
});
