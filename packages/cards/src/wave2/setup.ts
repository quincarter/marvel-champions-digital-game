import {
  CORE_STARTER_DECKS,
  WAVE2_CARDS,
  WAVE2_SCENARIOS,
  WAVE2_STARTER_DECKS,
  difficultyEncounterSetIds,
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

/**
 * A Core scenario (Rhino/Klaw/Ultron), or one of cycle 1's own scenarios, seated with wave 2 content — the cycle 1
 * analog of `../wave1/setup.ts`'s `wave1Scenario`. Read that file's docblock first: the same obstacle
 * (`coreScenario` hardcodes `cards: CORE_CARDS`) and the same fix (`cardPool`) apply here.
 *
 * **Now data-driven through `WAVE2_SCENARIOS`** (`@mc/content`'s `packages/content/src/data/index.ts`), the way
 * `wave1Scenario` already is through `WAVE1_SCENARIOS` — `card-data-pipeline` filled it with all six cycle 1
 * scenario records (The Rise of Red Skull's five plus Kang) additively, exactly as `docs/phase7-wave2-scripting.md`
 * asked. `buildSingleVillain` below is `wave1/setup.ts`'s own function, re-pointed at `WAVE2_CARDS`/
 * `wave2EncounterCardsOf`, plus two things wave 1 never needed: `Scenario.separateDecks` (Crossbones' Experimental
 * Weapons, Red Skull's side-scheme deck — both now data, not hand-written `ScenarioSeparateDeck` literals) and
 * `SETASIDE_BY_SCENARIO` (below) for the two scenarios (Taskmaster's four Captive allies, Red Skull's The Sleeper)
 * whose setup sets non-villain cards aside — `Scenario.setAsideVillainCardIds` is villain cards only (Kang's own
 * shape), so this is still `@mc/cards`-local data, not a content-schema gap.
 *
 * **Kang (`toafk`)** is a `WAVE2_SCENARIOS` record with `separateGameAreas` set — `kangScenario` below, not
 * `buildSingleVillain` (no single `villainSide`/`villainStartStageIndex`: Kang (I) is the whole villain deck, and
 * `Scenario.setAsideVillainCardIds`/`expertVillains` name the rest, added by card abilities —
 * `packages/engine/src/game-areas.test.ts`'s own `kangGame()` is the reference this is modeled on).
 */
export type Wave2Difficulty = CoreDifficulty;

export interface Wave2ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave2Difficulty;
}

const cardsById = new Map<string, AnyCard>(WAVE2_CARDS.map((card) => [card.id, card]));

/** A wave 2 or Core starter deck as a player seat (quantities expanded; the identity isn't part of the deck). */
export function wave2StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter =
    WAVE2_STARTER_DECKS.find((d) => d.id === starterDeckId) ?? CORE_STARTER_DECKS.find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 2 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave2StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as CardId,
      deck: seat.deck as readonly CardId[],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });

/**
 * Every card in these encounter sets (`quantityInSet` copies each), read from `WAVE2_CARDS` rather than
 * `@mc/cards/core`'s `encounterCardsOf`, which is hardcoded to `CORE_CARDS` and so never sees a cycle 1 set (or,
 * for Crossbones' "Legions of Hydra", a *Core* set a cycle 1 scenario references — `WAVE2_CARDS` includes
 * `CORE_CARDS`, so this already finds it). Copied and re-pointed from `../wave1/setup.ts`'s
 * `wave1EncounterCardsOf`, not imported: the function itself is otherwise identical.
 */
function wave2EncounterCardsOf(setIds: readonly string[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = WAVE2_CARDS.filter(
      (card) =>
        "encounterSetIds" in card &&
        (card.encounterSetIds as readonly string[]).includes(setId) &&
        card.type !== "villain" &&
        card.type !== "main_scheme",
    );
    if (members.length === 0) throw new Error(`encounter set ${setId} has no wave 2 card`);
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) deck.push(card.id);
  }
  return deck;
}

/**
 * Non-villain cards a scenario's own 1A setup sets aside, out of play, for a later card ability to bring in
 * (Taskmaster's four Captive allies — `taskmaster.ts`'s module docblock; Red Skull's The Sleeper — `red-skull.ts`'s
 * module docblock). `Scenario.setAsideVillainCardIds` (`@mc/content`) is villain cards only (Kang's own shape), so
 * this stays `@mc/cards`-local data rather than waiting on a content-schema field that would only ever serve two
 * cards in this pack.
 */
