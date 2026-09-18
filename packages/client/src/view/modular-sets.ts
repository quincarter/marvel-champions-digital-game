/**
 * Table setup's modular set picker (docs/phase4-screen-gaps.md §3 W2, D05):
 * which encounter sets a table may choose between, and toggling the draft's
 * choice.
 *
 * **Candidates.** `CORE_MODULAR_SET_IDS` (`content/pool.ts`) is always
 * offered — the five general-purpose Core modulars — plus whatever the
 * scenario itself recommends, since a wave 1 scenario (Green Goblin's Risky
 * Business/Mutagen Formula) recommends a set of its own ("Power Drain",
 * "Goblin Gimmicks") that isn't one of the five. The Wrecking Crew's Breakout
 * recommends none and calls for zero (`Scenario.modularSetCount`), so its
 * candidate list is exactly the five Core modulars with a cap of 0 — the
 * screen should show them all disabled/hidden behind "not used", not omit the
 * picker's own presence entirely (PLAN.md's "dashed, not omitted").
 *
 * **Selection.** Capped at `Scenario.modularSetCount` (absent = 1, RRG
 * Appendix II's usual "one modular encounter set"). At the default cap of 1
 * this reads as a single-select: choosing a new set replaces the old one. A
 * cap above 1 (none in this pool yet) is a small rolling window — the oldest
 * pick drops when a new one is added past the cap — rather than refusing the
 * click outright, so a keyboard/pad user toggling through chips never hits a
 * dead button.
 */
import type { Scenario } from "@mc/content";
import { CORE_MODULAR_SET_IDS, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { setModularSetIds, type SetupDraft } from "./setup-draft.js";

export interface ModularSetOption {
  readonly id: string;
  readonly name: string;
  readonly selected: boolean;
  readonly recommended: boolean;
}

/** Every set id a table setup for this scenario may pick between, Core's five modulars first, then any of the scenario's own recommended sets not already among them. */
export function modularSetCandidateIdsFor(scenario: Scenario): readonly string[] {
  const ids = [...CORE_MODULAR_SET_IDS];
  for (const id of scenario.recommendedModularSetIds) {
    if (!ids.includes(id as string)) ids.push(id as string);
  }
  return ids;
}

/** The draft's modular set(s) in effect right now: its own choice, or the scenario's recommendation when the draft hasn't overridden it (matches `coreScenario`/`wave1Scenario`'s own default). */
export function effectiveModularSetIds(draft: SetupDraft, scenario: Scenario): readonly string[] {
  return draft.modularSetIds ?? scenario.recommendedModularSetIds;
}

/** Every candidate, with its display name and whether it's currently chosen. */
export function modularSetOptionsFor(draft: SetupDraft, scenario: Scenario): readonly ModularSetOption[] {
  const chosen = new Set(effectiveModularSetIds(draft, scenario));
  const recommended = new Set(scenario.recommendedModularSetIds as readonly string[]);
  const setsById = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]));
  return modularSetCandidateIdsFor(scenario).map((id) => ({
    id,
    name: setsById.get(id) ?? id,
    selected: chosen.has(id),
    recommended: recommended.has(id),
  }));
}

/**
 * Toggles one set in or out of the draft's choice, capped at
 * `scenario.modularSetCount` (absent = 1). A scenario that calls for zero
 * modular sets (Breakout) never gains one from this — every toggle is a no-op.
 */
export function toggleModularSet(draft: SetupDraft, scenario: Scenario, setId: string): SetupDraft {
  const cap = scenario.modularSetCount ?? 1;
  const current = [...effectiveModularSetIds(draft, scenario)];
  if (current.includes(setId)) {
    return setModularSetIds(draft, current.filter((id) => id !== setId));
  }
  if (cap <= 0) return draft;
  const next = current.length >= cap ? [...current.slice(current.length - cap + 1), setId] : [...current, setId];
  return setModularSetIds(draft, next);
}
