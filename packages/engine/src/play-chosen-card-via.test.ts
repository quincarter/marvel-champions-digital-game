/**
 * docs/phase7-wave6.md §3.42: playing a card chosen in an ability's cost, and remembering how. Synthetic cards shaped like
 * Wolverine's Claws (35002: "Exhaust Wolverine's Claws, choose an ATTACK event in your hand, and take damage equal to its
 * printed cost → play that event, ignoring its resource cost. That attack gains piercing.") and Lunging Strike (35010:
 * "If you exhausted Wolverine's Claws to play this card, this attack gains overkill").
 *
 * - `AbilityCost.chooseCard` picks the event in the cost; `damageSelf` reads its printed cost.
 * - `playFromHand.card` plays exactly that card, `via` records the Claws on the play (`Predicate playedVia`), and
 *   `whileResolving` grants "that attack gains piercing" for that play only.
 *
 * Sources: the cards' text; RRG 1.8 "Cost" (p. 13: a cost whose effect has no valid target cannot be paid), "Ignore"
 * (p. 23), "Piercing" (p. 32).
 */

import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ATTACK = trait("ATTACK");
const n = (value: number) => ({ kind: "const", value }) as const;
const VILLAIN_REF = { kind: "villain" } as const;

const CLAWS_ACTION = stubAbility("claws.action", {
  trigger: { kind: "action" },
  cost: {
    exhaustSelf: true,
    chooseCard: {
      slot: "event",
      from: { zone: "hand", player: "you", query: { categories: ["event"], trait: ATTACK } },
      playableIgnoringCost: true,
    },
    damageSelf: { kind: "printedCost", of: { kind: "slot", slot: "event" } },
  },
  effects: [
    {
      kind: "playFromHand",
      player: { kind: "controller" },
      ignoreCost: true,
      card: { kind: "slot", slot: "event" },
      via: { kind: "self" },
      whileResolving: [{ kind: "attackKeywords", keywords: ["piercing"], via: { inSlot: "event" } }],
    },
  ],
});
const CLAWS = stubUpgrade({ id: "claws", cost: 0, abilities: [CLAWS_ACTION.ref] });

/** "Deal 3 damage to the villain. If you exhausted the Claws to play this card, deal 5 instead." */
const strike = (amount: number): EffectSpec => ({ kind: "attack", target: VILLAIN_REF, amount: n(amount) });
const STRIKE_ACTION = stubAbility("strike.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [
    {
      kind: "if",
      condition: { kind: "playedVia", card: { name: "claws" } },
      then: [strike(5)],
      otherwise: [strike(3)],
    },
  ],
});
const STRIKE = { ...stubEvent({ id: "strike", cost: 2, abilities: [STRIKE_ACTION.ref] }), traits: [ATTACK] };
/** An attack event with no target (it attacks a minion and there is none): not a legal pick. */
const SWIPE_ACTION = stubAbility("swipe.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [
    { kind: "chooseTarget", slot: "minion", query: { categories: ["minion"] }, chooser: { kind: "controller" } },
    { kind: "attack", target: { kind: "slot", slot: "minion" }, amount: n(2) },
  ],
});
const SWIPE = { ...stubEvent({ id: "swipe", cost: 1, abilities: [SWIPE_ACTION.ref] }), traits: [ATTACK] };
/** Not an ATTACK event. */
const SNACK = stubEvent({ id: "snack", cost: 0, abilities: [] });

const VILLAIN = stubVillain({ id: "tough-villain", stages: [{ hp: flat(30), atk: 1, sch: 0 }] });
const deps: EngineDeps = depsOf(CLAWS_ACTION, STRIKE_ACTION, SWIPE_ACTION);

function start(): { state: GameState; claws: InstanceId; strike: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [CLAWS, STRIKE, SWIPE, SNACK, VILLAIN],
    deps,
    villain: VILLAIN,
    deck: [CLAWS.id, STRIKE.id, SWIPE.id, SNACK.id],
  });
  const withClaws = playerCardIntoPlay(base, CLAWS.id);
  const hero = mustPlayer(withClaws.state, P1).identity.form === "hero";
  const state = hero
    ? withClaws.state
    : driveSession(startSession(withClaws.state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
  const given = giveCard(state, P1, STRIKE.id);
  const withSwipe = giveCard(given.state, P1, SWIPE.id);
  const withSnack = giveCard(withSwipe.state, P1, SNACK.id);
  return { state: withTough(withSnack.state), claws: withClaws.id, strike: given.id };
}

const villainOf = (state: GameState) => state.villains[0]!.instanceId;
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const withTough = (state: GameState): GameState => {
  const id = villainOf(state);
  const instance = mustInstance(state, id);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, statuses: { ...instance.statuses, tough: 1 } } },
  };
};

const useClaws = (claws: InstanceId, event: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: claws,
  abilityId: CLAWS_ACTION.ref.id,
  payment: [],
  costChoices: { event: [event] },
});

function run(state: GameState, ...commands: Command[]): GameSession {
  const { session } = driveSession(startSession(state), deps, commands);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return session;
}

describe("§3.42 play a card chosen in the cost, and remember how", () => {
  it("plays the chosen event for 0, takes damage equal to its printed cost, and that attack gains piercing", () => {
    const { state, claws, strike } = start();
    const hand = mustPlayer(state, P1).hand.length;
    const { state: after } = run(state, useClaws(claws, strike));
    // Its printed cost (2) as damage to the identity; no resources spent (only the event left the hand).
    expect(mustInstance(after, identityOf(after)).damage).toBe(2);
    expect(mustPlayer(after, P1).hand.length).toBe(hand - 1);
    expect(mustPlayer(after, P1).discard).toContain(strike);
    expect(mustInstance(after, claws).exhausted).toBe(true);
    // Piercing: the tough card is discarded and the damage still dealt; played via the Claws: 5, not 3.
    expect(mustInstance(after, villainOf(after)).statuses.tough).toBe(0);
    expect(mustInstance(after, villainOf(after)).damage).toBe(5);
    // The grant ended with that play.
    expect(after.lastingEffects).toEqual([]);
  });

  it("the same event played from hand normally: not via the Claws, no piercing", () => {
    const { state, strike } = start();
    const payment = mustPlayer(state, P1)
      .hand.filter((id) => id !== strike)
      .slice(0, 2)
      .map((id) => ({ fromHand: id }));
    const { state: after } = run(state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: strike,
      payment,
      attachToInstanceId: null,
    });
    // Tough prevents the whole attack (no piercing), and the condition read false.
    expect(mustInstance(after, villainOf(after)).statuses.tough).toBe(0);
    expect(mustInstance(after, villainOf(after)).damage).toBe(0);
    expect(mustInstance(after, identityOf(after)).damage).toBe(0);
  });

  it("only an ATTACK event that could be played ignoring its cost can be chosen", () => {
    const { state, claws } = start();
    const swipe = giveCard(state, P1, SWIPE.id).id;
    const snack = giveCard(state, P1, SNACK.id).id;
    for (const event of [swipe, snack]) {
      const { session } = driveSession(startSession(state), deps);
      expect(() => driveSession(session, deps, [useClaws(claws, event)])).toThrow(/rejected/);
    }
    const actions = legalActions(state, P1, deps);
    if (actions.kind !== "turn") throw new Error("not P1's turn");
    const use = actions.legal.find((entry) => entry.action.kind === "useAbility" && entry.action.instanceId === claws);
    expect(use?.targets).toEqual([start().strike]);
  });
});
