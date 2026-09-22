/**
 * Hawkeye's Quiver: "You may play Arrow events attached to this card as if they were in your hand." The engine has
 * always offered such an Arrow as a legal play, but the table only draws the hand, and a play-area card tile draws no
 * attachments — so an Arrow the Quiver found was legal and drawn nowhere (2026-09-21 report). The board model now
 * carries it at the end of the hand strip, tagged with where it is (`HandCardView.from`).
 *
 * Real content, real commands: the Hawkeye (Leadership) precon against Rhino.
 */
import { describe, expect, test } from "vitest";
import { applyCommand, legalActions, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { EngineSessionCore } from "../engine/session-core.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";

const BOW = "04002";
const QUIVER = "04003";
const CABLE_ARROW = "04008";

function run(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command, POOL_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

/** Answers every open choice with its first legal answer until none is open (or `stop` says to wait). */
function settle(state: GameState, stop: (s: GameState) => boolean = () => false): GameState {
  let current = state;
  for (let guard = 0; guard < 40 && current.pendingChoice && !stop(current); guard++) {
    const choice = current.pendingChoice;
    current = run(current, {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
    });
  }
  return current;
}

const idOf = (state: GameState, ids: readonly InstanceId[], code: string): InstanceId => {
  const id = ids.find((candidate) => state.instances[candidate]?.cardId === code);
  if (!id) throw new Error(`no ${code}`);
  return id;
};

async function hawkeyeWithQuiverArrow(): Promise<{ state: GameState; me: PlayerId; cable: InstanceId }> {
  const core = new EngineSessionCore();
  const started = await core.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "hawkeye-leadership" }],
    seed: 11,
  });
  let state = settle({ ...started.snapshot.state, cardPool: started.cardPool } as GameState);
  const me = state.players[0]!.playerId;
  if (state.players[0]!.identity.form !== "hero") state = run(state, { type: "changeForm", playerId: me });

  // The Quiver into hand, Cable Arrow on top of the deck, so the Quiver's "search the top 5" is sure to find it.
  const seat = state.players[0]!;
  const pool = [...seat.deck, ...seat.hand, ...seat.discard];
  const bow = idOf(state, pool, BOW);
  const quiver = idOf(state, pool, QUIVER);
  const cable = idOf(state, pool, CABLE_ARROW);
  const moved = new Set([bow, quiver, cable]);
  state = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === me
        ? {
            ...p,
            hand: [...p.hand.filter((id) => !moved.has(id)), bow, quiver],
            deck: [cable, ...p.deck.filter((id) => !moved.has(id))],
            discard: p.discard.filter((id) => !moved.has(id)),
          }
        : p,
    ),
  };

  // Cable Arrow's own cost exhausts Hawkeye's Bow, so the Bow has to be in play for the Arrow to be playable.
  const playBow = legalOf(state, me).find((e) => e.action.kind === "playCard" && e.action.instanceId === bow);
  if (!playBow) throw new Error("the Bow is not playable");
  state = settle(run(state, playBow.example));

  const playQuiver = legalOf(state, me).find((e) => e.action.kind === "playCard" && e.action.instanceId === quiver);
  if (!playQuiver) throw new Error("the Quiver is not playable");
  state = settle(run(state, playQuiver.example));

  const search = legalOf(state, me).find((e) => e.action.kind === "useAbility" && e.action.instanceId === quiver);
  if (!search) throw new Error("the Quiver's search is not usable");
  state = run(state, search.example);
  // The search's pick: take Cable Arrow.
  const choice = state.pendingChoice;
  if (!choice) throw new Error("the search asked nothing");
  const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === cable);
  if (!option) throw new Error("Cable Arrow was not offered by the search");
  state = settle(
    run(state, {
      type: "resolveChoice",
      playerId: me,
      choiceId: choice.choiceId,
      selectedOptionIds: [option.optionId],
    }),
  );
  expect(state.instances[cable]?.attachedTo).toBe(quiver);
  return { state, me, cable };
}

function legalOf(state: GameState, me: PlayerId) {
  const legal = legalActions(state, me, POOL_DEPS);
  if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
  return legal.legal;
}

describe("Hawkeye's Quiver on the board", () => {
  test("an Arrow attached to the Quiver rides at the end of the hand strip, tagged with where it is, and plays from there", async () => {
    const { state, me, cable } = await hawkeyeWithQuiverArrow();
    const model = boardModel(state, me, POOL_DEPS);
    const onQuiver = model.hand.find((card) => card.instanceId === cable);
    expect(onQuiver?.from).toBe("on Hawkeye's Quiver");
    expect(model.hand[model.hand.length - 1]?.instanceId).toBe(cable);
    // The caption counts only the real hand.
    expect(model.handLimit).toBe(state.players[0]!.hand.length);
    expect(model.hand.filter((card) => card.from === null)).toHaveLength(model.handLimit);

    // …and the engine accepts playing it from there, so a tap on it does something.
    const play = legalOf(state, me).find((e) => e.action.kind === "playCard" && e.action.instanceId === cable);
    expect(play).toBeDefined();
    const played = settle(run(state, play!.example));
    expect(played.instances[cable]?.attachedTo).toBeNull();
  });

  test("real hand cards carry no location tag", async () => {
    const { state, me } = await hawkeyeWithQuiverArrow();
    const hand = new Set(state.players[0]!.hand);
    for (const card of boardModel(state, me, POOL_DEPS).hand) {
      if (hand.has(card.instanceId)) expect(card.from).toBeNull();
    }
  });
});