const SETASIDE_BY_SCENARIO: Readonly<Record<string, readonly CardId[]>> = {
  taskmaster: ["04097", "04098", "04099", "04100"] as CardId[],
  "red-skull": ["04130"] as CardId[],
};

/**
 * A single-villain `WAVE2_SCENARIOS` record — every cycle 1 scenario except Kang (`separateGameAreas`, not yet
 * scripted). The wave 1 analog of this function (`wave1/setup.ts`'s `buildSingleVillain`) is the same shape;
 * duplicated rather than shared because the two wave's `*_CARDS`/`*EncounterCardsOf` pools differ and a shared
 * generic would need to thread both through every call site for one function this small.
 */
function buildSingleVillain(
  scenario: (typeof WAVE2_SCENARIOS)[number],
  options: Wave2ScenarioOptions,
): GameSetupConfig {
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
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  const setAside = SETASIDE_BY_SCENARIO[scenario.id];
  return {
    seed: options.seed,
    cards: WAVE2_CARDS,
    villainCardId: scenario.villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageIndex(firstStage),
    villainLastStageIndex: stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: wave2EncounterCardsOf(sets),
    players: seatsOf(options.players),
    includeIdentitySets: scenario.usesIdentityEncounterSets ?? true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(setAside ? { setAside } : {}),
    ...(scenario.separateDecks ? { scenarioDecks: scenario.separateDecks } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

/**
 * Kang (`toafk`, `separateGameAreas`): Kang (I) alone in the villain deck (one stage; no `villainSide`/
 * `villainStartStageIndex`/`villainLastStageIndex` needed, matching the reference test's own `kangGame()` — the
 * defaults already resolve to that single stage). Expert mode substitutes the whole Expert Kang villain
 * (`Scenario.expertVillains`), not a later stage of the same card. Kang (II)'s four versions and Kang (III) are
 * `setAsideVillainCardIds`, entering play through `addVillain` (`kang.ts`'s stage 3/4 `when-revealed` abilities).
 */
function kangScenario(options: Wave2ScenarioOptions): GameSetupConfig {
  const scenario = WAVE2_SCENARIOS.find((s) => s.id === "kang");
  if (!scenario) throw new Error("no kang scenario record in WAVE2_SCENARIOS");
  const difficulty = difficultyOf(resolveModes(options.difficulty, options.modes));
  const villains =
    difficulty === "expert" && scenario.expertVillains
      ? scenario.expertVillains
      : { villainCardId: scenario.villainCardId, setAsideVillainCardIds: scenario.setAsideVillainCardIds ?? [] };
  const sets = [
    ...scenario.encounterSetIds,
    ...(options.modularSetIds ?? scenario.recommendedModularSetIds),
    ...difficultyEncounterSetIds(scenario, difficulty, options.difficultySets),
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  return {
    seed: options.seed,
    cards: WAVE2_CARDS,
    villainCardId: villains.villainCardId,
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: wave2EncounterCardsOf(sets),
    players: seatsOf(options.players),
    includeIdentitySets: scenario.usesIdentityEncounterSets ?? true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    setAsideVillainCardIds: villains.setAsideVillainCardIds,
    ...(scenario.victory ? { victory: scenario.victory } : {}),
    separateGameAreas: true,
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

/**
 * Any `WAVE2_SCENARIOS` record this file knows how to build (every cycle 1 scenario: `buildSingleVillain` for the
 * five Red Skull ones, `kangScenario` for Kang), or — for a scenario id it doesn't have — a Core scenario
 * (Rhino/Klaw/Ultron) seated with wave 2 content, mirroring `wave1Scenario`'s own fallback.
 */
export function wave2Scenario(scenarioId: string, options: Wave2ScenarioOptions): GameSetupConfig {
  const scenario = WAVE2_SCENARIOS.find((s) => s.id === scenarioId);
  if (scenario) return scenario.separateGameAreas ? kangScenario(options) : buildSingleVillain(scenario, options);
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = wave2StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: setup.identityCardId,
      deck: setup.deck,
      ...(setup.aspects ? { aspects: setup.aspects } : {}),
    };
  });
  return coreScenario(scenarioId, { ...options, players, cardPool: WAVE2_CARDS });
}
