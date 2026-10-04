/**
 * "Remove each [type] counter from [card] →" as a cost (`spendCounters.all`, `bind`): every counter of that type on the
 * holder, with no player choice. Bishop (`gambit` 37011): "Interrupt: When Bishop attacks, remove each energy counter
 * from him → for each counter discarded this way, he gets +2 ATK for this attack (to a maximum of +6 ATK)." Synthetic
 * cards shaped like it: "Action: Remove each growth counter from your identity → draw that many cards."
 *
 * At least one counter: RRG 1.8 "Cost" (p. 14): "A cost requiring 'any number' or 'up to' some number of game elements
 * requires a minimum of one such game element." "Each" is read as the same variable-quantity cost (by analogy; reported
 * as a rules question), so with no counters the ability cannot be initiated.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command, CostSelection } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard, RESOURCE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

const DRAIN_ABILITY = stubAbility(
  "drain.action",
  def({
    trigger: { kind: "action" },
    cost: { spendCounters: { counterType: "growth", amount: 1, target: "identity", all: true, bind: "x" } },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "var", name: "x" } }],
  }),
);
const DRAIN = stubEvent({ id: "drain", cost: 0, abilities: [DRAIN_ABILITY.ref] });
const deps = depsOf(DRAIN_ABILITY);

/** p1 with `growth` counters on her identity and the event in hand. */
function start(growth: number): { state: GameState; card: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [DRAIN],
    deps,
    deck: [DRAIN.id, ...Array.from({ length: 20 }, () => RESOURCE.id)],
  });
  const identity = mustPlayer(base, P1).identity.instanceId;
  const withCounters: GameState = {
    ...base,
    instances: {
      ...base.instances,
      [identity]: { ...mustInstance(base, identity), counters: growth > 0 ? { growth } : {} },
    },
  };
  const card = giveCard(withCounters, P1, DRAIN.id);
  return { state: card.state, card: card.id };
}
const play = (card: InstanceId, costSelection?: CostSelection): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
  ...(costSelection ? { costSelection } : {}),
});
const growthOn = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters.growth ?? 0;
const handSize = (state: GameState): number => mustPlayer(state, P1).hand.length;

describe("'Remove each growth counter from your identity → draw that many cards'", () => {
  it("removes every counter and binds the count", () => {
    const { state, card } = start(3);
    const hand = handSize(state);
    const { session, events } = driveSession(startSession(state), deps, [play(card)]);
    expect(growthOn(session.state)).toBe(0);
    expect(handSize(session.state)).toBe(hand - 1 + 3);
    const removed = events.filter((e) => e.type === "counterRemoved");
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({ counterType: "growth", amount: 3 });
  });

  it("leaves no choice: a costSelection count is ignored, every counter is still removed", () => {
    const { state, card } = start(3);
    const hand = handSize(state);
    const { session } = driveSession(startSession(state), deps, [play(card, { counters: 1 })]);
    expect(growthOn(session.state)).toBe(0);
    expect(handSize(session.state)).toBe(hand - 1 + 3);
  });

  it("one counter: removes it and draws 1", () => {
    const { state, card } = start(1);
    const hand = handSize(state);
    const { session } = driveSession(startSession(state), deps, [play(card)]);
    expect(growthOn(session.state)).toBe(0);
    expect(handSize(session.state)).toBe(hand - 1 + 1);
  });

  it("near miss: with no counters it cannot be initiated (RRG 1.8 'Cost', p. 14, by analogy)", () => {
    const empty = start(0);
    expect(applyCommand(empty.state, play(empty.card), deps).ok).toBe(false);
    const actions = legalActions(empty.state, P1, deps);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === empty.card)).toBe(false);
  });

  it("legalActions offers it with no counter range to pick from", () => {
    const three = start(3);
    const actions = legalActions(three.state, P1, deps);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    const offered = actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === three.card);
    expect(offered).toBeDefined();
    expect(offered?.costCounters).toBeUndefined();
  });

  it("replays deep-equal", () => {
    const { state, card } = start(2);
    const { session } = driveSession(startSession(state), deps, [play(card)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
