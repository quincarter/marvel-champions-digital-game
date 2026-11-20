/**
 * An either/or additional cost to play a card, with a flip of another card as one branch (#890 item 11), on synthetic
 * cards shaped like Sentinel's Rocket Punch (the `sentinel-tw` community pack: "As an additional cost to play this
 * event, exhaust Arms (Intact) or destroy it", where destroying flips the Component to its Destroyed side and deals 2
 * unpreventable damage to Sentinel: `AbilityCost.damageSelfUnpreventable`).
 *
 * The branch is the player's pick, named in the play command's `costSelection.branch`; absent, the first branch that
 * can be paid (`selectCost`). An exhausted Arms cannot be exhausted, so only destroying it pays (the author's ruling,
 * 2026-11-19: an exhausted Intact Component can still be destroyed).
 *
 * Unpreventable damage passes a tough status card (which stays), a "prevent all damage" constant and a reduction, so
 * none of them stops the destroy branch from being paid; a "cannot take damage" rule still does (RRG 1.8 "Cannot",
 * p. 13), and a cost that cannot be paid means the card cannot be played (RRG 1.8 "Cost", p. 14).
 *
 * Sources: RRG 1.8 "Cost" (p. 13-14), "Flip" (p. 20); the MC62 insert ("cannot be reduced or prevented").
 */

import { describe, expect, it } from "vitest";
import type { CardId } from "@mc/content";
import type { AbilityCost, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const YOUR_IDENTITY = { categories: ["identity"], controller: "you" } as const;
const ARMS: TargetQuery = { categories: ["upgrade"], name: "Arms (Intact)", controller: "you" };
/** "Exhaust Arms (Intact) or destroy it": exhaust it, or flip it and take 2 unpreventable damage. */
const EXHAUST_OR_DESTROY: AbilityCost = {
  either: [
    { exhaustCards: { slot: "arms", query: ARMS, min: 1, max: 1 } },
    { flipCards: { slot: "arms", query: ARMS, min: 1, max: 1 }, damageSelf: 2, damageSelfUnpreventable: true },
  ],
};

const ARMS_CARD = {
  ...stubUpgrade({ id: "arms", cost: 0 }),
  name: "Arms (Intact)",
  flipSide: { name: "Arms (Destroyed)", traits: [], keywords: [], text: { printed: "", current: "" }, abilities: [] },
};
const PUNCH_COST = stubAbility("punch.constant", {
  trigger: { kind: "constant", additionalCostToPlay: {} },
  cost: EXHAUST_OR_DESTROY,
  effects: [],
});
const PUNCH_ACTION = stubAbility("punch.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "addCounters", target: yourIdentity, counterType: "punched", amount: { kind: "const", value: 1 } }],
});
const PUNCH = stubEvent({ id: "punch", cost: 0, abilities: [PUNCH_COST.ref, PUNCH_ACTION.ref] });

const constantSupport = (id: string, rule: RuleSpec) => {
  const ability = stubAbility(`${id}.constant`, { trigger: { kind: "constant", rules: [rule] }, effects: [] });
  return { ability, card: stubSupport({ id, cost: 0, abilities: [ability.ref] }) };
};
const WARD = constantSupport("ward", { kind: "cannotTakeDamage", target: YOUR_IDENTITY });
const AEGIS = constantSupport("aegis", { kind: "preventAllDamage", target: YOUR_IDENTITY });
const PADDING = constantSupport("padding", { kind: "reduceDamageTaken", target: YOUR_IDENTITY, amount: 1 });
const STUBS = [WARD, AEGIS, PADDING];

const CARDS = [ARMS_CARD, PUNCH, ...STUBS.map((s) => s.card)];
const deps: EngineDeps = depsOf(PUNCH_COST, PUNCH_ACTION, ...STUBS.map((s) => s.ability));

interface Setup {
  readonly armsExhausted?: boolean;
  readonly noArms?: boolean;
  readonly tough?: boolean;
  readonly supports?: readonly CardId[];
}

function start(setup: Setup = {}): { state: GameState; arms: InstanceId | null; punch: InstanceId } {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: [...CARDS, ...CARDS, ...CARDS].map((c) => c.id) });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  let arms: InstanceId | null = null;
  if (!setup.noArms) {
    const put = playerCardIntoPlay(state, ARMS_CARD.id);
    arms = put.id;
    state = setup.armsExhausted
      ? {
          ...put.state,
          instances: { ...put.state.instances, [put.id]: { ...mustInstance(put.state, put.id), exhausted: true } },
        }
      : put.state;
  }
  for (const id of setup.supports ?? []) state = playerCardIntoPlay(state, id).state;
  if (setup.tough) {
    const identityId = mustPlayer(state, P1).identity.instanceId;
    const identity = mustInstance(state, identityId);
    state = {
      ...state,
      instances: { ...state.instances, [identityId]: { ...identity, statuses: { ...identity.statuses, tough: 1 } } },
    };
  }
  const given = giveCard(state, P1, PUNCH.id);
  return { state: given.state, arms, punch: given.id };
}

