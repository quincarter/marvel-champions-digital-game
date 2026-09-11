import { CORE_CARDS, CORE_SCENARIOS, CORE_STARTER_DECKS, type AnyCard, type CardId } from "@mc/content";
import type { GameSetupConfig, PlayerSetup } from "@mc/engine";

export type CoreDifficulty = "standard" | "expert";

/** A seat: a Core starter deck by id, or an identity plus an explicit deck list. */
export type CorePlayer = { readonly starterDeckId: string } | { readonly identityCardId: string; readonly deck: readonly string[] };

export interface CoreScenarioOptions {
  readonly difficulty?: CoreDifficulty;
  /** Defaults to the scenario's recommended modular set(s). */
  readonly modularSetIds?: readonly string[];
  readonly players: readonly CorePlayer[];
  readonly seed: number;
  readonly firstPlayerIndex?: number;
}

const cardsById = new Map<string, AnyCard>(CORE_CARDS.map((card) => [card.id, card]));

/** A Core starter deck as a player seat (quantities expanded; the identity isn't part of the deck). */
export function starterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = CORE_STARTER_DECKS.find((deck) => deck.id === starterDeckId);
  if (!starter) throw new Error(`no Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

/** Every encounter card in these sets (`quantityInSet` copies each); the villain and main scheme cards aren't dealt. */
export function encounterCardsOf(setIds: readonly string[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = CORE_CARDS.filter(
      (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId) && card.type !== "villain" && card.type !== "main_scheme",
    );
    if (members.length === 0) throw new Error(`encounter set ${setId} has no Core cards`);
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) deck.push(card.id);
  }
  return deck;
}

/**
 * A Core scenario set up from the scenario record (RRG Appendix II): the
 * villain stages for the difficulty (standard I–II, expert II–III), the
 * scenario's own set + modular set(s) + Standard (+ Expert), and each hero's
 * obligation and nemesis set, which the engine shuffles in / sets aside from
 * the card pool. The whole Core card pool is passed so saves replay standalone.
 */
export function coreScenario(scenarioId: string, options: CoreScenarioOptions): GameSetupConfig {
  const scenario = CORE_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`no Core scenario ${scenarioId}`);
  const difficulty = options.difficulty ?? "standard";
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
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1–4 players");
  return {
    seed: options.seed,
    cards: CORE_CARDS,
    villainCardId: scenario.villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageIndex(firstStage),
    villainLastStageIndex: stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: encounterCardsOf(sets),
    players: options.players.map((seat) =>
      "starterDeckId" in seat ? starterDeckSetup(seat.starterDeckId) : { identityCardId: seat.identityCardId as CardId, deck: seat.deck as readonly CardId[] },
    ),
    requireIdentitySets: true,
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}
