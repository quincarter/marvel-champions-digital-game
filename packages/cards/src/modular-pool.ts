/**
 * Which modular encounter sets a scenario's setup uses (docs/phase7-wave6.md §3.63): the sets shuffled in, the sets
 * set aside, and the extra sets the players add on top. Generic over `Scenario.modularSetPool`,
 * `Scenario.setAsideModularSetCount` and `EncounterSet.extraModular`; a scenario builder calls it and turns the ids into
 * `GameSetupConfig.encounterDeck` / `setAsideModularSets`.
 *
 * - A restricted pool (Spiral 39015a, Mojo 39025a; §4 Q44): every pick, the players' or a random one, comes from it.
 * - An unrestricted pool (MaGog 39002a's italic "1 random modular set from the MojoMania scenario pack"): the players
 *   may name any modular set; a random pick draws from the pool.
 * - Without a pool the scenario keeps its old default, `recommendedModularSetIds`.
 * - An extra modular set (Longshot; §4 Q43, MojoMania insert p. 2: "Longshot does not count as one of those sets") is
 *   added only when the players ask for it, never counted, never a random pick and never set aside.
 *
 * Random picks use their own stream seeded from the game's seed, so the same seed always builds the same game and the
 * engine's own RNG (`GameState.rng`, started from the same seed) is untouched.
 */
import {
  CORE_ENCOUNTER_SETS,
  CORE_SCENARIOS,
  PLAYABLE_CARDS,
  WAVE1_SCENARIOS,
  WAVE2_SCENARIOS,
  WAVE3_SCENARIOS,
  WAVE4_SCENARIOS,
  WAVE5_SCENARIOS,
  WAVE6_SCENARIOS,
  WAVE1_ENCOUNTER_SETS,
  WAVE2_ENCOUNTER_SETS,
  WAVE3_ENCOUNTER_SETS,
  WAVE4_ENCOUNTER_SETS,
  WAVE5_ENCOUNTER_SETS,
  WAVE6_ENCOUNTER_SETS,
  setAsideModularSetCountFor,
  type AnyCard,
  type CardId,
  type EncounterSet,
  type Scenario,
} from "@mc/content";
import { createRng, shuffle, type RngState } from "@mc/engine";

/** Every encounter set of the playable pool, each once, in wave order: what a modular pick is checked against at any scenario. */
export const PLAYABLE_ENCOUNTER_SETS: readonly EncounterSet[] = [
  ...new Map(
    [
      ...CORE_ENCOUNTER_SETS,
      ...WAVE1_ENCOUNTER_SETS,
      ...WAVE2_ENCOUNTER_SETS,
      ...WAVE3_ENCOUNTER_SETS,
      ...WAVE4_ENCOUNTER_SETS,
      ...WAVE5_ENCOUNTER_SETS,
      ...WAVE6_ENCOUNTER_SETS,
    ].map((set) => [set.id as string, set] as const),
  ).values(),
];

export interface ModularSetChoiceOptions {
  readonly playerCount: number;
  readonly seed: number;
  /** The players' modular sets. Absent: random picks from the pool, or the recommendation when there is none. */
  readonly modularSetIds?: readonly string[];
  /** The players' set-aside modular sets. Absent: random picks from the pool. */
  readonly setAsideModularSetIds?: readonly string[];
  /** Extra modular sets to shuffle in on top (`EncounterSet.extraModular`). Absent: none. */
  readonly extraModularSetIds?: readonly string[];
}

export interface ModularSetChoice {
  /** Shuffled into the encounter deck; exactly `modularSetCount` of them when the scenario has a pool. */
  readonly modularSetIds: readonly string[];
  /** Set aside (`GameSetupConfig.setAsideModularSets`); `setAsideModularSetCountFor(scenario, playerCount)` of them. */
  readonly setAsideModularSetIds: readonly string[];
  /** Shuffled into the encounter deck, never counted. */
  readonly extraModularSetIds: readonly string[];
}

/**
 * A set the players may choose as a modular set: not the scenario's own, a Standard/Expert (by classification or as the
 * scenario's difficulty set; RRG 1.8 "Standard Set", p. 40), nemesis, campaign, competitive or extra set, or one a setup
 * condition includes (`autoIncluded`: Dreadpool, in the game when a player chooses the 'Pool aspect).
 */
export function isModularChoice(set: EncounterSet, scenario: Scenario): boolean {
  return (
    set.classification === undefined &&
    !scenario.standardEncounterSetIds.includes(set.id) &&
    !scenario.expertEncounterSetIds.includes(set.id) &&
    set.nemesisOfIdentityId === undefined &&
    !set.competitiveOnly &&
    !set.campaignSpecific &&
    !set.extraModular &&
    !set.autoIncluded &&
    !scenario.encounterSetIds.includes(set.id)
  );
}

