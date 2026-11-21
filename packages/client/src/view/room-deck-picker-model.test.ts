import { describe, expect, it } from "vitest";
import type { DeckOption } from "./deck-list-model.js";
import { cardsOf, pickerRows } from "./room-deck-picker-model.js";

const option = (
  id: string,
  name: string,
  hero: string,
  aspects: string[],
  over: Partial<DeckOption> = {},
): DeckOption =>
  ({
    deck: {
      id,
      name,
      identityCardId: hero,
      aspects,
      cards: [
        { cardId: "a", quantity: 3 },
        { cardId: "b", quantity: 2 },
      ],
      source: { kind: "userBuilt" },
    },
    identityName: name.split(" ")[0],
    legal: true,
    problems: [],
    unscripted: [],
    poolChanged: false,
    seatable: true,
    blockedReason: null,
    warning: null,
    ...over,
  }) as unknown as DeckOption;

const spider = option("d1", "Spider-Man webs", "01001a", ["justice"]);
const marvel = option("d2", "Captain Marvel starter", "01010a", ["leadership"]);
const broken = option("d3", "Iron Man draft", "01029a", ["aggression"], {
  seatable: false,
  legal: false,
  blockedReason: "Needs 40 cards.",
});

describe("room deck picker rows", () => {
  it("lists every deck, the seatable ones first", () => {
    const rows = pickerRows([broken, spider, marvel], "");
    expect(rows.map((r) => r.id)).toEqual(["d1", "d2", "d3"]);
    expect(rows[2]).toMatchObject({ seatable: false, blockedReason: "Needs 40 cards." });
    expect(rows[0]).toMatchObject({ cardId: "01001a", aspects: "Justice", cards: 5, heroName: "Spider-Man" });
  });
  it("counts every copy", () => {
    expect(cardsOf(spider)).toBe(5);
  });
  it("filters by deck name, hero or aspect, ignoring accents, case and a typo", () => {
    const all = [spider, marvel, broken];
    expect(pickerRows(all, "CAPTAIN").map((r) => r.id)).toEqual(["d2"]);
    expect(pickerRows(all, "aggresion").map((r) => r.id)).toEqual(["d3"]);
    expect(pickerRows(all, "spidr man").map((r) => r.id)).toEqual(["d1"]);
    expect(pickerRows(all, "justice").map((r) => r.id)).toEqual(["d1"]);
    expect(pickerRows(all, "nothing like it")).toEqual([]);
  });
  it("keeps a deck that cannot be seated below one that can, whatever the match", () => {
    const iron = option("d4", "Iron Man starter", "01029a", ["aggression"]);
    expect(pickerRows([broken, iron], "iron").map((r) => r.id)).toEqual(["d4", "d3"]);
  });
  it("marks the deck already in the seat", () => {
    const rows = pickerRows([spider, marvel], "", { hero: "01010a", name: "Captain Marvel starter" });
    expect(rows.map((r) => r.current)).toEqual([false, true]);
  });
});
