import {
  CORE_STARTER_DECKS,
  SM_SCENARIOS,
  SM_STARTER_DECKS,
  encounterSetId,
  type AnyCard,
  type CardId,
} from "@mc/content";
import type { GameSetupConfig, PlayerSetup } from "@mc/engine";
import {
  checkScenarioSetupOptions,
  coreScenario,
  encounterCardsOf,
  resolveModes,
  type CoreDifficulty,
  type CorePlayer,
  type CoreScenarioOptions,
} from "../core/setup.js";
import { WAVE5_CARDS } from "./cards.js";

// (seatsOf below expands a `starterDeckId` seat to identityCardId/deck before calling `coreScenario`, which only
// knows `CORE_STARTER_DECKS` by that name — `wave1/setup.ts`'s own `wave1Scenario` precedent.)

export type Wave5Difficulty = CoreDifficulty;

export interface Wave5ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave5Difficulty;
}

const cardsById = new Map<string, AnyCard>(WAVE5_CARDS.map((card) => [card.id, card]));

/**
 * `sm`'s scenario records carry empty `standardEncounterSetIds`/`expertEncounterSetIds` (docs/phase7-wave5.md
 * `scenarios.ts` docblock: the box's raw MarvelCDB pack has no `standard`/`expert` `card_set_code` of its own — the
 * physical cards are Core's, reused across products the way "and Standard encounter sets" is printed in every box's
 * rulebook without the box carrying its own copies). None of the box's five 1A Setups print an Expert set at all
 * (docs/phase7-wave5.md §2.2's own table), only "Standard", so this scaffold adds Core's own `standard` set to
 * every `sm` scenario's deck unconditionally rather than reading the (empty) scenario fields — a data gap flagged
 * for `card-data-pipeline`, worked around here rather than left to silently under-build every `sm` scenario's
 * encounter deck. Revisit (and drop this constant) once `SM_SCENARIOS` carries the real set ids.
 */
const SM_STANDARD_SET_IDS = [encounterSetId("standard")];

/**
 * A single-villain `SM_SCENARIOS` record (Sandman, Venom, Mysterio; not Venom Goblin's lettered main scheme or The
 * Sinister Six's `multipleVillains` shape — see the module docblock below), modeled directly on
 * `wave4/setup.ts`'s `buildMtsSingleVillain`.
 */
function buildSmSingleVillain(scenario: (typeof SM_SCENARIOS)[number], options: Wave5ScenarioOptions): GameSetupConfig {
  if (scenario.multipleVillains) {
    throw new Error(`${scenario.name}: buildSmSingleVillain does not build multipleVillains scenarios`);
  }
  const modes = resolveModes(options.difficulty, options.modes);
  const difficulty = modes.expert ? "expert" : "standard";
  const villainCardId = scenario.villainCardId;
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
    ...SM_STANDARD_SET_IDS,
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  return {
    seed: options.seed,
    cards: WAVE5_CARDS,
    villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageIndex(firstStage),
    villainLastStageIndex: stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: encounterCardsOf(sets, WAVE5_CARDS),
    players: seatsOf(options.players),
    includeIdentitySets: true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(difficulty === "expert" ? { difficulty: "expert" as const } : {}),
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

/** A Sinister Motives or Core starter deck as a player seat (quantities expanded). */
export function wave5StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter =
    SM_STARTER_DECKS.find((d) => d.id === starterDeckId) ?? CORE_STARTER_DECKS.find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 5 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId as CardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

/** `options.players`, with any `starterDeckId` seat expanded to `identityCardId`/`deck` — `coreScenario`'s own
 * `starterDeckId` branch only knows `CORE_STARTER_DECKS` by that name (`wave1/setup.ts`'s `wave1Scenario`
 * precedent). */
const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave5StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: seat.identityCardId as CardId,
      deck: seat.deck as readonly CardId[],
      ...(seat.aspects ? { aspects: seat.aspects } : {}),
    };
  });

/**
 * A `sm` scenario's `GameSetupConfig` (Sandman built here; Venom/Mysterio/The Sinister Six/Venom Goblin are later
 * agents' work, docs/phase7-wave5.md §5) built the shape `wave4Scenario` established, so the client can wire in
 * `wave5Scenario` the same way it wires `wave4Scenario` (step 5). Falls through to `coreScenario` for a Core
 * scenario seated with wave 5 content, `wave1Scenario`/`wave4Scenario`'s "no scenario of its own yet" precedent.
 *
 * **What the other four scenarios will need from this scaffold, in order:**
 * - **Venom, Mysterio**: nothing new — both are single-villain, standard I–II/expert II–III, one recommended
 *   modular, no lettered stages or set-aside villains (`SM_SCENARIOS`' own shape for both already matches
 *   Sandman's). They should build with `buildSmSingleVillain` unchanged once their own encounter-set/villain/main-
 *   scheme modules exist — Venom additionally needs docs/phase7-wave5.md §3.6/§3.8/§3.29 (boost cards held on an
 *   identity, Bell Tower's damage increase, the overkill-spill decision) already landed in the engine; Mysterio
 *   needs §3.5 (encounter cards living in a player's deck/hand/discard pile), also landed.
 * - **The Sinister Six**: `scenario.multipleVillains` is set (`atSetup: "setAside"`, `winCondition: "cardAbility"`,
 *   §1.5/§3.1/§3.2), so it needs a `buildSmMultipleVillains` alongside this function — modeled on
 *   `wave4/setup.ts`'s own `buildMtsMultipleVillains`, but with all six villains starting set aside rather than a
 *   `sharedEncounterDeck` of two active villains (Tower Defense's shape doesn't fit: Sinister Synchronization 1A's
 *   own Setup randomly chooses which villains enter play, §4.2 Q1 — the scenario's own Setup ability, not something
 *   this builder should hardcode. It needs `GameSetupConfig` to accept "every named villain set aside, none in
 *   play, no active villain" at setup, which `buildMtsMultipleVillains`'s shape does not yet cover).
 * - **Venom Goblin**: needs `buildSmSingleVillain` extended (or a sibling builder) for Skies Over New York's
 *   lettered main-scheme stages whose other face is an environment (`MainSchemeStage.otherFaceId`/`onCompletion`,
 *   §1.1/§3.3) and the glider counter/focused main scheme mechanism (§3.4/§3.9) — `wave4/setup.ts`'s
 *   `buildHoodSingleVillain`'s `setAsideModularSets` shape is the closer model (a scenario-specific setup wrinkle
 *   layered on the single-villain base) than a wholesale rewrite.
 *
 * All five scenarios need `SM_STANDARD_SET_IDS`'s workaround above (or its eventual fix in `@mc/content`).
 */
export function wave5Scenario(scenarioId: string, options: Wave5ScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(scenarioId, options.setupOptions);
  const sm = SM_SCENARIOS.find((s) => s.id === scenarioId);
  if (sm) {
    if (sm.multipleVillains) {
      throw new Error(
        `${sm.name}: multipleVillains scenarios (The Sinister Six) are not built by wave5Scenario yet — see this file's own docblock`,
      );
    }
    return buildSmSingleVillain(sm, options);
  }
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = wave5StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: setup.identityCardId,
      deck: setup.deck,
      ...(setup.aspects ? { aspects: setup.aspects } : {}),
    };
  });
  return coreScenario(scenarioId, { ...options, players, cardPool: WAVE5_CARDS });
}
