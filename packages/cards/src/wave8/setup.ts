import {
  CORE_STARTER_DECKS,
  WAVE8_ENCOUNTER_SETS,
  WAVE8_SCENARIOS,
  WAVE8_STARTER_DECKS,
  autoIncludedSetsOf,
  difficultyEncounterSetIds,
  type AnyCard,
  type CardId,
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
}

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
 * - **Four Horsemen**: four villains in play at once (`villains`, one `sharedEncounterDeck`), 45085a; each Horseman's
 *   version is picked per villain (`options.horsemanSides`, default from the difficulty).
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
  // TODO(engine task 19, docs/phase7-wave8.md section 3.6): Standard III as a standard-set choice. `difficultySets`
  // is passed through as the other waves do, but "standard_iii" has no `classification` yet, so a pick is refused.
  const sets = [
    ...ownSets,
    ...modular.modularSetIds,
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
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
    // TODO(engine task 20, docs/phase7-wave8.md section 3.7): 45085a's Setup shuffles the Horsemen into a random row
    // (`villainRowSet`) and places the active counter on the leftmost; each player reveals a random Four Horsemen side
    // scheme. Neither is built: the row is the printed order (War, Famine, Pestilence, Death), the active villain is
    // the first, and the four Horsemen side schemes (45086 to 45089) are still shuffled into the shared deck.
    return { ...common, villainCardId: villains[0]!.villainCardId, villains, sharedEncounterDeck: true };
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
 *
 * TODO(engine task 18, docs/phase7-wave8.md section 3.5): the Infinites "Modular Difficulty" setup option (threat per
 * player placed on Gene Pool) is not built. No option exists here; when it does it is a field on the options, offered
 * whenever `infinites` is among the game's sets.
 */
export function wave8Scenario(scenarioId: string, options: Wave8ScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(scenarioId, options.setupOptions);
  const record = WAVE8_SCENARIOS.find((s) => s.id === scenarioId);
  if (!record) throw new Error(`no wave 8 scenario ${scenarioId}`);
  return buildScenario(record, options);
}
