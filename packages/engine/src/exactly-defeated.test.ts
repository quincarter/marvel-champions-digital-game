/**
 * "Exactly defeat" a side scheme (docs/phase7-wave11.md §3.7): `schemeDefeated.excessThreat` / `byThwart` and
 * `Predicate exactlyDefeated`, on synthetic cards shaped like Stealth Training (60028: "Response: After you thwart and
 * exactly defeat a side scheme, exhaust Stealth Training → stun an enemy") and Know Your Enemy (60023: "Hero Action
 * (thwart): Remove 1 threat from a scheme. Remove 1 threat from a scheme.").
 *
 * Sources: MC60 insert p. 4, a scheme is exactly defeated when "defeated by a thwart that did not attempt to remove more
 * threat than was necessary"; p. 25: "Know Your Enemy and Stick help you defeat side schemes exactly", so each removal
 * instruction of a thwart is its own attempt (engine reading, §3.7). August 3, 2026 - Ruling 6 covers characters only
 * (dealt damage, not taken), which this predicate does not read.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const eachSideScheme = { kind: "each", query: { categories: ["sideScheme"] } } as const;
const removes = (amount: number): EffectSpec => ({ kind: "removeThreat", target: eachSideScheme, amount: n(amount) });

/** "Forced Response: After you defeat a side scheme, if you thwarted and exactly defeated it, place 1 counter here." */
const TRAINING_RESPONSE = stubAbility("training.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "schemeDefeated", playerIs: "controller", targetIs: { categories: ["sideScheme"] } },
    while: { kind: "exactlyDefeated" },
  },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "exact", amount: n(1) }],
} satisfies AbilityDefinition);
const TRAINING = stubSupport({ id: "training", cost: 0, abilities: [TRAINING_RESPONSE.ref] });

/** Know Your Enemy's shape: "Action (thwart): Remove 1 threat from each side scheme. Remove 1 threat from each side scheme." */
const TWICE = stubAbility("twice.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [removes(1), removes(1)],
} satisfies AbilityDefinition);
/** "Action: Remove 2 threat from each side scheme." No label: a plain removal, not a thwart (Foggy Nelson's case). */
const PLAIN = stubAbility("plain.action", { trigger: { kind: "action" }, effects: [removes(2)] });
const TOOLKIT = stubSupport({ id: "toolkit", cost: 0, abilities: [TWICE.ref, PLAIN.ref] });

/** Stick's "-1 to that basic power" as a constant: "Your allies get -1 THW." */
const DAMPER_CONSTANT = stubAbility("damper.constant", {
  trigger: {
    kind: "constant",
    modifiers: [{ stat: "thw", amount: -1, target: { categories: ["ally"], controller: "you" } }],
  },
  effects: [],
} satisfies AbilityDefinition);
const DAMPER = stubSupport({ id: "damper", cost: 0, abilities: [DAMPER_CONSTANT.ref] });
/** "Forced Interrupt: When a character you control thwarts, that thwart removes 1 additional threat." */
const SHOVE_INTERRUPT = stubAbility("shove.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "thwart", playerIs: "controller" } },
  effects: [{ kind: "modifyThwart", extraThreat: n(1) }],
} satisfies AbilityDefinition);
const SHOVE = stubSupport({ id: "shove", cost: 0, abilities: [SHOVE_INTERRUPT.ref] });

const SCOUT = stubAlly({ id: "scout", cost: 0, atk: 1, thw: 2, hp: 3 });
const HIDEOUT = stubSideScheme({ id: "hideout", startingThreat: 2 });

const deps: EngineDeps = depsOf(TRAINING_RESPONSE, TWICE, PLAIN, DAMPER_CONSTANT, SHOVE_INTERRUPT);

interface Table {
  readonly state: GameState;
  readonly scheme: InstanceId;
  readonly training: InstanceId;
  readonly toolkit: InstanceId;
  readonly scout: InstanceId;
}

