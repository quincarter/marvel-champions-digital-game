import { describe, expect, it } from "vitest";
import { cardId, cycleId, setCode, unerrataedText, validateCard } from "./index.js";
import type { EventCard } from "./index.js";

/**
 * docs/phase7-wave7.md §1.3: a per player icon on a printed cost (`CostedCard.costPerPlayer`). The fixture copies Team
 * Investigation's (40053) printed values, trimmed to what the rule needs; it is not curated data.
 *
 * Sources: RRG 1.8 "Per Player Icon" (p. 32); MC40 p. 5.
 */

const teamInvestigation: EventCard = {
  id: cardId("40053"),
  type: "event",
  name: "Team Investigation",
  setCode: setCode("next_evol"),
  cycleId: cycleId("cycle7"),
  collectorNumber: "53",
  quantityInSet: 3,
  unique: false,
  cost: 2,
  costPerPlayer: true,
  resourceIcons: { mental: 1 },
  aspect: "justice",
  traits: [],
  keywords: [{ name: "alliance" }],
  deckLimit: 3,
  text: unerrataedText("Alliance.\nHero Action: Remove 3[per_hero] threat from a side scheme."),
  abilities: [],
};

describe("§1.3 CostedCard.costPerPlayer", () => {
  it("a cost of 2 per player is the numeral 2 with the flag", () => {
    expect(validateCard(teamInvestigation).errors).toEqual([]);
    const { costPerPlayer: _dropped, ...flatCost } = teamInvestigation;
    expect(validateCard(flatCost).errors).toEqual([]);
  });

  it("is true or absent, never false or a number", () => {
    for (const value of [false, 1, "true"]) {
      const card = { ...teamInvestigation, costPerPlayer: value } as unknown as EventCard;
      expect(validateCard(card).errors).toContain("event costPerPlayer must be true when present");
    }
  });

  it("does not go with a printed X or — cost, which has no numeral to multiply", () => {
    for (const specialCost of ["X", "dash"] as const) {
      const card: EventCard = { ...teamInvestigation, cost: 0, specialCost };
      expect(validateCard(card).errors).toContain("event costPerPlayer needs a printed number, not a printed X or —");
    }
  });
});
