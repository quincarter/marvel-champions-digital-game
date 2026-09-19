/**
 * The wave 2 reprint mechanism (docs/phase7-wave2-scripting.md, modeled on `../wave1/reprints.test.ts`).
 * `reprints.ts` derives the reprint list programmatically from `@mc/content`, so this test never hardcodes the
 * full pair count for the whole cycle 1 pool — a later pack silently adding or losing a reprint would change
 * these numbers and fail here. Scoped to `trors` (the only pack with scripted content so far); extend the counts
 * as more packs land.
 */
import { TRORS_CARDS } from "@mc/content";
import { CORE_ABILITIES } from "../core/index.js";
import { WAVE2_REPRINT_ABILITIES, WAVE2_REPRINT_PROBLEMS, wave2ReprintPairs } from "./index.js";

describe("wave 2 reprints", () => {
  it("finds every (name, type) match for trors, whether or not it ends up aliased", () => {
    const trorsIds = new Set(TRORS_CARDS.map((c) => c.id as string));
    const pairs = wave2ReprintPairs().filter((p) => trorsIds.has(p.wave2.id as string));
    expect(pairs.length).toBeGreaterThan(0);
    for (const { wave2: card, wave1: match } of pairs) {
      expect(card.name).toBe(match.name);
      expect(card.type).toBe(match.type);
      expect(card.id).not.toBe(match.id);
    }
  });

  it("does not alias the Hawkeye ally collision: Kate Bishop (04011, trors) vs. Clint Barton (03012/01015, Core/cap)", () => {
    // Same (name, type) — both are `ally` cards named "Hawkeye" — but a different card with a different ability
    // shape (Kate Bishop has her own 1-ability action; the Core/wave 1 "Hawkeye" reprint chain has 2 abilities).
    // Confirmed unaliased so it must be (and is) hand-scripted in `hawkeye-kit.ts`.
    const problem = WAVE2_REPRINT_PROBLEMS.find((p) => p.startsWith("04011 "));
    expect(problem).toBeDefined();
    expect(WAVE2_REPRINT_ABILITIES["04011.hawkeye-action"]).toBeUndefined();
  });

  it("aliases Lead from the Front (04018) to Core's own 01070, the exact same AbilityDefinition object", () => {
    expect(WAVE2_REPRINT_ABILITIES["04018.lead-from-the-front-action"]).toBe(CORE_ABILITIES["01070.lead-from-the-front-action"]);
  });

  it("aliases Hail Hydra! (04057, hawkeye_nemesis; 04147, hydra_assault) to the same wave 1 (cap) definition", () => {
    expect(WAVE2_REPRINT_ABILITIES["04057.when-revealed"]).toBeDefined();
    expect(WAVE2_REPRINT_ABILITIES["04057.when-revealed"]).toBe(WAVE2_REPRINT_ABILITIES["04147.when-revealed"]);
  });
});
