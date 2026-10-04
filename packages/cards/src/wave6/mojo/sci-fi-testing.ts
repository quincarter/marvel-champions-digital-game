import { activeEncounterDeckId, createGame, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles, inPlay } from "../mut_gen/magneto-testing.js";

/** A Rhino game with the Sci-Fi genre set as its modular set (Core hero by default), past setup. */
export function sciFiGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["sci-fi"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** The instances of `code` in the active encounter deck. */
export const inDeck = (state: GameState, code: string): InstanceId[] =>
  state.encounterDecks[activeEncounterDeckId(state)]!.deck.filter((id) => state.instances[id]!.cardId === cardId(code));
