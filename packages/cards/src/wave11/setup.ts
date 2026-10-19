import {
  CORE_STARTER_DECKS,
  WAVE11_ENCOUNTER_SETS,
  WAVE11_SCENARIOS,
  WAVE11_STARTER_DECKS,
  difficultyEncounterSetIds,
  difficultyOf,
  difficultySetChoiceErrors,
  type AnyCard,
  type CardId,
  type EncounterSet,
  type Scenario,
  type VillainOption,
} from "@mc/content";
import { playerId, type GameSetupConfig, type PlayerSetup } from "@mc/engine";
import {
  checkScenarioSetupOptions,
  encounterCardsOf,
  modularSetupCardIds,
  resolveModes,
  setSeparateDecks,
  type CoreDifficulty,
  type CorePlayer,
  type CoreScenarioOptions,
} from "../core/setup.js";
import {
  PLAYABLE_ENCOUNTER_SETS,
  checkModularPickCount,
  chooseModularSets,
  extraModularCardIds,
} from "../modular-pool.js";
import { withoutBackFaces } from "../wave9/setup.js";
import { WAVE11_CARDS } from "./cards.js";

/**
 * The choices of one wave 11 game (Fear No Evil, MC60). The main scheme is the scenario id; the villain is an option
 * (docs/phase7-wave11-scenarios.md §S1.1, §S3.3).
 *
 * - `villainSetId`: one of the record's `villainOptions` by its villain set ("hammerhead", "typhoid_mary"). Absent is
 *   the record's default (MC60 p. 8's first, Hammerhead). Refused at a scenario whose villain is not a choice (Kingpin).
 *   In a campaign it is `CampaignGameStart.villain`, which the node's `composeVillain` named (MC60 p. 9 step 5).
 * - `mainSchemePicks`: at a scenario with a main scheme per player (`Scenario.mainSchemeChoice`, Protection Racket), each
 *   seat's main scheme card in seat order. Required in standard mode ("Each player chooses"), refused in expert mode
 *   ("at random in expert mode", drawn by the engine from the game seed) and at every other scenario.
 * - `difficulty` / `modes`, `modularSetIds`, `difficultySets`, `extraModularSetIds`: as at every other builder.
 */
export interface Wave11ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: CoreDifficulty;
  readonly villainSetId?: string;
  readonly mainSchemePicks?: readonly string[];
  /** Extra modular sets shuffled in on top, never counted (`EncounterSet.extraModular`). */
  readonly extraModularSetIds?: readonly string[];
}

/**
 * Every encounter set a wave 11 game can name: the playable sets and the wave's own. The wave is not joined to
 * `PLAYABLE_ENCOUNTER_SETS` yet, so its sets are added here (each once, the playable record first).
 */
export const WAVE11_GAME_ENCOUNTER_SETS: readonly EncounterSet[] = (() => {
  const seen = new Set<string>();
  return [...PLAYABLE_ENCOUNTER_SETS, ...WAVE11_ENCOUNTER_SETS].filter(
    (set) => !seen.has(set.id) && !!seen.add(set.id),
  );
})();

const cardsById = new Map<string, AnyCard>(WAVE11_CARDS.map((card) => [card.id, card]));

/** A `WAVE11_SCENARIOS` record, or a throw naming the id. */
export function wave11ScenarioRecord(scenarioId: string): Scenario {
  const record = WAVE11_SCENARIOS.find((scenario) => scenario.id === scenarioId);
  if (!record) throw new Error(`no wave 11 scenario ${scenarioId}`);
  return record;
}

/**
 * The villain option a game of `scenario` is played against: `villainSetId`'s, or the default when it is absent. Null at
 * a scenario whose villain is not a choice and no set was asked for. Throws for a set that is not one of the options,
 * and for any set at a scenario without options, rather than building a game against another villain silently.
 */
