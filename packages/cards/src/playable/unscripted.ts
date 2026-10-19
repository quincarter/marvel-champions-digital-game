/**
 * Content that is in the card pool but not playable yet, and the one place that says so.
 *
 * Gating is by encounter set, in one list: `UNSCRIPTED_ENCOUNTER_SET_IDS`. A listed set is left out of the playable
 * encounter sets (so no modular pick, no extra-set pick and no table setup can name it), a scenario that uses one of
 * them as its own set is left out of the playable scenarios (Trickster Takeover's Enchantress and God of Lies), and a
 * scenario's random pool of modular sets drops it (Thunderbolts' pool of ten: Techno and Whiteout).
 * `unscripted.test.ts` checks every id here still has an unscripted ability ref, so the day a set is scripted the test
 * says so; the cards stay in the pool and in `PLAYABLE_CARDS` either way, because the card data is not what is gated.
 *
 * **To un-gate a set, delete its id from the list below** (the playable scenarios, the pools and the client's lists
 * follow). To un-gate everything, make the list empty.
 */
import type { Scenario } from "@mc/content";

export const UNSCRIPTED_ENCOUNTER_SET_IDS: ReadonlySet<string> = new Set([
  // Synthezoid Smackdown (cycle 10; docs/phase7-synthezoid.md), mid-scripting: every set of the pack, so neither leader
  // is offered, no set is a modular pick anywhere, and no Civil War leader is offered the pack's main scheme stages.
  "deadly_duo",
  "moon_knight_modular",
  "royal_guard",
  "scarlet_twins",
  "she_hulk_leader",
  "shield_ops",
  "synthezoid_registration",
  "synthezoid_resistance",
  "taskmaster_modular",
  "thunderbolts_modular",
  "vision_leader",
  "young_avengers",
]);

/**
 * Gated sets whose every ability is scripted but which are held back for another reason, each with that reason. The
 * "fully scripted: remove it" check skips these; delete an entry with its reason gone, then un-gate the set above.
 */
const SYNTHEZOID_MID_SCRIPTING = "Synthezoid Smackdown is un-gated as one pack once its last set is scripted";
export const GATED_THOUGH_SCRIPTED: Readonly<Record<string, string>> = {
  deadly_duo: SYNTHEZOID_MID_SCRIPTING,
  moon_knight_modular: SYNTHEZOID_MID_SCRIPTING,
  royal_guard: SYNTHEZOID_MID_SCRIPTING,
  scarlet_twins: SYNTHEZOID_MID_SCRIPTING,
  she_hulk_leader: SYNTHEZOID_MID_SCRIPTING,
  shield_ops: SYNTHEZOID_MID_SCRIPTING,
  synthezoid_registration: SYNTHEZOID_MID_SCRIPTING,
  synthezoid_resistance: SYNTHEZOID_MID_SCRIPTING,
  taskmaster_modular: SYNTHEZOID_MID_SCRIPTING,
  thunderbolts_modular: SYNTHEZOID_MID_SCRIPTING,
  vision_leader: SYNTHEZOID_MID_SCRIPTING,
  young_avengers: SYNTHEZOID_MID_SCRIPTING,
};

/** Whether a scenario is playable: none of its own sets (or its villains' own sets) is gated. */
export function scenarioIsScripted(scenario: Pick<Scenario, "encounterSetIds" | "multipleVillains">): boolean {
  return ![
    ...(scenario.encounterSetIds as readonly string[]),
    ...(scenario.multipleVillains?.villains.flatMap((v) => v.encounterSetIds as readonly string[]) ?? []),
  ].some((id) => UNSCRIPTED_ENCOUNTER_SET_IDS.has(id));
}

/**
 * The scenario as the playable pool offers it: a restricted or open pool of modular sets (Thunderbolts' ten) without
 * the gated sets, and a recommendation without them. A scenario with no pool is returned as it is.
 */
export function playableScenarioRecord(scenario: Scenario): Scenario {
  const pool = scenario.modularSetPool;
  const recommended = scenario.recommendedModularSetIds.filter((id) => !UNSCRIPTED_ENCOUNTER_SET_IDS.has(id));
  if (!pool && recommended.length === scenario.recommendedModularSetIds.length) return scenario;
  return {
    ...scenario,
    recommendedModularSetIds: recommended,
    ...(pool
      ? { modularSetPool: { ...pool, setIds: pool.setIds.filter((id) => !UNSCRIPTED_ENCOUNTER_SET_IDS.has(id)) } }
      : {}),
  };
}
