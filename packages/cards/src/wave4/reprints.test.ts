/**
 * The wave 4 (cycle 3) reprint mechanism (docs/phase7-wave4.md), modeled directly on `../wave3/reprints.test.ts`.
 * `reprints.ts` derives the reprint list programmatically from `@mc/content`, so this test never hardcodes the full
 * pair count for the whole cycle 3 pool — a later pack silently adding or losing a reprint would change these
 * numbers and fail here. Scoped to `vision` (the only pack whose reprints are exercised by a real card so far);
 * extend as more packs land.
 */
import { VISION_CARDS } from "@mc/content";
import { CORE_ABILITIES } from "../core/index.js";
import { WAVE3_ABILITIES } from "../wave3/index.js";
import { WAVE4_REPRINT_ABILITIES, wave4ReprintPairs } from "./index.js";

describe("wave 4 reprints", () => {
  it("finds every (name, type) match for vision, whether or not it ends up aliased", () => {
    const visionIds = new Set(VISION_CARDS.map((c) => c.id as string));
    const pairs = wave4ReprintPairs().filter((p) => visionIds.has(p.wave4.id as string));
    expect(pairs.length).toBeGreaterThan(0);
    for (const { wave4: card, earlier: match } of pairs) {
      expect(card.name).toBe(match.name);
      expect(card.type).toBe(match.type);
      expect(card.id).not.toBe(match.id);
    }
  });

  it("aliases Indomitable (26017, vision) to Core's own 01082, the exact same AbilityDefinition object", () => {
    expect(WAVE4_REPRINT_ABILITIES["26017.indomitable-response"]).toBeDefined();
    expect(WAVE4_REPRINT_ABILITIES["26017.indomitable-response"]).toBe(CORE_ABILITIES["01082.indomitable-response"]);
  });

  it("aliases Get Behind Me! (26020, vision) to Core's own 01078", () => {
    expect(WAVE4_REPRINT_ABILITIES["26020.get-behind-me-interrupt"]).toBe(
      CORE_ABILITIES["01078.get-behind-me-interrupt"],
    );
  });

  it("aliases Avengers Mansion (26023, vision) to Core's own 01091", () => {
    expect(WAVE4_REPRINT_ABILITIES["26023.avengers-mansion-action"]).toBe(
      CORE_ABILITIES["01091.avengers-mansion-action"],
    );
  });

  it("aliases Side Step (26019, vision) to `qsv`'s own 14015 (wave 3's pool)", () => {
    expect(WAVE4_REPRINT_ABILITIES["26019.side-step-interrupt"]).toBe(WAVE3_ABILITIES["14015.side-step-interrupt"]);
  });

  it("aliases Ultron Drones (26031, vision) to Core's own 01140 environment, both refs", () => {
    expect(WAVE4_REPRINT_ABILITIES["26031.ultron-drones-constant"]).toBe(
      CORE_ABILITIES["01140.ultron-drones-constant"],
    );
    expect(WAVE4_REPRINT_ABILITIES["26031.ultron-drones-forced-response"]).toBe(
      CORE_ABILITIES["01140.ultron-drones-forced-response"],
    );
  });
});
