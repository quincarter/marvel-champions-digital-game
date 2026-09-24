/**
 * docs/phase7-wave4.md §3.4: a main scheme stage's completion as an interruptible, replaceable event. Synthetic stages
 * shaped like Tower Defense's Under Siege 1B (`mts` 21098b): "Forced Interrupt: When this stage would be completed,
 * remove all the threat from this stage instead. Then, deal 6[per_hero] damage to Avengers Tower." Also Upgrading
 * Adaptoids 1B (`aos` 50104b).
 *
 * Sources: RRG 1.8 "Main Scheme, Main Scheme Deck" (p. 27), "Interrupt" (p. 25), "Replacement Effect" / "Instead"
 * (p. 37), "Would" (p. 48).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };

/** "When this stage would be completed, remove all the threat from this stage instead. Then, …" */
const SIEGE = stubAbility("siege.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "mainSchemeCompleting", selfIs: "target" } },
  effects: [
    { kind: "cancelTriggeringEvent" },
    { kind: "removeThreat", target: self, amount: { kind: "threat", of: self } },
    { kind: "addCounters", target: tracker, counterType: "towerDamage", amount: { kind: "const", value: 6 } },
  ],
});
/** Listens without replacing anything: the completion still happens after it. */
const WITNESS = stubAbility("witness.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "mainSchemeCompleting" } },
  effects: [{ kind: "addCounters", target: tracker, counterType: "witnessed", amount: { kind: "const", value: 1 } }],
});
const stage = (abilities: readonly StubAbility[] = []) => ({
  startingThreat: flat(0),
  targetThreat: flat(3),
  acceleration: flat(0),
  abilities: abilities.map((a) => a.ref),
});
const SIEGE_SCHEME = stubMainScheme({ id: "under-siege", stages: [stage([SIEGE])] });
const PLAIN_TWO_STAGE = stubMainScheme({ id: "plain", stages: [stage(), stage()] });
const TRACKER = stubSupport({ id: "tracker", cost: 0, abilities: [WITNESS.ref] });
const QUIET = stubSupport({ id: "quiet", cost: 0 });

const threaten = (() => {
  const effects: EffectSpec[] = [
    { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } },
  ];
  const ability = stubAbility("threaten.action", { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id: "threaten", cost: 0, abilities: [ability.ref] }), ability };
})();

const siegeDeps: EngineDeps = depsOf(SIEGE, threaten.ability);
const witnessDeps: EngineDeps = depsOf(WITNESS, threaten.ability);

function start(options: { scheme: typeof SIEGE_SCHEME; deps: EngineDeps; watcher: typeof TRACKER }): GameState {
  const base = gameAtFirstTurn({
    cards: [TRACKER, QUIET, threaten.card],
    deps: options.deps,
    mainScheme: options.scheme,
    deck: [TRACKER.id, QUIET.id, ...copiesOf(threaten.card.id, 2)],
  });
  return playerCardIntoPlay(base, options.watcher.id).state;
}
const schemeThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const counter = (state: GameState, type: string): number => {
  const id = state.players.flatMap((p) => p.playArea).find((i) => state.instances[i]?.cardId === TRACKER.id);
  return id ? (mustInstance(state, id).counters[type] ?? 0) : 0;
};

describe("§3.4 a main scheme stage's completion is replaceable", () => {
  it("'remove all the threat from this stage instead': the final stage is not completed, and the rest resolves", () => {
    const state = start({ scheme: SIEGE_SCHEME, deps: siegeDeps, watcher: TRACKER });
    const { state: after, session } = playFree(state, siegeDeps, threaten.card.id);
    expect(after.outcome).toBeNull();
    expect(after.mainScheme.completed).toBe(false);
    expect(schemeThreat(after)).toBe(0);
    expect(counter(after, "towerDamage")).toBe(6);
    const replayed = replay(session.log, siegeDeps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("an interrupt that replaces nothing leaves the completion to happen after it", () => {
    const state = start({ scheme: PLAIN_TWO_STAGE, deps: witnessDeps, watcher: TRACKER });
    const after = playFree(state, witnessDeps, threaten.card.id).state;
    expect(counter(after, "witnessed")).toBe(1);
    expect(after.mainScheme.stageIndex).toBe(1);
  });

  it("with nothing listening, completing the final stage loses as before", () => {
    const state = start({ scheme: SIEGE_SCHEME, deps: depsOf(threaten.ability), watcher: QUIET });
    const after = playFree(state, depsOf(threaten.ability), threaten.card.id).state;
    expect(after.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });
});
