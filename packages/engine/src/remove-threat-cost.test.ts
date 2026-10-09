/**
 * docs/phase7-wave9.md §3.7 (b): `AbilityCost.removeThreat { from, amount }`: threat taken off a card in play as a
 * cost, a fixed amount or one the payer chooses, with the amount removed bound as `cost.removeThreat` for the text
 * after the arrow ("this attack deals 1 additional damage for each threat removed this way").
 *
 * Sources: RRG 1.8 "Cost" (p. 13): a cost is paid in full or not at all, and one that cannot be paid stops the
 * ability; (p. 14): "A cost requiring 'any number' or 'up to' some number of game elements requires a minimum of one
 * such game element", so a printed "up to 3" is `min` 1. The engine honors a `min` of 0 as written (no printed card
 * asks for one; the scripting DSL refuses it). "Crisis Icon" (p. 14) for a cost whose card is the main scheme.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, RemoveThreatCost } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeVillain, mustInstance } from "./query.js";
import type { TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const SELF: TargetRef = { kind: "self" };
const theUpgrade: TargetRef = { kind: "each", query: { categories: ["upgrade"] } };
const REMOVED = { kind: "var", name: "cost.removeThreat" } as const;
const upTo = (from: TargetRef, max: number, min = 1): RemoveThreatCost => ({ from, amount: { choose: { min, max } } });
/** What the text after the arrow saw: one `used` counter per resolution and one `paid` counter per threat removed. */
const tally = [
  { kind: "addCounters", target: SELF, counterType: "used", amount: { kind: "const", value: 1 } },
  { kind: "addCounters", target: SELF, counterType: "paid", amount: REMOVED },
] as never[];

/** "Interrupt: When you attack, remove up to 3 threat from here → this attack deals 1 additional damage for each." */
const ASSAULT_ABILITY = stubAbility(
  "assault.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      form: "hero",
      on: { on: "attack", sourceIs: { categories: ["identity"], controller: "you" } },
    },
    cost: { removeThreat: upTo(SELF, 3) },
    effects: [{ kind: "modifyAttack", extraDamage: REMOVED } as never],
  }),
);
const ASSAULT = stubUpgrade({ id: "assault", cost: 0, abilities: [ASSAULT_ABILITY.ref] });
const action = (id: string, removeThreat: RemoveThreatCost) => {
  const ability = stubAbility(
    `${id}.action`,
    def({ trigger: { kind: "action" }, cost: { removeThreat }, effects: tally }),
  );
  return { ability, card: stubSupport({ id, cost: 0, abilities: [ability.ref] }) };
};
/** "Action: Remove 1 threat from your suit form upgrade → …" */
const ONE = action("one", { from: theUpgrade, amount: 1 });
/** "Action: Remove up to 2 threat from your suit form upgrade → …" */
const UP_TO_2 = action("up-to-2", upTo(theUpgrade, 2));
/** The same with a `min` of 0, which no printed card has: removing none pays it. */
const ZERO_TO_3 = action("zero-to-3", upTo(theUpgrade, 3, 0));
/** "Action: Remove 2 threat from the main scheme → …": a scheme pays under its own rules. */
const FROM_MAIN = action("from-main", { from: { kind: "mainScheme" }, amount: 2 });
const ACTIONS = [ONE, UP_TO_2, ZERO_TO_3, FROM_MAIN];
const CRISIS_SCHEME = stubSideScheme({ id: "crisis-scheme", startingThreat: 3, icons: ["crisis"] });
const deps = depsOf(ASSAULT_ABILITY, ...ACTIONS.map((a) => a.ability));

interface Table {
  readonly state: GameState;
  readonly upgrade: InstanceId;
  readonly hero: InstanceId;
  readonly ids: Readonly<Record<string, InstanceId>>;
}

