/**
 * Custom content in a game (docs/custom-content-packs.md §5, §11.9): a pack's scenarios and modular encounter sets
 * played beside the base game's. The playable builders know only the base pool, so this is the one seam that takes a
 * pack's cards, encounter sets and scenario records as arguments:
 *
 * - **A pack scenario** is built generically from its `Scenario` record, the way `coreScenario` builds a Core one: the
 *   villain's stages, the main scheme, the scenario's own sets, the picked modular sets, the Standard (and Expert) set,
 *   each hero's obligation and nemesis set. A pack scenario may use only the plain fields and `setAsideCardIds` (`CUSTOM_SCENARIO_FIELDS`);
 *   anything a printed scenario needs a hand-written builder for (several villains, a set-aside deck, a villain choice)
 *   is refused by `customScenarioProblems` rather than built wrong.
 * - **A pack modular set at a base scenario** is added to the base builder's own game: the base picks go through
 *   `playableScenario` unchanged, and the pack set's cards are shuffled in on top of them, counted as one of the
 *   scenario's modular sets (RRG 1.8 "Modular Encounter Set", p. 29: a modular set is "added to a scenario ... as an
 *   entire set").
 *
 * Base behaviour is untouched: with no custom content `playableScenarioWithCustom` is `playableScenario`.
 */
import {
  PLAYABLE_CARDS,
  WAVE10_SCENARIOS,
  WAVE11_SCENARIOS,
  autoIncludedSetsOf,
  difficultyEncounterSetIds,
  difficultyOf,
  type AnyCard,
  type CardId,
  type EncounterSet,
  type Scenario,
} from "@mc/content";
import type { GameSetupConfig } from "@mc/engine";
import { encounterCardsOf, modularSetupCardIds, resolveModes, setSeparateDecks } from "../core/setup.js";
import {
  PLAYABLE_ENCOUNTER_SETS,
  PLAYABLE_SCENARIO_RECORDS,
  checkModularPickCount,
  chosenModularSetIds,
  modularPickCountProblem,
  modularPickProblem,
} from "../modular-pool.js";
import { playableScenario, playableStarterDeckSetup, type PlayableScenarioOptions } from "./index.js";

/** What a game takes from custom packs: their cards, encounter sets and scenario records, whole. */
export interface CustomContent {
  readonly cards: readonly AnyCard[];
  readonly encounterSets: readonly EncounterSet[];
  readonly scenarios: readonly Scenario[];
}

/** The fields a pack's `Scenario` record may carry. Everything else needs a builder only the base game has. */
export const CUSTOM_SCENARIO_FIELDS: ReadonlySet<string> = new Set([
  "id",
  "name",
  "packCode",
  "villainCardId",
  "mainSchemeCardId",
  "encounterSetIds",
  "recommendedModularSetIds",
  "standardEncounterSetIds",
  "expertEncounterSetIds",
  "villainStages",
  "modularSetCount",
  "modularSetCountRange",
  "setAsideCardIds",
]);

/** The base pool with custom cards added; a custom card that reuses a base id is an error, never an override. */
function widenedPool(base: readonly AnyCard[], custom: CustomContent): readonly AnyCard[] {
  if (custom.cards.length === 0) return base;
  const known = new Set(base.map((card) => card.id as string));
  for (const card of custom.cards)
    if (known.has(card.id as string)) throw new Error(`custom card ${card.id} is already in the card pool`);
  return [...base, ...custom.cards];
}

