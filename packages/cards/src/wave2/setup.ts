import { CORE_STARTER_DECKS, WAVE2_CARDS, WAVE2_STARTER_DECKS, encounterSetId, type AnyCard, type CardId, type ScenarioSeparateDeck } from "@mc/content";
import type { GameSetupConfig, PlayerSetup } from "@mc/engine";
import { coreScenario, type CoreDifficulty, type CorePlayer, type CoreScenarioOptions } from "../core/setup.js";

/**
 * A Core scenario (Rhino/Klaw/Ultron), or one of cycle 1's own scenarios, seated with wave 2 content — the cycle 1
 * analog of `../wave1/setup.ts`'s `wave1Scenario`. Read that file's docblock first: the same obstacle
 * (`coreScenario` hardcodes `cards: CORE_CARDS`) and the same fix (`cardPool`) apply here.
 *
 * **Why this can't yet be `Scenario`-data-driven the way `wave1Scenario` is for Green Goblin/The Wrecking Crew:**
 * `@mc/content`'s `WAVE2_SCENARIOS` is deliberately empty (`packages/content/src/data/index.ts`'s own docblock:
 * "No `ScenarioCuration` has been written yet for any of the six packs [...] `WAVE2_CARDS` already carries every
 * scenario's villain, main scheme and encounter cards"). Building `Scenario` *records* is `card-data-pipeline`'s
 * work (flagged in `docs/phase7-wave2-scripting.md`), not `@mc/cards`'s — this module owns `packages/cards/**`
 * only. So each cycle 1 scenario this file knows how to set up is a small hand-written function here (the same
 * shape `wave1/gob/testing.ts`'s stopgap `gobScenario` used before `WAVE1_SCENARIOS` existed), reading card ids
 * straight out of `WAVE2_CARDS` by code, not through a `Scenario` object. Once `card-data-pipeline` lands
 * `WAVE2_SCENARIOS`, this file should be rewritten to dispatch through it the way `wave1Scenario` does, and these
 * one-off functions retired.
 *
 * **Scripted so far: Crossbones only** (`crossbonesScenario`, below) — the one cycle 1 scenario whose villain, main
 * scheme and own encounter set are scripted (`wave2/trors/crossbones.ts`). Absorbing Man, Taskmaster, Zola, Red
 * Skull and Kang all need their own card scripts first (docs/phase7-wave2-scripting.md "Progress").
 */
export type Wave2Difficulty = CoreDifficulty;

export interface Wave2ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave2Difficulty;
}

const cardsById = new Map<string, AnyCard>(WAVE2_CARDS.map((card) => [card.id, card]));

/** A wave 2 or Core starter deck as a player seat (quantities expanded; the identity isn't part of the deck). */
export function wave2StarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = WAVE2_STARTER_DECKS.find((d) => d.id === starterDeckId) ?? CORE_STARTER_DECKS.find((d) => d.id === starterDeckId);
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
    return { identityCardId: seat.identityCardId as CardId, deck: seat.deck as readonly CardId[], ...(seat.aspects ? { aspects: seat.aspects } : {}) };
  });

/**
 * Every card in these encounter sets (`quantityInSet` copies each), read from `WAVE2_CARDS` rather than
 * `@mc/cards/core`'s `encounterCardsOf`, which is hardcoded to `CORE_CARDS` and so never sees a cycle 1 set.
 * Copied and re-pointed from `../wave1/setup.ts`'s `wave1EncounterCardsOf`, not imported: the function itself is
 * otherwise identical.
 */
function wave2EncounterCardsOf(setIds: readonly string[]): CardId[] {
  const deck: CardId[] = [];
  for (const setId of setIds) {
    const members = WAVE2_CARDS.filter(
      (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId) && card.type !== "villain" && card.type !== "main_scheme",
    );
    if (members.length === 0) throw new Error(`encounter set ${setId} has no wave 2 card`);
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) deck.push(card.id);
  }
  return deck;
}

function villainStageIndex(villainCardId: string, stageNumber: number): number {
  const villain = cardsById.get(villainCardId);
  if (!villain || villain.type !== "villain") throw new Error(`${villainCardId} is not a villain`);
  const side = villain.sides[0];
  if (!side) throw new Error(`${villain.name} has no sides`);
  const index = side.stages.findIndex((stage) => stage.stageNumber === stageNumber);
  if (index < 0) throw new Error(`${villain.name} has no stage ${stageNumber}`);
  return index;
}

/**
 * Crossbones (The Rise of Red Skull's first scenario): "Attack on Mount Athena" → "The Infinity Stone" → "The
 * Getaway" (04061a/04062b/04063b), villain Crossbones (04058 stage I / 04059 stage II / 04060 stage III;
 * docs/phase7-wave2.md §2.2 "Each scenario's villain deck is I–II standard and II–III expert"). Modular sets:
 * Hydra Assault and Weapon Master are scripted as `EncounterSet`s; "Legions of Hydra" is not (the 1A text prints a
 * third modular set that has no `EncounterSet` in `@mc/content` yet — docs/phase7-wave2.md §5.1's parser-needs
 * table doesn't cover it either; flagged in `docs/phase7-wave2-scripting.md` for `card-data-pipeline`), so only
 * the two that exist are used here.
 */
function crossbonesScenario(options: Wave2ScenarioOptions): GameSetupConfig {
  const difficulty = options.difficulty ?? "standard";
  const [firstStage, lastStage] = difficulty === "expert" ? [2, 3] : [1, 2];
  const sets = ["crossbones", "exper_weapon", ...(options.modularSetIds ?? ["hydra_assault", "weap_master"]), "standard"];
  if (options.players.length < 1 || options.players.length > 4) throw new Error("a game has 1-4 players");
  const experimentalWeapons: ScenarioSeparateDeck = {
    name: "Experimental Weapons",
    contents: { encounterSetIds: [encounterSetId("exper_weapon")] },
    discardPile: "encounter",
    whenEmpty: "remainsEmpty",
  };
  return {
    seed: options.seed,
    cards: WAVE2_CARDS,
    villainCardId: "04058" as CardId,
    villainSide: "A",
    villainStartStageIndex: villainStageIndex("04058", firstStage),
    villainLastStageIndex: villainStageIndex("04058", lastStage),
    mainSchemeCardId: "04061a" as CardId,
    encounterDeck: wave2EncounterCardsOf(sets),
    players: seatsOf(options.players),
    includeIdentitySets: true,
    requireIdentitySets: true,
    requireLegalDecks: true,
    scenarioDecks: [experimentalWeapons],
    ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
  };
}

const TRORS_SCENARIOS: Readonly<Record<string, (options: Wave2ScenarioOptions) => GameSetupConfig>> = {
  crossbones: crossbonesScenario,
};

/**
 * A cycle 1 scenario this file knows how to build (`TRORS_SCENARIOS`, so far only Crossbones), or — for a
 * scenario id it doesn't have — a Core scenario (Rhino/Klaw/Ultron) seated with wave 2 content, mirroring
 * `wave1Scenario`'s own fallback.
 */
export function wave2Scenario(scenarioId: string, options: Wave2ScenarioOptions): GameSetupConfig {
  const builder = TRORS_SCENARIOS[scenarioId];
  if (builder) return builder(options);
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = wave2StarterDeckSetup(seat.starterDeckId);
    return { identityCardId: setup.identityCardId, deck: setup.deck, ...(setup.aspects ? { aspects: setup.aspects } : {}) };
  });
  return coreScenario(scenarioId, { ...options, players, cardPool: WAVE2_CARDS });
}
