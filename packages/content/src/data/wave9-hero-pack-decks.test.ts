import { describe, expect, it } from "vitest";
import { BP_CARDS } from "./bp/cards.js";
import { BP_STARTER_DECKS } from "./bp/starterDecks.js";
import { FALCON_CARDS } from "./falcon/cards.js";
import { FALCON_STARTER_DECKS } from "./falcon/starterDecks.js";
import { SILK_STARTER_DECKS } from "./silk/starterDecks.js";
import { WINTER_STARTER_DECKS } from "./winter/starterDecks.js";
import { SILK_CARDS } from "./silk/cards.js";
import { CATALOG_REPRINTS } from "./catalog.js";
import { SILK_PROVENANCE } from "./silk/provenance.js";
import { BP_PROVENANCE } from "./bp/provenance.js";
import { FALCON_PROVENANCE } from "./falcon/provenance.js";
import { WINTER_PROVENANCE } from "./winter/provenance.js";
import type { AnyCard, StarterDeck } from "../schema/index.js";

/**
 * The four Agents of S.H.I.E.L.D. hero pack decks, card by card against the printed decklist cards as transcribed in
 * docs/phase7-wave9-data-survey.md section 6.2 (collector number -> copies; the code is the pack prefix plus the
 * collector number). Written out here on purpose: the test compares the emitted deck with the survey's list.
 */
function list(prefix: string, entries: Record<number, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(entries).map(([n, q]) => [`${prefix}${String(n).padStart(3, "0")}`, q]));
}
const ones = (from: number, to: number): Record<number, number> =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, 1]));

const SURVEY: Record<string, { deck: readonly StarterDeck[]; cards: Record<string, number> }> = {
  bp: {
    deck: BP_STARTER_DECKS,
    cards: list("51", {
      ...ones(2, 30),
      3: 2,
      4: 2,
      6: 2,
      15: 3,
      19: 3,
      20: 3,
      21: 3,
    }),
  },
  silk: {
    deck: SILK_STARTER_DECKS,
    cards: list("52", { ...ones(2, 27), 2: 2, 3: 3, 4: 2, 15: 3, 16: 3, 18: 3, 19: 3, 20: 3 }),
  },
  falcon: {
    deck: FALCON_STARTER_DECKS,
    cards: list("53", {
      ...ones(2, 28),
      3: 2,
      4: 2,
      5: 2,
      19: 3,
      20: 3,
      21: 3,
      24: 3,
      28: 3,
    }),
  },
  winter: {
    deck: WINTER_STARTER_DECKS,
    cards: list("54", {
      ...ones(2, 26),
      4: 2,
      5: 3,
      6: 2,
      8: 2,
      14: 3,
      15: 3,
      16: 3,
      17: 3,
      20: 3,
    }),
  },
};

describe("Wave 9 hero pack starter decks", () => {
  for (const [pack, { deck, cards }] of Object.entries(SURVEY)) {
    it(`${pack}: one deck, 40 cards by id, equal to the survey's printed list card by card`, () => {
      expect(deck).toHaveLength(1);
      const emitted: Record<string, number> = {};
      for (const entry of deck[0]!.cards) emitted[entry.cardId] = (emitted[entry.cardId] ?? 0) + entry.quantity;
      expect(emitted).toEqual(cards);
      expect(Object.values(emitted).reduce((a, b) => a + b, 0)).toBe(40);
      expect(new Set(deck[0]!.cards.map((c) => c.cardId)).size).toBe(deck[0]!.cards.length);
    });
  }

  it("Redemption 51036 and Captain America's Shield 53034 are linked cards outside every deck", () => {
    const pairs: [string, readonly AnyCard[]][] = [
      ["51036", BP_CARDS],
      ["53034", FALCON_CARDS],
    ];
    for (const [id, cards] of pairs) {
      const card = cards.find((c) => c.id === id)!;
      expect("keywords" in card && card.keywords.some((k) => k.name === "linked")).toBe(true);
      for (const { deck } of Object.values(SURVEY)) {
        expect(deck[0]!.cards.some((c) => c.cardId === id)).toBe(false);
      }
    }
  });

  // The reprints by MarvelCDB `duplicate_of_code`: 5, 6, 7 and 5 (spec 8.1 item 17), each recorded in the card's
  // provenance and in the generated catalog's reprint map.
  it("the reprints of the four packs, by source card", () => {
    const FOUND: Record<string, Record<string, string>> = {
      bp: { "51020": "20015", "51026": "40027", "51027": "01088", "51028": "01089", "51029": "01090" },
      silk: {
        "52015": "38016",
        "52022": "27049",
        "52023": "27018",
        "52025": "01088",
        "52026": "01089",
        "52027": "01090",
      },
      falcon: {
        "53014": "17011",
        "53016": "29014",
        "53022": "01073",
        "53025": "01088",
        "53026": "01089",
        "53027": "01090",
        "53028": "42022",
      },
      winter: { "54015": "28014", "54021": "50054", "54024": "01088", "54025": "01089", "54026": "01090" },
    };
    const provenance = {
      bp: BP_PROVENANCE,
      silk: SILK_PROVENANCE,
      falcon: FALCON_PROVENANCE,
      winter: WINTER_PROVENANCE,
    };
    for (const [pack, expected] of Object.entries(FOUND)) {
      const got = Object.fromEntries(
        provenance[pack as keyof typeof provenance].flatMap((p) =>
          p.duplicateOfCardId ? [[p.cardId, p.duplicateOfCardId]] : [],
        ),
      );
      expect(got).toEqual(expected);
      for (const [code, source] of Object.entries(expected)) expect(CATALOG_REPRINTS[code]).toBe(source);
    }
  });

  it("Silk's Spider-Man 52022 uses the image of the card it reprints (27049, Peter Parker), not Miles Morales's 27011", () => {
    const card = SILK_CARDS.find((c) => c.id === "52022")!;
    expect(card.images?.front).toBe("/bundles/cards/27049.png");
  });
});
