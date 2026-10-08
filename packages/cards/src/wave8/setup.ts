import {
  CORE_STARTER_DECKS,
  WAVE8_ENCOUNTER_SETS,
  WAVE8_SCENARIOS,
  WAVE8_STARTER_DECKS,
  autoIncludedSetsOf,
  difficultyEncounterSetIds,
  difficultySetChoiceErrors,
  type AnyCard,
  type CardId,
  type DifficultySetChoice,
  type EncounterSet,
  type Scenario,
} from "@mc/content";
import type { GameSetupConfig, PlayerSetup, VillainSetup } from "@mc/engine";
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
import { PLAYABLE_ENCOUNTER_SETS, chooseModularSets, extraModularCardIds } from "../modular-pool.js";
import { INFINITES_SET_ID, infinitesGenePoolThreat } from "./aoa/infinites.js";
import { WAVE8_CARDS } from "./cards.js";

export type Wave8Difficulty = CoreDifficulty;

/** Which printed version of a Horseman plays: side A (skirmish, standard) or side B (expert, heroic). MC45 p. 11. */
export type HorsemanSide = "A" | "B";

export interface Wave8ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave8Difficulty;
  /**
   * Four Horsemen only: the version each Horseman plays, in printed order (War, Famine, Pestilence, Death). MC45 p. 11:
   * "To play the scenario in skirmish or standard mode, use each villain's side A. To play the scenario in expert or
   * heroic mode, use each villain's side B." The choice is per villain (docs/phase7-wave8.md section 4.1 Q9 = B), so
   * the client picker starts every row at the mode's default (A in standard, B in expert or heroic) and lets the
   * player change each one; there is no "Extreme" label. Absent: the default for every Horseman. Any other scenario
   * refuses it.
   */
  readonly horsemanSides?: readonly [HorsemanSide, HorsemanSide, HorsemanSide, HorsemanSide];
  /**
   * The Infinites set's "Modular Difficulty" (MC45 p. 8; docs/phase7-wave8.md section 3.5, section 4.1 Q1 = A): threat
   * per player placed on Gene Pool during setup, 0 to 3, "up to the players as a group". It belongs to the encounter
   * set, not to a scenario: any game whose sets include `infinites` takes it (Unus and Apocalypse by their own sets,
   * any other scenario with Infinites as a modular pick), and a game without the set refuses it. Absent or 0 is off:
   * no threat is placed and nothing is logged, whatever the mode. The amount is never filled in from the difficulty;
   * `infinitesGenePoolThreatRecommendation` is only where a setup control starts.
   */
  readonly genePoolThreatPerPlayer?: number;
}

/** Whether a game built from these encounter sets offers `Wave8ScenarioOptions.genePoolThreatPerPlayer`. */
export const offersGenePoolThreat = (encounterSetIds: readonly string[]): boolean =>
  encounterSetIds.includes(INFINITES_SET_ID);

/**
 * Every encounter set a game can name (`chooseModularSets` checks picks against these): the playable pool's sets plus
 * wave 8's (the wave is not joined to the playable pool yet).
 */
const ENCOUNTER_SETS: readonly EncounterSet[] = [
  ...new Map([...PLAYABLE_ENCOUNTER_SETS, ...WAVE8_ENCOUNTER_SETS].map((set) => [set.id as string, set])).values(),
];

const cardsById = new Map<string, AnyCard>(WAVE8_CARDS.map((card) => [card.id, card]));

/**
 * Scenarios `wave8Scenario` refuses to build, each with the reason. None: all five Age of Apocalypse scenarios build a
 * game the card scripts can complete. Add an entry for a scenario whose engine row turns out to be needed first.
 */
const NOT_YET_SUPPORTED: Readonly<Record<string, string>> = {};

/**
 * Whether a scenario's Standard set may be replaced by another set of the Standard classification (Standard II,
 * Standard III): exactly when the scenario requires the one Standard set (docs/phase7-wave8.md section 3.6, section 4.1
 * Q10 = A: "Standard III may replace the Standard set on any scenario that uses it"; RRG 1.8 "Standard Set", p. 40). The
 * rule reads the scenario record and nothing else, so it holds for a scenario of any pack. A scenario that requires no
 * Standard set, or another one, has nothing to replace.
 */
