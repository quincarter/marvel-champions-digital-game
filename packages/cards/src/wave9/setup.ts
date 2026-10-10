import {
  CORE_STARTER_DECKS,
  WAVE9_ENCOUNTER_SETS,
  WAVE9_SCENARIOS,
  WAVE9_STARTER_DECKS,
  cardId,
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
  modularSetupCardIds,
  resolveModes,
  setSeparateDecks,
  type CoreDifficulty,
  type CorePlayer,
  type CoreScenarioOptions,
} from "../core/setup.js";
import { PLAYABLE_ENCOUNTER_SETS, chooseModularSets, extraModularCardIds } from "../modular-pool.js";
import { WAVE9_CARDS } from "./cards.js";

export type Wave9Difficulty = CoreDifficulty;

export interface Wave9ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave9Difficulty;
  /**
   * Thunderbolts: which modular sets are set aside (`Scenario.setAsideModularSetCount`, base 1 plus 1 per player, from
   * the scenario's restricted pool). Absent: random picks from the pool (`chooseModularSets`).
   */
  readonly setAsideModularSetIds?: readonly string[];
  /** Extra modular sets shuffled in on top, never counted (S.H.I.E.L.D. Executive Board outside the campaign). */
  readonly extraModularSetIds?: readonly string[];
}

/**
 * Every encounter set a game can name. `modular-pool.ts`'s playable list stops at wave 8 (wave 9 is not playable yet),
 * so the wave 9 sets are added here, each once.
 */
const ENCOUNTER_SETS: readonly EncounterSet[] = [
  ...new Map(
    [...PLAYABLE_ENCOUNTER_SETS, ...WAVE9_ENCOUNTER_SETS].map((set) => [set.id as string, set] as const),
  ).values(),
];

const cardsById = new Map<string, AnyCard>(WAVE9_CARDS.map((card) => [card.id, card]));

/**
 * Cards a scenario's own Setup sets aside that its record does not list in `Scenario.setAsideCardIds` (the data agent
 * has not added them yet): `quantityInSet` copies of each stay out of the encounter deck until a card asks for them.
 * docs/phase7-wave9.md section 1.10 (`setAsideCardIds`). Rescued Captive 50091 has no encounter set, so only its place
 * in `setAside` matters; the four Adaptoid upgrade environments (50109 to 50112) carry the `m.o.d.o.k.` set and are
 * taken out of its deck. The Holding Cell a-sides (50105a to 50108a) stay in it: the record's `separateDecks` entry
 * names them and the engine builds the Holding Cell deck from them at Setup. The Thunderbolt minions chosen at setup (section 2.5) are not
 * set aside here; that waits on the Thunderbolts script.
 */
const SETASIDE_BY_SCENARIO: Readonly<Record<string, readonly CardId[]>> = {
  batroc: [cardId("50091")],
  modok: ["50109", "50110", "50111", "50112"].map(cardId),
};

/** A double-sided encounter card whose two faces are both in one deck is one card: its front face. */
function withoutBackFaces(deck: readonly CardId[]): CardId[] {
  const inDeck = new Set<string>(deck);
  return deck.filter((id) => {
    const other = cardsById.get(id)?.otherFaceId;
    return other === undefined || !inDeck.has(other) || String(id) < String(other);
  });
}

/** `Scenario.victoryCondition`'s mode key. */
function victoryConditionModeOf(modes: ReturnType<typeof resolveModes>): "skirmish" | "standard" | "expert" | "heroic" {
  if (modes.skirmish) return "skirmish";
  if (modes.heroic) return "heroic";
  return difficultyOf(modes);
}

/**
 * A `WAVE9_SCENARIOS` record's `GameSetupConfig`, modeled on `wave6/setup.ts`'s `buildSingleVillain`.
 *
 * - **Villain face by mode**: `Scenario.expertVillains` replaces the villain in expert mode (Baron Zemo 50165a standard,
 *   50166a expert); every other scenario's villain card holds both modes as stages (`villainStages`).
 * - **Set aside**: `Scenario.setAsideCardIds` plus `SETASIDE_BY_SCENARIO` go to `GameSetupConfig.setAside`; God of Lies'
 *   other three Avatars of Loki (`setAsideVillainCardIds`) are passed through; `startingVillain: "bySetup"` and
 *   `neutralCards` (Loki, God of Lies and Worlds Collide) are not read yet (engine tasks 42 to 47).
 * - **Thunderbolts**: `chooseModularSets` takes the restricted pool and the set-aside count (base 1 + 1 per player).
 * - **Baron Zemo**: Executive Board Evidence (50185 to 50193) is never in the encounter deck (docs/phase7-wave9.md
 *   section 1.10): it is left out here, and the hidden piles wait on the engine row 3.29 and data item 1. The scenario
 *   is not playable until then.
 */
