/**
 * The Hood's own "choose 7 modular encounter sets and set them aside — you may choose randomly" (MC21 p. 24,
 * docs/phase7-wave4.md §2.3, §3.18): unlike every other scenario's modular picker (`view/modular-sets.ts`, a
 * positive pick up to `Scenario.modularSetCount`), The Hood's own nine modular sets are *all* candidates and the
 * player instead chooses which `9 - setAsideModularSetCount` stay **in** the game — the complement is what
 * `SetupDraft.setAsideModularSetIds`/`Wave4ScenarioOptions.setAsideModularSetIds` actually names. Framed here as a
 * positive "which sets are in?" pick (mirroring `toggleModularSet`'s own single-select-by-default shape, generalized
 * to a cap of `includedCount`) so the screen reads the same way as the ordinary modular picker, and the set-aside
 * list is only ever derived, never edited directly.
 *
 * `Scenario.setAsideModularSetCount` is the generic field (present today only on The Hood); this module works for
 * any scenario that sets it, not "the-hood" by name.
 */
import type { AnyCard, Scenario } from "@mc/content";
import { POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { cardCountForSet, descriptorForSet } from "./modular-sets.js";
import { setSetAsideModularSetIds, type SetupDraft } from "./setup-draft.js";

export interface HoodModularSetOption {
  readonly id: string;
  readonly name: string;
  /** In the game (not set aside). */
  readonly included: boolean;
  readonly cardCount: number;
  readonly descriptor: string | null;
}

/** True only for a scenario that actually has this choice (`Scenario.setAsideModularSetCount` present). */
export const hasSetAsideModularChoice = (scenario: Scenario | undefined): boolean =>
  scenario?.setAsideModularSetCount !== undefined;

/**
 * Every candidate id, in `POOL_ENCOUNTER_SETS`' own declaration order — the scenario's own pack's modular sets,
 * excluding its villain's own required set(s) and any Standard/Expert (II) classification set, since neither is a
 * modular pick. Matches `@mc/cards`' own `HOOD_MODULAR_SET_IDS` filter (`wave4/setup.ts`) so the default this
 * screen shows is the same one the scenario builder falls back to.
 */
export function setAsideCandidateIdsFor(scenario: Scenario): readonly string[] {
  const required = new Set(scenario.encounterSetIds as readonly string[]);
  return POOL_ENCOUNTER_SETS.filter(
    (set) =>
      set.packCodes.includes(scenario.packCode) && set.classification === undefined && !required.has(set.id as string),
  ).map((set) => set.id as string);
}

/** How many of the candidates stay in the game — the complement of `Scenario.setAsideModularSetCount`. */
export function includedCountFor(scenario: Scenario, candidateCount: number): number {
  return Math.max(0, candidateCount - (scenario.setAsideModularSetCount ?? 0));
}

/**
 * The draft's own choice, restated as "which sets are in", or the scenario builder's own default — the *last*
 * `includedCount` candidates in declaration order, since `HOOD_MODULAR_SET_IDS.slice(0, setAsideModularSetCount)`
 * sets aside the *first* `setAsideModularSetCount` of them (`wave4/setup.ts`'s own default).
 */
export function effectiveIncludedSetIds(draft: SetupDraft, scenario: Scenario): readonly string[] {
  const candidates = setAsideCandidateIdsFor(scenario);
  if (draft.setAsideModularSetIds === null) {
    const included = includedCountFor(scenario, candidates.length);
    return candidates.slice(candidates.length - included);
  }
  const setAside = new Set(draft.setAsideModularSetIds);
  return candidates.filter((id) => !setAside.has(id));
}

/** Every candidate, with its real card count/descriptor and whether it's currently in the game. */
export function hoodModularSetOptionsFor(
  draft: SetupDraft,
  scenario: Scenario,
  cardsById: ReadonlyMap<string, AnyCard>,
): readonly HoodModularSetOption[] {
  const included = new Set(effectiveIncludedSetIds(draft, scenario));
  const setsById = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name]));
  return setAsideCandidateIdsFor(scenario).map((id) => ({
    id,
    name: setsById.get(id) ?? id,
    included: included.has(id),
    cardCount: cardCountForSet(id, cardsById),
    descriptor: descriptorForSet(id, cardsById),
  }));
}

/**
 * Toggles one set in or out of the "included" pick, capped at `includedCountFor` — the same rolling-window shape
 * `toggleModularSet` uses for an ordinary scenario's own cap. Writes the *complement* to
 * `SetupDraft.setAsideModularSetIds`, since that field (and `Wave4ScenarioOptions.setAsideModularSetIds`) names
 * what's set aside, not what's included.
 */
export function toggleHoodIncludedSet(draft: SetupDraft, scenario: Scenario, setId: string): SetupDraft {
  const candidates = setAsideCandidateIdsFor(scenario);
  const cap = includedCountFor(scenario, candidates.length);
  const current = [...effectiveIncludedSetIds(draft, scenario)];
  const next = current.includes(setId)
    ? current.filter((id) => id !== setId)
    : cap <= 0
      ? current
      : current.length >= cap
        ? [...current.slice(current.length - cap + 1), setId]
        : [...current, setId];
  const setAside = candidates.filter((id) => !next.includes(id));
  return setSetAsideModularSetIds(draft, setAside);
}
