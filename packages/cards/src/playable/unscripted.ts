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

export const UNSCRIPTED_ENCOUNTER_SET_IDS: ReadonlySet<string> = new Set<string>([
  // Empty: Synthezoid Smackdown (cycle 10; docs/phase7-synthezoid.md) is fully scripted and joined the playable pool.
]);

/**
 * Gated sets whose every ability is scripted but which are held back for another reason, each with that reason. The
 * "fully scripted: remove it" check skips these; delete an entry with its reason gone, then un-gate the set above.
 * Empty: Synthezoid Smackdown left with its last set scripted.
 */
export const GATED_THOUGH_SCRIPTED: Readonly<Record<string, string>> = {};

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
