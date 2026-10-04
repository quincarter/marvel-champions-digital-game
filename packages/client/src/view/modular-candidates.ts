/**
 * Which modular encounter sets Table setup offers for a scenario (owner decision 2026-10-04). RRG 1.8 "Modular
 * Encounter Set" (p. 28): modular sets "can be added to and/or removed from nearly any scenario"; the FAQ calls a set
 * modular when it is neither scenario-specific nor campaign-specific. So the picker offers every modular set of every
 * unlocked pack, the scenario's own recommendation first.
 *
 * A set is a candidate when `@mc/cards`' `isModularChoice` accepts it (not the scenario's own set or difficulty set, not
 * Standard/Expert, nemesis, obligation-campaign, campaign, competitive or extra) and it is not scenario-specific:
 *
 * - a set a scenario names among its own `encounterSetIds` and no scenario recommends as a modular set (Rhino, Klaw,
 *   Hela's own sets). Sets such as Sentinels or Brotherhood are both a scenario's own and another's modular pick, so
 *   they stay modular;
 * - a set holding a villain or main scheme card (the Wrecking Crew's four villain sets).
 *
 * Unlocking follows the app's one source (`progression/unlocks.ts`): a set is offered once the wave (`Cycle.id`) of any
 * pack it shipped in is open. The scenario's own recommended sets are always offered, since the table is playing it.
 *
 * Scenarios that restrict the pool keep it: a restricted `modularSetPool` (Spiral, Mojo) offers only its own sets, and a
 * scenario that calls for no modular sets (Breakout, The Hood) keeps the short list it always had, because there is
 * nothing to add a set to.
 */
import { isScenarioSpecificSet, modularPickProblem } from "@mc/cards";
import type { EncounterSet, Scenario } from "@mc/content";
import { modularExclusionReason } from "./modular-exclusions.js";
import { CORE_MODULAR_SET_IDS, POOL_ENCOUNTER_SETS, POOL_HERO_SHELF_PACKS } from "../content/pool.js";

/** What the player has open: the picker offers a set once any of its packs' waves is. */
export interface ModularScope {
  readonly isCycleOpen: (cycleId: string) => boolean;
  /**
   * The player opted in to official print-and-play content (owner, 2026-10-04, matrix Q-M4): the Promo group's sets
   * ship in no retail pack, so they are not tied to a pack's unlock and stay hidden until this is on. Absent is off.
   */
  readonly officialPrintAndPlay?: boolean;
}

/** Every pack open: the whole pool (tests, and `?unlock=all`). */
export const ALL_OPEN: ModularScope = { isCycleOpen: () => true, officialPrintAndPlay: true };

/** The cycle id of print-and-play and promotional sets: not a retail pack, gated by `ModularScope.officialPrintAndPlay`. */
export const PROMO_CYCLE_ID = "promo";

export const RECOMMENDED_GROUP_ID = "recommended";
export const EXTRAS_GROUP_ID = "extras";
/** A restricted pool's own sets, drawn as one unlabeled group. */
export const POOL_GROUP_ID = "pool";

export interface ModularCandidate {
  readonly id: string;
  readonly recommended: boolean;
  readonly groupId: string;
  /** The small label over the group's first tile; null for an unlabeled group. */
  readonly groupLabel: string | null;
}

interface CycleInfo {
  readonly id: string;
  readonly label: string;
  /** Release order: the cycle's first appearance in the pool's pack list. */
  readonly order: number;
}

const CYCLE_BY_PACK: ReadonlyMap<string, CycleInfo> = (() => {
  const byCycle = new Map<string, CycleInfo>();
  const byPack = new Map<string, CycleInfo>();
  for (const pack of POOL_HERO_SHELF_PACKS) {
    let info = byCycle.get(pack.cycleId);
    if (!info) {
      info = {
        id: pack.cycleId,
        label: pack.cycleId === "promo" ? "Promo" : pack.cycleName,
        order: byCycle.size,
      };
      byCycle.set(pack.cycleId, info);
    }
    byPack.set(pack.code as string, info);
  }
  return byPack;
})();

