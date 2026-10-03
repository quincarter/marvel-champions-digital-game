import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles, inPlay } from "./brotherhood-testing.js";

/** A Sabretooth game with the Mystique modular set (the Brotherhood left out), a Core hero, past setup. */
export function mystiqueGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("sabretooth", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["mystique"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** One copy of encounter card `code` (deck, else discard) moved to the top of `player`'s deck, facedown and unowned. */
export function onTopOfPlayerDeck(
  state: GameState,
  code: string,
  player: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const id = [...piles.deck, ...piles.discard].find((i) => state.instances[i]!.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: piles.deck.filter((i) => i !== id), discard: piles.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, deck: [id, ...p.deck] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: false } },
    },
  };
}

/** Every instance of `code` in play. */
export const inPlayIds = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));

export const resolvedRefs = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));
