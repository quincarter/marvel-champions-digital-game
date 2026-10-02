import {
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
  resolveModes,
  type CoreDifficulty,
  type CorePlayer,
  type CoreScenarioOptions,
} from "../core/setup.js";
import { WAVE6_CARDS } from "./cards.js";
import { MYSTIQUE_SCENARIO_RULES } from "./mut_gen/mystique.js";

export type Wave6Difficulty = CoreDifficulty;

export interface Wave6ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave6Difficulty;
}

/** `Scenario.victoryCondition`'s mode key (`wave4/setup.ts`'s own helper). */
function victoryConditionModeOf(modes: ReturnType<typeof resolveModes>): "skirmish" | "standard" | "expert" | "heroic" {
  if (modes.skirmish) return "skirmish";
  if (modes.heroic) return "heroic";
  return difficultyOf(modes);
}

const cardsById = new Map<string, AnyCard>(WAVE6_CARDS.map((card) => [card.id, card]));

/** The six MojoMania genre sets: the only modular sets Spiral and Mojo may use (docs/phase7-wave6.md §4 Q44). */
const GENRE_SET_IDS: readonly string[] = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];

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
 * Remove an entry when its engine row and scenario scripting land.
 */
const NOT_YET_SUPPORTED: Readonly<Record<string, string>> = {
  // 1 + 1[per_hero] genre sets are chosen and set aside (`Scenario.setAsideModularSetCount` has no per-player part)
  // and the choice is limited to the genre sets (§3.63).
  mojo: "not yet supported: §3.63 (Mojo's per-player count of set-aside genre sets and genre-only modular pool)",
};

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
 * The modular sets this game uses. MaGog and Spiral print their modular sets as a pool of the six genre sets, not a
 * list to shuffle in whole (MaGog: 1 random genre set recommended; Spiral: 3 required), and the schema cannot say
 * "pick N of the pool" yet (§3.63), so the caller must name them.
 */
function modularSetsOf(scenario: Scenario, options: Wave6ScenarioOptions): readonly string[] {
  if (scenario.packCode !== "mojo") return options.modularSetIds ?? scenario.recommendedModularSetIds;
  const chosen = options.modularSetIds;
  const count = scenario.modularSetCount ?? 1;
  if (!chosen) {
    throw new Error(
      `${scenario.name}: not yet supported: §3.63 (a genre-only modular pool; pass modularSetIds with ${count} genre set(s))`,
    );
  }
  if (chosen.length !== count) throw new Error(`${scenario.name} uses ${count} modular set(s), got ${chosen.length}`);
  const bad = chosen.filter((id) => !GENRE_SET_IDS.includes(id));
  if (bad.length > 0) throw new Error(`${scenario.name}: ${bad.join(", ")} is not a MojoMania genre set (Q44)`);
  return chosen;
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
  const sets = [
    ...scenario.encounterSetIds,
    ...modularSetsOf(scenario, options),
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
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
    encounterDeck: withoutBackFaces(encounterCardsOf(sets, WAVE6_CARDS)),
    players: seatsOf(options.players),
    // Cards the scenario's own setup puts into play from outside its sets (Master Mold's Magneto ally, §1.8).
    ...(scenario.setAsideCardIds || SETASIDE_BY_SCENARIO[scenario.id]
      ? { setAside: [...(scenario.setAsideCardIds ?? []), ...(SETASIDE_BY_SCENARIO[scenario.id] ?? [])] }
      : {}),
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
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = wave6StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: setup.identityCardId,
      deck: setup.deck,
      ...(setup.aspects ? { aspects: setup.aspects } : {}),
    };
  });
  return coreScenario(scenarioId, { ...options, players, cardPool: WAVE6_CARDS });
}