export function villainOptionOf(scenario: Scenario, villainSetId?: string): VillainOption | null {
  const choice = scenario.villainOptions;
  if (!choice) {
    if (villainSetId !== undefined)
      throw new Error(`${scenario.name}: the villain is not a setup choice (no villainOptions), got ${villainSetId}`);
    return null;
  }
  const wanted = villainSetId ?? choice.defaultSetId;
  const option = choice.options.find((candidate) => candidate.villainSetId === wanted);
  if (!option)
    throw new Error(
      `${scenario.name}: ${wanted} is not one of its villains (${choice.options.map((o) => o.villainSetId).join(", ")})`,
    );
  return option;
}

/**
 * `scenario` played against one of its villain options (docs/phase7-wave11-scenarios.md §S3.3): the option's villain
 * card, stages and victory in place of the record's, and its villain set in place of the default's among the
 * encounter sets (MC60 p. 9 step 6: "Gather your chosen main scheme, your chosen villain, and their corresponding
 * encounter sets"). The record is returned as it is for the default or a scenario without options.
 */
export function scenarioWithVillain(scenario: Scenario, villainSetId?: string): Scenario {
  const option = villainOptionOf(scenario, villainSetId);
  if (!option) return scenario;
  const defaultSetId = scenario.villainOptions!.defaultSetId;
  const { expertVillains: _expert, victory: _victory, ...rest } = scenario;
  return {
    ...rest,
    villainCardId: option.villainCardId,
    villainStages: option.villainStages,
    encounterSetIds: scenario.encounterSetIds.map((id) => (id === defaultSetId ? option.villainSetId : id)),
    ...(option.victory ? { victory: option.victory } : {}),
    ...(option.expertVillainCardId
      ? { expertVillains: { villainCardId: option.expertVillainCardId, setAsideVillainCardIds: [] } }
      : {}),
  };
}

/**
 * A wave 11 or Core starter deck as a player seat, quantities expanded. Another wave's precon is seated through
 * `playableScenario`, which resolves it to a deck list first.
 */
export function wave11StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = [...WAVE11_STARTER_DECKS, ...CORE_STARTER_DECKS].find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 11 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId as CardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
}

const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave11StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as CardId,
      deck: seat.deck as readonly CardId[],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });

/** `GameSetupConfig.mainSchemeChoice` from the record and the seats' picks (see `Wave11ScenarioOptions`). */
function mainSchemeChoiceOf(
  scenario: Scenario,
  options: Wave11ScenarioOptions,
  expert: boolean,
): GameSetupConfig["mainSchemeChoice"] {
  const choice = scenario.mainSchemeChoice;
  const picks = options.mainSchemePicks;
  if (!choice) {
    if (picks !== undefined) throw new Error(`${scenario.name}: there is one main scheme, not one per player`);
    return undefined;
  }
  if (expert) {
    if (picks !== undefined) throw new Error(`${scenario.name}: each main scheme is drawn at random in expert mode`);
    return { kind: choice.kind, cardIds: choice.cardIds };
  }
  if (picks === undefined || picks.length !== options.players.length)
    throw new Error(`${scenario.name}: each player chooses a main scheme (mainSchemePicks, one per seat)`);
  // The engine checks each pick (one of the cards, none twice); the seats are p1, p2, ... in seat order.
  return {
    kind: choice.kind,
    cardIds: choice.cardIds,
    picks: Object.fromEntries(picks.map((card, index) => [playerId(`p${index + 1}`), card as CardId])),
  };
}

/** A wave 11 scenario's `GameSetupConfig` from its record (`WAVE11_SCENARIOS`); see `buildWave11Scenario`. */
export function wave11Scenario(scenarioId: string, options: Wave11ScenarioOptions): GameSetupConfig {
  return buildWave11Scenario(wave11ScenarioRecord(scenarioId), options);
}

/**
 * Player-typed cards with an encounter back that belong to one of the game's sets through `specificTo` (a player card
 * type has no `encounterSetIds`): Shop Proprietor (60139), the Protection Racket set's ally, revealed from the encounter
 * deck ("When Revealed: Put Shop Proprietor into play under your control").
 */
