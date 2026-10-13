/**
 * `AbilityDefinition.minX`: the least X a player may name for a card with a printed X cost (`specialCost: "X"`).
 *
 * The owner's answer 52B (2026-10-13, docs/phase7-wave10.md §4.0): "Choose X schemes. Remove 2 threat from each chosen
 * scheme" cannot be played with X = 0, since it would choose no scheme and remove no threat. RRG 1.8 "Non-Numerical
 * Variable" (p. 30): X is "defined by card ability or player choice"; "Choose (Game Element)" (p. 12); "Target" (p. 42).
 *
 * Synthetic cards only. Each probe puts its X on the player's identity as counters.
 */

import type { CardId, PlayerCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { minimumChosenX } from "./actions.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions, paymentFor, tryPayment } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubResource } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const countX: EffectSpec = {
  kind: "addCounters",
  target: { kind: "identityOf", player: { kind: "controller" } },
  counterType: "x",
  amount: { kind: "var", name: "x" },
};
/** "Action: [do something to X things]", which at X = 0 does nothing: X is at least 1. */
const SPREAD_ACTION = stubAbility("spread.action", {
  trigger: { kind: "action" },
  minX: 1,
  effects: [countX],
} satisfies AbilityDefinition);
const SPREAD: PlayerCard = {
  ...stubEvent({ id: "spread", cost: 0, abilities: [SPREAD_ACTION.ref] }),
  specialCost: "X",
};
/** The same with no minimum: X may be 0, as for every X cost before. */
const LOOSE_ACTION = stubAbility("loose.action", { trigger: { kind: "action" }, effects: [countX] });
const LOOSE: PlayerCard = { ...stubEvent({ id: "loose", cost: 0, abilities: [LOOSE_ACTION.ref] }), specialCost: "X" };
/** A printed cost of 1: no X at all. */
const FIXED = stubEvent({ id: "fixed", cost: 1, abilities: [LOOSE_ACTION.ref] });
const ENERGY = stubResource({ id: "energy-card", icons: 1, produces: { energy: 1 } });

const CARDS = [SPREAD, LOOSE, FIXED, ENERGY];
const deps: EngineDeps = depsOf(SPREAD_ACTION, LOOSE_ACTION);

/** P1's first turn with a hand of exactly `hand` (by card id), in that order. */
function table(...hand: readonly CardId[]): { state: GameState; ids: readonly InstanceId[] } {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.flatMap((c) => [c.id, c.id, c.id]) });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
  };
  const ids = hand.map((cardId) => {
    const taken = mustPlayer(state, P1).deck.find((id) => mustInstance(state, id).cardId === cardId);
    if (!taken) throw new Error(`no ${cardId} in P1's deck`);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((x) => x !== taken), hand: [...p.hand, taken] } : p,
      ),
    };
    return taken;
  });
  return { state, ids };
}
const play = (card: InstanceId, payers: readonly InstanceId[], x?: number): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: payers.map((fromHand) => ({ fromHand })),
  attachToInstanceId: null,
  ...(x === undefined ? {} : { x }),
});
const xCounters = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters.x ?? 0;