/** p1 in hero form with the upgrade (holding `threat`) and every action support in play; 5 threat on the main scheme. */
function table(threat: number): Table {
  let state = gameAtFirstTurn({
    cards: [ASSAULT, CRISIS_SCHEME, ...ACTIONS.map((a) => a.card)],
    deps,
    deck: [ASSAULT.id, ...ACTIONS.map((a) => a.card.id)],
    encounter: [CRISIS_SCHEME.id, ...Array.from({ length: 20 }, () => "treachery" as never)],
  });
  const upgrade = playerCardIntoPlay(state, ASSAULT.id);
  state = upgrade.state;
  const ids: Record<string, InstanceId> = {};
  for (const { card } of ACTIONS) {
    const put = playerCardIntoPlay(state, card.id);
    state = put.state;
    ids[card.id] = put.id;
  }
  const main = state.mainScheme.instanceId;
  state = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "hero" } } : p)),
    instances: {
      ...state.instances,
      [upgrade.id]: { ...mustInstance(state, upgrade.id), threat },
      [main]: { ...mustInstance(state, main), threat: 5 },
    },
  };
  return { state, upgrade: upgrade.id, hero: state.players[0]!.identity.instanceId, ids };
}

const attack = (t: Table): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: t.hero,
  targetInstanceId: activeVillain(t.state).instanceId,
});
const use = (t: Table, a: (typeof ACTIONS)[number]): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: t.ids[a.card.id]!,
  abilityId: a.ability.ref.id,
  payment: [],
});
/** Uses the interrupt when offered (or not, for `null`) and answers the number prompt with `amount`. */
function run(t: Table, command: Command, amount: number | null) {
  const numbers: string[][] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseNumber") {
      numbers.push(choice.options.map((o) => o.optionId));
      return [String(amount)];
    }
    const interrupt = choice?.options.find((o) => o.optionId.includes(ASSAULT_ABILITY.ref.id));
    if (interrupt) return amount === null ? [] : [interrupt.optionId];
    return defaultPick(state);
  };
  const { session, events } = driveSession(startSession(t.state), deps, [command], pick);
  return { state: session.state, events, session, numbers };
}
const threatOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const villainDamage = (state: GameState): number => mustInstance(state, activeVillain(state).instanceId).damage;
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const settled = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatCostSettled" ? [[e.chosen, e.removed, e.paid]] : []));
const removals = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatRemoved" ? [{ from: e.schemeInstanceId, amount: e.amount }] : []));
const offered = (t: Table, a: (typeof ACTIONS)[number]): boolean => {
  const legal = legalActions(t.state, P1, deps);
  if (legal.kind !== "turn") throw new Error(legal.kind);
  return legal.legal.some((l) => l.action.kind === "useAbility" && l.action.instanceId === t.ids[a.card.id]);
};

