import {
  CORE_CARDS,
  CORE_SCENARIOS,
  CORE_STARTER_DECKS,
  difficultyOf,
  type AnyCard,
  type CardId,
  type CoreAspect,
  type PlayModes,
} from "@mc/content";
import type { GameSetupConfig, PlayerSetup } from "@mc/engine";

export type CoreDifficulty = "standard" | "expert";

/**
 * The one place the old `difficulty` option and the new mode set (`@mc/content`'s `schema/modes.ts`, RRG 1.8
 * pp. 28–29) are reconciled, shared by every scenario builder in this package.
 *
 * `modes` wins when both are given, so a caller that has a real mode set (a campaign, later a heroic level)
 * doesn't have to keep a redundant `difficulty` in sync — but the two may not *disagree* about expert mode,
 * because silently preferring one would change which villain stages a game starts at without saying so. A
 * caller that passes neither gets standard mode, exactly as `options.difficulty ?? "standard"` did.
 *
 * `difficulty` is typed loosely because each builder's own option type already narrows it, and wave 1's
 * `"extreme"` (The Wrecking Crew's per-villain version choice, `wave1/setup.ts`) is deliberately *not* an RRG
 * mode: any value other than `"expert"` is non-expert as far as the mode set is concerned.
 */
export function resolveModes(difficulty: string | undefined, modes: PlayModes | undefined): PlayModes {
  if (!modes) return difficulty === "expert" ? { expert: true } : {};
  if (difficulty !== undefined && (difficulty === "expert") !== (modes.expert === true)) {
    throw new Error(
      `difficulty "${difficulty}" and modes disagree about expert mode (modes.expert is ` +
        `${modes.expert === true ? "set" : "absent"}); pass one or the other`,
    );
  }
  return modes;
}

/**
 * A seat: a Core starter deck by id, or an identity plus an explicit deck list. Decks must be
 * legal (`requireLegalDecks`), so an explicit list also needs its chosen `aspects`.
 *
 * `deckId` on the explicit-list case is opaque provenance, not a rules input: the client's local
 * deck-storage id (`Deck.id`, `@mc/content`) this seat's cards were read from, carried along only
 * so a saved game can later be attributed back to the deck that played it
 * (docs/phase4-screen-gaps.md §2 S4). `coreScenario` below (and `wave1Scenario`'s `seatsOf`,
 * `packages/cards/src/wave1/setup.ts`) map each `CorePlayer` field by name into `PlayerSetup`
 * rather than spreading the seat, so `deckId` never reaches `@mc/engine`: it can't affect setup,
 * RNG, or a replay, and an old save built before this field existed still replays byte-for-byte.
 * It's optional and precon seats (`{ starterDeckId }`) don't carry one, because `starterDeckId`
 * already *is* that seat's stable attribution key.
 */
export type CorePlayer =
  | { readonly starterDeckId: string }
  | {
      readonly identityCardId: string;
      readonly deck: readonly string[];
      readonly aspects?: readonly CoreAspect[];
      readonly deckId?: string;
    };

export interface CoreScenarioOptions {
  readonly difficulty?: CoreDifficulty;
  /**
   * The full mode set (RRG 1.8 pp. 28–29), of which `difficulty` is the expert half. Optional and additive:
   * omitting it behaves exactly as before. When both are given they must agree about expert mode
   * (`resolveModes`). Campaign, heroic and skirmish are carried but read by nothing yet.
   */
  readonly modes?: PlayModes;
  /** Defaults to the scenario's recommended modular set(s). */
  readonly modularSetIds?: readonly string[];
  readonly players: readonly CorePlayer[];
  readonly seed: number;
  readonly firstPlayerIndex?: number;
  /**
   * The card pool sent to the engine (`GameSetupConfig.cards`). Defaults to `CORE_CARDS`. A Core scenario's
   * villain/main-scheme/encounter-set cards are always looked up in `CORE_CARDS` regardless of this — only a
   * seat's identity and deck need the wider pool, e.g. a wave 1 hero's precon sitting at a Core scenario
   * (`packages/cards/src/wave1/setup.ts` `wave1Scenario`, docs/phase7-wave1-scripting.md). Every existing caller
   * that doesn't set this keeps exactly the old behavior.
   */
  readonly cardPool?: readonly AnyCard[];
}

const cardsById = new Map<string, AnyCard>(CORE_CARDS.map((card) => [card.id, card]));

/** A Core starter deck as a player seat (quantities expanded; the identity isn't part of the deck). */
export function starterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = CORE_STARTER_DECKS.find((deck) => deck.id === starterDeckId);
  if (!starter) throw new Error(`no Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

/** Every encounter card in these sets (`quantityInSet` copies each); the villain and main scheme cards aren't dealt. */
export function encounterCardsOf(setIds: readonly string[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = CORE_CARDS.filter(
      (card) =>
        "encounterSetIds" in card &&
        (card.encounterSetIds as readonly string[]).includes(setId) &&
        card.type !== "villain" &&
        card.type !== "main_scheme",
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
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1–4 players");
  return {
    seed: options.seed,
    cards: options.cardPool ?? CORE_CARDS,
    villainCardId: scenario.villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageIndex(firstStage),
    villainLastStageIndex: stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: encounterCardsOf(sets),
    players: options.players.map((seat) =>
      "starterDeckId" in seat
        ? starterDeckSetup(seat.starterDeckId)
        : {
            identityCardId: seat.identityCardId as CardId,
            deck: seat.deck as readonly CardId[],
            ...(seat.aspects ? { aspects: seat.aspects } : {}),
          },
    ),
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}
