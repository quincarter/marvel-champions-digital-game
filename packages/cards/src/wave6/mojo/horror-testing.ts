import { activeEncounterDeckId, createGame, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles, inPlay } from "../mut_gen/magneto-testing.js";

/**
 * A Magneto game with the Horror set as its modular set (Core hero by default), past setup. Magneto stands in for the
 * Mojo scenarios, which `wave6Scenario` does not build yet; the Horror set is the same cards either way.
 */
export function horrorGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("magneto", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["horror"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Moves the first `code` in the encounter deck to the top of the encounter discard pile (state surgery). */
export function toEncounterDiscard(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => state.instances[i]!.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: [id, ...pile.discard] },
      },
    },
  };
}

/**
 * Tucks `ids` (cards out of play, in `player`'s hand, deck or discard) facedown under `host`, the state `tuckCards`
 * leaves: unlike `tuckBySurgery` (wideawake-testing) it keeps each card's player `home`, so a card discarded from under
 * `host` goes to its owner's discard pile.
 */
export function tuckAllies(state: GameState, host: InstanceId, ids: readonly InstanceId[]): GameState {
  const strip = (zone: readonly InstanceId[]) => zone.filter((i) => !ids.includes(i));
  const instances = { ...state.instances };
  for (const id of ids) instances[id] = { ...instances[id]!, faceup: false };
  instances[host] = { ...instances[host]!, tucked: [...instances[host]!.tucked, ...ids] };
  return {
    ...state,
    instances,
    players: state.players.map((p) => ({ ...p, deck: strip(p.deck), hand: strip(p.hand), discard: strip(p.discard) })),
  };
}
