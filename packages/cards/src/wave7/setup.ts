import {
  CORE_STARTER_DECKS,
  WAVE7_ENCOUNTER_SETS,
  WAVE7_SCENARIOS,
  WAVE7_STARTER_DECKS,
  autoIncludedSetsOf,
  difficultyEncounterSetIds,
  difficultyOf,
  type AnyCard,
  type CardId,
  type EncounterSet,
  type Scenario,
} from "@mc/content";
import type { GameSetupConfig, PlayerSetup } from "@mc/engine";
import {
  checkScenarioSetupOptions,
  encounterCardsOf,
  resolveModes,
  setSeparateDecks,
  type CoreDifficulty,
  type CorePlayer,
  type CoreScenarioOptions,
} from "../core/setup.js";
import { PLAYABLE_ENCOUNTER_SETS, chooseModularSets, extraModularCardIds } from "../modular-pool.js";
import { WAVE7_CARDS } from "./cards.js";

export type Wave7Difficulty = CoreDifficulty;

export interface Wave7ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave7Difficulty;
}

/**
 * Every encounter set a game can name (`chooseModularSets` checks picks against these): the playable pool's sets,
 * which already list wave 7's (the union keeps this builder usable on its own).
 */
const ENCOUNTER_SETS: readonly EncounterSet[] = [
  ...new Map([...PLAYABLE_ENCOUNTER_SETS, ...WAVE7_ENCOUNTER_SETS].map((set) => [set.id as string, set])).values(),
];

/** `Scenario.victoryCondition`'s mode key (`wave6/setup.ts`'s own helper). */
function victoryConditionModeOf(modes: ReturnType<typeof resolveModes>): "skirmish" | "standard" | "expert" | "heroic" {
  if (modes.skirmish) return "skirmish";
  if (modes.heroic) return "heroic";
  return difficultyOf(modes);
}

const cardsById = new Map<string, AnyCard>(WAVE7_CARDS.map((card) => [card.id, card]));

/**
 * Scenarios `wave7Scenario` refuses to build, each with the reason, rather than building a wrong game. None at the
 * scaffold: all five box scenarios build a game the card scripts can then complete (docs/phase7-wave7.md §1.16). Add an
 * entry for a scenario whose engine row or scripting turns out to be needed first.
 */
const NOT_YET_SUPPORTED: Readonly<Record<string, string>> = {};

/** A double-sided encounter card whose two faces are both emitted as cards of one set is one card in the deck: its front face (`wave6/setup.ts`). */
function withoutBackFaces(deck: readonly CardId[]): CardId[] {
  const inDeck = new Set<string>(deck);
  return deck.filter((id) => {
    const other = cardsById.get(id)?.otherFaceId;
    return other === undefined || !inDeck.has(other) || String(id) < String(other);
  });
}

/**
 * Encounter sets that hold only villain and main scheme cards (Marauders: the seven villains the first two scenarios
 * share). Those cards are never dealt (`encounterCardsOf` leaves them out and refuses an empty set), so such a set
 * adds nothing to the deck and is skipped there.
 */
function dealtSets(sets: readonly string[]): string[] {
  const setupTypes: readonly string[] = ["villain", "main_scheme"];
  return sets.filter((setId) =>
    WAVE7_CARDS.some(
      (card) =>
        "encounterSetIds" in card &&
        (card.encounterSetIds as readonly string[]).includes(setId) &&
        !setupTypes.includes(card.type),
    ),
  );
}

/**
 * Cards of a set that belong to it through `specificTo: { kind: "scenario" }` and carry the setup keyword: Hope Summers
 * (40130, `hope_summers`). The keyword puts her into play at Appendix II step 11, found in the encounter deck, under the
 * first player's control (docs/phase7-wave7.md §3.25), so she is dealt with the deck. `core/setup.ts`'s
 * `modularSetupCardIds` leaves out encounter-back cards (the GMW scenarios set their own aside), so it cannot be used.
 */
