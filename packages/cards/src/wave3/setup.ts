import {
  CORE_STARTER_DECKS,
  difficultyOf,
  GMW_SCENARIOS,
  GMW_STARTER_DECKS,
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
import { WAVE3_CARDS } from "./cards.js";

/**
 * A Core scenario, a cycle 1 scenario, or one of cycle 2's own scenarios (only The Galaxy's Most Wanted's five are
 * data today — `stld`/`gam`/`drax`/`vnm`/`ron` carry no `Scenario` records), seated with wave 3 content — the
 * cycle 2 analog of `../wave2/setup.ts`'s `wave2Scenario`. Same obstacle, same fix (`cardPool`); see that file's
 * docblock first.
 */
export type Wave3Difficulty = CoreDifficulty;

export interface Wave3ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave3Difficulty;
}

const cardsById = new Map<string, AnyCard>(WAVE3_CARDS.map((card) => [card.id, card]));

/** A wave 3, wave 2, wave 1 or Core starter deck as a player seat (quantities expanded). */
export function wave3StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter =
    GMW_STARTER_DECKS.find((d) => d.id === starterDeckId) ?? CORE_STARTER_DECKS.find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 3 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave3StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as CardId,
      deck: seat.deck as readonly CardId[],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });

/** Every card in these encounter sets, read from `WAVE3_CARDS` (which includes every earlier wave, so a scenario
 * referencing a Core/wave 1/wave 2 encounter set — none does yet in `gmw` — would still resolve). Copied and
 * re-pointed from `../wave2/setup.ts`'s `wave2EncounterCardsOf`. */
function wave3EncounterCardsOf(setIds: readonly string[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = WAVE3_CARDS.filter(
      (card) =>
        "encounterSetIds" in card &&
        (card.encounterSetIds as readonly string[]).includes(setId) &&
        card.type !== "villain" &&
        card.type !== "main_scheme",
    );
    if (members.length === 0) throw new Error(`encounter set ${setId} has no wave 3 card`);
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) deck.push(card.id);
  }
  return deck;
}

/**
 * A card belonging to one of these encounter sets by `specificTo: { kind: "scenario" }` rather than
 * `encounterSetIds` (the Milano, 16142: "Permanent. Setup." — a player-typed support that "enters the game only
 * through that scenario", per `packages/engine/src/deck.ts`'s own reading of `specificTo`, so it is never shuffled
 * into the encounter deck; MC16's own setup text puts it into play directly). These need an instance to exist
 * before a scenario's own `Setup:` ability can find and place it, so they start set aside
 * (`GameSetupConfig.setAside`, RRG 1.8 "Set Aside", p. 39) like a signature side scheme, for that ability to select
 * by name (`encounterSetAside({ name })`) and `putIntoPlay`. Generic over any pack's `specificTo`-scoped scenario
 * card, not just the Milano — no card name here.
 */
function scenarioSpecificSetAside(setIds: readonly string[]): CardId[] {
  return WAVE3_CARDS.filter(
    (card) =>
      "specificTo" in card && card.specificTo?.kind === "scenario" && setIds.includes(card.specificTo.encounterSetId),
  ).map((card) => card.id);
}

/**
 * A single-villain `GMW_SCENARIOS` record. Unlike `../wave2/setup.ts`'s `buildSingleVillain`, expert mode may
 * substitute an entirely different villain card (`Scenario.expertVillains`) rather than a later stage of the same
 * one — Escape the Museum's Collector is two separate one-stage cards, front (16080a) and back (16081a), per
 * docs/phase7-wave3.md §1.1, not two stages of a shared card the way Kang's `Scenario.expertVillains` is either
 * (that one substitutes a whole separate villain deck via `separateGameAreas`, not this function).
 */
function buildSingleVillain(scenario: (typeof GMW_SCENARIOS)[number], options: Wave3ScenarioOptions): GameSetupConfig {
  const difficulty = difficultyOf(resolveModes(options.difficulty, options.modes));
  const useExpertVillain = difficulty === "expert" && scenario.expertVillains;
  const villainCardId = useExpertVillain ? scenario.expertVillains!.villainCardId : scenario.villainCardId;
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
    ...(options.modularSetIds ?? scenario.recommendedModularSetIds),
    ...scenario.standardEncounterSetIds,
    ...(difficulty === "expert" ? scenario.expertEncounterSetIds : []),
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  return {
    seed: options.seed,
    cards: WAVE3_CARDS,
    villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageIndex(firstStage),
    villainLastStageIndex: stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: wave3EncounterCardsOf(sets),
    players: seatsOf(options.players),
    includeIdentitySets: scenario.usesIdentityEncounterSets ?? true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    setAside: scenarioSpecificSetAside(sets),
    ...(useExpertVillain ? { setAsideVillainCardIds: scenario.expertVillains!.setAsideVillainCardIds } : {}),
    ...(scenario.separateDecks ? { scenarioDecks: scenario.separateDecks } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

/**
 * Any `GMW_SCENARIOS` record (every `gmw` scenario, via `buildSingleVillain`), or — for a scenario id it doesn't
 * have — a Core scenario seated with wave 3 content, mirroring `wave2Scenario`'s own fallback.
 */
export function wave3Scenario(scenarioId: string, options: Wave3ScenarioOptions): GameSetupConfig {
  const scenario = GMW_SCENARIOS.find((s) => s.id === scenarioId);
  if (scenario) return buildSingleVillain(scenario, options);
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = wave3StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: setup.identityCardId,
      deck: setup.deck,
      ...(setup.aspects ? { aspects: setup.aspects } : {}),
    };
  });
  return coreScenario(scenarioId, { ...options, players, cardPool: WAVE3_CARDS });
}