const baseScenarioIds: ReadonlySet<string> = new Set(
  [...PLAYABLE_SCENARIO_RECORDS, ...WAVE10_SCENARIOS, ...WAVE11_SCENARIOS].map((scenario) => scenario.id as string),
);
const baseSetIds: ReadonlySet<string> = new Set([
  ...PLAYABLE_ENCOUNTER_SETS.map((set) => set.id as string),
  ...PLAYABLE_CARDS.flatMap((card) => ("encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [])),
]);

/** Whether `id` is a base-game scenario id: a pack's scenario may never take it (the base game always wins). */
export const isBaseScenarioId = (id: string): boolean => baseScenarioIds.has(id);
/** Whether `id` is a base-game encounter set id: a pack's set may never take it. */
export const isBaseEncounterSetId = (id: string): boolean => baseSetIds.has(id);

/**
 * Why `custom` cannot join a game as it stands: a scenario or set whose id is a base id or is used twice (two packs
 * whose ids meet, `foo`'s `foo-bar-x` and `foo-bar`'s). Base content is never shadowed and never merged.
 */
export function customContentProblems(custom: CustomContent): readonly string[] {
  const problems: string[] = [];
  const once = (kind: string, ids: readonly string[], isBase: (id: string) => boolean): void => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (isBase(id)) problems.push(`${kind} id "${id}" is a base-game id`);
      else if (seen.has(id)) problems.push(`${kind} id "${id}" is used by two packs`);
      seen.add(id);
    }
  };
  once(
    "scenario",
    custom.scenarios.map((scenario) => scenario.id as string),
    isBaseScenarioId,
  );
  once(
    "encounter set",
    custom.encounterSets.map((set) => set.id as string),
    isBaseEncounterSetId,
  );
  return problems;
}

const allSets = (custom: CustomContent): readonly EncounterSet[] => [
  ...PLAYABLE_ENCOUNTER_SETS,
  ...custom.encounterSets,
];

/** Ids of the sets that hold a villain or main scheme card in `pool`: they belong to the scenario those cards name. */
function scenarioSpecificSetIds(pool: readonly AnyCard[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const card of pool)
    if ("encounterSetIds" in card && (card.type === "villain" || card.type === "main_scheme"))
      for (const id of card.encounterSetIds as readonly string[]) ids.add(id);
  return ids;
}

