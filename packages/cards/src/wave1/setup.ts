import { CORE_STARTER_DECKS, WAVE1_CARDS, WAVE1_SCENARIOS, WAVE1_STARTER_DECKS, type AnyCard, type CardId } from "@mc/content";

type VillainVersion = "A" | "B" | "extreme";
import type { GameSetupConfig, PlayerSetup, VillainSetup } from "@mc/engine";
import { coreScenario, type CoreDifficulty, type CorePlayer, type CoreScenarioOptions } from "../core/setup.js";

/**
 * A Core scenario (Rhino/Klaw/Ultron — `packages/cards/src/core/scenarios/`) seated with wave 1 content.
 *
 * **The obstacle (task 4 of the Phase 7 wave 1 foundation pass):** `coreScenario()` hardcoded
 * `cards: CORE_CARDS`, so a wave 1 deck (its identity and cards aren't in `CORE_CARDS`) could never sit at a Core
 * scenario — `createGame` would refuse it as soon as it tried to resolve the identity or a deck card.
 *
 * **The fix, and why it's the smallest one:** `CoreScenarioOptions` gained one new optional field,
 * `cardPool?: readonly AnyCard[]`, defaulting to `CORE_CARDS` (see `core/setup.ts`). Every existing call site
 * that doesn't set it is byte-for-byte unaffected — same type, same default, same `cards: CORE_CARDS` result. A
 * Core scenario's own villain/main-scheme/encounter-set lookups stay pinned to `CORE_CARDS` regardless (a Core
 * scenario never *becomes* a wave 1 scenario just because a wave 1 hero is seated at it); only the pool sent to
 * the engine for identity/deck resolution needs to be wider. `wave1Scenario` below is the thin wrapper that sets
 * `cardPool: WAVE1_CARDS` (Core plus all eight wave 1 packs) and expands any wave 1 `starterDeckId` seat before
 * `coreScenario` sees it, since `coreScenario`'s own `starterDeckId` branch only knows `CORE_STARTER_DECKS`.
 *
 * **Generalized (this pass, docs/phase7-wave1.md §2.3/§3.15) to build a wave 1 scenario itself**, not only seat a
 * wave 1 hero at a Core one. `scenarioId` is looked up in `WAVE1_SCENARIOS` first (Green Goblin's Risky
 * Business/Mutagen Formula, single villain; The Wrecking Crew's Breakout, four villains at once via
 * `Scenario.multipleVillains`); a scenario id `WAVE1_SCENARIOS` doesn't have falls through to `coreScenario`
 * unchanged, so every existing Core-scenario call site (wave 1 hero or not) is untouched.
 *
 * **Alternatives considered and rejected:**
 * - A parallel `wave1CoreScenario()` that duplicates `coreScenario`'s ~40 lines with `WAVE1_CARDS` baked in: two
 *   copies of the same setup logic to keep in sync as Core's own scenario logic evolves, for one field's worth of
 *   difference.
 * - Making `coreScenario` always use `WAVE1_CARDS`: wrong dependency direction for `@mc/cards/core` (which must
 *   stand alone as "the Core Set" module) and silently changes the pool every existing Core test/game already
 *   asserts against.
 * - A pack-local `gobScenario`/`twcScenario` per scenario pack (the shape Green Goblin shipped with as a stopgap,
 *   `wave1/gob/testing.ts`): two nearly-identical ~60-line functions already diverging (Breakout's four
 *   encounter decks and per-villain version aren't expressible in Green Goblin's single-villain shape), instead
 *   of one shared builder both scenario packs' tests call.
 *
 * A caller still must pass `WAVE1_DEPS` (not `CORE_DEPS`) to `createGame`/`applyCommand`, so wave 1 ability ids
 * resolve — `cardPool` only decides which *cards* are legal, not which *abilities* run them.
 */
export type Wave1Difficulty = CoreDifficulty | "extreme";

export interface Wave1ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave1Difficulty;
  /**
   * Multi-villain scenarios only (Breakout): each villain's own printed version, in the scenario's printed order
   * (Wrecker, Thunderball, Piledriver, Bulldozer), overriding `difficulty`'s uniform default for that one villain
   * (docs/phase7-wave1.md §2.3: "Version A for standard, B for expert, or a mix").
   */
  readonly villainVersions?: readonly ("A" | "B" | "extreme")[];
}

const cardsById = new Map<string, AnyCard>(WAVE1_CARDS.map((card) => [card.id, card]));

