import {
  CORE_STARTER_DECKS,
  cardId,
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
import {
  playerId,
  type GameSetupConfig,
  type ScenarioSetupInstruction,
  type PlayerSetup,
  type VillainChoiceSetup,
} from "@mc/engine";
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
import {
  chosen,
  eachPlayer,
  encounterSetAside,
  forEachPlayer,
  putIntoPlay,
  query,
  selectCards,
  thatPlayer,
} from "../dsl/index.js";
import { WAVE11_CARDS } from "./cards.js";

/**
 * The choices of one wave 11 game (Fear No Evil, MC60). The main scheme is the scenario id; the villain is an option
 * (docs/phase7-wave11-scenarios.md §S1.1, §S3.3).
 *
 * - `villainSetId`: one of the record's `villainOptions` by its villain set ("hammerhead", "typhoid_mary"). Absent is
 *   the record's default (MC60 p. 8's first, Hammerhead). Refused at a scenario whose villain is not a choice (Kingpin)
 *   and at a card-keyed choice, where it is read as `villainCardId` when it names one of the options' villain cards:
 *   in a campaign it is `CampaignGameStart.villain`, which the node's `composeVillain` named (MC60 p. 9 step 5; at
 *   Shadowland's card-keyed choice the campaign draws the villain card, MC65 p. 5).
 * - `villainCardId`: at a card-keyed choice (`villainOptions.keyedBy: "card"`, Shadowland's six Dark Protégé villains
 *   in one set), one option by its villain card ("65013a"). Absent or `"random"`: drawn by the engine with the game's
 *   seeded RNG where the record says `selection: "random"` ("Choose 1 random villain from that set"), else the
 *   default card. Refused at every other scenario.
 * - `mainSchemePicks`: at a scenario with a main scheme per player (`Scenario.mainSchemeChoice`, Protection Racket), each
 *   seat's main scheme card in seat order. Required in standard mode ("Each player chooses"), refused in expert mode
 *   ("at random in expert mode", drawn by the engine from the game seed) and at every other scenario.
 * - `difficulty` / `modes`, `modularSetIds`, `difficultySets`, `extraModularSetIds`: as at every other builder.
 */
export interface Wave11ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: CoreDifficulty;
  readonly villainSetId?: string;
  readonly villainCardId?: string;
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
  if (choice.keyedBy === "card") {
    // Every option shares one set (Dark Protégé), so a set names none of them: the default card's option.
    if (villainSetId !== undefined)
      throw new Error(`${scenario.name}: its villains share one encounter set; choose one by villainCardId`);
    return cardKeyedOption(scenario, choice.defaultCardId);
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
  // A card-keyed choice is resolved by the engine at setup (`villainChoiceOf`), not by rewriting the record.
  if (!option || scenario.villainOptions?.keyedBy === "card") return scenario;
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

/** What a card-keyed choice's `villainCardId` is given to leave the pick to the game's seeded draw. */
export const RANDOM_VILLAIN = "random";

/** Whether `villainCardId` is one of a card-keyed choice's villain cards. */
function cardKeyedHasOption(scenario: Scenario, villainCardId: string | undefined): boolean {
  return (scenario.villainOptions?.options ?? []).some((option) => option.villainCardId === villainCardId);
}

/** A card-keyed choice's option by its villain card, or a throw naming the options. */
function cardKeyedOption(scenario: Scenario, villainCardId: string | undefined): VillainOption {
  const options = scenario.villainOptions?.options ?? [];
  const option = options.find((candidate) => candidate.villainCardId === villainCardId);
  if (!option)
    throw new Error(
      `${scenario.name}: ${villainCardId ?? "no card"} is not one of its villains (${options.map((o) => o.villainCardId).join(", ")})`,
    );
  return option;
}

/**
 * A card-keyed villain choice (`villainOptions.keyedBy: "card"`; docs/phase7-shadowland.md §4.1) as the engine's
 * `GameSetupConfig.villainChoice`, or null at a scenario without one. `villainCardId` picks an option; absent or
 * `"random"` leaves the draw to the engine's seeded RNG when the record's `selection` is `"random"`, and is the default
 * card otherwise. The options carry their `linkedCardIds`: the chosen villain's are shuffled into the encounter deck,
 * the rest of the set waits set aside (RRG 1.8 "Linked", p. 27; Shadows in the Night 1A, Shadow Labyrinth 1A).
 * Throws for a card that is not an option, and for a card at a scenario whose choice is not card-keyed.
 *
 * Hidden while set aside (rules expert, reading (a)): 65038A prints no "reveal" (unlike 65001A "and reveal its side
 * A"); 65039 2A "Reveal the chosen villain's side A" and 65040 "side A faceup" are the first reveals, so the choice and
 * the unchosen linked cards stay facedown while set aside. RRG 1.8 "Set Aside" p. 39 is silent on visibility; engine
 * reading from the card text (docs/phase7-shadowland.md).
 */
export function villainChoiceOf(scenario: Scenario, villainCardId?: string): VillainChoiceSetup | null {
  const choice = scenario.villainOptions;
  if (choice?.keyedBy !== "card") {
    if (villainCardId !== undefined)
      throw new Error(`${scenario.name}: the villain is not chosen by card here, got ${villainCardId}`);
    return null;
  }
  const random = choice.selection === "random";
  const asked = villainCardId === RANDOM_VILLAIN ? undefined : villainCardId;
  if (villainCardId === RANDOM_VILLAIN && !random)
    throw new Error(`${scenario.name}: the players choose the villain; it is not drawn at random`);
  const pick = asked ?? (random ? undefined : choice.defaultCardId);
  if (pick !== undefined) cardKeyedOption(scenario, pick);
  return {
    options: choice.options.map((option) => ({
      villainCardId: option.villainCardId,
      linkedCardIds: option.linkedCardIds ?? [],
    })),
    ...(pick !== undefined ? { pick: pick as CardId } : {}),
    chosenVillain: choice.chosenVillain ?? "inPlay",
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

const HEART_OF_SHADOW = "heart-of-shadow";
/** Creeping Corruption (Black Flower 72A). */
const CREEPING_CORRUPTION_ID = cardId("65072a");

/**
 * "Each player puts a Creeping Corruption upgrade into play. Set the rest aside" for a standalone game (Setup keyword,
 * Max 1 per player). It resolves as scenario text after Appendix II step 12 rather than at step 11, which no effect
 * between the two can tell apart: the copies are held back from step 11 so that all four do not land under one player.
 */
const PUT_CREEPING_CORRUPTION: ScenarioSetupInstruction = {
  id: "black_flower.creeping-corruption",
  text: "Each player puts a Creeping Corruption upgrade (72A) into play. Set the rest aside.",
  citation: "MC65 pp. 4, 9; RRG 1.8 Setup (Keyword)",
  effects: [
    forEachPlayer(
      eachPlayer,
      selectCards("cc", encounterSetAside(query("upgrade", { printedId: CREEPING_CORRUPTION_ID }), { random: 1 })),
      putIntoPlay(chosen("cc"), thatPlayer),
    ),
  ],
};

/** Every printed copy of Creeping Corruption (72A). */
function creepingCorruptionCopies(): CardId[] {
  const card = WAVE11_CARDS.find((c) => (c.id as string) === "65072a");
  if (!card) throw new Error("Creeping Corruption (65072a) is not in the wave 11 card pool");
  return Array.from({ length: card.quantityInSet }, () => card.id);
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
 * The villain fields of a game whose card-keyed choice puts the chosen villain in play (`chosenVillain: "inPlay"`):
 * the pick's when there is one. A random draw happens in the engine, after this config is built, so every option must
 * start on the same side and stage indexes and none may carry its own victory or expert card: the config's fields then
 * hold whichever is drawn (the engine puts the drawn card in `villainCardId`'s place). Throws when they differ, rather
 * than build a game whose stages fit one villain only.
 */
function chosenVillainPlan<
  Plan extends { readonly side: { readonly side: string }; readonly start: number; readonly last: number },
>(record: Scenario, choice: VillainChoiceSetup, planOf: (option: VillainOption) => Plan): Plan {
  const options = record.villainOptions!.options;
  // `villainPlan` starts an `expertVillains` card at its own first stage; a chosen villain has no such card.
  if (record.expertVillains)
    throw new Error(`${record.name}: a card-keyed villain choice cannot be combined with expertVillains`);
  for (const option of options)
    if (option.victory !== undefined || option.expertVillainCardId !== undefined)
      throw new Error(`${record.name}: a card-keyed villain option cannot carry its own victory or expert villain`);
  const wanted = choice.pick ?? record.villainOptions!.defaultCardId ?? options[0]?.villainCardId;
  const chosen = cardKeyedOption(record, wanted);
  const plan = planOf(chosen);
  if (choice.pick === undefined)
    for (const option of options) {
      const other = planOf(option);
      if (other.side.side !== plan.side.side || other.start !== plan.start || other.last !== plan.last)
        throw new Error(
          `${record.name}: its villains start on different sides or stages; a random draw needs them alike`,
        );
    }
  return plan;
}

/**
 * A wave 11 scenario's `GameSetupConfig` from a scenario record and the players' choices (RRG 1.8 Appendix II, p. 51;
 * MC60 p. 5). Throws for a choice the rules forbid.
 *
 * - **Villain** (§S3.3): the chosen option's card, started at the difficulty's first stage and ending at its last
 *   (I-II standard, II-III expert; Typhoid Mary A standard, B expert, MC60 p. 5), and its victory (Typhoid Mary's
 *   Disturbed Psyche wins the game, so `"cardAbility"`). An `expertVillains` card (Kingpin's B1/B2) replaces the villain
 *   in expert mode, started at its first stage. A card-keyed choice (Shadowland's Dark Protégé) is passed to the engine
 *   as `villainChoice` (`villainChoiceOf`): it draws the villain, shuffles that villain's linked cards in and sets the
 *   rest of the set aside, the chosen card being the villain (`"inPlay"`) or set aside beside the record's own villain
 *   (`"setAside"`, Shadow Labyrinth's Shifting Corridors).
 * - **Encounter deck**: the scenario's sets with the chosen villain's, the modular sets, and the Standard (plus Expert)
 *   sets, a double-sided card once by its front face. Permanent and Setup cards stay in it: the villains' and stage
 *   1A's Setup texts find them there, and step 11 puts setup cards into play (RRG 1.8 "Find", "Setup (Keyword)").
 * - **Main schemes**: one per player where the record says so (`mainSchemeChoice`).
 */
export function buildWave11Scenario(record: Scenario, options: Wave11ScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(record.id, options.setupOptions);
  // A card-keyed choice has no villain set to name (its six villains share one), so the drawn villain card comes in
  // `villainCardId` (the client's campaign launcher passes it). Back-compat path: a card id handed in `villainSetId`
  // (the field campaign callers used to fill from `CampaignGameStart.villain`) is still read as the villain card.
  const keyed = record.villainOptions?.keyedBy === "card";
  const campaignVillainCard =
    keyed && options.villainCardId === undefined && cardKeyedHasOption(record, options.villainSetId)
      ? options.villainSetId
      : undefined;
  const scenario = scenarioWithVillain(record, campaignVillainCard === undefined ? options.villainSetId : undefined);
  const villainChoice = villainChoiceOf(record, options.villainCardId ?? campaignVillainCard);
  const modes = resolveModes(options.difficulty, options.modes);
  const difficulty = difficultyOf(modes);
  const expertVillain = difficulty === "expert" ? scenario.expertVillains : undefined;
  /** A villain card's first side and the stage indexes `stages[difficulty]` names on it. */
  const villainPlan = (cardId: CardId, stages: Scenario["villainStages"]) => {
    const villain = cardsById.get(cardId);
    if (!villain || villain.type !== "villain") throw new Error(`${cardId} is not a villain`);
    const side = villain.sides[0];
    if (!side) throw new Error(`${villain.name} has no sides`);
    const stageIndex = (stageNumber: number): number => {
      const index = side.stages.findIndex((stage) => stage.stageNumber === stageNumber);
      if (index < 0) throw new Error(`${villain.name} has no stage ${stageNumber}`);
      return index;
    };
    const [firstStage, lastStage] = stages[difficulty];
    return {
      villainCardId: cardId,
      side,
      // An `expertVillains` card is its own card whose printed stage need not match `villainStages`.
      start: expertVillain ? 0 : stageIndex(firstStage),
      last: expertVillain ? side.stages.length - 1 : stageIndex(lastStage),
    };
  };
  const plan =
    villainChoice?.chosenVillain === "inPlay"
      ? chosenVillainPlan(record, villainChoice, (option) => villainPlan(option.villainCardId, option.villainStages))
      : villainPlan(expertVillain ? expertVillain.villainCardId : scenario.villainCardId, scenario.villainStages);
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
  // Creeping Corruption (72A, Setup, Max 1 per player) is a player-typed card with no encounter back, so no encounter
  // set lists it. Black Flower brings the four copies, set aside and held back from Appendix II step 11 (which would
  // put every Setup copy into the first player's area), for a Setup text to put one into play per player and leave the
  // rest aside: Heart of Shadow's 1A, or the standalone step below. Shadows in the Night and Shadow Labyrinth in a
  // campaign get theirs from the campaign (`campaigns/shadowland.ts` composes four copies set aside,
  // `CampaignGameInput.setAsideCards`), so every game of the pack holds the card back from step 11, whichever side
  // supplied the copies.
  const creepingCorruption = sets.includes("black_flower") ? creepingCorruptionCopies() : [];
  const heldBack = scenario.packCode === "shadowland" ? [CREEPING_CORRUPTION_ID] : creepingCorruption;
  // A standalone game with Black Flower as a modular set (Shadows in the Night, Shadow Labyrinth, any other scenario):
  // 72A is "Permanent. Setup. Max 1 per player", so each player begins with one in play and the rest stay aside (RRG 1.8
  // "Setup (Keyword)", Appendix II step 11; engine reading, the rules expert has not ruled). Heart of Shadow's own 1A
  // does this, and a campaign's scenarios 1 and 2 never list Black Flower as a set (it is composed), so neither gets
  // the step.
  const standaloneCorruption = creepingCorruption.length > 0 && record.id !== HEART_OF_SHADOW;
  const setAside = [...(scenario.setAsideCardIds ?? []), ...creepingCorruption];
  const scenarioDecks = [...(scenario.separateDecks ?? []), ...setSeparateDecks(sets)];
  return {
    seed: options.seed,
    cards: WAVE11_CARDS,
    villainCardId: plan.villainCardId,
    villainSide: plan.side.side,
    villainStartStageIndex: plan.start,
    villainLastStageIndex: plan.last,
    ...(villainChoice ? { villainChoice } : {}),
    mainSchemeCardId: scenario.mainSchemeCardId,
    ...(mainSchemeChoice ? { mainSchemeChoice } : {}),
    // The modular set's Setup cards are listed in the deck; the copies of 72A are the set-aside ones above, never these.
    encounterDeck:
      creepingCorruption.length > 0 ? encounterDeck.filter((id) => id !== CREEPING_CORRUPTION_ID) : encounterDeck,
    players: seatsOf(options.players),
    ...(setAside.length > 0 ? { setAside } : {}),
    ...(standaloneCorruption ? { scenarioSetupInstructions: [PUT_CREEPING_CORRUPTION] } : {}),
    ...(heldBack.length > 0 ? { setAsideUntilCalled: { cardIds: [...new Set(heldBack)] } } : {}),
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
