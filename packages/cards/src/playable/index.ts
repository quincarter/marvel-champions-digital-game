/**
 * The playable pool: every scripted wave at once (Core, wave 1, cycle 1). `WAVE1_*` and `WAVE2_*` are sibling
 * pools that each start from Core and know nothing of each other, which is right for a pack's own tests and wrong
 * for an app where a cycle 1 hero sits down against a wave 1 villain. This module is that union, built from the
 * waves' own exports so a pack is still added in exactly one place (its wave's `index.ts`).
 *
 * **Adding a wave is one registry list and one scenario lookup here.**
 */
import {
  CORE_STARTER_DECKS,
  PLAYABLE_CARDS,
  WAVE1_STARTER_DECKS,
  WAVE2_SCENARIOS,
  WAVE2_STARTER_DECKS,
  type StarterDeck,
} from "@mc/content";
import type { AbilityRegistry, EngineDeps, GameSetupConfig, PlayerSetup } from "@mc/engine";
import type { CorePlayer } from "../core/setup.js";
import { WAVE1_ABILITIES } from "../wave1/index.js";
import { wave1Scenario, type Wave1ScenarioOptions } from "../wave1/setup.js";
import { WAVE2_ABILITIES } from "../wave2/index.js";
import { wave2Scenario } from "../wave2/setup.js";

/**
 * Every scripted ability. Both waves' registries carry Core's own scripts, as the same objects under the same ids,
 * so this is a plain union rather than `mergeRegistries` (whose "defined twice" guard would trip on exactly that
 * overlap). An id two waves define *differently* is still an error.
 */
function unionRegistries(...registries: readonly AbilityRegistry[]): AbilityRegistry {
  const union: Record<string, AbilityRegistry[string]> = {};
  for (const registry of registries) {
    for (const [id, ability] of Object.entries(registry)) {
      if (id in union && union[id] !== ability) throw new Error(`ability ${id} is defined differently by two waves`);
      union[id] = ability;
    }
  }
  return union;
}

export const PLAYABLE_ABILITIES: AbilityRegistry = unionRegistries(WAVE1_ABILITIES, WAVE2_ABILITIES);

/** Engine dependencies for a game on the playable pool. */
export const PLAYABLE_DEPS: EngineDeps = { abilities: PLAYABLE_ABILITIES };

/** Wave 1's options are the widest (Breakout's `"extreme"` and `villainVersions`); every other builder takes a subset. */
export type PlayableScenarioOptions = Wave1ScenarioOptions;

const STARTER_DECKS: readonly StarterDeck[] = [...CORE_STARTER_DECKS, ...WAVE1_STARTER_DECKS, ...WAVE2_STARTER_DECKS];

/** Any starter deck in the playable pool as a player seat (quantities expanded; the identity isn't part of the deck). */
export function playableStarterDeckSetup(starterDeckId: string): PlayerSetup {
  const starter = STARTER_DECKS.find((deck) => deck.id === starterDeckId);
  if (!starter) throw new Error(`no playable starter deck ${starterDeckId}`);
  return {
    identityCardId: starter.identityCardId,
    aspects: starter.aspects,
    deck: starter.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
  };
}

/**
 * Any playable scenario, seated with any playable deck. The scenario's own wave builds it (each knows its own
 * setup quirks: Breakout's four villains, Kang's separate game areas, Red Skull's side-scheme deck), then the
 * game's card pool is widened to `PLAYABLE_CARDS` so a seat from another wave is a known card. Starter-deck seats
 * are resolved here first, because a wave's own builder only knows its own starter decks.
 */
export function playableScenario(scenarioId: string, options: PlayableScenarioOptions): GameSetupConfig {
  const players: readonly CorePlayer[] = options.players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = playableStarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: setup.identityCardId,
      deck: setup.deck,
      ...(setup.aspects ? { aspects: setup.aspects } : {}),
    };
  });
  const seated = { ...options, players };
  if (WAVE2_SCENARIOS.some((scenario) => scenario.id === scenarioId)) {
    if (seated.difficulty === "extreme")
      throw new Error(`${scenarioId} is a cycle 1 scenario; "extreme" is Breakout's own multi-villain challenge`);
    const { villainVersions: _villainVersions, difficulty, ...rest } = seated;
    return { ...wave2Scenario(scenarioId, { ...rest, ...(difficulty ? { difficulty } : {}) }), cards: PLAYABLE_CARDS };
  }
  // Wave 1's builder also seats a Core scenario, and rejects an id nobody knows.
  return { ...wave1Scenario(scenarioId, seated), cards: PLAYABLE_CARDS };
}
