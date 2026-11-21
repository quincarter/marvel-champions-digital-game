/**
 * The set-aside modular sets of a pack scenario (#943). A pack scenario may set modular sets aside for its own cards to
 * call on (`Scenario.setAsideModularSetCount`: The Rose's mini-boss set, The Hood's shape). The Hood's own picker
 * (`view/hood-modular-sets.ts`) lists the sets of the scenario's own pack, which a pack scenario has none of, so these
 * are offered here instead: one setup-option stepper per set aside, over the same candidates the modular picker offers
 * (`modularCandidatesFor`), the authors' `recommendedSetAsideModularSetIds` first.
 *
 * The pick in effect is the draft's own when it is whole and none of it is shuffled in this game, else the authors'
 * recommendation on the same terms, else none (`null`): the builder (`@mc/cards` `customSetAsideModularSetIds`) then
 * reads the recommendation, or draws seeded random sets when there is none.
 */
import type { Scenario } from "@mc/content";
import { ALL_OPEN, modularCandidatesFor, type ModularScope } from "./modular-candidates.js";
import { effectiveModularSetIds } from "./modular-sets.js";
import { houseModularSetIdsOf } from "./house-modular-sets.js";
import type { SetupDraft } from "./setup-draft.js";
import { currentEncounterSets } from "../content/pool.js";

/** The scenario's fixed set-aside count, for a pack scenario that sets modular sets aside; 0 otherwise. */
export function packSetAsideCountOf(scenario: Scenario | undefined, isPack: boolean): number {
  const count = scenario?.setAsideModularSetCount;
  return isPack && typeof count === "number" && count > 0 ? count : 0;
}

/** The sets shuffled in this game: the draft's modular picks (or the recommendation) and any house sets. */
function shuffledInOf(draft: SetupDraft, scenario: Scenario): ReadonlySet<string> {
  return new Set([...effectiveModularSetIds(draft, scenario), ...houseModularSetIdsOf(draft)]);
}

/** A whole pick of `count` distinct sets, none of them shuffled in. */
const usable = (ids: readonly string[] | null | undefined, count: number, shuffled: ReadonlySet<string>): boolean =>
  !!ids && ids.length === count && new Set(ids).size === count && !ids.some((id) => shuffled.has(id));

/** The set-aside sets in effect: the draft's, else the authors' recommendation, else null (the builder decides). */
export function effectivePackSetAside(draft: SetupDraft, scenario: Scenario, count: number): readonly string[] | null {
  if (count === 0) return null;
  const shuffled = shuffledInOf(draft, scenario);
  // A saved pick of a set no longer in the pool (its pack removed) is dropped, not sent to a builder that refuses it.
  const known = new Set(currentEncounterSets().map((set) => set.id as string));
  const own = draft.setAsideModularSetIds;
  if (usable(own, count, shuffled) && own!.every((id) => known.has(id))) return own;
  const recommended = (scenario.recommendedSetAsideModularSetIds ?? []) as readonly string[];
  return usable(recommended, count, shuffled) ? recommended : null;
}

/**
 * Every set a set-aside slot may step through, in order: the recommendation, then the modular picker's own candidates
 * (none it lists disabled), leaving out the sets shuffled in.
 */
export function packSetAsideCandidates(
  draft: SetupDraft,
  scenario: Scenario,
  scope: ModularScope = ALL_OPEN,
): readonly string[] {
  const shuffled = shuffledInOf(draft, scenario);
  const ids = [
    ...((scenario.recommendedSetAsideModularSetIds ?? []) as readonly string[]),
    // A scenario that shuffles in no modular set gets the picker's short Core list there; the sets it sets aside are
    // still any modular set, so the candidates are read as if it took one.
    ...modularCandidatesFor(scenario.modularSetCount === 0 ? { ...scenario, modularSetCount: 1 } : scenario, scope)
      .filter((candidate) => candidate.disabledReason === undefined)
      .map((candidate) => candidate.id),
  ];
  return [...new Set(ids)].filter((id) => !shuffled.has(id));
}

/**
 * The draft with slot `slot` stepped to the next (or previous) candidate that no other slot holds. With no pick in
 * effect yet, the slots start from the first candidates.
 */
export function stepPackSetAside(
  draft: SetupDraft,
  scenario: Scenario,
  count: number,
  slot: number,
  direction: "next" | "prev",
  scope: ModularScope = ALL_OPEN,
): SetupDraft {
  if (count === 0 || !Number.isInteger(slot) || slot < 0 || slot >= count) return draft;
  const candidates = packSetAsideCandidates(draft, scenario, scope);
  if (candidates.length < count) return draft;
  const effective = effectivePackSetAside(draft, scenario, count);
  const picks = [...(effective ?? candidates.slice(0, count))];
  const step = direction === "next" ? 1 : candidates.length - 1;
  // From Random (no pick in effect) the first step lands on the first candidate, or back on the last.
  let at = effective ? candidates.indexOf(picks[slot]!) : direction === "next" ? -1 : 0;
  if (at < 0 && effective) at = 0;
  for (let tries = 0; tries < candidates.length; tries++) {
    at = (at + step) % candidates.length;
    if (!picks.some((id, other) => other !== slot && id === candidates[at])) break;
  }
  picks[slot] = candidates[at]!;
  return { ...draft, setAsideModularSetIds: picks };
}
