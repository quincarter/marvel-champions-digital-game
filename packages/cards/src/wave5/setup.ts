import { CORE_STARTER_DECKS, SM_STARTER_DECKS, type CardId } from "@mc/content";
import type { GameSetupConfig, PlayerSetup } from "@mc/engine";
import { coreScenario, type CorePlayer, type CoreScenarioOptions } from "../core/setup.js";
import { WAVE5_CARDS } from "./cards.js";

// (seatsOf below expands a `starterDeckId` seat to identityCardId/deck before calling `coreScenario`, which only
// knows `CORE_STARTER_DECKS` by that name — `wave1/setup.ts`'s own `wave1Scenario` precedent.)

/**
 * A Core scenario (Rhino/Klaw/Ultron) seated with wave 5 content, the same `cardPool` widening
 * `wave1/setup.ts`'s `wave1Scenario` introduced (docs/phase7-wave1.md §2.3/§3.15). **No `sm` scenario builder
 * yet** (Sandman/Venom/Mysterio/The Sinister Six/Venom Goblin are a later agent's work, docs/phase7-wave5.md
 * §5) — `scenarioId` always falls through to `coreScenario`, unlike `wave1Scenario`/`wave4Scenario`'s own
 * `WAVE1_SCENARIOS`/`MTS_SCENARIOS` lookups. Add that lookup here, ahead of the `coreScenario` fallback, once a
 * scenario-building agent scripts one.
 */
export type Wave5ScenarioOptions = Omit<CoreScenarioOptions, "cardPool">;

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
const seatsOf = (players: readonly CorePlayer[]): CorePlayer[] =>
  players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
    const setup = wave5StarterDeckSetup(seat.starterDeckId);
    return {
      identityCardId: setup.identityCardId,
      deck: setup.deck,
      ...(setup.aspects ? { aspects: setup.aspects } : {}),
    };
  });

export function wave5Scenario(scenarioId: string, options: Wave5ScenarioOptions): GameSetupConfig {
  return coreScenario(scenarioId, { ...options, players: seatsOf(options.players), cardPool: WAVE5_CARDS });
}