function buildScenario(scenario: Scenario, options: Wave9ScenarioOptions): GameSetupConfig {
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
  const modular = chooseModularSets(scenario, ENCOUNTER_SETS, { ...options, playerCount: options.players.length });
  const sets = [
    ...scenario.encounterSetIds,
    ...modular.modularSetIds,
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
  const isEvidence = (id: CardId): boolean => cardsById.get(id)?.type === "evidence";
  const setAside = [...(scenario.setAsideCardIds ?? []), ...(SETASIDE_BY_SCENARIO[scenario.id] ?? [])].flatMap((id) => {
    const card = cardsById.get(id);
    if (!card) throw new Error(`${scenario.name}: unknown set-aside card ${id}`);
    return Array.from({ length: "quantityInSet" in card ? card.quantityInSet : 1 }, () => id);
  });
  const setAsideKinds = new Set<string>(setAside);
  const setAsideVillainCardIds = (expertVillain ?? scenario).setAsideVillainCardIds ?? [];
  return {
    seed: options.seed,
    cards: WAVE9_CARDS,
    villainCardId,
    villainSide: side.side,
    // An `expertVillains` card is its own one-stage card whose printed stage need not match `villainStages`.
    villainStartStageIndex: expertVillain ? 0 : stageIndex(firstStage),
    villainLastStageIndex: expertVillain ? side.stages.length - 1 : stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: [
      ...withoutBackFaces(encounterCardsOf(sets, WAVE9_CARDS)).filter(
        (id) => !isEvidence(id) && !setAsideKinds.has(id),
      ),
      ...modularSetupCardIds(modular.modularSetIds, WAVE9_CARDS),
      ...extraModularCardIds(modular.extraModularSetIds, WAVE9_CARDS),
    ],
    players: seatsOf(options.players),
    ...(setAside.length > 0 ? { setAside } : {}),
    ...(modular.setAsideModularSetIds.length > 0
      ? {
          setAsideModularSets: modular.setAsideModularSetIds.map((encounterSetId) => ({
            encounterSetId,
            cardIds: withoutBackFaces(encounterCardsOf([encounterSetId], WAVE9_CARDS)),
          })),
          // A set-aside modular set comes in whole, by the scenario's own text; a setup-keyword card in one stays aside.
          setAsideUntilCalled: { encounterSetIds: modular.setAsideModularSetIds },
        }
      : {}),
    ...(scenario.separateDecks || setSeparateDecks(sets).length > 0
      ? { scenarioDecks: [...(scenario.separateDecks ?? []), ...setSeparateDecks(sets)] }
      : {}),
    ...(setAsideVillainCardIds.length > 0 ? { setAsideVillainCardIds } : {}),
    ...(scenario.victoryCondition
      ? { victoryCondition: scenario.victoryCondition[victoryConditionModeOf(modes)] }
      : {}),
    ...(scenario.victory ? { victory: scenario.victory } : {}),
    // Sets a setup condition includes: the engine decides (as wave 8 does).
    includeIdentitySets: true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(difficulty === "expert" ? { difficulty: "expert" as const } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

/**
 * A wave 9 hero pack, Agents of S.H.I.E.L.D. or Core starter deck as a player seat (quantities expanded). Nick Fury's
 * Assault / Stealth 50035a is Permanent: it is listed in the deck and the engine sets it aside before setup and puts it
 * into play, so it is outside the 40 cards (as Iceman's Frostbite is).
 */
export function wave9StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = [...WAVE9_STARTER_DECKS, ...CORE_STARTER_DECKS].find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 9 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId as CardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
}

const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave9StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as CardId,
      deck: seat.deck as readonly CardId[],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });

/**
 * A wave 9 scenario's `GameSetupConfig` from its emitted `Scenario` record (`black-widow`, `batroc`, `modok`,
 * `thunderbolts`, `baron-zemo`, `enchantress`, `god-of-lies`). Throws for any other id.
 */
export function wave9Scenario(scenarioId: string, options: Wave9ScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(scenarioId, options.setupOptions);
  const record = WAVE9_SCENARIOS.find((s) => s.id === scenarioId);
  if (!record) throw new Error(`no wave 9 scenario ${scenarioId}`);
  return buildScenario(record, options);
}
