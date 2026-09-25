import {
  CORE_STARTER_DECKS,
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
function buildMtsSingleVillain(
  scenario: (typeof MTS_SCENARIOS)[number],
  options: Wave4ScenarioOptions,
): GameSetupConfig {
  if (scenario.multipleVillains) {
    throw new Error(`${scenario.name}: multipleVillains scenarios are not built by wave4Scenario yet`);
  }
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
    ...(options.modularSetIds ?? scenario.recommendedModularSetIds),
    ...scenario.standardEncounterSetIds,
    ...(difficulty === "expert" ? scenario.expertEncounterSetIds : []),
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
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
