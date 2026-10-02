/**
 * docs/phase7-wave6.md §3.8: "After you ignore guard / patrol / the crisis icon" (`TriggerEvent keywordIgnored`).
 * Synthetic cards shaped like Shadowcat's Acute Control (`mut_gen` 32034: "After you ignore the guard or patrol keyword
 * on a minion, exhaust Acute Control → deal 2 damage to that minion") and Intangible Interference (32035: "After you
 * ignore the crisis icon on a scheme, exhaust Intangible Interference → remove 2 threat from that scheme"), with the
 * exemption shaped like Selective Intangibility (32030a) as a `characterIgnores` rule (wave 4 §3.24).
 *
 * §4.1 Q6: Shadowcat "ignores" a guard, patrol or crisis only when it would otherwise have stopped the attack or thwart
 * she made; one event per card ignored, after the attack/thwart. Sources: RRG 1.8 "Guard" (p. 21), "Patrol" (p. 32),
 * "Crisis Icon" (p. 14), "Ignore" (p. 23), "Triggering Condition" (p. 45: one occurrence, one window).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubMinion, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const GUARD = stubMinion({ id: "guard-minion", atk: 1, sch: 1, hp: 9, keywords: [{ name: "guard" }] });
const PATROL = stubMinion({ id: "patrol-minion", atk: 1, sch: 1, hp: 9, keywords: [{ name: "patrol" }] });
const CRISIS = stubSideScheme({ id: "crisis-scheme", startingThreat: 3, icons: ["crisis"] });
// The default test hero's printed ATK and THW (`testing/fixtures.ts`).
const HERO_ATK = 2;
const HERO_THW = 2;

const bump = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "self" },
  counterType,
  amount: { kind: "const", value: 1 },
});

/** Selective Intangibility's exemption, on the hero. */
const INTANGIBLE_CONSTANT = stubAbility("intangible.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "characterIgnores",
        target: { categories: ["hero"], controller: "you" },
        ignores: ["guard", "patrol", "crisis"],
      },
    ],
  },
  effects: [],
});
/** Acute Control: exhausts, so it answers once per window. */
const ACUTE_RESPONSE = stubAbility("acute.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "keywordIgnored", eventIs: { ignored: ["guard", "patrol"] }, playerIs: "controller" },
  },
  cost: { exhaustSelf: true },
  effects: [{ kind: "dealDamage", target: { kind: "eventTarget" }, amount: { kind: "const", value: 2 } }],
});
/** Intangible Interference: exhausts. */
const INTERFERENCE_RESPONSE = stubAbility("interference.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "keywordIgnored", eventIs: { ignored: "crisis" }, playerIs: "controller" },
  },
  cost: { exhaustSelf: true },
  effects: [{ kind: "removeThreat", target: { kind: "eventTarget" }, amount: { kind: "const", value: 2 } }],
});
/** A counter per event heard, to count them. */
const WATCH_RESPONSE = stubAbility("watch.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "keywordIgnored" } },
  effects: [bump("heard")],
});

const INTANGIBLE = stubSupport({ id: "intangible", cost: 0, abilities: [INTANGIBLE_CONSTANT.ref] });
const ACUTE = stubSupport({ id: "acute", cost: 0, abilities: [ACUTE_RESPONSE.ref] });
const INTERFERENCE = stubSupport({ id: "interference", cost: 0, abilities: [INTERFERENCE_RESPONSE.ref] });
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_RESPONSE.ref] });

const deps: EngineDeps = depsOf(INTANGIBLE_CONSTANT, ACUTE_RESPONSE, INTERFERENCE_RESPONSE, WATCH_RESPONSE);

interface Setup {
  readonly intangible?: boolean;
  readonly guards?: number;
  readonly patrol?: boolean;
  readonly crisis?: boolean;
}

