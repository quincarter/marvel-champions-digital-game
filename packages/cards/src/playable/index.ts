/**
 * The playable pool: every scripted wave at once (Core through cycle 10's Civil War box, minus the sets in `./unscripted.ts`). `WAVE1_*` and `WAVE2_*` are sibling
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
  WAVE8_ENCOUNTER_SETS,
  WAVE8_SCENARIOS,
  WAVE8_STARTER_DECKS,
  WAVE9_ENCOUNTER_SETS,
  WAVE9_SCENARIOS,
  WAVE9_STARTER_DECKS,
  WAVE10_ENCOUNTER_SETS,
  WAVE10_SCENARIOS,
  WAVE10_STARTER_DECKS,
  WAVE11_SCENARIOS,
  WAVE11_STARTER_DECKS,
  autoIncludedSetsOf,
  type AnyCard,
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
import { INFINITES_SET_ID, infinitesGenePoolThreat } from "../wave8/aoa/infinites.js";
import { WAVE8_ABILITIES } from "../wave8/index.js";
import { wave8Scenario, type Wave8ScenarioOptions } from "../wave8/setup.js";
import { WAVE9_ABILITIES } from "../wave9/index.js";
import { wave9Scenario } from "../wave9/setup.js";
import { WAVE10_ABILITIES } from "../wave10/index.js";
import { wave10Scenario } from "../wave10/setup.js";
import { WAVE11_ABILITIES } from "../wave11/index.js";
import { wave11Scenario, type Wave11ScenarioOptions } from "../wave11/setup.js";
import { checkPlayableDifficultySets } from "./scenario-options.js";
import { UNSCRIPTED_ENCOUNTER_SET_IDS } from "./unscripted.js";
import {
  PLAYABLE_ENCOUNTER_SETS,
  PLAYABLE_SCENARIO_RECORDS,
  checkModularPickCount,
  chooseModularSets,
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
  WAVE8_ABILITIES,
  WAVE9_ABILITIES,
  WAVE10_ABILITIES,
  WAVE11_ABILITIES,
);

/** Engine dependencies for a game on the playable pool. */
export const PLAYABLE_DEPS: EngineDeps = { abilities: PLAYABLE_ABILITIES };

/**
 * Wave 1's options are the widest base (Breakout's `"extreme"` and `villainVersions`); every other builder takes a
 * subset, except wave 4's own `setAsideModularSetIds` (The Hood's seven-of-nine modular choice, docs/phase7-wave4.md
 * §2.3), which is additive here the same way. Wave 8 adds its three setup choices (docs/phase7-wave8.md section 4.1 Q1,
 * Q9, Q12): `genePoolThreatPerPlayer` for any game whose sets include Infinites, `horsemanSides` for the Four Horsemen
 * and `easierStart` for Apocalypse on standard. `./scenario-options.ts` says which of them a scenario offers.
 */
export type PlayableScenarioOptions = Wave1ScenarioOptions &
  Pick<Wave4ScenarioOptions, "setAsideModularSetIds"> &
  Pick<Wave6ScenarioOptions, "extraModularSetIds"> &
  Pick<Wave8ScenarioOptions, "genePoolThreatPerPlayer" | "horsemanSides" | "easierStart"> &
  Pick<Wave11ScenarioOptions, "villainSetId" | "mainSchemePicks">;

