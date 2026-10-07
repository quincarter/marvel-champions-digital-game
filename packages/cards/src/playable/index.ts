/**
 * The playable pool: every scripted wave at once (Core through cycle 7). `WAVE1_*` and `WAVE2_*` are sibling
 * pools that each start from Core and know nothing of each other, which is right for a pack's own tests and wrong
 * for an app where a cycle 1 hero sits down against a wave 1 villain. This module is that union, built from the
 * waves' own exports so a pack is still added in exactly one place (its wave's `index.ts`).
 *
 * **Adding a wave is one registry list and one scenario lookup here.**
 */
import {
  CORE_ENCOUNTER_SETS,
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE1_STARTER_DECKS,
  WAVE2_SCENARIOS,
  WAVE2_STARTER_DECKS,
  WAVE3_SCENARIOS,
  WAVE3_STARTER_DECKS,
  WAVE4_SCENARIOS,
  WAVE4_STARTER_DECKS,
  WAVE5_SCENARIOS,
  WAVE5_STARTER_DECKS,
  WAVE6_ENCOUNTER_SETS,
  WAVE6_SCENARIOS,
  WAVE6_STARTER_DECKS,
  WAVE7_ENCOUNTER_SETS,
  WAVE7_SCENARIOS,
  WAVE7_STARTER_DECKS,
  autoIncludedSetsOf,
  type StarterDeck,
} from "@mc/content";
import type { AbilityRegistry, EngineDeps, GameSetupConfig, PlayerSetup } from "@mc/engine";
import { checkScenarioSetupOptions, type CorePlayer } from "../core/setup.js";
import { WAVE1_ABILITIES } from "../wave1/index.js";
import { wave1Scenario, type Wave1ScenarioOptions } from "../wave1/setup.js";
import { WAVE2_ABILITIES } from "../wave2/index.js";
import { wave2Scenario } from "../wave2/setup.js";
import { WAVE3_ABILITIES } from "../wave3/index.js";
import { wave3Scenario } from "../wave3/setup.js";
import { WAVE4_ABILITIES } from "../wave4/index.js";
import { wave4Scenario, type Wave4ScenarioOptions } from "../wave4/setup.js";
import { WAVE5_ABILITIES } from "../wave5/index.js";
import { wave5Scenario } from "../wave5/setup.js";
import { WAVE6_ABILITIES } from "../wave6/index.js";
import { WAVE7_ABILITIES } from "../wave7/index.js";
import { wave7Scenario } from "../wave7/setup.js";
import {
  PLAYABLE_ENCOUNTER_SETS,
  PLAYABLE_SCENARIO_RECORDS,
  checkModularPickCount,
  extraModularCardIds,
} from "../modular-pool.js";
import { wave6Scenario, type Wave6ScenarioOptions } from "../wave6/setup.js";

/**
 * Every scripted ability. Both waves' registries carry Core's own scripts, as the same objects under the same ids,
 * so this is a plain union rather than `mergeRegistries` (whose "defined twice" guard would trip on exactly that
 * overlap). An id two waves define *differently* is still an error.
 */
function unionRegistries(...registries: readonly AbilityRegistry[]): AbilityRegistry {
  const union: Record<string, AbilityRegistry[string]> = {};
  for (const registry of registries) {
    for (const [id, ability] of Object.entries(registry)) {
      if (id in union && union[id] !== ability) throw new Error(`ability ${id} is defined differently by two waves`);
      union[id] = ability;
    }
  }
  return union;
}

export const PLAYABLE_ABILITIES: AbilityRegistry = unionRegistries(
  WAVE1_ABILITIES,
  WAVE2_ABILITIES,
  WAVE3_ABILITIES,
  WAVE4_ABILITIES,
  WAVE5_ABILITIES,
  WAVE6_ABILITIES,
  WAVE7_ABILITIES,
);

/** Engine dependencies for a game on the playable pool. */
export const PLAYABLE_DEPS: EngineDeps = { abilities: PLAYABLE_ABILITIES };

/**
 * Wave 1's options are the widest base (Breakout's `"extreme"` and `villainVersions`); every other builder takes a
 * subset, except wave 4's own `setAsideModularSetIds` (The Hood's seven-of-nine modular choice, docs/phase7-wave4.md
 * §2.3), which is additive here the same way.
 */