/** A wave 1 or Core starter deck as a player seat (quantities expanded; the identity isn't part of the deck). */
export function wave1StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = WAVE1_STARTER_DECKS.find((d) => d.id === starterDeckId) ?? CORE_STARTER_DECKS.find((d) => d.id === starterDeckId);
  if (!starter) throw new Error(`no wave 1 or Core starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

const seatsOf = (players: readonly CorePlayer[]): PlayerSetup[] =>
  players.map((seat) => {
    if ("starterDeckId" in seat) return wave1StarterDeckSetup(seat.starterDeckId);
    return { identityCardId: seat.identityCardId as CardId, deck: seat.deck as readonly CardId[], ...(seat.aspects ? { aspects: seat.aspects } : {}) };
  });

/**
 * Every card in these encounter sets (`quantityInSet` copies each), read from `WAVE1_CARDS` rather than
 * `@mc/cards/core`'s `encounterCardsOf` (`core/setup.ts`), which is hardcoded to `CORE_CARDS` and so never sees a
 * wave 1 set (Risky Business, Mutagen Formula, Wrecker, Thunderball, Piledriver, Bulldozer, …). Copied and
 * re-pointed, not imported: the function itself is otherwise identical.
 */
function wave1EncounterCardsOf(setIds: readonly string[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = WAVE1_CARDS.filter(
      (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId) && card.type !== "villain" && card.type !== "main_scheme",
    );
    if (members.length === 0) throw new Error(`encounter set ${setId} has no wave 1 cards`);
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) deck.push(card.id);
  }
  return deck;
}

/** A single-villain wave 1 scenario (Risky Business, Mutagen Formula) — the `gobScenario` shape, generalized. */
function buildSingleVillain(scenario: (typeof WAVE1_SCENARIOS)[number], options: Wave1ScenarioOptions): GameSetupConfig {
  if (options.difficulty === "extreme") throw new Error(`${scenario.id} has one villain; "extreme" is Breakout's own multi-villain challenge`);
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
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  return {
    seed: options.seed,
    cards: WAVE1_CARDS,
    villainCardId: scenario.villainCardId,
    villainSide: side.side,
    villainStartStageIndex: stageIndex(firstStage),
    villainLastStageIndex: stageIndex(lastStage),
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: wave1EncounterCardsOf(sets),
    players: seatsOf(options.players),
    includeIdentitySets: scenario.usesIdentityEncounterSets ?? true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

/**
 * A multi-villain wave 1 scenario (Breakout, The Wrecking Crew's four villains at once — docs/phase7-wave1.md
 * §2.3, §3.1/§3.2). Every villain gets its own 15-card encounter deck (built from its own `encounterSetIds`,
 * never shuffled together — `VillainSetup.encounterDeck`) and its own signature side scheme, and the whole
 * `villains` list replaces the single-villain `villainSide`/`villainStartStageIndex`/`encounterDeck` fields (the
 * engine refuses both at once, `setup.ts` "with `villains`, side and stages are set per villain").
 */
function buildMultiVillain(scenario: (typeof WAVE1_SCENARIOS)[number], options: Wave1ScenarioOptions): GameSetupConfig {
  const multi = scenario.multipleVillains;
  if (!multi) throw new Error(`${scenario.id} has no multipleVillains`);
  if (options.difficulty !== undefined && options.difficulty !== "standard" && options.difficulty !== "expert" && options.difficulty !== "extreme") {
    throw new Error(`unknown difficulty ${options.difficulty as string}`);
  }
  const defaultVersion: VillainVersion = options.difficulty === "expert" ? "B" : options.difficulty === "extreme" ? "extreme" : "A";
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  const villains: VillainSetup[] = multi.villains.map((villain, index) => ({
    villainCardId: villain.villainCardId,
    encounterDeck: wave1EncounterCardsOf(villain.encounterSetIds),
    version: options.villainVersions?.[index] ?? defaultVersion,
    ...(villain.signatureSideSchemeCardId ? { signatureSideSchemeCardId: villain.signatureSideSchemeCardId } : {}),
  }));
  return {
    seed: options.seed,
    cards: WAVE1_CARDS,
    villainCardId: scenario.villainCardId,
    villains,
    mainSchemeCardId: scenario.mainSchemeCardId,
    encounterDeck: [],
    players: seatsOf(options.players),
    includeIdentitySets: scenario.usesIdentityEncounterSets ?? true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

/**
 * Any `WAVE1_SCENARIOS` scenario (single-villain or Breakout's four-at-once), or — for a scenario id it doesn't
 * have — a Core scenario seated with wave 1 content (`coreScenario` above), unchanged.
 */
export function wave1Scenario(scenarioId: string, options: Wave1ScenarioOptions): GameSetupConfig {
  const scenario = WAVE1_SCENARIOS.find((s) => s.id === scenarioId);
  if (scenario) return scenario.multipleVillains ? buildMultiVillain(scenario, options) : buildSingleVillain(scenario, options);
  if (options.difficulty === "extreme") throw new Error(`${scenarioId} is a Core scenario; "extreme" is Breakout's own multi-villain challenge`);
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = wave1StarterDeckSetup(seat.starterDeckId);
    return { identityCardId: setup.identityCardId, deck: setup.deck, ...(setup.aspects ? { aspects: setup.aspects } : {}) };
  });
  const { difficulty: _difficulty, villainVersions: _villainVersions, ...rest } = options;
  return coreScenario(scenarioId, { ...rest, ...(options.difficulty ? { difficulty: options.difficulty as CoreDifficulty } : {}), players, cardPool: WAVE1_CARDS });
}