/** Why custom set `id` cannot be a modular pick at `scenario`, or null when it can. */
export function customModularPickProblem(scenario: Scenario, id: string, custom: CustomContent): string | null {
  const problem = modularPickProblem(scenario, id, allSets(custom));
  if (problem) return problem;
  // RRG 1.8 "Standard Set" (p. 40) and "Expert Set" (p. 19): a scenario's Standard or Expert set, a pack's included,
  // is never a modular choice, at that scenario or at any other.
  if (
    [scenario, ...custom.scenarios].some((s) =>
      [...s.standardEncounterSetIds, ...s.expertEncounterSetIds].includes(id as never),
    )
  )
    return `${id} is a Standard or Expert set, never a modular choice (RRG pp. 40, 19)`;
  // `modularPickProblem` knows the base pool's scenario-specific sets only; a custom scenario's own set is one too.
  const pool = [...PLAYABLE_CARDS, ...custom.cards];
  if (scenarioSpecificSetIds(pool).has(id)) return `${id} belongs to another scenario`;
  const hasCards = pool.some(
    (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(id),
  );
  return hasCards ? null : `${id} has no cards`;
}

/** The custom encounter sets `scenario` (a base or custom scenario record) may take as a modular pick. */
export function customModularSetChoices(scenario: Scenario, custom: CustomContent): readonly EncounterSet[] {
  return custom.encounterSets.filter((set) => customModularPickProblem(scenario, set.id, custom) === null);
}

/**
 * Why a pack's scenario record cannot be played, as plain sentences (empty when it can): a field a pack scenario may
 * not use, a villain or main scheme that is not one, a stage the villain lacks, a set nobody has, a set with no cards.
 */
export function customScenarioProblems(scenario: Scenario, custom: CustomContent): readonly string[] {
  const problems: string[] = [];
  for (const key of Object.keys(scenario))
    if (!CUSTOM_SCENARIO_FIELDS.has(key)) problems.push(`field "${key}" is not available to a pack scenario yet`);
  const pool = [...PLAYABLE_CARDS, ...custom.cards];
  const sets = allSets(custom);
  const range = (value: unknown): value is readonly [number, number] =>
    Array.isArray(value) && value.length === 2 && value.every(Number.isInteger) && value[0] <= value[1];
  for (const mode of ["standard", "expert"] as const)
    if (!range(scenario.villainStages?.[mode]))
      problems.push(`villainStages.${mode} must be [first stage, last stage] with first at most last`);
  if (!scenario.standardEncounterSetIds?.length)
    problems.push("standardEncounterSetIds is empty: a scenario needs a Standard set (RRG 1.8 p. 40)");
  const villain = pool.find((card) => card.id === scenario.villainCardId);
  if (!villain) problems.push(`villain ${scenario.villainCardId} is in neither the pack nor the base game`);
  else if (villain.type !== "villain") problems.push(`${scenario.villainCardId} is not a villain card`);
  else {
    const stages = villain.sides[0]?.stages.map((stage) => stage.stageNumber) ?? [];
    for (const mode of ["standard", "expert"] as const) {
      for (const stage of range(scenario.villainStages?.[mode]) ? scenario.villainStages[mode] : [])
        if (!stages.includes(stage)) problems.push(`the villain has no stage ${stage} (needed in ${mode} mode)`);
    }
  }
  const scheme = pool.find((card) => card.id === scenario.mainSchemeCardId);
  if (!scheme) problems.push(`main scheme ${scenario.mainSchemeCardId} is in neither the pack nor the base game`);
  else if (scheme.type !== "main_scheme") problems.push(`${scenario.mainSchemeCardId} is not a main scheme card`);
  const named: [string, readonly string[] | undefined][] = [
    ["encounterSetIds", scenario.encounterSetIds],
    ["standardEncounterSetIds", scenario.standardEncounterSetIds],
    ["expertEncounterSetIds", scenario.expertEncounterSetIds],
    ["recommendedModularSetIds", scenario.recommendedModularSetIds],
  ];
  for (const [field, ids] of named) {
    for (const id of ids ?? []) {
      if (!sets.some((set) => set.id === id))
        problems.push(`${field}: "${id}" is in neither the pack nor the base game`);
      else if (field !== "recommendedModularSetIds") {
        const set = sets.find((candidate) => candidate.id === id)!;
        const expected =
          field === "standardEncounterSetIds" ? "standard" : field === "expertEncounterSetIds" ? "expert" : undefined;
        if (expected && set.classification !== expected)
          problems.push(`${field}: "${id}" needs classification "${expected}" (RRG 1.8 pp. 40, 19)`);
        if (field === "encounterSetIds" && (set.nemesisOfIdentityId !== undefined || set.campaignSpecific))
          problems.push(`${field}: "${id}" is a nemesis or campaign set, never a scenario's own set`);
        try {
          encounterCardsOf([id], pool);
        } catch {
          problems.push(`${field}: "${id}" has no cards to deal`);
        }
      }
    }
  }
  for (const id of scenario.recommendedModularSetIds ?? []) {
    if (!sets.some((set) => set.id === id)) continue;
    const problem = customModularPickProblem(scenario, id, custom);
    if (problem) problems.push(`recommendedModularSetIds: ${problem}`);
  }
  // `setAsideCardIds`: cards the scenario's Setup sets aside, out of play (RRG 1.8 "Set Aside", p. 39). A card must
  // belong to one of the scenario's own sets (or its Standard or Expert set), so it is dealt out of the deck it would
  // otherwise sit in and not conjured from outside the game.
  const setAside = scenario.setAsideCardIds;
  if (setAside !== undefined) {
    const own = new Set<string>([
      ...scenario.encounterSetIds,
      ...scenario.standardEncounterSetIds,
      ...scenario.expertEncounterSetIds,
    ]);
    const seen = new Set<string>();
    for (const id of setAside) {
      if (seen.has(id)) problems.push(`setAsideCardIds: "${id}" is listed twice`);
      seen.add(id);
      const card = pool.find((candidate) => candidate.id === id);
      if (!card) problems.push(`setAsideCardIds: "${id}" is in neither the pack nor the base game`);
      else if (card.type === "villain" || card.type === "main_scheme" || card.type === "evidence")
        problems.push(`setAsideCardIds: "${id}" is a ${card.type}, which a scenario's own fields place`);
      else if (
        !("encounterSetIds" in card) ||
        !(card.encounterSetIds as readonly string[]).some((setId) => own.has(setId))
      )
        problems.push(`setAsideCardIds: "${id}" is not a card of the scenario's own, Standard or Expert sets`);
    }
  }
  const count = modularPickCountProblem(scenario, scenario.recommendedModularSetIds?.length ?? 0);
  if (count) problems.push(`recommendedModularSetIds: ${count}`);
  return problems;
}

/** A custom scenario record by id, or undefined. */
const customScenarioOf = (scenarioId: string, custom: CustomContent): Scenario | undefined =>
  custom.scenarios.find((scenario) => scenario.id === scenarioId);

/**
 * A pack scenario set up from its record, as `coreScenario` sets up a Core one (RRG Appendix II). Seats may be any
 * playable starter deck or an explicit identity and deck list (a pack hero's).
 */
function customScenario(scenario: Scenario, options: PlayableScenarioOptions, custom: CustomContent): GameSetupConfig {
  const unsupported: string[] = [];
  if (options.setAsideModularSetIds) unsupported.push("setAsideModularSetIds");
  if (options.extraModularSetIds?.length) unsupported.push("extraModularSetIds");
  if (options.difficultySets) unsupported.push("difficultySets");
  if (options.setupOptions) unsupported.push("setupOptions");
  if (options.mainSchemeStageIds) unsupported.push("mainSchemeStageIds");
  if (options.villainSetId !== undefined || options.villainCardId !== undefined) unsupported.push("the villain choice");
  if (options.mainSchemePicks) unsupported.push("mainSchemePicks");
  if (options.horsemanSides) unsupported.push("horsemanSides");
  if (options.easierStart) unsupported.push("easierStart");
  if (options.genePoolThreatPerPlayer !== undefined) unsupported.push("genePoolThreatPerPlayer");
  if (unsupported.length > 0)
    throw new Error(`${scenario.name}: ${unsupported.join(", ")} is not offered at a pack scenario`);
  const problems = [...customContentProblems(custom), ...customScenarioProblems(scenario, custom)];
  if (problems.length > 0) throw new Error(`${scenario.name} cannot be played: ${problems.join("; ")}`);
  const modes = resolveModes(options.difficulty, options.modes);
  if (options.difficulty === "extreme") throw new Error(`${scenario.name}: "extreme" is Breakout's own challenge`);
  if (modes.skirmish) throw new Error(`${scenario.name} has no skirmish mode`);
  const heroic = modes.heroic ?? 0;
  if (!Number.isInteger(heroic) || heroic < 0) throw new Error(`heroic level ${heroic} is not a whole number`);
  const difficulty = difficultyOf(modes);

  const pool = widenedPool(PLAYABLE_CARDS, custom);
  const sets = allSets(custom);
  const villain = pool.find((card) => card.id === scenario.villainCardId);
  if (villain?.type !== "villain") throw new Error(`${scenario.villainCardId} is not a villain`);
  const side = villain.sides[0];
  if (!side) throw new Error(`${villain.name} has no sides`);
  const stageIndex = (stageNumber: number): number => {
    const index = side.stages.findIndex((stage) => stage.stageNumber === stageNumber);
    if (index < 0) throw new Error(`${villain.name} has no stage ${stageNumber}`);
    return index;
  };
  const [firstStage, lastStage] = scenario.villainStages[difficulty];
  if (options.modularSetIds) checkModularPickCount(scenario, options.modularSetIds);
  const modular = chosenModularSetIds(scenario, options.modularSetIds, sets);
  for (const id of modular) {
    const problem = customModularPickProblem(scenario, id, custom);
    if (problem) throw new Error(`${scenario.name}: ${problem}`);
  }
  const ownAndModular = [...scenario.encounterSetIds, ...modular];
  const difficultySets = difficultyEncounterSetIds(scenario, difficulty);
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1–4 players");
  const autoIncludedSets = autoIncludedSetsOf(PLAYABLE_ENCOUNTER_SETS, pool);
  // `Scenario.setAsideCardIds`, as the wave 7 builder reads it: `quantityInSet` copies of each card go to
  // `GameSetupConfig.setAside` and every copy leaves the encounter deck dealt from its set.
  const setAside = (scenario.setAsideCardIds ?? []).flatMap((id) => {
    const card = pool.find((candidate) => candidate.id === id);
    if (!card) throw new Error(`${scenario.name}: unknown set-aside card ${id}`);
    return Array.from({ length: "quantityInSet" in card ? card.quantityInSet : 1 }, () => id);
  });
  const setAsideIds = new Set<string>(setAside);
  const dealt = (ids: CardId[]): CardId[] => (setAside.length > 0 ? ids.filter((id) => !setAsideIds.has(id)) : ids);
  return {
    seed: options.seed,
    cards: pool,
    villainCardId: scenario.villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageIndex(firstStage),
    villainLastStageIndex: stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: [
      ...dealt(encounterCardsOf(ownAndModular, pool)),
      ...encounterCardsOf(difficultySets, pool),
      ...modularSetupCardIds(modular, pool),
    ],
    ...(setAside.length > 0 ? { setAside } : {}),
    players: options.players.map((seat) => {
      if ("starterDeckId" in seat) return playableStarterDeckSetup(seat.starterDeckId);
      return {
        identityCardId: seat.identityCardId as CardId,
        deck: seat.deck as readonly CardId[],
        ...(seat.aspects ? { aspects: seat.aspects } : {}),
      };
    }),
    requireIdentitySets: true,
    requireLegalDecks: true,
    // Decks a set brings (Infinity Gauntlet's stones, MC21 p. 16), as `coreScenario` builds them.
    ...(setSeparateDecks(ownAndModular).length > 0 ? { scenarioDecks: setSeparateDecks(ownAndModular) } : {}),
    ...(difficulty === "expert" ? { difficulty: "expert" as const } : {}),
    ...(heroic > 0 ? { heroicLevel: heroic } : {}),
    ...(autoIncludedSets.length > 0 ? { autoIncludedSets } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
    ...(options.stack ? { stack: options.stack } : {}),
    ...(options.gameMode !== undefined ? { gameMode: options.gameMode } : {}),
  };
}

/**
 * A game at any scenario the app knows, base or a pack's, with the packs' cards in the pool and any of the packs'
 * modular sets among the picks (`options.modularSetIds` may mix base and pack set ids). The game runs on
 * `PLAYABLE_DEPS` plus the packs' abilities. With no custom content this is `playableScenario`.
 *
 * Refused, with a sentence, rather than built wrong: a pack set picked at a scenario the generic path does not serve
 * (a Civil War leader, a Fear No Evil scenario, a scenario drawing its modular sets from a pool), and a pack scenario
 * option the scenario does not offer.
 */
export function playableScenarioWithCustom(
  scenarioId: string,
  options: PlayableScenarioOptions,
  custom: CustomContent,
): GameSetupConfig {
  const clashes = customContentProblems(custom);
  if (clashes.length > 0) throw new Error(`custom content cannot join a game: ${clashes.join("; ")}`);
  const own = customScenarioOf(scenarioId, custom);
  if (own) return customScenario(own, options, custom);
  const customIds = new Set(custom.encounterSets.map((set) => set.id as string));
  const picks = options.modularSetIds;
  const customPicks = (picks ?? []).filter((id) => customIds.has(id));
  const basePicks = (picks ?? []).filter((id) => !customIds.has(id));
  if (customPicks.length === 0) {
    const built = playableScenario(scenarioId, options);
    return { ...built, cards: widenedPool(built.cards, custom) };
  }
  const record = PLAYABLE_SCENARIO_RECORDS.find((s) => s.id === scenarioId);
  if (!record) throw new Error(`${scenarioId}: pack modular sets are not offered at this scenario`);
  if (record.modularSetPool || record.side !== undefined)
    throw new Error(
      `${record.name}: pack modular sets are not offered at a scenario with a modular set pool or a side`,
    );
  if (new Set(picks).size !== picks?.length) throw new Error(`${record.name}: a modular set is chosen twice`);
  for (const id of customPicks) {
    const problem = customModularPickProblem(record, id, custom);
    if (problem) throw new Error(`${record.name}: ${problem}`);
  }
  const built = playableScenario(scenarioId, { ...options, modularSetIds: basePicks }, customPicks.length);
  const pool = widenedPool(built.cards, custom);
  return {
    ...built,
    cards: pool,
    encounterDeck: [
      ...(built.encounterDeck ?? []),
      ...encounterCardsOf(customPicks, pool),
      ...modularSetupCardIds(customPicks, pool),
    ],
  };
}