/** Every scenario of the playable pool, in wave order. */
export const PLAYABLE_SCENARIO_RECORDS: readonly Scenario[] = [
  ...CORE_SCENARIOS,
  ...WAVE1_SCENARIOS,
  ...WAVE2_SCENARIOS,
  ...WAVE3_SCENARIOS,
  ...WAVE4_SCENARIOS,
  ...WAVE5_SCENARIOS,
  ...WAVE6_SCENARIOS,
];

/** Every set some scenario names as its Standard or Expert set: never a modular choice anywhere (RRG 1.8 pp. 40, 19). */
const DIFFICULTY_SET_IDS: ReadonlySet<string> = new Set(
  PLAYABLE_SCENARIO_RECORDS.flatMap((scenario) => [
    ...(scenario.standardEncounterSetIds as readonly string[]),
    ...(scenario.expertEncounterSetIds as readonly string[]),
  ]),
);

/**
 * A set that belongs to one scenario (RRG 1.8 Appendix IV FAQ, "Modular Encounter Sets": a set is modular unless it is
 * scenario-specific): it holds a villain or main scheme card, which names the scenario it is for.
 */
const SCENARIO_SPECIFIC_SET_IDS: ReadonlySet<string> = (() => {
  const ids = new Set<string>();
  for (const card of PLAYABLE_CARDS)
    if ("encounterSetIds" in card && (card.type === "villain" || card.type === "main_scheme"))
      for (const id of card.encounterSetIds as readonly string[]) ids.add(id);
  return ids;
})();

export function isScenarioSpecificSet(setId: string): boolean {
  return SCENARIO_SPECIFIC_SET_IDS.has(setId);
}

/** Every set a scenario builds its game from itself: its own sets and each villain's. (A separate deck's set, Future Past, is drawn from the cards the set brings: it is a modular set.) */
export function scenarioOwnSetIds(scenario: Scenario): ReadonlySet<string> {
  return new Set<string>([
    ...(scenario.encounterSetIds as readonly string[]),
    ...(scenario.multipleVillains?.villains.flatMap((v) => v.encounterSetIds as readonly string[]) ?? []),
  ]);
}

/**
 * Why `id` cannot be one of `scenario`'s modular sets, or null when it can. RRG 1.8 "Modular Encounter Set" (p. 29):
 * "added to a scenario ... as an entire set"; the Standard and Expert sets are never a modular choice (pp. 40, 19), a
 * nemesis set is its hero's (p. 30), a campaign-specific set is for its campaign (p. 11); MC21 p. 16: the Infinity
 * Gauntlet set "cannot be used" with more than one villain.
 */
export function modularPickProblem(
  scenario: Scenario,
  id: string,
  encounterSets: readonly EncounterSet[],
): string | null {
  const set = encounterSets.find((candidate) => candidate.id === id);
  if (!set) return `${id} is not an encounter set`;
  if (set.extraModular) return `${id} is an extra modular set and never counts as one (Q43)`;
  if (set.autoIncluded) return `${id} is included by a setup condition, never chosen (wave 7 Q44)`;
  if (scenarioOwnSetIds(scenario).has(id)) return `${id} is already part of ${scenario.name}`;
  if (set.classification !== undefined || DIFFICULTY_SET_IDS.has(id))
    return `${id} is a Standard or Expert set, never a modular choice (RRG pp. 40, 19)`;
  if (set.nemesisOfIdentityId !== undefined) return `${id} is a hero's nemesis set`;
  if (set.campaignSpecific) return `${id} is a campaign set`;
  if (set.competitiveOnly) return `${id} is a competitive-mode set`;
  if (isScenarioSpecificSet(id)) return `${id} belongs to another scenario`;
  if (set.singleVillainOnly && scenario.multipleVillains)
    return `${id} cannot be used with more than one villain (MC21 p. 16)`;
  return null;
}

/**
 * The picks for a scenario without a modular pool, checked: a scenario that takes no modular set (Breakout, The Hood, The
 * Sinister Six) takes none, each pick is a set `modularPickProblem` accepts, none twice. No picks (`undefined`) is the
 * scenario's recommendation, unchecked. How many picks a scenario wants is `checkModularPickCount`, asked by the app's
 * entry point (`playableScenario`): the builders also serve tests that seat a partial list on purpose.
 */
export function chosenModularSetIds(
  scenario: Scenario,
  picks: readonly string[] | undefined,
  encounterSets: readonly EncounterSet[] = PLAYABLE_ENCOUNTER_SETS,
): readonly string[] {
  if (picks === undefined) return scenario.recommendedModularSetIds;
  const label = scenario.name;
  const count = scenario.modularSetCount ?? scenario.recommendedModularSetIds.length;
  if (count === 0 && picks.length > 0) throw new Error(`${label} uses no modular encounter sets, got ${picks.length}`);
  if (new Set(picks).size !== picks.length) throw new Error(`${label}: a modular set is chosen twice`);
  for (const id of picks) {
    const problem = modularPickProblem(scenario, id, encounterSets);
    if (problem) throw new Error(`${label}: ${problem}`);
  }
  return picks;
}

