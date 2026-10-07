/**
 * A thwart reports the scheme it thwarted, the way an attack reports the character it attacked (`attack.target`,
 * docs/phase7-wave6.md §3.31): slot `target` on the thwart's own event frame, so `thwart.target` on the thwarter's
 * consequential damage and `<bind>.target` for a `thwart` effect with a `bind`. "Each ally you control … takes -1
 * consequential damage after thwarting a side scheme" (Uncanny X-Force, `next_evol` 40022).
 *
 * RRG 1.8 "Consequential Damage" (p. 13): the ally takes it after the thwart resolves, so a side scheme the thwart
 * defeated has left play by then and the rule reads it `anywhere`. A basic thwart divided across schemes (`divideBasicPower`)
 * is one event per scheme reporting into the same damage, so the slot names every scheme.
 *
 * Synthetic cards: an ally with THW 2 and 1 consequential damage per power, two side schemes, the main scheme.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { Predicate, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ALLIES = { categories: ["ally" as const] };
const thwarted = (bind: string, query: TargetQuery): Predicate => ({
  kind: "refMatches",
  ref: { kind: "slot", slot: `${bind}.target` },
  query,
  anywhere: true,
});
const SIDE_SCHEME = { categories: ["sideScheme" as const] };
const MAIN_SCHEME = { categories: ["mainScheme" as const] };

/** "-1 consequential damage after thwarting a side scheme". */
const AFTER_SIDE_SCHEME: RuleSpec = {
  kind: "reduceDamageTaken",
  target: ALLIES,
  amount: 1,
  consequential: { from: "thwart", if: thwarted("thwart", SIDE_SCHEME) },
};
const DIVIDES: RuleSpec = { kind: "divideBasicPower", power: "thwart", target: ALLIES };

/** "Action: thwart a side scheme for 1. If that thwart was against a side scheme / the main scheme, take 1 / 2 damage." */
const PROBE = stubAbility("grunt.probe", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseTarget", slot: "scheme", query: { categories: ["scheme"] }, chooser: { kind: "controller" } },
    {
      kind: "thwart",
      target: { kind: "slot", slot: "scheme" },
      amount: { kind: "const", value: 1 },
      thwarter: { kind: "self" },
      bind: "probe",
    },
    {
      kind: "if",
      condition: thwarted("probe", SIDE_SCHEME),
      then: [{ kind: "dealDamage", target: { kind: "self" }, amount: { kind: "const", value: 1 } }],
    },
    {
      kind: "if",
      condition: thwarted("probe", MAIN_SCHEME),
      then: [{ kind: "dealDamage", target: { kind: "self" }, amount: { kind: "const", value: 2 } }],
    },
  ],
});
const GRUNT = stubAlly({ id: "grunt", cost: 0, atk: 1, thw: 2, hp: 9, abilities: [PROBE.ref] });
const PLOT = stubSideScheme({ id: "plot", startingThreat: 5 });
const PLAN = stubSideScheme({ id: "plan", startingThreat: 5 });

interface Table {
  readonly state: GameState;
  readonly deps: EngineDeps;
  readonly grunt: InstanceId;
  readonly plot: InstanceId;
  readonly plan: InstanceId;
  readonly main: InstanceId;
}

function table(name: string, rules: readonly RuleSpec[], plotThreat = 5): Table {
  const aura = stubAbility(`aura.${name}`, { trigger: { kind: "constant", rules }, effects: [] });
  const AURA = stubSupport({ id: `aura-${name}`, cost: 0, abilities: [aura.ref] });
  const deps = depsOf(PROBE, aura);
  const encounter: readonly CardId[] = [PLOT.id, PLAN.id];
  const base = gameAtFirstTurn({ cards: [GRUNT, AURA, PLOT, PLAN], deps, deck: [GRUNT.id, AURA.id], encounter });
  const withAura = playerCardIntoPlay(base, AURA.id);
  const grunt = playerCardIntoPlay(withAura.state, GRUNT.id);
  const plot = encounterCardInVillainArea(grunt.state, PLOT.id, plotThreat);
  const plan = encounterCardInVillainArea(plot.state, PLAN.id, 5);
  const main = plan.state.mainScheme.instanceId;
  const state: GameState = {
    ...plan.state,
    instances: { ...plan.state.instances, [main]: { ...mustInstance(plan.state, main), threat: 6 } },
  };
  return { state, deps, grunt: grunt.id, plot: plot.id, plan: plan.id, main };
}

