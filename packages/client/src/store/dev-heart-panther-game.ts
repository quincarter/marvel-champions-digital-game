/**
 * The `?screen=board&fixture=heart-panther` dev jump (`scenes/boot-dev-jump.ts`, issue #425): a real Black Panther
 * (Shuri) game against Rhino, stopped on her first turn in hero form with the T'Challa ally (51002) in play and Heart of
 * the Panther (51025) in hand, so the hand shows it playable rather than "needs partner". The ally and the event are
 * moved there by state surgery: no card effect does this.
 */
import type { GameState, InstanceId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import type { SessionConfig } from "../engine/host.js";
import { DevStateHost } from "../engine/dev-state-host.js";
import { appSession, useDevHost } from "../session.js";
import { codeOf, nextTurn } from "./dev-game-steps.js";

export const HEART_OF_THE_PANTHER = "51025";
export const TCHALLA_ALLY = "51002";

export const HEART_PANTHER_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "bp-justice" }],
  seed: 3,
};

/** The seat's T'Challa ally in its play area and Heart of the Panther in its hand, its identity in hero form. */
export function stageHeartOfThePanther(state: GameState): GameState {
  const [seat, ...rest] = state.players;
  if (!seat) return state;
  const owned = [...seat.deck, ...seat.discard, ...seat.hand, ...seat.playArea];
  const find = (code: string): InstanceId | undefined => owned.find((id) => codeOf(state, id) === code);
  const ally = find(TCHALLA_ALLY);
  const heart = find(HEART_OF_THE_PANTHER);
  if (!ally || !heart) return state;
  const out = (ids: readonly InstanceId[]) => ids.filter((id) => id !== ally && id !== heart);
  const moved = {
    ...seat,
    identity: { ...seat.identity, form: "hero" as const },
    deck: out(seat.deck),
    discard: out(seat.discard),
    hand: [...out(seat.hand), heart],
    playArea: seat.playArea.includes(ally) ? seat.playArea : [...seat.playArea, ally],
  };
  const instances = {
    ...state.instances,
    [ally]: { ...state.instances[ally]!, faceup: true, controllerId: seat.playerId },
    [heart]: { ...state.instances[heart]!, faceup: true },
  };
  return { ...state, instances, players: [moved, ...rest] };
}

export async function startDevHeartPantherGame(): Promise<void> {
  const store = appSession().store;
  await store.start(HEART_PANTHER_CONFIG);
  await nextTurn(store);
  useDevHost(new DevStateHost(stageHeartOfThePanther(store.state.game!), POOL_DEPS));
  await appSession().store.start(HEART_PANTHER_CONFIG);
  await nextTurn(appSession().store);
}
