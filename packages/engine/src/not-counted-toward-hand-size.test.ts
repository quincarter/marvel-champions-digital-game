/**
 * docs/phase7-wave5.md §3.18: a card that does not count toward hand size. Synthetic card shaped like Connection to the
 * Worldmind (`nova` 28007: "Connection to the Worldmind does not count toward your hand size.").
 *
 * Source: RRG 1.8 "Hand Size" (p. 21): discard down to or draw up to the hand size at the end of the player phase.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { handSize, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const WORLDMIND_CONSTANT = stubAbility("worldmind.constant", {
  trigger: { kind: "constant", notCountedTowardHandSize: true },
  effects: [],
});
const WORLDMIND = stubSupport({ id: "worldmind", cost: 0, abilities: [WORLDMIND_CONSTANT.ref] });
const FILLER = stubEvent({ id: "filler", cost: 9, abilities: [] });

const deps: EngineDeps = depsOf(WORLDMIND_CONSTANT);

/** A hand of Worldmind plus `others` filler cards (test surgery). */
function withHand(others: number): { readonly state: GameState; readonly worldmind: InstanceId } {
  const state = gameAtFirstTurn({ cards: [WORLDMIND, FILLER], deps, deck: [WORLDMIND.id, ...copiesOf(FILLER.id, 20)] });
  const seat = mustPlayer(state, P1);
  const pool = [...seat.hand, ...seat.deck];
  const worldmind = pool.find((id) => mustInstance(state, id).cardId === WORLDMIND.id)!;
  const fillers = pool.filter((id) => mustInstance(state, id).cardId === FILLER.id).slice(0, others);
  const hand = [worldmind, ...fillers];
  const rest = pool.filter((id) => !hand.includes(id));
  return {
    worldmind,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand, deck: rest, discard: [] } : p)),
    },
  };
}

function endTurn(state: GameState) {
  const step = state.step;
  if (step.kind !== "turn") throw new Error(step.kind);
  return driveSession(startSession(state), deps, [{ type: "endTurn", playerId: step.activePlayerId }]);
}

describe("§3.18 'does not count toward your hand size'", () => {
  it("the end-of-phase draw fills the hand size without it; replay deep-equal", () => {
    const { state } = withHand(2);
    const size = handSize(state, P1, deps);
    const { session } = endTurn(state);
    expect(mustPlayer(session.state, P1).hand).toHaveLength(size + 1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a full hand plus it discards nothing, and discarding it cannot stand in for a counted card", () => {
    const size = handSize(withHand(0).state, P1, deps);
    const full = withHand(size);
    const step = full.state.step;
    if (step.kind !== "turn") throw new Error(step.kind);
    const ended = applyCommand(full.state, { type: "endTurn", playerId: step.activePlayerId }, deps);
    if (!ended.ok) throw new Error(ended.error.message);
    const choice = ended.state.pendingChoice;
    expect(choice?.prompt.kind).toBe("discardDownToHandSize");
    expect(choice?.minSelections).toBe(0);

    const over = withHand(size + 1);
    const overStep = over.state.step;
    if (overStep.kind !== "turn") throw new Error(overStep.kind);
    const overEnded = applyCommand(over.state, { type: "endTurn", playerId: overStep.activePlayerId }, deps);
    if (!overEnded.ok) throw new Error(overEnded.error.message);
    const overChoice = overEnded.state.pendingChoice!;
    expect(overChoice.minSelections).toBe(1);
    const wrong = applyCommand(
      overEnded.state,
      {
        type: "resolveChoice",
        playerId: P1,
        choiceId: overChoice.choiceId,
        selectedOptionIds: [String(over.worldmind)],
      },
      deps,
    );
    expect(wrong.ok).toBe(false);
  });
});