function encounterBackedCardIds(sets: readonly string[]): CardId[] {
  const ids: CardId[] = [];
  for (const card of WAVE11_CARDS) {
    if (card.cardBack !== "encounter" || !("specificTo" in card) || card.specificTo?.kind !== "scenario") continue;
    if (!sets.includes(card.specificTo.encounterSetId)) continue;
    if ("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).length > 0) continue;
    for (let copy = 0; copy < card.quantityInSet; copy++) ids.push(card.id);
  }
  return ids;
}

/**
 * A wave 11 scenario's `GameSetupConfig` from a scenario record and the players' choices (RRG 1.8 Appendix II, p. 51;
 * MC60 p. 5). Throws for a choice the rules forbid.
 *
 * - **Villain** (§S3.3): the chosen option's card, started at the difficulty's first stage and ending at its last
 *   (I-II standard, II-III expert; Typhoid Mary A standard, B expert, MC60 p. 5), and its victory (Typhoid Mary's
 *   Disturbed Psyche wins the game, so `"cardAbility"`). An `expertVillains` card (Kingpin's B1/B2) replaces the villain
 *   in expert mode, started at its first stage.
 * - **Encounter deck**: the scenario's sets with the chosen villain's, the modular sets, and the Standard (plus Expert)
 *   sets, a double-sided card once by its front face. Permanent and Setup cards stay in it: the villains' and stage
 *   1A's Setup texts find them there, and step 11 puts setup cards into play (RRG 1.8 "Find", "Setup (Keyword)").
 * - **Main schemes**: one per player where the record says so (`mainSchemeChoice`).
 */
export function buildWave11Scenario(record: Scenario, options: Wave11ScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(record.id, options.setupOptions);
  const scenario = scenarioWithVillain(record, options.villainSetId);
  const modes = resolveModes(options.difficulty, options.modes);
  const difficulty = difficultyOf(modes);
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

  checkModularPickCount(scenario, options.modularSetIds);
  const modular = chooseModularSets(scenario, WAVE11_GAME_ENCOUNTER_SETS, {
    ...options,
    playerCount: options.players.length,
  });
  if (options.difficultySets) {
    const errors = difficultySetChoiceErrors(options.difficultySets, WAVE11_GAME_ENCOUNTER_SETS);
    if (errors.length > 0) throw new Error(`${scenario.name}: difficultySets: ${errors.join("; ")}`);
  }
  const mainSchemeChoice = mainSchemeChoiceOf(scenario, options, difficulty === "expert");

  const sets = [
    ...scenario.encounterSetIds,
    ...modular.modularSetIds,
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
  const encounterDeck = withoutBackFaces([
    ...encounterCardsOf(sets, WAVE11_CARDS),
    ...encounterBackedCardIds(sets),
    ...modularSetupCardIds(modular.modularSetIds, WAVE11_CARDS),
    ...extraModularCardIds(modular.extraModularSetIds, WAVE11_CARDS),
  ]);
  const scenarioDecks = [...(scenario.separateDecks ?? []), ...setSeparateDecks(sets)];
  return {
    seed: options.seed,
    cards: WAVE11_CARDS,
    villainCardId,
    villainSide: side.side,
    // An `expertVillains` card is its own card whose printed stage need not match `villainStages`.
    villainStartStageIndex: expertVillain ? 0 : stageIndex(firstStage),
    villainLastStageIndex: expertVillain ? side.stages.length - 1 : stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    ...(mainSchemeChoice ? { mainSchemeChoice } : {}),
    encounterDeck,
    players: seatsOf(options.players),
    ...(scenario.setAsideCardIds && scenario.setAsideCardIds.length > 0 ? { setAside: scenario.setAsideCardIds } : {}),
    ...(scenarioDecks.length > 0 ? { scenarioDecks } : {}),
    includeIdentitySets: scenario.usesIdentityEncounterSets ?? true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(scenario.victory ? { victory: scenario.victory } : {}),
    ...(difficulty === "expert" ? { difficulty: "expert" as const } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
    ...(options.stack ? { stack: options.stack } : {}),
    ...(options.gameMode !== undefined ? { gameMode: options.gameMode } : {}),
  };
}
