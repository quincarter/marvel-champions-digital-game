import { FNE_CARDS, PLAYABLE_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "./ability-refs.js";
import { PLAYABLE_ABILITIES } from "./playable/index.js";
import { WAVE11_MODULES } from "./wave11/index.js";
import { isFnePlayerHalfId } from "./wave11/card-groups.js";

/**
 * Registry guard (QA 2026-10-13, finding 6: Friends and Family 27132 had two ability refs no module registered, and
 * no per-wave guard noticed because those are hand-listed per hero kit). Every ability ref on every playable card must
 * be in the assembled registry. An exemption would be listed here by id with the reason; there are none.
 */
const EXEMPT: ReadonlySet<string> = new Set([
  // Wave 11 mid-scripting: every jj / luke_cage ref still unscripted is in its module's `_SKIPPED` map with a reason.
  ...WAVE11_MODULES.flatMap((module) => Object.keys(module.skipped)),
  // Fear No Evil's player half (60001a to 60064) is in the module `_SKIPPED` maps above; its encounter half (60065 on)
  // has no modules yet (docs/phase7-wave11-scenarios.md §S6), so its refs stay exempt until they exist.
  ...FNE_CARDS.filter((card) => !isFnePlayerHalfId(card.id as string)).flatMap(abilityRefIds),
]);

describe("every ability ref on a playable card is registered", () => {
  it("has no ref missing from PLAYABLE_ABILITIES", () => {
    const missing: string[] = [];
    for (const card of PLAYABLE_CARDS as readonly any[]) {
      const refs: { id: string }[] = [...(card.abilities ?? []), ...(card.flipSide?.abilities ?? [])];
      for (const ref of refs)
        if (!PLAYABLE_ABILITIES[ref.id] && !EXEMPT.has(ref.id)) missing.push(`${card.id} ${ref.id}`);
    }
    expect(PLAYABLE_CARDS.length).toBeGreaterThan(1000);
    expect(missing).toEqual([]);
  });
});
