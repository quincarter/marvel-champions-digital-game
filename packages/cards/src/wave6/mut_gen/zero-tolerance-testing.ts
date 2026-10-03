import { activeEncounterDeckId, cardsInPlay, createGame, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

/** Takes every minion out of play (to the encounter discard pile): Master Mold's setup deals each player a Sentinel. */
function withoutMinions(state: GameState): GameState {
  const gone = cardsInPlay(state).filter((id) => state.cardPool[state.instances[id]!.cardId]!.type === "minion");
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !gone.includes(i)) })),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...gone] } },
  };
}

/** A Master Mold game with Zero Tolerance as its modular set, past setup, with no minion in play. */
export function zeroToleranceGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("master-mold", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["zero_tolerance"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return withoutMinions(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
}

/** Every instance of `code` in the active encounter deck or its discard pile. */
export const inEncounterPile = (state: GameState, code: string): InstanceId[] => {
  const pile = state.encounterDecks[activeEncounterDeckId(state)]!;
  return [...pile.deck, ...pile.discard].filter((id) => state.instances[id]!.cardId === cardId(code));
};
