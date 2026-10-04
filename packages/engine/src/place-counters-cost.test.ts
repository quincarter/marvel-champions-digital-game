/**
 * docs/phase7-wave6.md §3.53: placing counters as a cost (`AbilityCost.placeCounters`). Synthetic cards shaped like
 * Gambit's Natural Agility (37008, "Hero Interrupt (defense): When you defend against an attack, place 1 charge counter
 * on Gambit → for each charge counter on Gambit, you get +1 DEF for that attack"), here interrupting an ATTACK event's
 * play so the bonus shows as damage, and the same cost on an action ability.
 *
 * - Always payable: offered and usable with no counters anywhere.
 * - Paid before the effects (RRG 1.8 "Initiating Abilities", p. 24, step 5 before step 6), so "for each charge counter"
 *   counts the one just placed: a near miss (reading before payment) is one short.
 * - Announced as `countersPlaced` (`paidAsCost`), whose responses resolve before the paid-for effects.
 *
 * Sources: the card's text; RRG 1.8 "Cost" (p. 13), "Initiating Abilities" (p. 24). No FFG ruling on Natural Agility in
 * the post-RRG 1.7 rulings transcript.
 */

import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ATTACK = trait("ATTACK");
const n = (value: number) => ({ kind: "const", value }) as const;
const SELF: TargetRef = { kind: "self" };
const IDENTITY: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const onIdentity = (counterType: string): ValueSpec => ({ kind: "counters", of: IDENTITY, counterType });
const PLACE_ON_IDENTITY: AbilityCost = { placeCounters: { counterType: "charge", amount: 1, target: "identity" } };

/** Natural Agility's shape, from hand: place 1 charge counter on your identity → +1 damage per charge counter there. */
const AGILITY = stubAbility("agility.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: false,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"], trait: ATTACK } },
  },
  cost: PLACE_ON_IDENTITY,
  effects: [{ kind: "modifyCardEffect", card: { kind: "eventTarget" }, damage: onIdentity("charge") }],
});
const AGILITY_CARD = stubEvent({ id: "agility", cost: 0, abilities: [AGILITY.ref] });

/** An ATTACK event dealing 1 damage to the villain. */
const STRIKE_ACTION = stubAbility("strike.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(1) }],
});
const STRIKE = { ...stubEvent({ id: "strike", cost: 0, abilities: [STRIKE_ACTION.ref] }), traits: [ATTACK] };

const draw = (amount: ValueSpec): EffectSpec => ({ kind: "draw", player: { kind: "controller" }, amount });

/** An action on a support: place 1 charge counter on your identity → draw 1 per charge counter there. */
const CHARGE = stubAbility("charge.action", {
  trigger: { kind: "action" },
  cost: PLACE_ON_IDENTITY,
  effects: [draw(onIdentity("charge"))],
});
/** The same on the ability's own card (no `target`): exhaust it and place 2 here → draw 1 per counter here. */
const STACK = stubAbility("stack.action", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true, placeCounters: { counterType: "charge", amount: 2 } },
  effects: [draw({ kind: "counters", of: SELF, counterType: "charge" })],
});
/** The control: the same action with no counter cost. */
const PLAIN = stubAbility("plain.action", {
  trigger: { kind: "action" },
  effects: [draw(onIdentity("charge"))],
});
const CHARGER = stubSupport({ id: "charger", cost: 0, abilities: [CHARGE.ref, STACK.ref, PLAIN.ref] });

/** "After you place a charge counter": marks itself, so the order against the paid-for draw shows. */
const LISTENER = stubAbility("listener.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersPlaced", playerIs: "controller", eventIs: { counterType: "charge" } },
  },
  effects: [{ kind: "addCounters", target: SELF, counterType: "heard", amount: { kind: "eventAmount" } }],
});
const LISTENER_CARD = stubSupport({ id: "listener", cost: 0, abilities: [LISTENER.ref] });

const VILLAIN = stubVillain({ id: "big-villain", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const deps: EngineDeps = depsOf(AGILITY, STRIKE_ACTION, CHARGE, STACK, PLAIN, LISTENER);

interface Table {
  readonly state: GameState;
  readonly charger: InstanceId;
  readonly listener: InstanceId | null;
}

/** P1 with `charges` charge counters on their identity, the charger support in play, and optionally the listener. */
function table(charges: number, listen = false): Table {
  let state = gameAtFirstTurn({
    cards: [AGILITY_CARD, STRIKE, CHARGER, LISTENER_CARD, VILLAIN],
    deps,
    villain: VILLAIN,
    deck: [AGILITY_CARD.id, STRIKE.id, CHARGER.id, LISTENER_CARD.id],
  });
  const placed = playerCardIntoPlay(state, CHARGER.id);
  state = placed.state;
  let listener: InstanceId | null = null;
  if (listen) {
    const heard = playerCardIntoPlay(state, LISTENER_CARD.id);
    state = heard.state;
    listener = heard.id;
  }
  const identity = mustPlayer(state, P1).identity.instanceId;
  if (charges > 0) {
    state = {
      ...state,
      instances: {
        ...state.instances,
        [identity]: { ...mustInstance(state, identity), counters: { charge: charges } },
      },
    };
  }
  return { state, charger: placed.id, listener };
}

/** Answers every choice by default, except that every Natural Agility offered is used. */
const agilityPicker = (state: GameState): readonly string[] => {
  const offered = (state.pendingChoice?.options ?? []).filter((o) => o.optionId.includes(AGILITY.ref.id));
  return offered.length > 0 ? offered.map((o) => o.optionId) : defaultPick(state);
};

function run(state: GameState, ...commands: Command[]) {
  const result = runCommandsPicking(state, deps, agilityPicker, ...commands);
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
  return result;
}

const use = (charger: InstanceId, ability: { readonly ref: { readonly id: string } }): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: charger,
  abilityId: ability.ref.id as never,
  payment: [],
});
const playFree = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});

