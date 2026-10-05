import { describe, expect, it } from "vitest";
import { DEADPOOL_CARDS } from "../data/deadpool/cards.js";
import { validateCard } from "./index.js";
import type { UpgradeCard } from "./index.js";

/**
 * docs/phase7-wave7.md §3.82, §4.1 Q52 = B: `PlayerCard.restrictedWeight`, "Counts as 2 restricted cards." on a card
 * that does not have the restricted keyword (Laser Swords, `deadpool` 44055).
 *
 * Sources: RRG 1.8 "Restricted" (p. 38).
 */

const laserSwords = DEADPOOL_CARDS.find((card) => card.id === "44055") as UpgradeCard;

describe("PlayerCard.restrictedWeight", () => {
  it("Laser Swords carries 2 as data, has no restricted keyword, and keeps one scripted constant (its ATK)", () => {
    expect(laserSwords.restrictedWeight).toBe(2);
    expect(laserSwords.keywords).toEqual([]);
    expect(laserSwords.deckLimit).toBe(1);
    expect(laserSwords.abilities.map((ref) => ref.id)).toEqual(["44055.laser-swords-constant"]);
    expect(validateCard(laserSwords).errors).toEqual([]);
  });

  it("no other Deadpool card has a weight", () => {
    const weighted = DEADPOOL_CARDS.filter((card) => "restrictedWeight" in card && card.restrictedWeight !== undefined);
    expect(weighted.map((card) => card.id)).toEqual(["44055"]);
  });

  it("refuses a weight below 2 or not an integer", () => {
    for (const restrictedWeight of [0, 1, 2.5, -2]) {
      expect(validateCard({ ...laserSwords, restrictedWeight }).errors).toContain(
        "upgrade restrictedWeight must be an integer of at least 2",
      );
    }
    expect(validateCard({ ...laserSwords, restrictedWeight: 3 }).errors).toEqual([]);
  });

  it("refuses a weight on a card that also has the restricted keyword", () => {
    expect(validateCard({ ...laserSwords, keywords: [{ name: "restricted" }] }).errors).toContain(
      "upgrade restrictedWeight cannot be combined with the restricted keyword",
    );
  });
});