/** A scenario without a modular pool wants exactly `modularSetCount` picks (the recommendation's length when unset). */
export function checkModularPickCount(scenario: Scenario, picks: readonly string[] | undefined): void {
  if (picks === undefined || scenario.modularSetPool) return;
  const count = scenario.modularSetCount ?? scenario.recommendedModularSetIds.length;
  if (picks.length !== count) throw new Error(`${scenario.name} uses ${count} modular set(s), got ${picks.length}`);
}

function randomPicks(from: readonly string[], count: number, rng: RngState): readonly [string[], RngState] {
  const [shuffled, next] = shuffle(from, rng);
  return [shuffled.slice(0, count), next];
}

/** The modular, set-aside and extra sets for one game of `scenario`. Throws on a choice the scenario forbids. */
export function chooseModularSets(
  scenario: Scenario,
  encounterSets: readonly EncounterSet[],
  options: ModularSetChoiceOptions,
): ModularSetChoice {
  const label = scenario.name;
  const byId = new Map<string, EncounterSet>(encounterSets.map((set) => [set.id, set]));
  const pool = scenario.modularSetPool;
  const poolIds: readonly string[] = pool?.setIds ?? [];
  const checkPicks = (ids: readonly string[], what: string): void => {
    if (new Set(ids).size !== ids.length) throw new Error(`${label}: a ${what} set is chosen twice`);
    for (const id of ids) {
      const set = byId.get(id);
      if (set?.extraModular) throw new Error(`${label}: ${id} is an extra modular set and never counts as one (Q43)`);
      if (pool?.restricted) {
        if (!poolIds.includes(id)) throw new Error(`${label}: ${id} is not in the scenario's modular set pool (Q44)`);
      } else {
        const problem = modularPickProblem(scenario, id, encounterSets);
        if (problem) throw new Error(`${label}: ${id} is not a modular set (${problem})`);
      }
    }
  };

  let rng = createRng(options.seed);
  let modularSetIds: readonly string[];
  if (!pool) modularSetIds = chosenModularSetIds(scenario, options.modularSetIds, encounterSets);
  else {
    const count = scenario.modularSetCount ?? 1;
    if (options.modularSetIds) {
      if (options.modularSetIds.length !== count)
        throw new Error(`${label} uses ${count} modular set(s), got ${options.modularSetIds.length}`);
      checkPicks(options.modularSetIds, "modular");
      modularSetIds = options.modularSetIds;
    } else [modularSetIds, rng] = randomPicks(poolIds, count, rng);
  }

  const setAsideCount = setAsideModularSetCountFor(scenario, options.playerCount);
  let setAsideModularSetIds: readonly string[] = [];
  if (options.setAsideModularSetIds || setAsideCount > 0) {
    if (options.setAsideModularSetIds) {
      if (options.setAsideModularSetIds.length !== setAsideCount)
        throw new Error(`${label}: expected ${setAsideCount} set-aside modular sets`);
      checkPicks(options.setAsideModularSetIds, "set-aside");
      setAsideModularSetIds = options.setAsideModularSetIds;
    } else {
      if (!pool) throw new Error(`${label}: choose its ${setAsideCount} set-aside modular sets`);
      [setAsideModularSetIds] = randomPicks(
        poolIds.filter((id) => !modularSetIds.includes(id)),
        setAsideCount,
        rng,
      );
    }
    const both = setAsideModularSetIds.filter((id) => modularSetIds.includes(id));
    if (both.length > 0) throw new Error(`${label}: ${both.join(", ")} is both shuffled in and set aside`);
  }

  const extraModularSetIds = options.extraModularSetIds ?? [];
  if (new Set(extraModularSetIds).size !== extraModularSetIds.length)
    throw new Error(`${label}: an extra modular set is added twice`);
  for (const id of extraModularSetIds)
    if (!byId.get(id)?.extraModular) throw new Error(`${label}: ${id} is not an extra modular set`);

  return { modularSetIds, setAsideModularSetIds, extraModularSetIds };
}

/**
 * The cards an extra modular set shuffles in. Longshot's set is one player-type ally with an encounter card back
 * (39071, MojoMania insert p. 2: "has an encounter card back and forms its own one-card modular encounter set"), so
 * its card names the set through `specificTo` rather than `encounterSetIds`; either link counts.
 */
export function extraModularCardIds(setIds: readonly string[], pool: readonly AnyCard[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = pool.filter(
      (card) =>
        ("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId)) ||
        ("specificTo" in card &&
          card.specificTo?.kind === "scenario" &&
          card.specificTo.encounterSetId === setId &&
          card.cardBack === "encounter"),
    );
    if (members.length === 0) throw new Error(`extra modular set ${setId} has no cards in this pool`);
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) deck.push(card.id);
  }
  return deck;
}