/** The cycle a set is grouped under: its first pack's. Null for a set whose pack is not in the pool. */
export function cycleOfSet(set: EncounterSet): CycleInfo | null {
  for (const code of set.packCodes) {
    const info = CYCLE_BY_PACK.get(code as string);
    if (info) return info;
  }
  return null;
}

/** True once any pack the set shipped in is open. A set with no known pack is never hidden. */
export function setIsUnlocked(set: EncounterSet, scope: ModularScope): boolean {
  const cycles = set.packCodes.map((code) => CYCLE_BY_PACK.get(code as string)).filter((c) => c !== undefined);
  // A print-and-play set is its own unlock (an opt-in), not a pack's.
  if (cycles.length > 0 && cycles.every((c) => c.id === PROMO_CYCLE_ID)) return scope.officialPrintAndPlay === true;
  return cycles.length === 0 || cycles.some((c) => scope.isCycleOpen(c.id));
}

export { isScenarioSpecificSet };

/**
 * True for a set the picker may list for `scenario`, before the unlock gate: exactly what the builders accept, plus the
 * pairings `MODULAR_SET_EXCLUSIONS` names, which are listed disabled with their short reason (the builder refuses them).
 */
function isOfferable(set: EncounterSet, scenario: Scenario): boolean {
  return (
    modularPickProblem(scenario, set.id as string, POOL_ENCOUNTER_SETS) === null ||
    modularExclusionReason(scenario.id as string, set.id as string) !== null
  );
}

/**
 * Every modular candidate for `scenario`, in draw order: the recommended sets, then the rest grouped by cycle in
 * release order (the pool's own declaration order inside a cycle).
 */
export function modularCandidatesFor(scenario: Scenario, scope: ModularScope = ALL_OPEN): readonly ModularCandidate[] {
  const recommended = scenario.recommendedModularSetIds.map((id) => id as string);
  const isRecommended = (id: string): boolean => recommended.includes(id);

  // A restricted pool (Spiral, Mojo; docs/phase7-wave6.md §4 Q44) offers only its own sets: the engine refuses any other.
  if (scenario.modularSetPool?.restricted)
    return scenario.modularSetPool.setIds.map((id) => ({
      id: id as string,
      recommended: isRecommended(id as string),
      groupId: POOL_GROUP_ID,
      groupLabel: null,
    }));

  const out: ModularCandidate[] = recommended.map((id) => ({
    id,
    recommended: true,
    groupId: RECOMMENDED_GROUP_ID,
    groupLabel: "Recommended",
  }));
  const have = new Set(recommended);
  const setsById = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set]));

  // A scenario that uses no modular set (Breakout, The Hood) keeps Core's five: nothing here to add a set to.
  const noModulars = scenario.modularSetCount === 0 && scenario.modularSetPool === undefined;
  const pool: readonly EncounterSet[] = noModulars
    ? CORE_MODULAR_SET_IDS.map((id) => setsById.get(id)).filter((s): s is EncounterSet => s !== undefined)
    : POOL_ENCOUNTER_SETS.filter((set) => isOfferable(set, scenario) && setIsUnlocked(set, scope));

  const rest = pool.filter((set) => !have.has(set.id as string));
  const keyed = rest.map((set, index) => ({ set, index, cycle: cycleOfSet(set) }));
  keyed.sort((a, b) => (a.cycle?.order ?? 999) - (b.cycle?.order ?? 999) || a.index - b.index);
  for (const { set, cycle } of keyed)
    out.push({
      id: set.id as string,
      recommended: false,
      groupId: cycle?.id ?? "other",
      groupLabel: cycle?.label ?? "Other",
    });
  return out;
}

/** Whether `set` (an extra, such as Longshot) is offered: its pack is open. */
export function extraSetIsOffered(set: EncounterSet, scope: ModularScope): boolean {
  return setIsUnlocked(set, scope);
}
