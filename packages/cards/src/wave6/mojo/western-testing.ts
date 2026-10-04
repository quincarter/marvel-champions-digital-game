import { createGame, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles, inPlay } from "../mut_gen/magneto-testing.js";

/**
 * A Magneto game with the Western set as its modular set (Core hero by default), past setup. Magneto stands in for the
 * Mojo scenarios, which `wave6Scenario` does not build yet (their Wheel of Genres is a later row); the Western set is
 * the same cards either way.
 */
export function westernGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("magneto", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["western"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** `player`'s hand is exactly `ids` (state surgery); every other card they held goes to the bottom of their deck. */
export function withHand(state: GameState, player: PlayerId, ids: readonly InstanceId[]): GameState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.playerId !== player) return p;
      const others = p.hand.filter((id) => !ids.includes(id));
      return {
        ...p,
        hand: [...ids],
        deck: [...p.deck.filter((id) => !ids.includes(id)), ...others],
        discard: p.discard.filter((id) => !ids.includes(id)),
      };
    }),
  };
}
