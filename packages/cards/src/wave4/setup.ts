import { EBONY_MAW_SCENARIO_RULES } from "./mts/ebony-maw.js";
import type { RuleSpec } from "@mc/engine";
import {
  CORE_STARTER_DECKS,
  HOOD_ENCOUNTER_SETS,
  HOOD_SCENARIOS,
  MTS_ENCOUNTER_SETS,
  MTS_SCENARIOS,
  MTS_STARTER_DECKS,
  NEBU_STARTER_DECKS,
  VALK_STARTER_DECKS,
  VISION_STARTER_DECKS,
  WARM_STARTER_DECKS,
  difficultyOf,
  type AnyCard,
  type CardId,
} from "@mc/content";
import type { GameSetupConfig, PlayerSetup } from "@mc/engine";
import {
  coreScenario,
  resolveModes,
  type CoreDifficulty,
  type CorePlayer,
  type CoreScenarioOptions,
} from "../core/setup.js";
import { WAVE4_CARDS } from "./cards.js";

/**
 * A wave 4 scenario builder: `MTS_SCENARIOS`' own single-villain records (today, only Ebony Maw —
 * docs/phase7-wave4.md §2.2 — is scripted; the others stay data-only per `../mts/coverage.test.ts`'s own
 * `KNOWN_SKIPPED`), else `coreScenario`'s fallback — a Core scenario seated with the wave 4 card pool, the same
 * "no scenario of its own yet" precedent `wave3/setup.ts` used before `gmw` landed. Modeled directly on
 * `wave3Scenario`'s own `buildSingleVillain`; Tower Defense's `multipleVillains` shape is left to whoever scripts
 * it next (`buildSingleVillain` below refuses it explicitly rather than silently building it wrong).
 */
export type Wave4Difficulty = CoreDifficulty;

export interface Wave4ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave4Difficulty;
  /**
   * The Hood only (docs/phase7-wave4.md §2.3, §3.18): which of the pack's nine modular encounter sets to set aside
   * at setup ("Choose 7 modular encounter sets and set them aside — you may choose randomly"). Defaults to the
   * first seven of `HOOD_ENCOUNTER_SETS` with no `classification` (excluding `the_hood` itself), in encounter-set
   * declaration order — a fixed, reproducible "you may choose randomly" rather than an RNG draw, since choosing
   * which sets even enter the game is a setup decision the scenario builder makes once, before the seeded game
   * state exists to draw from.
   */
  readonly setAsideModularSetIds?: readonly string[];
}

const cardsById = new Map<string, AnyCard>(WAVE4_CARDS.map((card) => [card.id, card]));

/** Every card in these encounter sets, read from `WAVE4_CARDS` (`wave3/setup.ts`'s `wave3EncounterCardsOf`,
 * re-pointed). */
function wave4EncounterCardsOf(setIds: readonly string[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = WAVE4_CARDS.filter(
      (card) =>
        "encounterSetIds" in card &&
        (card.encounterSetIds as readonly string[]).includes(setId) &&
        card.type !== "villain" &&
        card.type !== "main_scheme",
    );
    if (members.length === 0) throw new Error(`encounter set ${setId} has no wave 4 card`);
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) deck.push(card.id);
  }
  return deck;
}

/** A single-villain `MTS_SCENARIOS` record (`wave3/setup.ts`'s `buildSingleVillain`, re-pointed at `mts`). */
/** Scenario rules printed in a rulebook, not on a card, by scenario id (`GameSetupConfig.scenarioRuleSpecs`, §3.40). */
const SCENARIO_RULE_SPECS: Readonly<Record<string, readonly RuleSpec[]>> = {
  "ebony-maw": EBONY_MAW_SCENARIO_RULES,
};

/**
 * A wave 4 card scoped to a specific scenario (`specificTo.kind === "scenario"`, e.g. Odin, `mts` 21139a) starts set
 * aside so that scenario's own `Setup:` ability can find it by name (`encounterSetAside({ name })`) and place it —
 * `wave3/setup.ts`'s own `scenarioSpecificSetAside`, re-pointed at `WAVE4_CARDS`.
 */
function scenarioSpecificSetAside(setIds: readonly string[]): CardId[] {
  return WAVE4_CARDS.filter(
    (card) =>
      "specificTo" in card && card.specificTo?.kind === "scenario" && setIds.includes(card.specificTo.encounterSetId),
  ).map((card) => card.id);
}