describe("§3.7 (b) 'remove up to 3 threat from here →' on an attack", () => {
  it("4 threat there: 1 to 3 are offered; 3 removed, the ATK 2 attack deals 2 + 3 = 5 and 1 threat is left", () => {
    const t = table(4);
    const { state, events, numbers, session } = run(t, attack(t), 3);
    expect(numbers).toEqual([["1", "2", "3"]]);
    expect(threatOn(state, t.upgrade)).toBe(1);
    expect(villainDamage(state)).toBe(5);
    expect(removals(events)).toEqual([{ from: t.upgrade, amount: 3 }]);
    expect(settled(events)).toEqual([[3, 3, true]]);
    expect(events.find((e) => e.type === "threatCostSettled")).toEqual({
      type: "threatCostSettled",
      instanceId: t.upgrade,
      playerId: P1,
      fromInstanceId: t.upgrade,
      chosen: 3,
      removed: 3,
      paid: true,
    });
    // Tokens off an upgrade: the main scheme keeps its 5.
    expect(threatOn(state, state.mainScheme.instanceId)).toBe(5);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("2 threat there: 1 or 2 are offered, never 0 or 3; 2 removed, 4 damage, none left", () => {
    const t = table(2);
    const { state, numbers, events } = run(t, attack(t), 2);
    expect(numbers).toEqual([["1", "2"]]);
    expect(threatOn(state, t.upgrade)).toBe(0);
    expect(villainDamage(state)).toBe(4);
    expect(settled(events)).toEqual([[2, 2, true]]);
  });

  it("2 threat there, 1 chosen: 1 removed, 3 damage, 1 left", () => {
    const t = table(2);
    const { state, events } = run(t, attack(t), 1);
    expect(threatOn(state, t.upgrade)).toBe(1);
    expect(villainDamage(state)).toBe(3);
    expect(settled(events)).toEqual([[1, 1, true]]);
  });

  it("the open number choice is what legalActions offers, and only its numbers are accepted", () => {
    const t = table(2);
    let session = startSession(t.state);
    const apply = (command: Command): boolean => {
      const result = sessionApply(session, command, deps);
      if (result.ok) session = result.session;
      return result.ok;
    };
    expect(apply(attack(t))).toBe(true);
    for (let guard = 0; session.state.pendingChoice?.prompt.kind !== "chooseNumber"; guard++) {
      const choice = session.state.pendingChoice;
      if (!choice || guard > 10) throw new Error("no number choice opened");
      const interrupt = choice.options.find((o) => o.optionId.includes(ASSAULT_ABILITY.ref.id));
      const selectedOptionIds = interrupt ? [interrupt.optionId] : defaultPick(session.state);
      apply({ type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds });
    }
    const choice = session.state.pendingChoice;
    expect(choice).toMatchObject({ playerId: P1, prompt: { kind: "chooseNumber", min: 1, max: 2 }, minSelections: 1 });
    expect(choice?.options.map((o) => o.optionId)).toEqual(["1", "2"]);
    expect(legalActions(session.state, P1, deps)).toEqual({ kind: "choice", choice });
    // Nothing has come off yet.
    expect(threatOn(session.state, t.upgrade)).toBe(2);
    const answer = (id: string): Command => ({
      type: "resolveChoice",
      playerId: P1,
      choiceId: choice!.choiceId,
      selectedOptionIds: [id],
    });
    expect(sessionApply(session, answer("0"), deps).ok).toBe(false);
    expect(sessionApply(session, answer("3"), deps).ok).toBe(false);
    expect(sessionApply(session, answer("2"), deps).ok).toBe(true);
  });

  it("1 threat there: a range of one number is not asked; 1 removed, 3 damage", () => {
    const t = table(1);
    const { state, numbers, events } = run(t, attack(t), 1);
    expect(numbers).toEqual([]);
    expect(threatOn(state, t.upgrade)).toBe(0);
    expect(villainDamage(state)).toBe(3);
    expect(settled(events)).toEqual([[1, 1, true]]);
  });

  it("no threat there: the cost cannot be paid, the interrupt is not offered and the attack deals 2", () => {
    const t = table(0);
    const { state, events } = run(t, attack(t), 1);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === ASSAULT_ABILITY.ref.id)).toBe(false);
    expect(settled(events)).toEqual([]);
    expect(villainDamage(state)).toBe(2);
  });

  it("declined: nothing is asked, nothing is removed, the attack deals 2", () => {
    const t = table(4);
    const { state, events, numbers } = run(t, attack(t), null);
    expect(numbers).toEqual([]);
    expect(removals(events)).toEqual([]);
    expect(threatOn(state, t.upgrade)).toBe(4);
    expect(villainDamage(state)).toBe(2);
  });
});

describe("§3.7 (b) a fixed amount, and a cost on another card", () => {
  it("'remove 1 threat from your upgrade →' with 3 there: 1 removed, the effect reads 1", () => {
    const t = table(3);
    expect(offered(t, ONE)).toBe(true);
    const { state, events, numbers } = run(t, use(t, ONE), 1);
    expect(numbers).toEqual([]);
    expect(threatOn(state, t.upgrade)).toBe(2);
    expect(removals(events)).toEqual([{ from: t.upgrade, amount: 1 }]);
    expect(counters(state, t.ids[ONE.card.id]!)).toEqual({ used: 1, paid: 1 });
  });

  it("with none there it cannot be used: not a legal action, and the command is refused", () => {
    const t = table(0);
    expect(offered(t, ONE)).toBe(false);
    expect(offered(t, UP_TO_2)).toBe(false);
    const refused = sessionApply(startSession(t.state), use(t, ONE), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.message).toMatch(/not enough threat/);
  });

  it("'up to 2' with 1 there: at most 1, removed without asking", () => {
    const t = table(1);
    const { state, numbers } = run(t, use(t, UP_TO_2), 2);
    expect(numbers).toEqual([]);
    expect(threatOn(state, t.upgrade)).toBe(0);
    expect(counters(state, t.ids[UP_TO_2.card.id]!)).toEqual({ used: 1, paid: 1 });
  });

  it("'up to 2' with 5 there: 1 or 2 are offered; 2 removed, 3 left", () => {
    const t = table(5);
    const { state, numbers } = run(t, use(t, UP_TO_2), 2);
    expect(numbers).toEqual([["1", "2"]]);
    expect(threatOn(state, t.upgrade)).toBe(3);
    expect(counters(state, t.ids[UP_TO_2.card.id]!)).toEqual({ used: 1, paid: 2 });
  });
});

