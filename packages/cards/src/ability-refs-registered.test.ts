import { PLAYABLE_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { PLAYABLE_ABILITIES } from "./playable/index.js";

/**
 * Registry guard (QA 2026-10-13, finding 6: Friends and Family 27132 had two ability refs no module registered, and
 * no per-wave guard noticed because those are hand-listed per hero kit). Every ability ref on every playable card must
 * be in the assembled registry. An exemption would be listed here by id with the reason; there are none.
 */
const EXEMPT: ReadonlySet<string> = new Set();

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
