import { cardsInPlay, createGame, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

/** Helpers for the Sabretooth tests: a game past setup (no modular sets: the Brotherhood and Mystique are other modules). */
export function sabretoothGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("sabretooth", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: [],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Every instance of `code` in play. */
export const inPlay = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));

export const kellyOf = (state: GameState): InstanceId => inPlay(state, "32066")[0]!;
/** Find the Senator, whichever face it shows (its instance keeps its id when it flips to Protect the Senator). */
export const senatorOf = (state: GameState): InstanceId => [...inPlay(state, "32065a"), ...inPlay(state, "32065b")][0]!;

/** Distinct cards from `player`'s hand and deck, one printing each `resource`, moved to the hand: the payment of a mixed cost. */
export function handForMixedCost(
  state: GameState,
  player: PlayerId,
  resources: readonly ("physical" | "mental" | "energy")[],
): { state: GameState; ids: InstanceId[] } {
  const owner = state.players.find((p) => p.playerId === player)!;
  const ids: InstanceId[] = [];
  for (const resource of resources) {
    const id = [...owner.hand, ...owner.deck].find((i) => {
      if (ids.includes(i)) return false;
      const card = state.cardPool[state.instances[i]!.cardId]!;
      return "resourceIcons" in card && (card.resourceIcons?.[resource] ?? 0) > 0;
    });
    if (!id) throw new Error(`${player} has no spare ${resource} card`);
    ids.push(id);
  }
  return {
    ids,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              deck: p.deck.filter((i) => !ids.includes(i)),
              hand: [...p.hand.filter((i) => !ids.includes(i)), ...ids],
            }
          : p,
      ),
    },
  };
}
