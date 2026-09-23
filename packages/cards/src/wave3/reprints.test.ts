/**
 * The wave 3 (cycle 2) reprint mechanism (docs/phase7-wave3-scripting.md), modeled directly on `../wave2/
 * reprints.test.ts`. `reprints.ts` derives the reprint list programmatically from `@mc/content`, so this test
 * never hardcodes the full pair count for the whole cycle 2 pool — a later pack silently adding or losing a
 * reprint would change these numbers and fail here. Scoped to `gmw` (the only pack whose reprints are exercised
 * by a real card so far); extend as more packs land.
 */
import { GMW_CARDS } from "@mc/content";
import { CORE_ABILITIES } from "../core/index.js";
import { WAVE3_REPRINT_ABILITIES, wave3ReprintPairs } from "./index.js";

describe("wave 3 reprints", () => {
  it("finds every (name, type) match for gmw, whether or not it ends up aliased", () => {
    const gmwIds = new Set(GMW_CARDS.map((c) => c.id as string));
    const pairs = wave3ReprintPairs().filter((p) => gmwIds.has(p.wave3.id as string));
    expect(pairs.length).toBeGreaterThan(0);
    for (const { wave3: card, wave2: match } of pairs) {
      expect(card.name).toBe(match.name);
      expect(card.type).toBe(match.type);
      expect(card.id).not.toBe(match.id);
    }
  });

  it("aliases Caught Off Guard (16079, gmw) to Core's own 01188, the exact same AbilityDefinition object", () => {
    expect(WAVE3_REPRINT_ABILITIES["16079.when-revealed"]).toBeDefined();
    expect(WAVE3_REPRINT_ABILITIES["16079.when-revealed"]).toBe(CORE_ABILITIES["01188.when-revealed"]);
  });
});
