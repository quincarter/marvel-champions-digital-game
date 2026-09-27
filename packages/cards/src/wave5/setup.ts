import {
  CORE_STARTER_DECKS,
  SM_SCENARIOS,
  SM_STARTER_DECKS,
  cardId,
  difficultyEncounterSetIds,
  type AnyCard,
  type CardId,
} from "@mc/content";
import type { GameSetupConfig, PlayerSetup, VillainSetup } from "@mc/engine";
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
    ...difficultyEncounterSetIds(scenario, difficulty),
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

/**
 * Light at the End (`sm` 27102a Trap! / 27102b Chase!, docs/phase7-wave5.md §1.5/§1.7): a permanent side scheme both
 * of whose emitted faces carry ordinary `sinister_six` `encounterSetIds` membership (the same shape as the campaign
 * challenge side schemes' `modeOnly` pairs, `gmw` 16178a/b), but this one is never drawn from the shuffled deck —
 * Sinister Synchronization 1A's own Setup ("Put the Light at the End side scheme into play, [Trap!] side faceup")
 * puts it in directly, and RRG 1.8 "Permanent" (p. 32) is itself "Set this card aside during setup." Both ids are
 * therefore excluded from the built encounter deck (`wave4/setup.ts`'s own `MULTI_VILLAIN_SET_ASIDE` precedent for a
 * set member placed by name rather than shuffled in), and only the Trap! face (27102a) starts in `setAside` — its
 * other face (27102b) is reached only by `flipCard`, never dealt or shuffled on its own.
 */
const SINISTER_SIX_SET_ASIDE: readonly CardId[] = [cardId("27102a"), cardId("27102b")];

/**
 * The Sinister Six's one-stage villains have a single stage (stageNumber 1) on side "A" — `stageIndex 0` for both
 * `startStageIndex` and `lastStageIndex`, `wave4/setup.ts`'s own `villainStageIndexOf` re-pointed at `WAVE5_CARDS`.
 */
function sinisterSixStageIndex(villainCardId: CardId): number {
  const villain = cardsById.get(villainCardId);
  if (!villain || villain.type !== "villain") throw new Error(`${villainCardId} is not a villain`);
  const side = villain.sides[0];
  if (!side) throw new Error(`${villain.name} has no sides`);
  const index = side.stages.findIndex((stage) => stage.stageNumber === 1);
  if (index < 0) throw new Error(`${villain.name} has no stage 1`);
  return index;
}

/**
 * The Sinister Six (`sm` "sinister-six", MC27 p. 15, docs/phase7-wave5.md §1.5): all six villains start set aside
 * (`villainsStartSetAside`), the main scheme's own Setup ability chooses players+1 of them at random and gives the
 * lowest activation order the counter (`27100a.setup`, `sinister-six/main-scheme.ts`), the active counter passes by
 * activation order on defeat (`activeCounter: "nextInActivationOrder"`), and the win is Light at the End's own card
 * ability, not defeating every villain (`victory: "cardAbility"`, the `MultipleVillains.winCondition: "cardAbility"`
 * sibling on `GameSetupConfig` — the existing single-villain `Scenario.victory` field, wave4 §1.11's own shape). One
 * shared encounter deck (`sharedEncounterDeck`), each villain's own `encounterDeck` therefore empty, per
 * `MultipleVillains.encounterDecks: "shared"` (the scenario data's own choice; Tower Defense's shape, wave4 §3.2)
 * — Tower Defense's `sharedEncounterDeck` is the closest existing shape, but this scenario adds
 * `villainsStartSetAside`/`activeCounter` on top of it, which Tower Defense does not use.
 */
function buildSmMultipleVillains(
  scenario: (typeof SM_SCENARIOS)[number],
  options: Wave5ScenarioOptions,
): GameSetupConfig {
  const multi = scenario.multipleVillains;
  if (!multi) throw new Error(`${scenario.name}: buildSmMultipleVillains needs a multipleVillains scenario`);
  if (multi.encounterDecks !== "shared") {
    throw new Error(`${scenario.name}: only sharedEncounterDeck multipleVillains scenarios are built by wave5Scenario`);
  }
  if (multi.atSetup !== "setAside") {
    throw new Error(`${scenario.name}: only atSetup: "setAside" multipleVillains scenarios are built here`);
  }
  const modes = resolveModes(options.difficulty, options.modes);
  const difficulty = modes.expert ? "expert" : "standard";
  const [firstStage, lastStage] = scenario.villainStages[difficulty];
  if (firstStage !== 1 || lastStage !== 1) {
    throw new Error(`${scenario.name}: The Sinister Six's villains are single-stage; got stages ${firstStage}-${lastStage}`);
  }
  const sets = [
    ...scenario.encounterSetIds,
    ...(options.modularSetIds ?? scenario.recommendedModularSetIds),
    ...difficultyEncounterSetIds(scenario, difficulty),
  ];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  const setAsideSet = new Set<string>(SINISTER_SIX_SET_ASIDE);
  const villains: readonly VillainSetup[] = multi.villains.map((entry) => ({
    villainCardId: entry.villainCardId,
    startStageIndex: sinisterSixStageIndex(entry.villainCardId),
    lastStageIndex: sinisterSixStageIndex(entry.villainCardId),
    encounterDeck: [],
  }));
  return {
    seed: options.seed,
    cards: WAVE5_CARDS,
    villainCardId: scenario.villainCardId,
    villains,
    sharedEncounterDeck: true,
    villainsStartSetAside: true,
    activeCounter: "nextInActivationOrder",
    victory: "cardAbility",
    // Light at the End's Trap! face only (module docblock); its Chase! face is reached solely by `flipCard`.
    encounterDeck: encounterCardsOf(sets, WAVE5_CARDS).filter((id) => !setAsideSet.has(id)),
    setAside: [cardId("27102a")],
    mainSchemeCardId: scenario.mainSchemeCardId,
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
 */
export function wave5Scenario(scenarioId: string, options: Wave5ScenarioOptions): GameSetupConfig {
  checkScenarioSetupOptions(scenarioId, options.setupOptions);
  const sm = SM_SCENARIOS.find((s) => s.id === scenarioId);
  if (sm) return sm.multipleVillains ? buildSmMultipleVillains(sm, options) : buildSmSingleVillain(sm, options);
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
