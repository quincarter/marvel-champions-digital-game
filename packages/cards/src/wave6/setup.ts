import {
  CORE_SCENARIOS,
  CORE_STARTER_DECKS,
  CYCLOPS_STARTER_DECKS,
  GAMBIT_STARTER_DECKS,
  MOJO_SCENARIOS,
  MOJO_STARTER_DECKS,
  MUT_GEN_SCENARIOS,
  MUT_GEN_STARTER_DECKS,
  PHOENIX_STARTER_DECKS,
  ROGUE_STARTER_DECKS,
  STORM_STARTER_DECKS,
  WOLV_STARTER_DECKS,
  cardId,
  difficultyEncounterSetIds,
  difficultyOf,
  type AnyCard,
  type CardId,
  type Scenario,
} from "@mc/content";
import type { GameSetupConfig, PlayerSetup } from "@mc/engine";
import {
  checkScenarioSetupOptions,
  coreScenario,
  encounterCardsOf,
  modularSetupCardIds,
  resolveModes,
  type CoreDifficulty,
  type CorePlayer,
  type CoreScenarioOptions,
} from "../core/setup.js";
import { PLAYABLE_ENCOUNTER_SETS, chooseModularSets, extraModularCardIds } from "../modular-pool.js";
import { WAVE6_CARDS } from "./cards.js";
import { MYSTIQUE_SCENARIO_RULES } from "./mut_gen/mystique.js";

export type Wave6Difficulty = CoreDifficulty;

export interface Wave6ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave6Difficulty;
  /** A scenario that sets modular sets aside (Mojo): which. Absent: random picks from its pool (§3.63). */
  readonly setAsideModularSetIds?: readonly string[];
  /** Extra modular sets shuffled in on top, never counted (Longshot; docs/phase7-wave6.md §4 Q43). */
  readonly extraModularSetIds?: readonly string[];
}

/**
 * Every encounter set a game can name (`chooseModularSets` checks picks against these): MaGog's pool is unrestricted
 * (39002a), so a modular set of any box is a legal pick, not only Core's and cycle 6's.
 */
const ENCOUNTER_SETS = PLAYABLE_ENCOUNTER_SETS;

/** `Scenario.victoryCondition`'s mode key (`wave4/setup.ts`'s own helper). */
function victoryConditionModeOf(modes: ReturnType<typeof resolveModes>): "skirmish" | "standard" | "expert" | "heroic" {
  if (modes.skirmish) return "skirmish";
  if (modes.heroic) return "heroic";
  return difficultyOf(modes);
}

const cardsById = new Map<string, AnyCard>(WAVE6_CARDS.map((card) => [card.id, card]));

/**
 * Cards a scenario's own Setup sets aside that no encounter set sweeps into the game (`Scenario.setAsideCardIds` is
 * for cards a Setup puts into play; these are left out of play until a card asks for them): Project Wideawake's four
 * Captive allies ("Set each Captive ally aside", 32087a), which Abduction Protocols takes from at random. They carry
 * no `encounterSetIds` (`wave2/setup.ts`'s `SETASIDE_BY_SCENARIO` is the same shape for Taskmaster's). Sabretooth's
 * Robert Kelly likewise.
 */
const SETASIDE_BY_SCENARIO: Readonly<Record<string, readonly CardId[]>> = {
  "project-wideawake": [cardId("32089"), cardId("32090"), cardId("32091"), cardId("32092")],
  // Robert Kelly (32066, a scenario-specific ally with no encounter set): 32063a's Setup attaches him to Find the Senator.
  sabretooth: [cardId("32066")],
};

/**
 * Scenarios `wave6Scenario` refuses to build, each with the §3 row it waits on, rather than building a wrong game.
 * Add an entry for a scenario whose engine row or scripting has not landed.
 */
const NOT_YET_SUPPORTED: Readonly<Record<string, string>> = {};

/**
 * A double-sided encounter card whose two faces are both emitted as cards of the same set (Find the Senator 32065a /
 * Protect the Senator 32065b, `mut_gen`) is one card in the deck: its front face. `encounterCardsOf` only drops the
 * back of a villain or main scheme, so the back (the face whose `otherFaceId` is also in the deck, sorted later) is
 * left out here; it enters play by the front flipping.
 */
function withoutBackFaces(deck: readonly CardId[]): CardId[] {
  const inDeck = new Set<string>(deck);
  return deck.filter((id) => {
    const other = cardsById.get(id)?.otherFaceId;
    return other === undefined || !inDeck.has(other) || String(id) < String(other);
  });
}

/**
 * A single-villain `MUT_GEN_SCENARIOS` / `MOJO_SCENARIOS` record, modeled on `wave5/setup.ts`'s
 * `buildSmSingleVillain`. `expertVillains` (MaGog's second face; Mansion Attack's B sides) replaces the villain in
 * expert mode as wave 4's builder does, `setAsideCardIds` (Master Mold's Magneto 32172b) goes to
 * `GameSetupConfig.setAside`, and a random start (Mansion Attack) passes the set-aside villains through.
 */