const thwart = (t: Table, scheme: InstanceId, ...shares: readonly (readonly [InstanceId, number])[]) =>
  runCommandsPicking(t.state, t.deps, defaultPick, {
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: t.grunt,
    schemeInstanceId: scheme,
    ...(shares.length > 0
      ? { divide: shares.map(([targetInstanceId, amount]) => ({ targetInstanceId, amount })) }
      : {}),
  });
const threat = (s: GameState, id: InstanceId): number => mustInstance(s, id).threat;
const damage = (s: GameState, id: InstanceId): number => mustInstance(s, id).damage;

describe("a thwart reports the scheme it thwarted (`thwart.target`)", () => {
  it("a basic thwart of a side scheme: 2 threat removed, the ally's 1 consequential damage is reduced to 0", () => {
    const t = table("side", [AFTER_SIDE_SCHEME]);
    const { state, session } = thwart(t, t.plot);
    expect(threat(state, t.plot)).toBe(3);
    expect(damage(state, t.grunt)).toBe(0);
    const replayed = replay(session.log, t.deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a basic thwart of the main scheme: 2 threat removed, the ally takes its 1 consequential damage", () => {
    const t = table("main", [AFTER_SIDE_SCHEME]);
    const { state } = thwart(t, t.main);
    expect(threat(state, t.main)).toBe(4);
    expect(damage(state, t.grunt)).toBe(1);
  });

  it("a side scheme the thwart defeated has left play and is still the scheme thwarted: 0 damage", () => {
    const t = table("defeated", [AFTER_SIDE_SCHEME], 2);
    const { state } = thwart(t, t.plot);
    expect(state.villainArea).not.toContain(t.plot);
    expect(damage(state, t.grunt)).toBe(0);
  });

  it("a thwart divided across the main scheme and a side scheme names both: 1 threat off each, 0 damage", () => {
    const t = table("divided", [AFTER_SIDE_SCHEME, DIVIDES]);
    const { state, session } = thwart(t, t.main, [t.main, 1], [t.plot, 1]);
    expect(threat(state, t.main)).toBe(5);
    expect(threat(state, t.plot)).toBe(4);
    expect(damage(state, t.grunt)).toBe(0);
    const replayed = replay(session.log, t.deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a rule asking for the main scheme reads a divided thwart's other share too: 1 damage becomes 0", () => {
    const afterMain: RuleSpec = {
      ...AFTER_SIDE_SCHEME,
      consequential: { from: "thwart", if: thwarted("thwart", MAIN_SCHEME) },
    };
    const t = table("divided-main", [afterMain, DIVIDES]);
    expect(damage(thwart(t, t.plot, [t.plot, 1], [t.plan, 1]).state, t.grunt)).toBe(1);
    expect(damage(thwart(t, t.plot, [t.plot, 1], [t.main, 1]).state, t.grunt)).toBe(0);
  });

  it("a `thwart` effect's bind reads `<bind>.target`: 1 damage after a side scheme, 2 after the main scheme", () => {
    const t = table("bind", []);
    const probe = (scheme: InstanceId) =>
      runCommandsPicking(
        t.state,
        t.deps,
        (state) => (state.pendingChoice?.options.some((o) => o.optionId === scheme) ? [scheme] : defaultPick(state)),
        { type: "useAbility", playerId: P1, cardInstanceId: t.grunt, abilityId: PROBE.ref.id, payment: [] },
      ).state;
    const side = probe(t.plan);
    expect(threat(side, t.plan)).toBe(4);
    expect(damage(side, t.grunt)).toBe(1);
    const main = probe(t.main);
    expect(threat(main, t.main)).toBe(5);
    expect(damage(main, t.grunt)).toBe(2);
  });
});
