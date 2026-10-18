import { describe, expect, it } from "vitest";
import { on } from "./abilities.js";
import { applyRuleUntil, skipNextVillainPhase } from "./effects.js";

/**
 * docs/phase7-wave11-hero-packs.md H3.7, H3.8 (tasks HT2, HT3): Run Them to Ground's (61020) vocabulary. Engine
 * behavior: `packages/engine/src/skip-next-villain-phase.test.ts`.
 */
describe("skipNextVillainPhase / nextVillainPhaseBegins / on.roundEnding", () => {
  it("skipNextVillainPhase is the engine effect", () => {
    expect(skipNextVillainPhase()).toEqual({ kind: "skipNextVillainPhase" });
  });

  it("applyRuleUntil takes 'until the start of the next (unskipped) villain phase'", () => {
    expect(
      applyRuleUntil({ kind: "cannotTakeDamage", target: { categories: ["villain"] } }, "nextVillainPhaseBegins"),
    ).toEqual({
      kind: "applyRuleUntil",
      rule: { kind: "cannotTakeDamage", target: { categories: ["villain"] } },
      until: "nextVillainPhaseBegins",
    });
  });

  it("'when the round ends' hears a skipped phase's round end; 'when the villain phase ends' does not", () => {
    expect(on.roundEnding()).toEqual({ on: "phaseEnding", eventIs: { phase: ["villain", "round"] } });
    expect(on.phaseEnding("villain")).toEqual({ on: "phaseEnding", eventIs: { phase: "villain" } });
  });
});
