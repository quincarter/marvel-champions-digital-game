import {
  CORE_STARTER_DECKS,
  MTS_STARTER_DECKS,
  NEBU_STARTER_DECKS,
  VALK_STARTER_DECKS,
  VISION_STARTER_DECKS,
  WARM_STARTER_DECKS,
  type CardId,
} from "@mc/content";
import type { PlayerSetup } from "@mc/engine";
import { coreScenario, type CoreDifficulty, type CorePlayer, type CoreScenarioOptions } from "../core/setup.js";
import { WAVE4_CARDS } from "./cards.js";

/**
 * A wave 4 scenario builder, minimal on purpose: wave 4 has no scenario of its own yet (only the Nebula hero pack
 * is scripted so far, docs/phase7-wave4.md), so this only ever takes `coreScenario`'s own fallback branch — a Core
 * scenario seated with the wave 4 card pool (`WAVE3_CARDS`'s "cycle 2, no scenario of its own yet" precedent from
 * `wave3/setup.ts`, before `gmw` landed). Extend this the way `wave3Scenario` extended `wave2Scenario` once a wave
 * 4 pack ships its own `Scenario` record.
 */
export type Wave4Difficulty = CoreDifficulty;

export interface Wave4ScenarioOptions extends Omit<CoreScenarioOptions, "cardPool" | "difficulty"> {
  readonly difficulty?: Wave4Difficulty;
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

export function wave4Scenario(scenarioId: string, options: Wave4ScenarioOptions) {
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