function buildSingleVillain(scenario: Scenario, options: Wave6ScenarioOptions): GameSetupConfig {
  const unsupported = NOT_YET_SUPPORTED[scenario.id];
  if (unsupported) throw new Error(`${scenario.name}: ${unsupported}`);
  const modes = resolveModes(options.difficulty, options.modes);
  const difficulty = modes.expert ? "expert" : "standard";
  const expertVillain = difficulty === "expert" ? scenario.expertVillains : undefined;
  const villainCardId = expertVillain ? expertVillain.villainCardId : scenario.villainCardId;
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
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  // §3.63: a pool (MojoMania's genre sets), a per-player set-aside count and extra sets that never count (Longshot).
  const modular = chooseModularSets(scenario, ENCOUNTER_SETS, { ...options, playerCount: options.players.length });
  const sets = [
    ...scenario.encounterSetIds,
    ...modular.modularSetIds,
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
  return {
    seed: options.seed,
    cards: WAVE6_CARDS,
    villainCardId,
    villainSide: side.side,
    // An `expertVillains` card is its own one-stage card whose printed stage number need not match the record's
    // `villainStages` (MaGog's 39001b and Mansion Attack's 32121b-32124b are stage 2, the records say [1, 1]), so it runs from its first stage to its last.
    villainStartStageIndex: expertVillain ? 0 : stageIndex(firstStage),
    villainLastStageIndex: expertVillain ? side.stages.length - 1 : stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: [
      ...withoutBackFaces(encounterCardsOf(sets, WAVE6_CARDS)),
      ...modularSetupCardIds(modular.modularSetIds, WAVE6_CARDS),
      ...extraModularCardIds(modular.extraModularSetIds, WAVE6_CARDS),
    ],
    players: seatsOf(options.players),
    // Cards the scenario's own setup puts into play from outside its sets (Master Mold's Magneto ally, §1.8).
    ...(scenario.setAsideCardIds || SETASIDE_BY_SCENARIO[scenario.id]
      ? { setAside: [...(scenario.setAsideCardIds ?? []), ...(SETASIDE_BY_SCENARIO[scenario.id] ?? [])] }
      : {}),
    ...(modular.setAsideModularSetIds.length > 0
      ? {
          setAsideModularSets: modular.setAsideModularSetIds.map((encounterSetId) => ({
            encounterSetId,
            cardIds: withoutBackFaces(encounterCardsOf([encounterSetId], WAVE6_CARDS)),
          })),
        }
      : {}),
    // The scenario's own scenario decks (the campaign's Future Past deck, docs/phase7-wave6.md §3.24).
    ...(scenario.separateDecks ? { scenarioDecks: scenario.separateDecks } : {}),
    ...(expertVillain ? { setAsideVillainCardIds: expertVillain.setAsideVillainCardIds } : {}),
    ...(scenario.startingVillain === "random"
      ? {
          randomStartingVillain: true as const,
          setAsideVillainCardIds: (expertVillain ?? scenario).setAsideVillainCardIds ?? [],
        }
      : {}),
    ...(scenario.victoryCondition
      ? { victoryCondition: scenario.victoryCondition[victoryConditionModeOf(modes)] }
      : {}),
    ...(scenario.victory ? { victory: scenario.victory } : {}),
    includeIdentitySets: true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(difficulty === "expert" ? { difficulty: "expert" as const } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
    // Mystique's treacheries stay in the hand they are drawn to (MC32 p. 7; docs/phase7-wave6.md §3.10).
    ...(sets.includes("mystique") ? { scenarioRuleSpecs: MYSTIQUE_SCENARIO_RULES } : {}),
  };
}

/** A wave 6 hero pack, the Mutant Genesis box, or a Core starter deck as a player seat (quantities expanded). */
export function wave6StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = [
    ...MUT_GEN_STARTER_DECKS,
    ...CYCLOPS_STARTER_DECKS,
    ...PHOENIX_STARTER_DECKS,
    ...WOLV_STARTER_DECKS,
    ...STORM_STARTER_DECKS,
    ...GAMBIT_STARTER_DECKS,
    ...ROGUE_STARTER_DECKS,
    ...MOJO_STARTER_DECKS,
    ...CORE_STARTER_DECKS,
  ].find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 6 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId as CardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave6StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as CardId,
      deck: seat.deck as readonly CardId[],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });

/**
 * A `mut_gen` or `mojo` scenario's `GameSetupConfig` from its emitted `Scenario` record, the shape `wave5Scenario`
 * established. Falls through to `coreScenario` (Core scenarios seated with wave 6 content). Throws
 * "not yet supported: §3.x" for a scenario that needs an engine row not landed (`NOT_YET_SUPPORTED`).
 */
export function wave6Scenario(scenarioId: string, options: Wave6ScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(scenarioId, options.setupOptions);
  const record = [...MUT_GEN_SCENARIOS, ...MOJO_SCENARIOS].find((s) => s.id === scenarioId);
  if (record) return buildSingleVillain(record, options);
  // Longshot "can be included in any scenario" (insert p. 2; §4 Q43): a Core scenario's extra sets are checked, then
  // shuffled in on top of what `coreScenario` builds.
  const core = CORE_SCENARIOS.find((s) => s.id === scenarioId);
  const extra =
    core && options.extraModularSetIds
      ? chooseModularSets(core, ENCOUNTER_SETS, { ...options, playerCount: options.players.length })
      : undefined;
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = wave6StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: setup.identityCardId,
      deck: setup.deck,
      ...(setup.aspects ? { aspects: setup.aspects } : {}),
    };
  });
  const config = coreScenario(scenarioId, { ...options, players, cardPool: WAVE6_CARDS });
  if (!extra) return config;
  return {
    ...config,
    encounterDeck: [...(config.encounterDeck ?? []), ...extraModularCardIds(extra.extraModularSetIds, WAVE6_CARDS)],
  };
}
