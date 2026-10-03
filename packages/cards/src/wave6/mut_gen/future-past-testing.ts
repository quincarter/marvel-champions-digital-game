import { activeEncounterDeckId, createGame, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

/** A standalone Sabretooth game with Future Past as its modular set, past setup, with no minion in play. */
export function futurePastGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("sabretooth", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["future_past"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Every instance of `code` in the active encounter deck or its discard pile. */
export const inEncounterPile = (state: GameState, code: string): InstanceId[] => {
  const pile = state.encounterDecks[activeEncounterDeckId(state)]!;
  return [...pile.deck, ...pile.discard].filter((id) => state.instances[id]!.cardId === cardId(code));
};
