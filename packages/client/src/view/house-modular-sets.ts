/**
 * The "Allow extra modular sets" house rule (issue #761): a scenario takes more modular sets than it calls for. The
 * sets beyond its count ride the draft as `houseModularSetIds` and the session config as `houseModularSetIds`; the
 * scenario builders (`@mc/cards`) refuse a pick count other than the scenario's, so `playableScenario` builds them as
 * counted sets without counting them (`houseModularSetIds`): their cards, decks and set-dependent setup options (the
 * Gene Pool threat of Infinites) all follow, and the engine shuffles the deck at the deal. Off is the default and the
 * printed game.
 */
import type { Scenario } from "@mc/content";
import { modularPicksAreSetAside } from "./modular-summary.js";
import type { SetupDraft } from "./setup-draft.js";

/**
 * Does the rule apply to this scenario? Not to a scenario that draws its sets from a pool (MojoMania) or sets them aside
 * (Mojo, The Hood), whose picks are not a count of sets shuffled in, nor to a Civil War leader's 3-or-4 range, which has
 * its own builder.
 */
export function houseModularAllowed(scenario: Scenario): boolean {
  return (
    scenario.modularSetPool === undefined &&
    scenario.modularSetCountRange === undefined &&
    !modularPicksAreSetAside(scenario) &&
    scenario.setAsideModularSetCount === undefined
  );
}

/** The draft's sets beyond the scenario's count. */
export const houseModularSetIdsOf = (draft: Pick<SetupDraft, "houseModularSetIds">): readonly string[] =>
  draft.houseModularSetIds ?? [];

/** `draft` with `setId` added to the sets beyond the count, or taken out when it is there. */
export function toggleHouseModularSet(draft: SetupDraft, setId: string): SetupDraft {
  const current = houseModularSetIdsOf(draft);
  const next = current.includes(setId) ? current.filter((id) => id !== setId) : [...current, setId];
  return withHouseModularSetIds(draft, next);
}

/** `draft` with exactly these sets beyond the count; none leaves the field off, so a draft that never had it keeps its shape. */
export function withHouseModularSetIds(draft: SetupDraft, ids: readonly string[]): SetupDraft {
  if (ids.length > 0) return { ...draft, houseModularSetIds: ids };
  const { houseModularSetIds: _none, ...rest } = draft;
  return rest;
}