export const standardSetReplaceable = (scenario: Pick<Scenario, "standardEncounterSetIds">): boolean =>
  scenario.standardEncounterSetIds.length === 1 && scenario.standardEncounterSetIds[0] === "standard";

/**
 * Refuses a Standard or Expert set choice that names no known set of the matching classification, and a Standard
 * choice at a scenario whose Standard set cannot be replaced. Standard III has no Expert partner: choosing it leaves the
 * Expert set as it was (the scenario's own, or an Expert alternative chosen on its own).
 */
function checkDifficultySets(scenario: Scenario, choice: DifficultySetChoice | undefined): void {
  if (!choice) return;
  const errors = difficultySetChoiceErrors(choice, ENCOUNTER_SETS);
  if (errors.length > 0) throw new Error(`${scenario.name}: difficultySets: ${errors.join("; ")}`);
  if (choice.standard !== undefined && !standardSetReplaceable(scenario))
    throw new Error(`${scenario.name}: difficultySets: the scenario does not use the Standard set`);
}

/** A double-sided encounter card whose two faces are both emitted as cards of one set is one card in the deck: its front face. */
function withoutBackFaces(deck: readonly CardId[]): CardId[] {
  const inDeck = new Set<string>(deck);
  return deck.filter((id) => {
    const other = cardsById.get(id)?.otherFaceId;
    return other === undefined || !inDeck.has(other) || String(id) < String(other);
  });
}

/** Sets that hold only villain and main scheme cards deal nothing and are skipped (`encounterCardsOf` refuses an empty set). */
function dealtSets(sets: readonly string[]): string[] {
  const setupTypes: readonly string[] = ["villain", "main_scheme"];
  return sets.filter((setId) =>
    WAVE8_CARDS.some(
      (card) =>
        "encounterSetIds" in card &&
        (card.encounterSetIds as readonly string[]).includes(setId) &&
        !setupTypes.includes(card.type),
    ),
  );
}

/**
 * Dark Beast's three Setting sets (Blue Moon, Genosha, Savage Land): Bogus Journey 1A's Setup (45121a, MC45 p. 16) "Set
 * the Blue Moon, Genosha, and Savage Land sets aside (including each environment card in those sets)", and Dark
 * Beast's When Revealed brings in a random set-aside environment. Each is a `setAsideModularSets` entry, and
 * `setAsideUntilCalled` keeps their environments' setup keyword from putting them into play at step 11 (RRG 1.8
 * Appendix II step 11, p. 51). They are the scenario's own sets, so they never count as modular picks.
 */
const SETTING_SETS: Readonly<Record<string, readonly string[]>> = {
  "dark-beast": ["blue_moon", "genosha", "savage_land"],
};

/** The Horsemen's side B card for a Horseman's side A card, and whether the scenario takes the per-villain choice. */
const horsemanCardId = (entry: { villainCardId: CardId; sideBCardId?: CardId }, side: HorsemanSide): CardId =>
  side === "B" ? (entry.sideBCardId ?? entry.villainCardId) : entry.villainCardId;

/** The index of `stageNumber` among the stages of `villain`'s side `sideLetter`. */
function stageIndexOf(villain: Extract<AnyCard, { type: "villain" }>, sideLetter: string, stageNumber: number): number {
  const side = villain.sides.find((s) => s.side === sideLetter);
  if (!side) throw new Error(`${villain.name} has no side ${sideLetter}`);
  const index = side.stages.findIndex((stage) => stage.stageNumber === stageNumber);
  if (index < 0) throw new Error(`${villain.name} has no stage ${stageNumber}`);
  return index;
}

const villainCard = (id: CardId): Extract<AnyCard, { type: "villain" }> => {
  const card = cardsById.get(id);
  if (!card || card.type !== "villain") throw new Error(`${id} is not a villain`);
  return card;
};

