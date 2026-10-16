/**
 * Regression: a "deal N damage to a [chosen] character →" cost (`AbilityCost.damageCards`) is paid even when its damage
 * is reduced or prevented, so the ability's effects still resolve.
 *
 * RRG v1.8 p.14 "Cost": "If dealing damage is a cost, that cost is considered paid even if some or all of that damage
 * is prevented." Ruling 2026-06-25 R6 / 2026-07-09 R2 (Luke Cage + Clarity of Purpose + Metal Bracelet): damage dealt as
 * a cost can be reduced or prevented, even to 0, and the cost remains paid; "reducing" and "preventing" are synonymous
 * here. The same page keeps a cost of *taking* damage unpaid unless all of it is taken (`AbilityCost.damageSelf`,
 * checked last below, unchanged).
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { trait } from "@mc/content";

const WEB = trait("WEB-WARRIOR");
const DRAW_2: EffectSpec = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 2 } };
const DEAL_COST: AbilityCost = {
  damageCards: {
    slot: "damaged",
    query: { categories: ["ally"], trait: WEB, controller: "you" },
    min: 1,
    max: 1,
    amount: 1,
  },
};

const DEAL_ABILITY = stubAbility("deal-draw.action", {
  trigger: { kind: "action" },
  cost: DEAL_COST,
  effects: [DRAW_2],
});
const DEAL_DRAW = stubEvent({ id: "deal-draw", cost: 0, abilities: [DEAL_ABILITY.ref] });
const TAKE_ABILITY = stubAbility("take-draw.action", {
  trigger: { kind: "action" },
  cost: { damageSelf: 1 },
  effects: [DRAW_2],
});
const TAKE_DRAW = stubEvent({ id: "take-draw", cost: 0, abilities: [TAKE_ABILITY.ref] });

const WEB_ALLY = stubAlly({ id: "web-ally", traits: [WEB], cost: 0, atk: 1, thw: 1, hp: 3 });
const ALLIES = { categories: ["ally" as const] };
/** "Your allies take 1 less damage." (Metal Bracelet's reduction, on allies.) */
const BRACELET_RULE = stubAbility("bracelet.constant", {
  trigger: { kind: "constant", rules: [{ kind: "reduceDamageTaken", target: ALLIES, amount: 1 }] },
  effects: [],
});
const BRACELET = stubSupport({ id: "bracelet", cost: 0, abilities: [BRACELET_RULE.ref] });
/** "Prevent all damage your allies would take." */
const AEGIS_RULE = stubAbility("aegis.constant", {
  trigger: { kind: "constant", rules: [{ kind: "preventAllDamage", target: ALLIES }] },
  effects: [],
});
const AEGIS = stubSupport({ id: "aegis", cost: 0, abilities: [AEGIS_RULE.ref] });
/** "Forced Interrupt: when an ally would take damage, prevent 1 of it" (Aerial Evacuation's prevention). */
const SHIELD_INTERRUPT = stubAbility("shield.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: ALLIES } },
  effects: [{ kind: "preventDamage", amount: { kind: "const", value: 1 } }],
});
const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_INTERRUPT.ref] });

const deps: EngineDeps = depsOf(DEAL_ABILITY, TAKE_ABILITY, BRACELET_RULE, AEGIS_RULE, SHIELD_INTERRUPT);
const CARDS = [DEAL_DRAW, TAKE_DRAW, WEB_ALLY, BRACELET, AEGIS, SHIELD];

const start = (): GameState =>
  gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [DEAL_DRAW.id, TAKE_DRAW.id, WEB_ALLY.id, BRACELET.id, AEGIS.id, SHIELD.id, ...copiesOf(WEB_ALLY.id, 6)],
    encounter: copiesOf("treachery" as never, 10),
  });

function withInPlay(...cards: readonly string[]): { state: GameState; ids: InstanceId[] } {
  let state = start();
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const placed = playerCardIntoPlay(state, card as never);
    state = placed.state;
    ids.push(placed.id);
  }
  return { state, ids };
}

const playCmd = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});

function offered(state: GameState, card: InstanceId): boolean {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected P1's turn, got ${actions.kind}`);
  return actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === card);
}

function run(state: GameState, command: Command): { state: GameState; events: readonly GameEvent[] } {
  const { session, events } = driveSession(startSession(state), deps, [command]);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

const handSize = (state: GameState): number => mustPlayer(state, P1).hand.length;
const resolved = (events: readonly GameEvent[], abilityId: string): boolean =>
  events.some((e) => e.type === "abilityResolved" && e.abilityId === abilityId);

describe("RRG v1.8 p.14; ruling 2026-06-25 R6 / 2026-07-09 R2: a deal-damage cost is paid even if its damage is prevented", () => {
  it.each([
    ["a constant reduction to 0 (Metal Bracelet)", BRACELET.id],
    ["a constant preventing all of it", AEGIS.id],
    ["an interrupt preventing it as it is dealt (Aerial Evacuation)", SHIELD.id],
  ])("%s: the cost is offered, paid, and the effect resolves", (_, preventer) => {
    const { state: table, ids } = withInPlay(WEB_ALLY.id, preventer);
    const web = ids[0]!;
    const given = giveCard(table, P1, DEAL_DRAW.id);
    expect(offered(given.state, given.id)).toBe(true);
    const hand = handSize(given.state);
    const { state: after, events } = run(given.state, playCmd(given.id));
    expect(mustInstance(after, web).damage).toBe(0); // fully prevented
    expect(resolved(events, DEAL_ABILITY.ref.id)).toBe(true);
    expect(handSize(after)).toBe(hand - 1 + 2); // the event left hand, then drew 2
    expect(events.some((e) => e.type === "costDamageSettled")).toBe(false);
  });

  it("a tough status card absorbs the cost's damage and is discarded; the cost is still paid", () => {
    const { state: table, ids } = withInPlay(WEB_ALLY.id);
    const web = ids[0]!;
    const tough: GameState = {
      ...table,
      instances: {
        ...table.instances,
        [web]: { ...mustInstance(table, web), statuses: { ...mustInstance(table, web).statuses, tough: 1 } },
      },
    };
    const given = giveCard(tough, P1, DEAL_DRAW.id);
    expect(offered(given.state, given.id)).toBe(true);
    const { state: after, events } = run(given.state, playCmd(given.id));
    expect(mustInstance(after, web).statuses.tough).toBe(0);
    expect(mustInstance(after, web).damage).toBe(0);
    expect(resolved(events, DEAL_ABILITY.ref.id)).toBe(true);
  });

  it("unchanged: a take-damage cost is still not paid when its damage is prevented (same page)", () => {
    const { state: table } = withInPlay(SHIELD.id);
    const identity = mustPlayer(table, P1).identity.instanceId;
    const tough: GameState = {
      ...table,
      instances: {
        ...table.instances,
        [identity]: {
          ...mustInstance(table, identity),
          statuses: { ...mustInstance(table, identity).statuses, tough: 1 },
        },
      },
    };
    const given = giveCard(tough, P1, TAKE_DRAW.id);
    expect(offered(given.state, given.id)).toBe(false); // FAQ "Focused Rage (#27)", RRG 1.8 p. 57
  });
});
