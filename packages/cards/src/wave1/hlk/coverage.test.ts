import { HLK_CARDS, type AbilityReference } from "@mc/content";
import { wave1ReprintPairs } from "../reprints.js";
import { HLK_ABILITIES } from "./index.js";
import { abilityRefIds } from "../../ability-refs.js";

/**
 * Local coverage check for the Hulk (`hlk`) pack (docs/phase7-wave1-scripting.md "What to deliver" #5): every
 * `hlk` card with ability text resolves, either via `HLK_ABILITIES` or via `../reprints.ts`'s automatic Core
 * reprint aliasing. The main session's `wave1/coverage.test.ts` does the same check across every pack once this
 * one is registered in `WAVE1_ABILITIES` — this file is the pack-local version a pack agent owns in the meantime.
 * Hulk Smash (10003) and Beat Cop's second action (10029) were both skips (missing engine primitives) until
 * 2026-09-15's fixes landed — see `kit.ts` and `pack-cards.ts`.
 */

const reprintIds = new Set<string>();
{
  const packIds = new Set(HLK_CARDS.map((c) => c.id as string));
  for (const { wave1 } of wave1ReprintPairs()) {
    if (!packIds.has(wave1.id as string)) continue;
    for (const ref of abilityRefIds(wave1)) reprintIds.add(ref);
  }
}

/** Recorded gaps: none. */
const KNOWN_SKIPPED = new Set<string>([]);

describe("Hulk (hlk) pack ability coverage", () => {
  const allRefs = HLK_CARDS.flatMap(abilityRefIds);

  it("every ability reference resolves, is a Core reprint alias, or is a documented skip", () => {
    const unresolved = allRefs.filter((id) => !(id in HLK_ABILITIES) && !reprintIds.has(id) && !KNOWN_SKIPPED.has(id));
    expect(unresolved, `unresolved hlk ability refs:\n${unresolved.join("\n")}`).toEqual([]);
  });

  it("every documented skip really is unresolved (not stale)", () => {
    for (const id of KNOWN_SKIPPED) {
      expect(allRefs, `${id} is no longer a real hlk ability ref — update KNOWN_SKIPPED`).toContain(id);
      expect(id in HLK_ABILITIES, `${id} is scripted now — remove it from KNOWN_SKIPPED`).toBe(false);
    }
  });

  it("has 32 cards", () => {
    expect(HLK_CARDS).toHaveLength(32);
  });
});