const STARTER_DECKS: readonly StarterDeck[] = [
  ...CORE_STARTER_DECKS,
  ...WAVE1_STARTER_DECKS,
  ...WAVE2_STARTER_DECKS,
  ...WAVE3_STARTER_DECKS,
  ...WAVE4_STARTER_DECKS,
  ...WAVE5_STARTER_DECKS,
  ...WAVE6_STARTER_DECKS,
  ...WAVE7_STARTER_DECKS,
  ...WAVE8_STARTER_DECKS,
  ...WAVE9_STARTER_DECKS,
  ...WAVE10_STARTER_DECKS,
  ...WAVE11_STARTER_DECKS,
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
  // A wave 11 record is checked the same way before the wave is joined to the playable records.
  const scenario =
    PLAYABLE_SCENARIO_RECORDS.find((candidate) => candidate.id === scenarioId) ??
    WAVE11_SCENARIOS.find((candidate) => candidate.id === scenarioId);
  // Which stages the main scheme deck is made of is a choice at a Civil War leader only (MC56 p. 5); every other
  // builder would drop the option silently.
  if (options.mainSchemeStageIds !== undefined && !isWave10Scenario(scenarioId))
    throw new Error(`${scenarioId}: the main scheme's stages are not a setup choice at this scenario`);
  if (scenario) {
    checkModularPickCount(scenario, options.modularSetIds);
    // One rule for every wave's builder: which Standard or Expert set may stand in for the printed one (Q10 = A).
    checkPlayableDifficultySets(scenario, options.difficultySets);
  }
  const built = withAutoIncludedSets(
    withGenePoolThreat(
      scenarioId,
      options,
      withExtraModularSets(scenarioId, options, playableScenarioUnstacked(scenarioId, options)),
    ),
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
  [
    ...CORE_ENCOUNTER_SETS,
    ...WAVE6_ENCOUNTER_SETS,
    ...WAVE7_ENCOUNTER_SETS,
    ...WAVE8_ENCOUNTER_SETS,
    ...WAVE9_ENCOUNTER_SETS,
    ...WAVE10_ENCOUNTER_SETS,
  ]
    .filter((set) => set.extraModular && !UNSCRIPTED_ENCOUNTER_SET_IDS.has(set.id))
    .map((set) => set.id as string),
);

/**
 * An extra modular set (Longshot, MojoMania insert p. 2: "can be included in any scenario") shuffled in on top of any
 * scenario's own encounter deck. A cycle 6, 7, 8 or 9 scenario's own builder already adds it (`wave6Scenario` to `wave9Scenario`); every earlier
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
    WAVE7_SCENARIOS.some((scenario) => scenario.id === scenarioId) ||
    WAVE8_SCENARIOS.some((scenario) => scenario.id === scenarioId) ||
    WAVE9_SCENARIOS.some((scenario) => scenario.id === scenarioId) ||
    isWave10Scenario(scenarioId) ||
    isWave11Scenario(scenarioId)
  )
    return built;
  if (new Set(extra).size !== extra.length) throw new Error(`${scenarioId}: an extra modular set is added twice`);
  for (const id of extra)
    if (!EXTRA_MODULAR_SET_IDS.has(id)) throw new Error(`${scenarioId}: ${id} is not an extra modular set`);
  return { ...built, encounterDeck: [...(built.encounterDeck ?? []), ...extraModularCardIds(extra, PLAYABLE_CARDS)] };
}

/** The Infinites set's cards, by id: a game whose encounter deck holds one uses the set. */
const INFINITES_CARD_IDS: ReadonlySet<string> = new Set(
  PLAYABLE_CARDS.filter(
    (card: AnyCard) =>
      "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(INFINITES_SET_ID),
  ).map((card) => card.id as string),
);

/**
 * The Infinites set's "Modular Difficulty" (MC45 p. 8; docs/phase7-wave8.md section 4.1 Q1 = A) at a scenario of an
 * earlier wave that took Infinites as a modular pick: the option belongs to the set, not to a scenario, and those
 * builders know nothing of it, so the threat on Gene Pool is added here. A wave 8 scenario's own builder already did it
 * (`wave8Scenario`). A game without the set refuses the option; 0 is off.
 */
function withGenePoolThreat(
  scenarioId: string,
  options: PlayableScenarioOptions,
  built: GameSetupConfig,
): GameSetupConfig {
  const perPlayer = options.genePoolThreatPerPlayer;
  if (perPlayer === undefined || WAVE8_SCENARIOS.some((scenario) => scenario.id === scenarioId)) return built;
  const dealt = [...(built.encounterDeck ?? []), ...(built.villains ?? []).flatMap((v) => v.encounterDeck ?? [])];
  if (!dealt.some((id) => INFINITES_CARD_IDS.has(id)))
    throw new Error(`${scenarioId}: genePoolThreatPerPlayer belongs to a game that uses the Infinites set`);
  if (perPlayer === 0) return built;
  return { ...built, setupOptions: [...(built.setupOptions ?? []), infinitesGenePoolThreat(perPlayer)] };
}

const isWave10Scenario = (scenarioId: string): boolean =>
  WAVE10_SCENARIOS.some((scenario) => scenario.id === scenarioId);

const isWave11Scenario = (scenarioId: string): boolean =>
  WAVE11_SCENARIOS.some((scenario) => scenario.id === scenarioId);

/**
 * A wave 11 scenario (Fear No Evil, docs/phase7-wave11-scenarios.md §S3.3): `wave11Scenario` builds it from the main
 * scheme's record and checks the villain (`villainSetId`, one of `Scenario.villainOptions`), the modular sets and
 * the per-player main schemes itself. Like a Civil War leader before its wave was joined, a record is answered here
 * before `PLAYABLE_SCENARIO_RECORDS` lists it, so no table setup offers one until then.
 */
function wave11Playable(
  scenarioId: string,
  options: PlayableScenarioOptions,
  players: readonly CorePlayer[],
): GameSetupConfig {
  if (options.horsemanSides) throw new Error(`${scenarioId}: horsemanSides belongs to the Four Horsemen scenario`);
  if (options.easierStart) throw new Error(`${scenarioId}: easierStart belongs to the Apocalypse scenario`);
  if (options.setAsideModularSetIds)
    throw new Error(`${scenarioId}: a Fear No Evil scenario sets no modular sets aside`);
  if (options.difficulty === "extreme")
    throw new Error(`${scenarioId} is a cycle 11 scenario; "extreme" is Breakout's own multi-villain challenge`);
  const {
    horsemanSides: _horsemanSides,
    easierStart: _easierStart,
    genePoolThreatPerPlayer: _genePoolThreatPerPlayer,
    villainVersions: _villainVersions,
    setAsideModularSetIds: _setAsideModularSetIds,
    difficulty,
    ...rest
  } = options;
  return {
    ...wave11Scenario(scenarioId, { ...rest, players, ...(difficulty ? { difficulty } : {}) }),
    cards: PLAYABLE_CARDS,
  };
}

/**
 * A Civil War scenario (docs/phase7-wave10.md §3.1): `wave10Scenario` builds it from the leader's record and the
 * players' choices, and checks every one of them itself (the count of modular sets, their side, the stage pair).
 *
 * The wave is joined to the playable pool: its scenarios are in `PLAYABLE_SCENARIO_RECORDS`, its sets in
 * `PLAYABLE_ENCOUNTER_SETS` (the hero packs' own sets stay gated, `./unscripted.ts`), its starter decks in
 * `playableStarterDeckSetup` and its scripts in `PLAYABLE_ABILITIES`, so a game built here runs on `PLAYABLE_DEPS`.
 */
function wave10Playable(
  scenarioId: string,
  options: PlayableScenarioOptions,
  players: readonly CorePlayer[],
): GameSetupConfig {
  if (options.horsemanSides) throw new Error(`${scenarioId}: horsemanSides belongs to the Four Horsemen scenario`);
  if (options.easierStart) throw new Error(`${scenarioId}: easierStart belongs to the Apocalypse scenario`);
  if (options.setAsideModularSetIds)
    throw new Error(`${scenarioId}: a Civil War scenario sets no modular sets aside (MC56 p. 4)`);
  if (options.difficulty === "extreme")
    throw new Error(`${scenarioId} is a cycle 10 scenario; "extreme" is Breakout's own multi-villain challenge`);
  const {
    horsemanSides: _horsemanSides,
    easierStart: _easierStart,
    genePoolThreatPerPlayer: _genePoolThreatPerPlayer,
    villainVersions: _villainVersions,
    setAsideModularSetIds: _setAsideModularSetIds,
    difficulty,
    ...rest
  } = options;
  // `wave10Scenario`'s cards are the playable pool with the side's gathered main scheme card in its printed card's
  // place (docs/phase7-synthezoid.md §3 M1), so they are kept as built.
  return wave10Scenario(scenarioId, { ...rest, players, ...(difficulty ? { difficulty } : {}) });
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
  if (isWave11Scenario(scenarioId)) return wave11Playable(scenarioId, options, players);
  // The villain is a setup choice, and there is a main scheme per player, only at a wave 11 scenario that says so
  // (`Scenario.villainOptions`, `mainSchemeChoice`); every other builder would drop the option silently.
  if (options.villainSetId !== undefined) throw new Error(`${scenarioId}: the villain is not a setup choice here`);
  if (options.mainSchemePicks !== undefined)
    throw new Error(`${scenarioId}: there is one main scheme, not one per player`);
  if (isWave10Scenario(scenarioId)) return wave10Playable(scenarioId, options, players);
  if (WAVE9_SCENARIOS.some((scenario) => scenario.id === scenarioId))
    return wave9Playable(scenarioId, options, players);
  if (WAVE8_SCENARIOS.some((scenario) => scenario.id === scenarioId)) {
    const seated = { ...options, players };
    if (seated.difficulty === "extreme")
      throw new Error(`${scenarioId} is a cycle 8 scenario; "extreme" is Breakout's own multi-villain challenge`);
    const { villainVersions: _villainVersions, difficulty, ...rest } = seated;
    return { ...wave8Scenario(scenarioId, { ...rest, ...(difficulty ? { difficulty } : {}) }), cards: PLAYABLE_CARDS };
  }
  // The Horsemen's versions and the easier Apocalypse start are those two scenarios' own; every other builder would
  // drop them silently. (`genePoolThreatPerPlayer` follows the Infinites set: `withGenePoolThreat`.)
  if (options.horsemanSides) throw new Error(`${scenarioId}: horsemanSides belongs to the Four Horsemen scenario`);
  if (options.easierStart) throw new Error(`${scenarioId}: easierStart belongs to the Apocalypse scenario`);
  const {
    horsemanSides: _horsemanSides,
    easierStart: _easierStart,
    genePoolThreatPerPlayer: _genePoolThreatPerPlayer,
    ...earlier
  } = options;
  const seated = { ...earlier, players };
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

/**
 * A wave 9 scenario. Nothing in `./unscripted.ts` is offered or accepted: a gated modular, set-aside or extra pick is
 * refused, and a scenario with a pool of modular sets (Thunderbolts' ten) draws its set-aside sets from the pool minus
 * the gated sets, with the same seeded draw the builder would make from the whole pool (`chooseModularSets` on the
 * playable record), because `wave9Scenario` reads the unfiltered record from `@mc/content`.
 */
function wave9Playable(
  scenarioId: string,
  options: PlayableScenarioOptions,
  players: readonly CorePlayer[],
): GameSetupConfig {
  const named = [
    ...(options.modularSetIds ?? []),
    ...(options.setAsideModularSetIds ?? []),
    ...(options.extraModularSetIds ?? []),
  ];
  for (const id of named)
    if (UNSCRIPTED_ENCOUNTER_SET_IDS.has(id)) throw new Error(`${scenarioId}: ${id} is not playable yet`);
  if (options.horsemanSides) throw new Error(`${scenarioId}: horsemanSides belongs to the Four Horsemen scenario`);
  if (options.easierStart) throw new Error(`${scenarioId}: easierStart belongs to the Apocalypse scenario`);
  if (options.difficulty === "extreme")
    throw new Error(`${scenarioId} is a cycle 9 scenario; "extreme" is Breakout's own multi-villain challenge`);
  const record = PLAYABLE_SCENARIO_RECORDS.find((candidate) => candidate.id === scenarioId);
  if (!record) throw new Error(`${scenarioId} is not playable yet`);
  const {
    horsemanSides: _horsemanSides,
    easierStart: _easierStart,
    genePoolThreatPerPlayer: _genePoolThreatPerPlayer,
    villainVersions: _villainVersions,
    difficulty,
    ...rest
  } = options;
  // An extra set the scenario already requires (Baron Zemo's Executive Board) is in the deck once, not twice.
  const required = new Set<string>(record.encounterSetIds as readonly string[]);
  const extra = (rest.extraModularSetIds ?? []).filter((id) => !required.has(id));
  let setAsideModularSetIds = rest.setAsideModularSetIds;
  if (record.modularSetPool && setAsideModularSetIds === undefined) {
    const chosen = chooseModularSets(record, PLAYABLE_ENCOUNTER_SETS, {
      playerCount: players.length,
      seed: options.seed,
      ...(rest.modularSetIds ? { modularSetIds: rest.modularSetIds } : {}),
    });
    setAsideModularSetIds = chosen.setAsideModularSetIds;
  }
  return {
    ...wave9Scenario(scenarioId, {
      ...rest,
      players,
      ...(difficulty ? { difficulty } : {}),
      ...(setAsideModularSetIds ? { setAsideModularSetIds } : {}),
      extraModularSetIds: extra,
    }),
    cards: PLAYABLE_CARDS,
  };
}