function buildMtsSingleVillain(
  scenario: (typeof MTS_SCENARIOS)[number],
  options: Wave4ScenarioOptions,
): GameSetupConfig {
  if (scenario.multipleVillains) {
    throw new Error(`${scenario.name}: multipleVillains scenarios are not built by wave4Scenario yet`);
  }
  const modes = resolveModes(options.difficulty, options.modes);
  const difficulty = difficultyOf(modes);
  // A whole separate villain card for expert mode (Escape the Museum's Collector, `gmw/scenarios.ts`'s own
  // `expertVillains` shape) rather than a later stage of the same one: MC21 p. 20's Hela contents line ("Villain deck
  // Hela A (Hela B instead for expert mode)"), `MTS_SCENARIOS`' `hela.expertVillains` (21137a).
  const useExpertVillain = difficulty === "expert" && scenario.expertVillains;
  const villainCardId = useExpertVillain ? scenario.expertVillains!.villainCardId : scenario.villainCardId;
  const villain = cardsById.get(villainCardId);
  if (!villain || villain.type !== "villain") throw new Error(`${villainCardId} is not a villain`);
  const side = villain.sides[0];
  if (!side) throw new Error(`${villain.name} has no sides`);
  const stageIndex = (stageNumber: number): number => {
    const index = side.stages.findIndex((stage) => stage.stageNumber === stageNumber);
    if (index < 0) throw new Error(`${villain.name} has no stage ${stageNumber}`);
    return index;
  };
  const [firstStage, lastStage] = scenario.villainStages[difficulty];
  const sets = [
    ...scenario.encounterSetIds,
    ...(options.modularSetIds ?? scenario.recommendedModularSetIds),
    ...scenario.standardEncounterSetIds,
    ...(difficulty === "expert" ? scenario.expertEncounterSetIds : []),
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  // A modular set that brings its own deck (`EncounterSet.separateDecks`; the Infinity Gauntlet set's Infinity
  // Stone deck, docs/phase7-wave4.md §1.10/§3.6/§5): every such set among this game's own `sets` becomes a
  // `GameSetupConfig.scenarioDecks` entry, built at setup with no card text asking. `singleVillainOnly` sets are
  // refused with more than one villain (checked above: `buildMtsSingleVillain` only ever builds a single villain).
  const scenarioDecks = MTS_ENCOUNTER_SETS.filter((set) => sets.includes(set.id) && set.separateDecks).flatMap((set) =>
    set.separateDecks!.map((deck) => ({ ...deck, buildAtSetup: true as const })),
  );
  return {
    seed: options.seed,
    cards: WAVE4_CARDS,
    villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageIndex(firstStage),
    villainLastStageIndex: stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: wave4EncounterCardsOf(sets),
    players: seatsOf(options.players),
    setAside: scenarioSpecificSetAside(sets),
    ...(useExpertVillain ? { setAsideVillainCardIds: scenario.expertVillains!.setAsideVillainCardIds } : {}),
    // Loki's own random start and victory count (docs/phase7-wave4.md §3.7): the villain that starts is drawn from
    // the game's own seeded RNG among `villainCardId` and `setAsideVillainCardIds`, so the latter is passed
    // through even though `buildMtsSingleVillain` never reads it for anything else.
    ...(scenario.startingVillain === "random"
      ? { randomStartingVillain: true as const, setAsideVillainCardIds: scenario.setAsideVillainCardIds ?? [] }
      : {}),
    ...(scenario.victoryCondition
      ? { victoryCondition: scenario.victoryCondition[victoryConditionModeOf(modes)] }
      : {}),
    ...(scenario.victory ? { victory: scenario.victory } : {}),
    // Rules the scenario's rulebook imposes without a card (docs/phase7-wave4.md §3.40).
    ...(SCENARIO_RULE_SPECS[scenario.id] ? { scenarioRuleSpecs: SCENARIO_RULE_SPECS[scenario.id] } : {}),
    includeIdentitySets: true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(scenarioDecks.length > 0 ? { scenarioDecks } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

/**
 * `Scenario.victoryCondition`'s own key (Loki, docs/phase7-wave4.md §3.7): skirmish and heroic aren't a two-value
 * `ScenarioDifficulty`, so this reads the mode set directly rather than through `difficultyOf` — the same "typed,
 * not built until a scenario actually needs it" gap `@mc/content`'s own `schema/modes.ts` docblock names, closed
 * here for the one scenario that does.
 */
function victoryConditionModeOf(modes: ReturnType<typeof resolveModes>): "skirmish" | "standard" | "expert" | "heroic" {
  if (modes.skirmish) return "skirmish";
  if (modes.heroic) return "heroic";
  return difficultyOf(modes);
}

/** The Hood's own nine modular encounter sets, in declaration order (docs/phase7-wave4.md §2.3): every
 * `HOOD_ENCOUNTER_SETS` member that is not `the_hood` itself and carries no `classification` (Standard II/Expert II
 * are difficulty sets, never drafted here). */
const HOOD_MODULAR_SET_IDS: readonly string[] = HOOD_ENCOUNTER_SETS.filter(
  (set) => set.id !== "the_hood" && !set.classification,
).map((set) => set.id);

/** The Hood (docs/phase7-wave4.md §2.3, §3.18): a single-villain `HOOD_SCENARIOS` record, built like
 * `buildMtsSingleVillain` but with the pack's own "set aside 7 modular sets, shuffle 1 in" setup passed to the
 * engine as `GameSetupConfig.setAsideModularSets`, and `difficulty` threaded through so the villain's own
 * `modeOnly`-faced cards (Formidable Foe) enter play on the right side (§1.8/§3.18). */
function buildHoodSingleVillain(
  scenario: (typeof HOOD_SCENARIOS)[number],
  options: Wave4ScenarioOptions,
): GameSetupConfig {
  const difficulty = difficultyOf(resolveModes(options.difficulty, options.modes));
  const villain = cardsById.get(scenario.villainCardId);
  if (!villain || villain.type !== "villain") throw new Error(`${scenario.villainCardId} is not a villain`);
  const side = villain.sides[0];
  if (!side) throw new Error(`${villain.name} has no sides`);
  const stageIndex = (stageNumber: number): number => {
    const index = side.stages.findIndex((stage) => stage.stageNumber === stageNumber);
    if (index < 0) throw new Error(`${villain.name} has no stage ${stageNumber}`);
    return index;
  };
  const [firstStage, lastStage] = scenario.villainStages[difficulty];
  const sets = [
    ...scenario.encounterSetIds,
    ...scenario.standardEncounterSetIds,
    ...(difficulty === "expert" ? scenario.expertEncounterSetIds : []),
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  const setAsideSetIds =
    options.setAsideModularSetIds ?? HOOD_MODULAR_SET_IDS.slice(0, scenario.setAsideModularSetCount);
  if (setAsideSetIds.length !== scenario.setAsideModularSetCount) {
    throw new Error(`${scenario.name}: expected ${scenario.setAsideModularSetCount} set-aside modular sets`);
  }
  const setAsideModularSets = setAsideSetIds.map((encounterSetId) => ({
    encounterSetId,
    cardIds: wave4EncounterCardsOf([encounterSetId]),
  }));
  return {
    seed: options.seed,
    cards: WAVE4_CARDS,
    villainCardId: scenario.villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageIndex(firstStage),
    villainLastStageIndex: stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: wave4EncounterCardsOf(sets),
    players: seatsOf(options.players),
    setAsideModularSets,
    ...(difficulty === "expert" ? { difficulty: "expert" as const } : {}),
    includeIdentitySets: true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

/** A wave 4 (Nebula, War Machine, Vision, Valkyrie) or Core/box (The Mad Titan's Shadow) starter deck as a player
 * seat (quantities expanded). */
export function wave4StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter =
    NEBU_STARTER_DECKS.find((d) => d.id === starterDeckId) ??
    WARM_STARTER_DECKS.find((d) => d.id === starterDeckId) ??
    VALK_STARTER_DECKS.find((d) => d.id === starterDeckId) ??
    VISION_STARTER_DECKS.find((d) => d.id === starterDeckId) ??
    MTS_STARTER_DECKS.find((d) => d.id === starterDeckId) ??
    CORE_STARTER_DECKS.find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 4 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId as CardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave4StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as CardId,
      deck: seat.deck as readonly CardId[],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });

export function wave4Scenario(scenarioId: string, options: Wave4ScenarioOptions) {
  const mts = MTS_SCENARIOS.find((s) => s.id === scenarioId);
  if (mts) return buildMtsSingleVillain(mts, options);
  const hood = HOOD_SCENARIOS.find((s) => s.id === scenarioId);
  if (hood) return buildHoodSingleVillain(hood, options);
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = wave4StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: setup.identityCardId,
      deck: setup.deck,
      ...(setup.aspects ? { aspects: setup.aspects } : {}),
    };
  });
  return coreScenario(scenarioId, { ...options, players, cardPool: WAVE4_CARDS });
}