describe("52B the least X of a printed X cost (AbilityDefinition.minX)", () => {
  it("X = 0, named or left out, is refused with the reason, paid for or not; nothing is spent", () => {
    const t = table(SPREAD.id, ENERGY.id);
    const [spread, energy] = t.ids as [InstanceId, InstanceId];
    for (const command of [play(spread, [], 0), play(spread, []), play(spread, [energy], 0)]) {
      const result = applyCommand(t.state, command, deps);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("invalid_choice");
      expect(result.error.message).toBe(
        `X must be at least 1 to play ${SPREAD.name}: with a lower X it would do nothing`,
      );
    }
    expect(mustPlayer(t.state, P1).hand).toEqual([spread, energy]);
  });

  it("X = 1 paid with 1 resource plays, and the ability reads X as 1", () => {
    const t = table(SPREAD.id, ENERGY.id);
    const [spread, energy] = t.ids as [InstanceId, InstanceId];
    const result = applyCommand(t.state, play(spread, [energy], 1), deps);
    if (!result.ok) throw new Error(result.error.message);
    expect(xCounters(result.state)).toBe(1);
    // X = 1 still has to be paid for.
    expect(applyCommand(t.state, play(spread, [], 1), deps)).toMatchObject({
      ok: false,
      error: { code: "insufficient_resources" },
    });
  });

  it("an X cost with no minimum still plays at X = 0", () => {
    const t = table(LOOSE.id);
    const [loose] = t.ids as [InstanceId];
    const result = applyCommand(t.state, play(loose, [], 0), deps);
    if (!result.ok) throw new Error(result.error.message);
    expect(xCounters(result.state)).toBe(0);
    expect(applyCommand(t.state, play(loose, []), deps).ok).toBe(true);
  });

  it("minimumChosenX: the ability's minimum for a printed X cost, 0 for any other card", () => {
    const t = table(SPREAD.id, LOOSE.id, FIXED.id);
    const [spread, loose, fixed] = t.ids as [InstanceId, InstanceId, InstanceId];
    expect(minimumChosenX(t.state, deps, spread)).toBe(1);
    expect(minimumChosenX(t.state, deps, spread, SPREAD_ACTION.ref.id)).toBe(1);
    expect(minimumChosenX(t.state, deps, loose)).toBe(0);
    expect(minimumChosenX(t.state, deps, fixed)).toBe(0);
  });

  it("legalActions probes the play at the least X: legal with a resource to pay for X = 1, not with an empty hand", () => {
    const playOf = (state: GameState, id: InstanceId) => {
      const listed = legalActions(state, P1, deps);
      if (listed.kind !== "turn") throw new Error("expected P1's turn");
      const is = (a: { action: { kind: string; instanceId?: InstanceId } }) =>
        a.action.kind === "playCard" && a.action.instanceId === id;
      return { legal: listed.legal.find(is), illegal: listed.illegal.find(is) };
    };
    const rich = table(SPREAD.id, ENERGY.id);
    const [spread, energy] = rich.ids as [InstanceId, InstanceId];
    expect(playOf(rich.state, spread).legal?.example).toMatchObject({ type: "playCard", x: 1 });
    // The pay step asks for the price of X = 1, and the command it builds names that X.
    const query = paymentFor(rich.state, P1, { kind: "playCard", instanceId: spread }, {}, deps);
    expect(query?.suggested).toEqual([`hand:${energy}`]);
    const tried = tryPayment(rich.state, P1, { kind: "playCard", instanceId: spread }, [`hand:${energy}`], {}, deps);
    expect(tried).toMatchObject({ ok: true, command: { x: 1 } });

    const poor = table(SPREAD.id);
    const [alone] = poor.ids as [InstanceId];
    expect(playOf(poor.state, alone).legal).toBeUndefined();
    expect(playOf(poor.state, alone).illegal).toMatchObject({ reason: "insufficient_resources" });

    // An X cost with no minimum is still probed at X = 0: legal with an empty hand, and its command names no X.
    const loose = table(LOOSE.id);
    const [free] = loose.ids as [InstanceId];
    expect(playOf(loose.state, free).legal?.example).not.toHaveProperty("x");
  });

  it("PaymentContext.x: the pay step prices the X the player names", () => {
    const t = table(SPREAD.id, ENERGY.id, ENERGY.id);
    const [spread, first, second] = t.ids as [InstanceId, InstanceId, InstanceId];
    const action = { kind: "playCard", instanceId: spread } as const;
    const two = tryPayment(t.state, P1, action, [`hand:${first}`, `hand:${second}`], { x: 2 }, deps);
    expect(two).toMatchObject({ ok: true, command: { x: 2 } });
    expect(tryPayment(t.state, P1, action, [`hand:${first}`], { x: 2 }, deps)).toMatchObject({
      ok: false,
      reason: "insufficient_resources",
    });
    expect(tryPayment(t.state, P1, action, [`hand:${first}`], { x: 0 }, deps)).toMatchObject({
      ok: false,
      reason: "invalid_choice",
    });
  });

  it("a printed X cost always has a pay step, even when the least X costs nothing, so the player can name the X", () => {
    const t = table(LOOSE.id);
    const [loose] = t.ids as [InstanceId];
    const query = paymentFor(t.state, P1, { kind: "playCard", instanceId: loose }, {}, deps);
    expect(query).not.toBeNull();
    expect(query?.requirement.generic).toBe(0);
    const listed = legalActions(t.state, P1, deps);
    if (listed.kind !== "turn") throw new Error("expected P1's turn");
    const needs = (id: InstanceId) =>
      listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id)?.needsPayment;
    expect(needs(loose)).toBe(true);
  });
});