const playOf = (id: InstanceId, branch?: number): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
  ...(branch !== undefined ? { costSelection: { branch } } : {}),
});
function run(state: GameState, command: Command) {
  const { state: after, session } = runCommandsPicking(state, deps, defaultPick, command);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(after);
  return after;
}
const identity = (state: GameState) => mustInstance(state, mustPlayer(state, P1).identity.instanceId);
function playable(state: GameState, punch: InstanceId) {
  const legal = legalActions(state, P1, deps);
  if (!("legal" in legal)) return undefined;
  return legal.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === punch);
}

describe("#890 item 11 an either/or additional cost to play, one branch a flip of another card", () => {
  it("absent a pick, the first payable branch is paid: Arms exhausts, and the event resolves", () => {
    const { state, arms, punch } = start();
    const after = run(state, playOf(punch));
    expect(mustInstance(after, arms!).exhausted).toBe(true);
    expect(mustInstance(after, arms!).flipped).toBe(false);
    expect(identity(after).counters.punched).toBe(1);
  });

  it("the player may pick the second branch: Arms flips to its Destroyed side and the identity takes 2 damage", () => {
    const { state, arms, punch } = start();
    const damageBefore = identity(state).damage;
    const after = run(state, playOf(punch, 1));
    expect(mustInstance(after, arms!).flipped).toBe(true);
    expect(mustInstance(after, arms!).exhausted).toBe(false);
    expect(identity(after).damage).toBe(damageBefore + 2);
    expect(identity(after).counters.punched).toBe(1);
  });

  it("an exhausted Arms cannot be exhausted, so destroying it is the branch paid", () => {
    const { state, arms, punch } = start({ armsExhausted: true });
    const after = run(state, playOf(punch));
    expect(mustInstance(after, arms!).flipped).toBe(true);
    expect(identity(after).counters.punched).toBe(1);
  });

  it("legalActions lists both branches as payable while Arms is ready", () => {
    const { state, punch } = start();
    expect(playable(state, punch)?.costBranches).toEqual([0, 1]);
  });
});

describe("#890 item 11 the destroy branch's damage is unpreventable", () => {
  it("a tough status card does not stop it: the damage is taken in full and the tough card stays", () => {
    const { state, arms, punch } = start({ tough: true });
    const damageBefore = identity(state).damage;
    const after = run(state, playOf(punch, 1));
    expect(mustInstance(after, arms!).flipped).toBe(true);
    expect(identity(after).damage).toBe(damageBefore + 2);
    expect(identity(after).statuses.tough).toBe(1);
    expect(identity(after).counters.punched).toBe(1);
  });

  it("a 'prevent all damage' constant does not stop it", () => {
    const { state, punch } = start({ supports: [AEGIS.card.id] });
    const damageBefore = identity(state).damage;
    const after = run(state, playOf(punch, 1));
    expect(identity(after).damage).toBe(damageBefore + 2);
    expect(identity(after).counters.punched).toBe(1);
  });

  it("a constant reduction does not reduce it", () => {
    const { state, punch } = start({ supports: [PADDING.card.id] });
    const damageBefore = identity(state).damage;
    const after = run(state, playOf(punch, 1));
    expect(identity(after).damage).toBe(damageBefore + 2);
  });

  it("with an exhausted Arms and an identity that cannot take damage, no branch can be paid: the card is not playable", () => {
    const { state, punch } = start({ armsExhausted: true, supports: [WARD.card.id] });
    expect(playable(state, punch)).toBeUndefined();
    expect(() => run(state, playOf(punch))).toThrow(/rejected/);
  });

  it("with no Arms in play there is nothing to exhaust or destroy: the card is not playable", () => {
    const { state, punch } = start({ noArms: true });
    expect(playable(state, punch)).toBeUndefined();
  });

  it("a 'cannot take damage' rule leaves only the exhaust branch while Arms is ready", () => {
    const { state, punch } = start({ supports: [WARD.card.id] });
    expect(playable(state, punch)?.costBranches).toEqual([0]);
  });
});