export type PlayableScenarioOptions = Wave1ScenarioOptions &
  Pick<Wave4ScenarioOptions, "setAsideModularSetIds"> &
  Pick<Wave6ScenarioOptions, "extraModularSetIds">;

const STARTER_DECKS: readonly StarterDeck[] = [
  ...CORE_STARTER_DECKS,
  ...WAVE1_STARTER_DECKS,
  ...WAVE2_STARTER_DECKS,
  ...WAVE3_STARTER_DECKS,
  ...WAVE4_STARTER_DECKS,
  ...WAVE5_STARTER_DECKS,
  ...WAVE6_STARTER_DECKS,
  ...WAVE7_STARTER_DECKS,
];

/** Any starter deck in the playable pool as a player seat (quantities expanded; the identity isn't part of the deck). */
export function playableStarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = STARTER_DECKS.find((deck) => deck.id === starterDeckId);
  if (!starter) throw new Error(`no playable starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

/**
 * Any playable scenario, seated with any playable deck. The scenario's own wave builds it (each knows its own
 * setup quirks: Breakout's four villains, Kang's separate game areas, Red Skull's side-scheme deck), then the
 * game's card pool is widened to `PLAYABLE_CARDS` so a seat from another wave is a known card. Starter-deck seats
 * are resolved here first, because a wave's own builder only knows its own starter decks.
 */
export function playableScenario(scenarioId: string, options: PlayableScenarioOptions): GameSetupConfig {
  // The picks are checked against the scenario's required count here, where the app's table setup builds a game; each
  // builder checks what a pick may be (`chosenModularSetIds`).
  const scenario = PLAYABLE_SCENARIO_RECORDS.find((candidate) => candidate.id === scenarioId);
  if (scenario) checkModularPickCount(scenario, options.modularSetIds);
  const built = withAutoIncludedSets(
    withExtraModularSets(scenarioId, options, playableScenarioUnstacked(scenarioId, options)),
  );
  // `stack` is a setup-config option, not a scenario rule, so it is attached here for every wave's builder alike
  // rather than trusted to each builder forwarding it (`GameSetupConfig.stack`).
  return options.stack ? { ...built, stack: options.stack } : built;
}

/**
 * The sets a setup condition includes (Dreadpool, when a seat declared the 'Pool aspect; docs/phase7-wave7.md §3.74),
 * handed to the engine for every scenario of every wave: a Deadpool or 'Pool deck at an older scenario gets the set
 * too. Only the engine decides inclusion; a builder that already passed the list (`wave7Scenario`) is left alone.
 */
function withAutoIncludedSets(built: GameSetupConfig): GameSetupConfig {
  if (built.autoIncludedSets !== undefined) return built;
  const autoIncludedSets = autoIncludedSetsOf(PLAYABLE_ENCOUNTER_SETS, PLAYABLE_CARDS);
  return autoIncludedSets.length > 0 ? { ...built, autoIncludedSets } : built;
}

const EXTRA_MODULAR_SET_IDS: ReadonlySet<string> = new Set(
  [...CORE_ENCOUNTER_SETS, ...WAVE6_ENCOUNTER_SETS, ...WAVE7_ENCOUNTER_SETS]
    .filter((set) => set.extraModular)
    .map((set) => set.id as string),
);

/**
 * An extra modular set (Longshot, MojoMania insert p. 2: "can be included in any scenario") shuffled in on top of any
 * scenario's own encounter deck. A cycle 6 or 7 scenario's own builder already adds it (`wave6Scenario`, `wave7Scenario`); every earlier
 * wave's builder knows nothing of it, so it is added here. Never counted as one of the scenario's modular sets.
 */
function withExtraModularSets(
  scenarioId: string,
  options: PlayableScenarioOptions,
  built: GameSetupConfig,
): GameSetupConfig {
  const extra = options.extraModularSetIds ?? [];
  if (
    extra.length === 0 ||
    WAVE6_SCENARIOS.some((scenario) => scenario.id === scenarioId) ||
    WAVE7_SCENARIOS.some((scenario) => scenario.id === scenarioId)
  )
    return built;
  if (new Set(extra).size !== extra.length) throw new Error(`${scenarioId}: an extra modular set is added twice`);
  for (const id of extra)
    if (!EXTRA_MODULAR_SET_IDS.has(id)) throw new Error(`${scenarioId}: ${id} is not an extra modular set`);
  return { ...built, encounterDeck: [...(built.encounterDeck ?? []), ...extraModularCardIds(extra, PLAYABLE_CARDS)] };
}

function playableScenarioUnstacked(scenarioId: string, options: PlayableScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(scenarioId, options.setupOptions);
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = playableStarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: setup.identityCardId,
      deck: setup.deck,
      ...(setup.aspects ? { aspects: setup.aspects } : {}),
    };
  });
  const seated = { ...options, players };
  if (WAVE7_SCENARIOS.some((scenario) => scenario.id === scenarioId)) {
    if (seated.difficulty === "extreme")
      throw new Error(`${scenarioId} is a cycle 7 scenario; "extreme" is Breakout's own multi-villain challenge`);
    const { villainVersions: _villainVersions, difficulty, ...rest } = seated;
    return { ...wave7Scenario(scenarioId, { ...rest, ...(difficulty ? { difficulty } : {}) }), cards: PLAYABLE_CARDS };
  }
  if (WAVE6_SCENARIOS.some((scenario) => scenario.id === scenarioId)) {
    if (seated.difficulty === "extreme")
      throw new Error(`${scenarioId} is a cycle 6 scenario; "extreme" is Breakout's own multi-villain challenge`);
    // Wave 6 builds on `setAsideModularSetIds` (MojoMania's genre sets), so it is forwarded, unlike waves 5's.
    const { villainVersions: _villainVersions, difficulty, ...rest } = seated;
    return { ...wave6Scenario(scenarioId, { ...rest, ...(difficulty ? { difficulty } : {}) }), cards: PLAYABLE_CARDS };
  }
  if (WAVE5_SCENARIOS.some((scenario) => scenario.id === scenarioId)) {
    if (seated.difficulty === "extreme")
      throw new Error(`${scenarioId} is a cycle 4 scenario; "extreme" is Breakout's own multi-villain challenge`);
    const {
      villainVersions: _villainVersions,
      setAsideModularSetIds: _setAsideModularSetIds,
      difficulty,
      ...rest
    } = seated;
    return { ...wave5Scenario(scenarioId, { ...rest, ...(difficulty ? { difficulty } : {}) }), cards: PLAYABLE_CARDS };
  }
  if (WAVE4_SCENARIOS.some((scenario) => scenario.id === scenarioId)) {
    if (seated.difficulty === "extreme")
      throw new Error(`${scenarioId} is a cycle 3 scenario; "extreme" is Breakout's own multi-villain challenge`);
    const { villainVersions: _villainVersions, difficulty, ...rest } = seated;
    return { ...wave4Scenario(scenarioId, { ...rest, ...(difficulty ? { difficulty } : {}) }), cards: PLAYABLE_CARDS };
  }
  if (WAVE3_SCENARIOS.some((scenario) => scenario.id === scenarioId)) {
    if (seated.difficulty === "extreme")
      throw new Error(`${scenarioId} is a cycle 2 scenario; "extreme" is Breakout's own multi-villain challenge`);
    const { villainVersions: _villainVersions, difficulty, ...rest } = seated;
    return { ...wave3Scenario(scenarioId, { ...rest, ...(difficulty ? { difficulty } : {}) }), cards: PLAYABLE_CARDS };
  }
  if (WAVE2_SCENARIOS.some((scenario) => scenario.id === scenarioId)) {
    if (seated.difficulty === "extreme")
      throw new Error(`${scenarioId} is a cycle 1 scenario; "extreme" is Breakout's own multi-villain challenge`);
    const { villainVersions: _villainVersions, difficulty, ...rest } = seated;
    return { ...wave2Scenario(scenarioId, { ...rest, ...(difficulty ? { difficulty } : {}) }), cards: PLAYABLE_CARDS };
  }
  // Wave 1's builder also seats a Core scenario, and rejects an id nobody knows.
  return { ...wave1Scenario(scenarioId, seated), cards: PLAYABLE_CARDS };
}