describe("§3.7 (b) a cost whose min is 0 (engine shape only)", () => {
  it("2 threat there: 0, 1 or 2 are offered; 2 chosen binds 2", () => {
    const t = table(2);
    const { state, numbers } = run(t, use(t, ZERO_TO_3), 2);
    expect(numbers).toEqual([["0", "1", "2"]]);
    expect(threatOn(state, t.upgrade)).toBe(0);
    expect(counters(state, t.ids[ZERO_TO_3.card.id]!)).toEqual({ used: 1, paid: 2 });
  });

  it("1 chosen of 2 binds 1 and leaves 1", () => {
    const t = table(2);
    const { state } = run(t, use(t, ZERO_TO_3), 1);
    expect(threatOn(state, t.upgrade)).toBe(1);
    expect(counters(state, t.ids[ZERO_TO_3.card.id]!)).toEqual({ used: 1, paid: 1 });
  });

  it("0 chosen: the cost is paid, no removal is raised, and the effect resolves reading 0", () => {
    const t = table(2);
    const { state, events } = run(t, use(t, ZERO_TO_3), 0);
    expect(threatOn(state, t.upgrade)).toBe(2);
    expect(removals(events)).toEqual([]);
    expect(settled(events)).toEqual([[0, 0, true]]);
    expect(counters(state, t.ids[ZERO_TO_3.card.id]!).used).toBe(1);
    expect(counters(state, t.ids[ZERO_TO_3.card.id]!).paid ?? 0).toBe(0);
  });

  it("no threat there: still usable, 0 paid without asking", () => {
    const t = table(0);
    expect(offered(t, ZERO_TO_3)).toBe(true);
    const { state, events, numbers } = run(t, use(t, ZERO_TO_3), 0);
    expect(numbers).toEqual([]);
    expect(settled(events)).toEqual([[0, 0, true]]);
    expect(counters(state, t.ids[ZERO_TO_3.card.id]!).used).toBe(1);
  });
});

describe("§3.7 (b) a scheme named by the cost pays under the scheme's rules", () => {
  it("2 of the main scheme's 5 threat are removed, leaving 3; the upgrade keeps its 4", () => {
    const t = table(4);
    const { state, events } = run(t, use(t, FROM_MAIN), 2);
    const main = state.mainScheme.instanceId;
    expect(threatOn(state, main)).toBe(3);
    expect(threatOn(state, t.upgrade)).toBe(4);
    expect(removals(events)).toEqual([{ from: main, amount: 2 }]);
    expect(counters(state, t.ids[FROM_MAIN.card.id]!)).toEqual({ used: 1, paid: 2 });
  });

  it("under a crisis icon it cannot be paid, while the upgrade's own threat still can", () => {
    const base = table(4);
    const t: Table = { ...base, state: encounterCardInVillainArea(base.state, CRISIS_SCHEME.id, 3).state };
    expect(offered(t, FROM_MAIN)).toBe(false);
    expect(sessionApply(startSession(t.state), use(t, FROM_MAIN), deps).ok).toBe(false);
    expect(offered(t, ONE)).toBe(true);
    expect(threatOn(run(t, use(t, ONE), 1).state, t.upgrade)).toBe(3);
  });
});
