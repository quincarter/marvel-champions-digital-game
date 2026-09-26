/**
 * docs/phase7-wave4.md §3.3: villains protected by each other's hit points. Synthetic villains shaped like Tower
 * Defense's Proxima Midnight and Corvus Glaive (`mts` 21092–21097): "Proxima Midnight cannot be defeated while Corvus
 * Glaive has any hit points remaining", and the mirror on Corvus. The same shape as the Four Horsemen (`aoa`
 * 45081–45084, "cannot be defeated while another villain has at least 1 hit point").
 *
 * Sources: RRG 1.8 "'Cannot'" (p. 11), "Villain Defeat" (p. 47), "Damage" (p. 14); ruling, Jun 2, 2026 (2) answer 1:
 * "Damage is dealt simultaneously".
 */

import { flat, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, villainOf } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "./testing/scenario.js";
import { copiesOf, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const protectedWhile = (self: string, other: string) =>
  stubAbility(`${self}.cannot-be-defeated`, {
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "cannotBeDefeated",
          target: { self: true },
          while: {
            kind: "compare",
            left: { kind: "remainingHp", of: { kind: "named", name: other } },
            op: "atLeast",
            right: { kind: "const", value: 1 },
          },
        },
      ],
    },
    effects: [],
  });
const PROXIMA_RULE = protectedWhile("proxima", "corvus");
const CORVUS_RULE = protectedWhile("corvus", "proxima");
const villain = (id: string, rule: typeof PROXIMA_RULE): VillainCard =>
  stubVillain({
    id,
    stages: [
      { hp: flat(5), atk: 0, sch: 0, abilities: [rule.ref] },
      { hp: flat(8), atk: 0, sch: 0, abilities: [rule.ref] },
    ],
  });
const PROXIMA = villain("proxima", PROXIMA_RULE);
const CORVUS = villain("corvus", CORVUS_RULE);
const SCHEME = stubMainScheme({
  id: "under-siege",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const n = (value: number): ValueSpec => ({ kind: "const", value });
const named = (name: string): TargetRef => ({ kind: "named", name });
const hit = (id: string, targets: readonly string[], amount: number) => {
  const effects: EffectSpec[] = [
    {
      kind: "dealDamage",
      target: targets.length === 1 ? named(targets[0]!) : { kind: "each", query: { categories: ["villain"] } },
      amount: n(amount),
    },
  ];
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** One effect dealing 5 to both villains at once: simultaneous damage. */
const BOTH = hit("both", ["proxima", "corvus"], 5);
const PROXIMA_5 = hit("proxima-5", ["proxima"], 5);
const CORVUS_5 = hit("corvus-5", ["corvus"], 5);
const EVENTS = [BOTH, PROXIMA_5, CORVUS_5];

const deps: EngineDeps = depsOf(PROXIMA_RULE, CORVUS_RULE, ...EVENTS.map((e) => e.ability));
/** A listener on villain defeats, so each defeat is an event on the stack with its own window (wave 3 §3.1). */
const WATCHER = stubAbility("watcher.response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated" } },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: n(0) }],
});
const WATCHER_CARD = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER.ref] });
const watchedDeps: EngineDeps = depsOf(PROXIMA_RULE, CORVUS_RULE, WATCHER, ...EVENTS.map((e) => e.ability));

function start(withDeps: EngineDeps = deps): GameState {
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, PROXIMA, CORVUS, SCHEME, FILLER, WATCHER_CARD, ...EVENTS.map((e) => e.card)],
      villainCardId: PROXIMA.id,
      villains: [
        { villainCardId: PROXIMA.id, encounterDeck: copiesOf(FILLER.id, 10), lastStageIndex: 1 },
        { villainCardId: CORVUS.id, encounterDeck: copiesOf(FILLER.id, 10), lastStageIndex: 1 },
      ],
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [],
      includeIdentitySets: false,
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, WATCHER_CARD.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
        },
      ],
    },
    withDeps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), withDeps).session.state;
}

const idOf = (state: GameState, name: string): InstanceId => {
  const found = state.villains.find((v) => v.cardId === name);
  if (!found) throw new Error(`no villain ${name}`);
  return found.instanceId;
};
const stageOf = (state: GameState, name: string): number => villainOf(state, idOf(state, name))!.stageIndex;
const damageOf = (state: GameState, name: string): number => mustInstance(state, idOf(state, name)).damage;

describe("§3.3 villains protected by each other's hit points", () => {
  it("one at zero while the other has hit points is not defeated", () => {
    const after = playFree(start(), deps, PROXIMA_5.card.id).state;
    expect(stageOf(after, "proxima")).toBe(0);
    expect(damageOf(after, "proxima")).toBe(5);
  });

  it("both reaching zero from one effect are both defeated, though each protects the other", () => {
    const { state: after, session } = playFree(start(), deps, BOTH.card.id);
    expect(stageOf(after, "proxima")).toBe(1);
    expect(stageOf(after, "corvus")).toBe(1);
    expect(damageOf(after, "proxima")).toBe(0);
    expect(damageOf(after, "corvus")).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the second reaching zero later takes the first, already at zero, down with it", () => {
    const first = playFree(start(), deps, PROXIMA_5.card.id, P1).state;
    const second = playFree(first, deps, CORVUS_5.card.id, P1).state;
    expect(stageOf(second, "proxima")).toBe(1);
    expect(stageOf(second, "corvus")).toBe(1);
  });

  it("with defeats on the stack (something listens to them), both still fall: protection was read once for both", () => {
    const watched = playerCardIntoPlay(start(watchedDeps), WATCHER_CARD.id).state;
    const after = playFree(watched, watchedDeps, BOTH.card.id).state;
    expect(stageOf(after, "proxima")).toBe(1);
    expect(stageOf(after, "corvus")).toBe(1);
  });
});
