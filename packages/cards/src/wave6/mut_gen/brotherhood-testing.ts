import { activeEncounterDeckId, cardsInPlay, createGame, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

/**
 * A Sabretooth game with the Brotherhood as a modular set (Mystique left out: another module), past setup. No test
 * surgery is needed to have the four minions in the encounter deck: they come from the set's card data.
 */
export function brotherhoodGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("sabretooth", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["brotherhood"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Every instance of `code` in play. */
export const inPlay = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));

/** Every instance of `code` in the active encounter deck, its discard pile or a player's dealt facedown cards. */
export const inEncounterPiles = (state: GameState, code: string): InstanceId[] => {
  const pile = state.encounterDecks[activeEncounterDeckId(state)]!;
  const dealt = state.players.flatMap((p) => p.dealtEncounter);
  return [...pile.deck, ...pile.discard, ...dealt].filter((id) => state.instances[id]!.cardId === cardId(code));
};