const identityCharges = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters.charge ?? 0;
const handSize = (state: GameState): number => mustPlayer(state, P1).hand.length;
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;
/** The turn's legal actions using `ability` on `card`. */
function offered(state: GameState, card: InstanceId, abilityId: string) {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`not P1's turn: ${actions.kind}`);
  const matches = (a: { readonly action: { readonly kind: string } }) =>
    a.action.kind === "useAbility" &&
    "instanceId" in a.action &&
    a.action.instanceId === card &&
    "abilityId" in a.action &&
    a.action.abilityId === abilityId;
  return { legal: actions.legal.find(matches), illegal: actions.illegal.find(matches) };
}

const placedAnnouncements = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "countersPlaced" ? [e.event] : [],
  );

describe("§3.53 placing counters as a cost", () => {
  for (const charges of [0, 2]) {
    it(`an action with ${charges} counter(s) on the identity: places 1, then draws ${charges + 1} (the new one counts)`, () => {
      const { state, charger } = table(charges);
      const before = handSize(state);
      const { state: after, events } = run(state, use(charger, CHARGE));
      expect(identityCharges(after)).toBe(charges + 1);
      expect(handSize(after)).toBe(before + charges + 1);
      const at = (type: GameEvent["type"]) => events.findIndex((e) => e.type === type);
      expect(at("counterAdded")).toBeGreaterThanOrEqual(0);
      expect(at("counterAdded")).toBeLessThan(at("cardDrawn"));
    });
  }

  it("no target places on the ability's own card, with the rest of the cost", () => {
    const { state, charger } = table(1);
    const before = handSize(state);
    const { state: after } = run(state, use(charger, STACK));
    expect(mustInstance(after, charger).counters.charge).toBe(2);
    expect(mustInstance(after, charger).exhausted).toBe(true);
    expect(identityCharges(after)).toBe(1);
    expect(handSize(after)).toBe(before + 2);
    // Its other component still binds it: exhausted, it cannot be used again, counters or not.
    expect(offered(after, charger, STACK.ref.id)).toMatchObject({
      legal: undefined,
      illegal: { reason: "already_exhausted" },
    });
  });

  it("always payable: offered with no counters anywhere, and asks for nothing", () => {
    const { state, charger } = table(0);
    const { legal, illegal } = offered(state, charger, CHARGE.ref.id);
    expect(illegal).toBeUndefined();
    expect(legal).toBeDefined();
    expect(legal?.needsPayment).toBe(false);
    expect(legal?.costCounters).toBeUndefined();
    expect(legal?.costBranches).toBeUndefined();
  });

  for (const [charges, damage] of [
    [0, 1 + 1],
    [2, 1 + 3],
  ] as const) {
    it(`Natural Agility's shape from hand in a window, ${charges} counter(s): the event deals ${damage}`, () => {
      const { state } = table(charges);
      const agility = giveCard(state, P1, AGILITY_CARD.id);
      const strike = giveCard(agility.state, P1, STRIKE.id);
      const { state: after } = run(strike.state, playFree(strike.id));
      expect(identityCharges(after)).toBe(charges + 1);
      expect(villainDamage(after)).toBe(damage);
      expect(mustPlayer(after, P1).discard).toEqual(expect.arrayContaining([agility.id, strike.id]));
    });
  }

  it("announced as paid, and its responses resolve before the paid-for effects", () => {
    const { state, charger, listener } = table(0, true);
    const { state: after, events } = run(state, use(charger, CHARGE));
    expect(placedAnnouncements(events)).toEqual([
      {
        kind: "countersPlaced",
        targetInstanceId: mustPlayer(state, P1).identity.instanceId,
        counterType: "charge",
        amount: 1,
        playerId: P1,
        paidAsCost: true,
      },
    ]);
    expect(mustInstance(after, listener!).counters.heard).toBe(1);
    const heardAt = events.findIndex(
      (e) => e.type === "counterAdded" && e.instanceId === listener && e.counterType === "heard",
    );
    expect(heardAt).toBeGreaterThanOrEqual(0);
    expect(heardAt).toBeLessThan(events.findIndex((e) => e.type === "cardDrawn"));
  });

  it("nothing changes without the cost: the same action places nothing and announces nothing", () => {
    const { state, charger } = table(2, true);
    const before = handSize(state);
    const { state: after, events } = run(state, use(charger, PLAIN));
    expect(identityCharges(after)).toBe(2);
    expect(handSize(after)).toBe(before + 2);
    expect(placedAnnouncements(events)).toEqual([]);
    expect(events.some((e) => e.type === "counterAdded")).toBe(false);
  });
});