/**
 * A `WAVE8_SCENARIOS` record's `GameSetupConfig`, modeled on `wave7/setup.ts`'s `buildScenario`.
 *
 * - **Unus**: `unus` + `infinites` + Standard (+ Expert) + one modular set. Gene Pool (permanent, setup) is dealt with
 *   the Infinites set and enters play at step 11 with its printed 4 threat. The expert-mode facedown card per player
 *   is 45062a's own Setup.
 * - **Four Horsemen**: four villains (`villains`, one `sharedEncounterDeck`) that start set aside; 45085a's Setup puts
 *   them into play in a random row with the active counter on the leftmost, and each player reveals a random side
 *   scheme of the set. Each Horseman's version is picked per villain (`options.horsemanSides`, default from the
 *   difficulty).
 * - **Apocalypse**: the five Prelates (45179b to 45183b) and The Tyrant's Throne (45105a) are set aside
 *   (`Scenario.setAsideCardIds`); Heart of the Empire (45104a) is in the deck.
 * - **Dark Beast**: the Setting sets are set aside whole (`SETTING_SETS`).
 * - **En Sabah Nur**: one villain card with sides A, B and C over three stages, started on side A.
 */
function buildScenario(scenario: Scenario, options: Wave8ScenarioOptions): GameSetupConfig {
  const unsupported = NOT_YET_SUPPORTED[scenario.id];
  if (unsupported) throw new Error(`${scenario.name}: not yet supported: ${unsupported}`);
  if (options.horsemanSides && !scenario.multipleVillains)
    throw new Error(`${scenario.name}: horsemanSides belongs to the Four Horsemen scenario`);
  const modes = resolveModes(options.difficulty, options.modes);
  const difficulty = modes.expert ? "expert" : "standard";
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  const modular = chooseModularSets(scenario, ENCOUNTER_SETS, { ...options, playerCount: options.players.length });
  const settingSets = SETTING_SETS[scenario.id] ?? [];
  const ownSets = scenario.encounterSetIds.filter((id) => !settingSets.includes(id));
  // Standard III (or Standard II) in place of the Standard set, the Expert set unchanged (section 3.6, Q10 = A).
  checkDifficultySets(scenario, options.difficultySets);
  const sets = [
    ...ownSets,
    ...modular.modularSetIds,
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
  if (options.genePoolThreatPerPlayer !== undefined && !offersGenePoolThreat(sets))
    throw new Error(`${scenario.name}: genePoolThreatPerPlayer belongs to a game that uses the Infinites set`);
  // Off unless a player stated an amount above 0; the mode never fills one in (Q1 = A).
  const setupOptions = options.genePoolThreatPerPlayer
    ? [infinitesGenePoolThreat(options.genePoolThreatPerPlayer)]
    : [];
  const settingAside = settingSets.map((setId) => ({
    encounterSetId: setId,
    cardIds: withoutBackFaces(encounterCardsOf([setId], WAVE8_CARDS)),
  }));
  const inSettingSets = new Set<string>(settingAside.flatMap((entry) => entry.cardIds));
  // Cards the printed Setup sets aside one by one (the Prelates, The Tyrant's Throne), `quantityInSet` copies each.
  const setAside = (scenario.setAsideCardIds ?? [])
    .filter((id) => !inSettingSets.has(id))
    .flatMap((id) => {
      const card = cardsById.get(id);
      if (!card) throw new Error(`${scenario.name}: unknown set-aside card ${id}`);
      return Array.from({ length: "quantityInSet" in card ? card.quantityInSet : 1 }, () => id);
    });
  const setAsideIds = new Set<string>(setAside);
  // Back faces go first: a set-aside card's own back face must not be left behind in the deck.
  const dealt = withoutBackFaces(encounterCardsOf(dealtSets(sets), WAVE8_CARDS)).filter((id) => !setAsideIds.has(id));
  const encounterDeck = [
    ...dealt,
    ...modularSetupCardIds(modular.modularSetIds, WAVE8_CARDS),
    ...extraModularCardIds(modular.extraModularSetIds, WAVE8_CARDS),
  ];
  const seats = seatsOf(options.players);
  const common = {
    seed: options.seed,
    cards: WAVE8_CARDS,
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck,
    players: seats,
    // Sets a setup condition includes (Dreadpool, when a seat chose the 'Pool aspect): the engine decides.
    autoIncludedSets: autoIncludedSetsOf(ENCOUNTER_SETS, WAVE8_CARDS),
    ...(setAside.length > 0 ? { setAside } : {}),
    ...(settingAside.length > 0
      ? { setAsideModularSets: settingAside, setAsideUntilCalled: { encounterSetIds: settingSets } }
      : {}),
    ...(scenario.separateDecks || setSeparateDecks(sets).length > 0
      ? { scenarioDecks: [...(scenario.separateDecks ?? []), ...setSeparateDecks(sets)] }
      : {}),
    ...(scenario.victory ? { victory: scenario.victory } : {}),
    ...(setupOptions.length > 0 ? { setupOptions } : {}),
    includeIdentitySets: true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(difficulty === "expert" ? { difficulty: "expert" as const } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  } satisfies Partial<GameSetupConfig>;

  const multi = scenario.multipleVillains;
  if (multi) {
    if (multi.encounterDecks !== "shared")
      throw new Error(`${scenario.name}: only a shared encounter deck is built here`);
    const defaultSide: HorsemanSide = modes.expert || modes.heroic ? "B" : "A";
    const sides = options.horsemanSides ?? multi.villains.map(() => defaultSide);
    if (sides.length !== multi.villains.length)
      throw new Error(`${scenario.name}: expected ${multi.villains.length} Horseman sides, got ${sides.length}`);
    // Each Horseman card (A or B) is a one-stage villain on side "A"; the version is which card is in play.
    const villains: VillainSetup[] = multi.villains.map((entry, index) => {
      const villainCardId = horsemanCardId(entry, sides[index]!);
      villainCard(villainCardId);
      return {
        villainCardId,
        side: "A",
        startStageIndex: 0,
        lastStageIndex: 0,
        encounterDeck: [],
      };
    });
    if (multi.atSetup !== "setAside")
      throw new Error(`${scenario.name}: only villains that start set aside are built here`);
    // The four Horsemen start set aside (`MultipleVillains.atSetup`), and 45085a's Setup does the rest (section 3.7,
    // 3.15): it shuffles them into a row (`GameState.villainRow`, logged `villainRowSet`), places the active counter on
    // the leftmost, and has each player reveal a random Four Horsemen side scheme (45086 to 45089) from the shared
    // encounter deck, where the set's cards are. `villains` stays in printed order; the row is where they sit.
    return {
      ...common,
      villainCardId: villains[0]!.villainCardId,
      villains,
      sharedEncounterDeck: true,
      villainsStartSetAside: true,
    };
  }

  const villain = villainCard(scenario.villainCardId);
  const startSide = (villain.startingSide ?? "A") as string;
  const [firstStage, lastStage] = scenario.villainStages[difficulty];
  return {
    ...common,
    villainCardId: scenario.villainCardId,
    villainSide: startSide as NonNullable<GameSetupConfig["villainSide"]>,
    villainStartStageIndex: stageIndexOf(villain, startSide, firstStage),
    villainLastStageIndex: stageIndexOf(villain, startSide, lastStage),
  };
}

/** A wave 8 hero pack or Core starter deck as a player seat (quantities expanded). */
export function wave8StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = [...WAVE8_STARTER_DECKS, ...CORE_STARTER_DECKS].find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 8 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId as CardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave8StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as CardId,
      deck: seat.deck as readonly CardId[],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });

/**
 * An Age of Apocalypse scenario's `GameSetupConfig` from its emitted `Scenario` record (`unus`, `four-horsemen`,
 * `apocalypse`, `dark-beast`, `en-sabah-nur`). Throws for any other id: Core's scenarios are built by `wave6Scenario`.
 */
export function wave8Scenario(scenarioId: string, options: Wave8ScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(scenarioId, options.setupOptions);
  const record = WAVE8_SCENARIOS.find((s) => s.id === scenarioId);
  if (!record) throw new Error(`no wave 8 scenario ${scenarioId}`);
  return buildScenario(record, options);
}