function start(setup: Setup): { readonly state: GameState; readonly minions: readonly InstanceId[] } {
  let state = gameAtFirstTurn({
    cards: [GUARD, PATROL, CRISIS, INTANGIBLE, ACUTE, INTERFERENCE, WATCH],
    deps,
    encounter: [...copiesOf(GUARD.id, 3), PATROL.id, CRISIS.id],
    deck: [INTANGIBLE.id, ACUTE.id, INTERFERENCE.id, WATCH.id],
  });
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    instances: {
      ...state.instances,
      [state.mainScheme.instanceId]: { ...mustInstance(state, state.mainScheme.instanceId), threat: 5 },
    },
  };
  const minions: InstanceId[] = [];
  for (let i = 0; i < (setup.guards ?? 0); i++) {
    const engaged = minionEngagedWith(state, GUARD.id, P1);
    state = engaged.state;
    minions.push(engaged.id);
  }
  if (setup.patrol) {
    const engaged = minionEngagedWith(state, PATROL.id, P1);
    state = engaged.state;
    minions.push(engaged.id);
  }
  if (setup.crisis) state = encounterCardInVillainArea(state, CRISIS.id, 3).state;
  const supports = [...(setup.intangible === false ? [] : [INTANGIBLE]), ACUTE, INTERFERENCE, WATCH];
  for (const support of supports) state = playerCardIntoPlay(state, support.id).state;
  return { state, minions };
}

/** Accepts every optional response offered. */
const acceptTriggers = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};
const run = (state: GameState, ...commands: readonly Command[]) =>
  runCommandsPicking(state, deps, acceptTriggers, ...commands);

const heroId = (state: GameState): InstanceId => state.players[0]!.identity.instanceId;
const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const supportId = (state: GameState, card: string): InstanceId =>
  state.players[0]!.playArea.find((id) => mustInstance(state, id).cardId === card)!;
const heard = (state: GameState): number => mustInstance(state, supportId(state, WATCH.id)).counters.heard ?? 0;
const exhausted = (state: GameState, card: string): boolean => mustInstance(state, supportId(state, card)).exhausted;
const crisisId = (state: GameState): InstanceId =>
  state.villainArea.find((id) => mustInstance(state, id).cardId === CRISIS.id)!;

const attack = (state: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: heroId(state),
  targetInstanceId: target,
});
const thwartMain = (state: GameState): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: heroId(state),
  schemeInstanceId: state.mainScheme.instanceId,
});

const ignoredEvents = (events: readonly GameEvent[]): readonly TriggerEvent[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "keywordIgnored" ? [e.event] : [],
  );
const windows = (events: readonly GameEvent[]): number =>
  events.filter((e) => e.type === "windowOpened" && e.timing === "response" && e.event.kind === "keywordIgnored")
    .length;
/** The index of the first log entry of `type`, to order the attack's end against the announcement. */
const indexOf = (events: readonly GameEvent[], predicate: (e: GameEvent) => boolean): number =>
  events.findIndex(predicate);

