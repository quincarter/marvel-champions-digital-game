import { PLAYABLE_CARDS, SHADOWLAND_SCENARIOS, WAVE10_ENCOUNTER_SETS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../ability-refs.js";
import { PLAYABLE_ENCOUNTER_SETS } from "../modular-pool.js";
import { PLAYABLE_ABILITIES } from "./index.js";
import { GATED_THOUGH_SCRIPTED, UNSCRIPTED_ENCOUNTER_SET_IDS, scenarioIsScripted } from "./unscripted.js";

/**
 * The gate's own bookkeeping (`unscripted.ts`): every gated id is a real set kept out of the playable sets, and a set
 * stays gated only while one of its cards still has an unscripted ability ref (or it is held back with a reason), so
 * the day a set is fully scripted this says to un-gate it.
 */
const unscriptedRefsOf = (setId: string): string[] =>
  PLAYABLE_CARDS.filter(
    (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId),
  ).flatMap((card) => abilityRefIds(card).filter((id) => !(id in PLAYABLE_ABILITIES)));

describe("UNSCRIPTED_ENCOUNTER_SET_IDS", () => {
  it("gates nothing now that Shadowland (unlocked as one pack, docs/phase7-shadowland.md) is open, and its three scenarios are playable", () => {
    expect([...UNSCRIPTED_ENCOUNTER_SET_IDS]).toEqual([]);
    expect(Object.keys(GATED_THOUGH_SCRIPTED)).toEqual([]);
    for (const scenario of SHADOWLAND_SCENARIOS) expect(scenarioIsScripted(scenario), scenario.id as string).toBe(true);
  });

  it("keeps Synthezoid Smackdown's fourteen sets (docs/phase7-synthezoid.md §4.3) playable", () => {
    const synthezoid = WAVE10_ENCOUNTER_SETS.filter((set) =>
      (set.packCodes as readonly string[]).includes("synthezoid"),
    );
    expect(synthezoid).toHaveLength(14);
    for (const set of synthezoid)
      expect(
        PLAYABLE_ENCOUNTER_SETS.some((s) => s.id === set.id),
        set.id as string,
      ).toBe(true);
  });

  it("gates a set only while it still has an unscripted ability ref, or with a reason", () => {
    const fullyScripted = [...UNSCRIPTED_ENCOUNTER_SET_IDS].filter(
      (id) => !(id in GATED_THOUGH_SCRIPTED) && unscriptedRefsOf(id).length === 0,
    );
    expect(fullyScripted, "fully scripted: remove from UNSCRIPTED_ENCOUNTER_SET_IDS").toEqual([]);
  });
});
