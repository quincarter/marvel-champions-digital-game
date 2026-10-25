/**
 * Make the Call (01071) opens a pay step the player fills (#419). "Pay the printed cost of an ally in any player's
 * discard pile" lists every card in every discard pile as a candidate, so with no pick made yet (one ally to choose,
 * nothing to aim) the payment used to be priced against the first discarded card. An event there gave no requirement,
 * `paymentFor` returned null, and the board sent `LegalAction.example`, spending hand cards the engine picked.
 */

import { CORE_STARTER_DECKS, type CardId } from "@mc/content";
import { createGame, legalActions, paymentFor, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { firstLegal, moveToHand, P1, playerOf, settle } from "../../testing/harness.js";

const MAKE_THE_CALL = "01071";
const NICK_FURY = "01084"; // ally, cost 4
const GET_READY = "01069"; // event

function opening(): GameState {
  const starter = CORE_STARTER_DECKS.find((deck) => deck.id === "core-captain-marvel-leadership")!;
  const deck = starter.cards.flatMap((entry) => Array.from({ length: entry.quantity }, () => entry.cardId as CardId));
  const scenario = playableScenario("rhino", {
    seed: 11,
    players: [{ identityCardId: starter.identityCardId as CardId, aspects: ["leadership"], deck }] as never,
  });
  const created = createGame(scenario, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
}

/** Make the Call in P1's hand, and P1's discard pile holding an event above Nick Fury. */
function withEventAboveTheAlly(): { state: GameState; call: InstanceId; fury: InstanceId } {
  const moved = moveToHand(opening(), P1, MAKE_THE_CALL, NICK_FURY, GET_READY);
  const [call, fury, event] = moved.ids as [InstanceId, InstanceId, InstanceId];
  const seat = playerOf(moved.state, P1);
  const state: GameState = {
    ...moved.state,
    players: moved.state.players.map((player) =>
      player.playerId === P1
        ? { ...seat, hand: seat.hand.filter((id) => id !== fury && id !== event), discard: [event, fury] }
        : player,
    ),
  };
  return { state, call, fury };
}

describe("01071 Make the Call: the pay step with one ally to choose (#419)", () => {
  it("lists only the ally as the pick, and prices the pay step at its printed cost with no pick made", () => {
    const { state, call, fury } = withEventAboveTheAlly();
    const legal = legalActions(state, P1, PLAYABLE_DEPS);
    if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
    const entry = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === call)!;
    expect(entry.targets).toEqual([fury]);
    expect(entry.needsPayment).toBe(true);

    const query = paymentFor(state, P1, entry.action, { target: null }, PLAYABLE_DEPS);
    expect(query?.requirement.generic).toBe(4);
  });
});