function expectReplays(result: ReturnType<typeof run>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

describe("§3.8 keywordIgnored", () => {
  it("attacking the villain past one guard minion: one guard event, after the attack; Acute Control answers it", () => {
    const { state, minions } = start({ guards: 1 });
    const result = run(state, attack(state, villainId(state)));
    const hero = heroId(result.state);
    expect(ignoredEvents(result.events)).toEqual([
      { kind: "keywordIgnored", characterInstanceId: hero, playerId: P1, ignored: "guard", cardInstanceId: minions[0] },
    ]);
    expect(windows(result.events)).toBe(2); // the forced tier (the watcher) and the optional one (Acute Control)
    // The attack resolved first: its damage is logged before the announcement.
    const damaged = indexOf(
      result.events,
      (e) => e.type === "damageDealt" && "targetInstanceId" in e && e.targetInstanceId === villainId(result.state),
    );
    const announced = indexOf(result.events, (e) => e.type === "triggerEvent" && e.event.kind === "keywordIgnored");
    expect(damaged).toBeGreaterThanOrEqual(0);
    expect(announced).toBeGreaterThan(damaged);
    expect(mustInstance(result.state, villainId(result.state)).damage).toBe(HERO_ATK);
    expect(mustInstance(result.state, minions[0]!).damage).toBe(2);
    expect(exhausted(result.state, ACUTE.id)).toBe(true);
    expect(heard(result.state)).toBe(1);
    expect(mustInstance(result.state, hero).exhausted).toBe(true);
    expectReplays(result);
  });

  it("with no guard minion engaged, the attack ignored nothing: no event", () => {
    const { state } = start({});
    const result = run(state, attack(state, villainId(state)));
    expect(ignoredEvents(result.events)).toEqual([]);
    expect(windows(result.events)).toBe(0);
    expect(mustInstance(result.state, villainId(result.state)).damage).toBe(HERO_ATK);
    expect(exhausted(result.state, ACUTE.id)).toBe(false);
    expect(heard(result.state)).toBe(0);
    expectReplays(result);
  });

  it("attacking a guard minion itself ignores nothing (guard only protects villains)", () => {
    const { state, minions } = start({ guards: 1 });
    const result = run(state, attack(state, minions[0]!));
    expect(ignoredEvents(result.events)).toEqual([]);
    expect(heard(result.state)).toBe(0);
    expect(mustInstance(result.state, minions[0]!).damage).toBe(HERO_ATK);
    expectReplays(result);
  });

  it("two guard minions ignored: two events in one shared window; the exhausting response answers once", () => {
    const { state, minions } = start({ guards: 2 });
    const result = run(state, attack(state, villainId(state)));
    const hero = heroId(result.state);
    expect(ignoredEvents(result.events)).toEqual([
      { kind: "keywordIgnored", characterInstanceId: hero, playerId: P1, ignored: "guard", cardInstanceId: minions[0] },
      { kind: "keywordIgnored", characterInstanceId: hero, playerId: P1, ignored: "guard", cardInstanceId: minions[1] },
    ]);
    expect(windows(result.events)).toBe(2); // one forced tier, one optional tier, shared by both events
    expect(heard(result.state)).toBe(2);
    expect(minions.map((id) => mustInstance(result.state, id).damage)).toEqual([2, 0]);
    expect(exhausted(result.state, ACUTE.id)).toBe(true);
    expect(mustInstance(result.state, villainId(result.state)).damage).toBe(HERO_ATK);
    expectReplays(result);
  });

  it("thwarting the main scheme past a crisis side scheme: one crisis event; Intangible Interference answers it", () => {
    const { state } = start({ crisis: true });
    const result = run(state, thwartMain(state));
    const hero = heroId(result.state);
    const crisis = crisisId(result.state);
    expect(ignoredEvents(result.events)).toEqual([
      { kind: "keywordIgnored", characterInstanceId: hero, playerId: P1, ignored: "crisis", cardInstanceId: crisis },
    ]);
    expect(mustInstance(result.state, result.state.mainScheme.instanceId).threat).toBe(5 - HERO_THW);
    expect(mustInstance(result.state, crisis).threat).toBe(1);
    expect(exhausted(result.state, INTERFERENCE.id)).toBe(true);
    expect(exhausted(result.state, ACUTE.id)).toBe(false);
    expect(heard(result.state)).toBe(1);
    expectReplays(result);
  });

  it("thwarting the main scheme past a patrol minion: one patrol event; thwarting with neither ignores nothing", () => {
    const { state, minions } = start({ patrol: true });
    const result = run(state, thwartMain(state));
    expect(ignoredEvents(result.events)).toEqual([
      {
        kind: "keywordIgnored",
        characterInstanceId: heroId(result.state),
        playerId: P1,
        ignored: "patrol",
        cardInstanceId: minions[0],
      },
    ]);
    expect(mustInstance(result.state, minions[0]!).damage).toBe(2);
    expect(heard(result.state)).toBe(1);
    expectReplays(result);

    const plain = start({}).state;
    const unblocked = run(plain, thwartMain(plain));
    expect(ignoredEvents(unblocked.events)).toEqual([]);
    expect(mustInstance(unblocked.state, unblocked.state.mainScheme.instanceId).threat).toBe(5 - HERO_THW);
    expectReplays(unblocked);
  });

  it("without the ignore rule the attack past guard and the thwart past crisis are refused as before", () => {
    const guarded = start({ intangible: false, guards: 1 }).state;
    const refused = applyCommand(guarded, attack(guarded, villainId(guarded)), deps);
    expect(refused.ok).toBe(false);
    const crisis = start({ intangible: false, crisis: true }).state;
    expect(applyCommand(crisis, thwartMain(crisis), deps).ok).toBe(false);
  });
});
