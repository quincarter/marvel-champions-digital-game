import { WAVE10_ENCOUNTER_SETS, WAVE10_SCENARIOS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { civilWarModularSets, civilWarSidesOffer } from "./scenario-options.js";

/**
 * Test T4 of docs/phase7-synthezoid.md: Synthezoid Smackdown's leaders and sets are listed after Civil War's, in the
 * builder's offers (the owner's decision of 2026-10-19: after Civil War, before Wonder Man). The pack is gated while it
 * is scripted (`unscripted.ts`), so the offers are asked of the ungated records and sets: the order they show once the
 * gate is lifted.
 */
describe("T4: the builder lists the pack after Civil War", () => {
  it("offers She-Hulk after Captain Marvel and Vision after Spider-Woman", () => {
    const offer = civilWarSidesOffer(WAVE10_SCENARIOS);
    const registration = offer.find((s) => s.side === "registration")!;
    const resistance = offer.find((s) => s.side === "resistance")!;
    expect(registration.leaders.map((l) => l.name)).toEqual(["Iron Man", "Captain Marvel", "She-Hulk"]);
    expect(resistance.leaders.map((l) => l.name)).toEqual(["Captain America", "Spider-Woman", "Vision"]);
  });

  it("lists Civil War's modular sets before the pack's", () => {
    const sheHulk = WAVE10_SCENARIOS.find((s) => s.id === "registration-she-hulk")!;
    const sets = civilWarModularSets(sheHulk, WAVE10_ENCOUNTER_SETS).filter((s) => s.side === "registration");
    const sources = new Map(WAVE10_ENCOUNTER_SETS.map((s) => [s.id as string, (s.packCodes as readonly string[])[0]]));
    const packs = sets.map((s) => sources.get(s.id));
    expect(packs).toContain("cw");
    expect(packs).toContain("synthezoid");
    expect(packs.lastIndexOf("cw")).toBeLessThan(packs.indexOf("synthezoid"));
    // At She-Hulk the four recommended sets are the pack's own, and every registration set of both boxes is legal.
    expect(sets.every((s) => s.ok)).toBe(true);
    expect(
      sets
        .filter((s) => s.recommended)
        .map((s) => s.id)
        .sort(),
    ).toEqual(["deadly_duo", "shield_ops", "taskmaster_modular", "thunderbolts_modular"]);
  });
});