/** P1 in hero form with Training, the toolkit and a THW 2 ally in play, and a side scheme with `threat` threat. */
function table(threat: number): Table {
  const base = gameAtFirstTurn({
    cards: [TRAINING, TOOLKIT, SCOUT, HIDEOUT, DAMPER, SHOVE],
    deps,
    deck: [TRAINING.id, TOOLKIT.id, SCOUT.id, SCOUT.id, DAMPER.id, SHOVE.id],
    encounter: [HIDEOUT.id],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const placed = encounterCardInVillainArea(heroes, HIDEOUT.id, threat);
  const training = playerCardIntoPlay(placed.state, TRAINING.id, P1);
  const toolkit = playerCardIntoPlay(training.state, TOOLKIT.id, P1);
  const scout = playerCardIntoPlay(toolkit.state, SCOUT.id, P1);
  return { state: scout.state, scheme: placed.id, training: training.id, toolkit: toolkit.id, scout: scout.id };
}

const run = (state: GameState, ...commands: readonly Command[]) =>
  driveSession(startSession(state), deps, commands).session.state;
const use = (card: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: ability.ref.id,
  payment: [],
});
const thwartWith = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const exact = (state: GameState, training: InstanceId) => mustInstance(state, training).counters["exact"] ?? 0;

describe("exactly defeating a side scheme (schemeDefeated.excessThreat, byThwart; Predicate exactlyDefeated)", () => {
  it("MC60 p. 4: a THW 2 basic thwart on a 2-threat side scheme removes no more than was there: exact", () => {
    const t = table(2);
    const after = run(t.state, thwartWith(t.scout, t.scheme));
    expect(after.villainArea).not.toContain(t.scheme);
    expect(exact(after, t.training)).toBe(1);
  });

  it("control: the same thwart on a 1-threat side scheme attempted 1 more than necessary: defeated, not exact", () => {
    const t = table(1);
    const after = run(t.state, thwartWith(t.scout, t.scheme));
    expect(after.villainArea).not.toContain(t.scheme);
    expect(exact(after, t.training)).toBe(0);
  });

  it("MC60 p. 25: each 'Remove 1 threat' of a thwart is its own attempt, so the first exactly defeats a 1-threat scheme", () => {
    const t = table(1);
    const after = run(t.state, use(t.toolkit, TWICE));
    expect(after.villainArea).not.toContain(t.scheme);
    expect(exact(after, t.training)).toBe(1);
  });

  it("MC60 p. 25: on a 2-threat scheme the first 'Remove 1' leaves 1 and the second exactly defeats it", () => {
    const t = table(2);
    const after = run(t.state, use(t.toolkit, TWICE));
    expect(after.villainArea).not.toContain(t.scheme);
    expect(exact(after, t.training)).toBe(1);
  });

  it("the attempt is read after modifiers: THW 2 with -1 (Stick's shape) on a 1-threat scheme is exact", () => {
    const t = table(1);
    const damped = playerCardIntoPlay(t.state, DAMPER.id, P1).state;
    const after = run(damped, thwartWith(t.scout, t.scheme));
    expect(after.villainArea).not.toContain(t.scheme);
    expect(exact(after, t.training)).toBe(1);
  });

  it("control: 'removes 1 additional threat' (modifyThwart) makes THW 2 on a 2-threat scheme attempt 3: not exact", () => {
    const t = table(2);
    const shoved = playerCardIntoPlay(t.state, SHOVE.id, P1).state;
    const after = run(shoved, thwartWith(t.scout, t.scheme));
    expect(after.villainArea).not.toContain(t.scheme);
    expect(exact(after, t.training)).toBe(0);
  });

  it("control: a plain removal of 2 on 2 threat is not a thwart (Foggy Nelson's case): no exact defeat", () => {
    const t = table(2);
    const after = run(t.state, use(t.toolkit, PLAIN));
    expect(after.villainArea).not.toContain(t.scheme);
    expect(exact(after, t.training)).toBe(0);
  });

  it("control: a thwart that leaves threat defeats nothing, and the main scheme is never 'defeated'", () => {
    const t = table(3);
    const left = run(t.state, thwartWith(t.scout, t.scheme));
    expect(mustInstance(left, t.scheme).threat).toBe(1);
    expect(exact(left, t.training)).toBe(0);
    const main = left.mainScheme.instanceId;
    const atTwo: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [main]: { ...mustInstance(t.state, main), threat: 2 } },
    };
    const identity = mustPlayer(atTwo, P1).identity.instanceId;
    expect(exact(run(atTwo, thwartWith(identity, main)), t.training)).toBe(0);
  });
});
