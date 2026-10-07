import { describe, expect, it } from "vitest";
import { MAGNETO_CARDS } from "./magneto/cards.js";
import { NCRAWLER_CARDS } from "./ncrawler/cards.js";

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