function setupKeywordCardIds(sets: readonly string[]): CardId[] {
  const ids: CardId[] = [];
  for (const card of WAVE7_CARDS) {
    if (!("specificTo" in card) || card.specificTo?.kind !== "scenario") continue;
    const own = card.specificTo.encounterSetId as string;
    if (!sets.includes(own)) continue;
    if ("encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(own)) continue;
    if (!("keywords" in card) || !(card.keywords as readonly { name: string }[]).some((k) => k.name === "setup"))
      continue;
    for (let copy = 0; copy < card.quantityInSet; copy++) ids.push(card.id);
  }
  return ids;
}

/**
 * A `WAVE7_SCENARIOS` record's `GameSetupConfig`, modeled on `wave6/setup.ts`'s `buildSingleVillain`.
 *
 * - `expertVillains` (the Marauders' B faces) replaces the villain in expert mode.
 * - `startingVillain: "random"` (Morlock Siege) passes the set-aside villains through to `createGame`'s draw;
 *   `"bySetup"` (On the Run, engine commit 345aa2b5) starts every villain set aside, none in play, and the main
 *   scheme's Setup text brings one in (`villainsStartSetAside`).
 * - `setAsideCardIds` are cards the Setup sets aside. Most of them (Hide!, Hope's Captor, Juggernaut's Helmet,
 *   Stryfe's Grasp, the Flight, Super Strength and Telepathy sets) are also members of the scenario's own encounter
 *   sets, so they are taken out of the encounter deck and set aside instead, `quantityInSet` copies each.
 * - Hope Summers (40130, setup keyword, in no encounter set) is dealt with the deck so Appendix II step 11 puts her into play.
 */
function buildScenario(scenario: Scenario, options: Wave7ScenarioOptions): GameSetupConfig {
  const unsupported = NOT_YET_SUPPORTED[scenario.id];
  if (unsupported) throw new Error(`${scenario.name}: not yet supported: ${unsupported}`);
  const modes = resolveModes(options.difficulty, options.modes);
  const difficulty = modes.expert ? "expert" : "standard";
  const expertVillain = difficulty === "expert" ? scenario.expertVillains : undefined;
  const villainCardId = expertVillain ? expertVillain.villainCardId : scenario.villainCardId;
  const villain = cardsById.get(villainCardId);
  if (!villain || villain.type !== "villain") throw new Error(`${villainCardId} is not a villain`);
  const side = villain.sides.find((s) => s.side === (villain.startingSide ?? "A")) ?? villain.sides[0];
  if (!side) throw new Error(`${villain.name} has no sides`);
  const stageIndex = (stageNumber: number): number => {
    const index = side.stages.findIndex((stage) => stage.stageNumber === stageNumber);
    if (index < 0) throw new Error(`${villain.name} has no stage ${stageNumber}`);
    return index;
  };
  const [firstStage, lastStage] = scenario.villainStages[difficulty];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  const modular = chooseModularSets(scenario, ENCOUNTER_SETS, { ...options, playerCount: options.players.length });
  const sets = [
    ...scenario.encounterSetIds,
    ...modular.modularSetIds,
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
  const setAside = (scenario.setAsideCardIds ?? []).flatMap((id) => {
    const card = cardsById.get(id);
    if (!card) throw new Error(`${scenario.name}: unknown set-aside card ${id}`);
    return Array.from({ length: "quantityInSet" in card ? card.quantityInSet : 1 }, () => id);
  });
  const setAsideIds = new Set<string>(setAside);
  // Back faces go first: a set-aside card's own back face must not be left behind in the deck.
  const dealt = withoutBackFaces(encounterCardsOf(dealtSets(sets), WAVE7_CARDS)).filter((id) => !setAsideIds.has(id));
  return {
    seed: options.seed,
    cards: WAVE7_CARDS,
    villainCardId,
    villainSide: side.side,
    // An `expertVillains` card is its own one-stage card whose stage number need not match the record's `villainStages`.
    villainStartStageIndex: expertVillain ? 0 : stageIndex(firstStage),
    villainLastStageIndex: expertVillain ? side.stages.length - 1 : stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: [
      ...dealt,
      ...setupKeywordCardIds([...scenario.encounterSetIds, ...modular.modularSetIds]),
      ...extraModularCardIds(modular.extraModularSetIds, WAVE7_CARDS),
    ],
    players: seatsOf(options.players),
    // Sets a setup condition includes (Dreadpool, when a seat chose the 'Pool aspect): the engine decides.
    autoIncludedSets: autoIncludedSetsOf(ENCOUNTER_SETS, WAVE7_CARDS),
    ...(setAside.length > 0 ? { setAside } : {}),
    ...(scenario.separateDecks || setSeparateDecks(sets).length > 0
      ? { scenarioDecks: [...(scenario.separateDecks ?? []), ...setSeparateDecks(sets)] }
      : {}),
    ...(expertVillain ? { setAsideVillainCardIds: expertVillain.setAsideVillainCardIds } : {}),
    ...(scenario.startingVillain === "random"
      ? {
          randomStartingVillain: true as const,
          setAsideVillainCardIds: (expertVillain ?? scenario).setAsideVillainCardIds ?? [],
        }
      : {}),
    // On the Run: every villain starts set aside and 1A's Setup puts one into play. No villain is in play yet.
    ...(scenario.startingVillain === "bySetup"
      ? {
          villainsStartSetAside: true as const,
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
  };
}

/** A wave 7 hero pack, the NeXt Evolution box, or a Core starter deck as a player seat (quantities expanded). */
export function wave7StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = [...WAVE7_STARTER_DECKS, ...CORE_STARTER_DECKS].find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 7 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId as CardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave7StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as CardId,
      deck: seat.deck as readonly CardId[],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });

/**
 * A NeXt Evolution scenario's `GameSetupConfig` from its emitted `Scenario` record (`morlock-siege`, `on-the-run`,
 * `juggernaut`, `mister-sinister`, `stryfe`). Throws "not yet supported: <reason>" for a scenario that cannot be built
 * correctly yet (`NOT_YET_SUPPORTED`), and for any other id: Core's scenarios are built by `wave6Scenario`.
 */
export function wave7Scenario(scenarioId: string, options: Wave7ScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(scenarioId, options.setupOptions);
  const record = WAVE7_SCENARIOS.find((s) => s.id === scenarioId);
  if (!record) throw new Error(`no wave 7 scenario ${scenarioId}`);
  return buildScenario(record, options);
}
