import { flat } from "@mc/content";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { stubAbility, depsOf, type StubAbility } from "./testing/abilities.js";
import { stubIdentity, stubVillain } from "./testing/fixtures.js";
import { newGame, resolvePending, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn = { type: "endTurn", playerId: p1 } as const;
const toHero = { type: "changeForm", playerId: p1 } as const;

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(20), atk: 2, sch: 1 }] });

/** "Interrupt: When an enemy attack would damage you, prevent all of that damage." */
const backflip = stubAbility("backflip", {
  trigger: {
    kind: "interrupt",
    forced: false,
    on: { on: "dealDamage", targetIs: { categories: ["hero"] }, fromAttack: true },
  },
  effects: [{ kind: "cancelTriggeringEvent" }],
});

const forcedMark = stubAbility("forced-mark", {
  trigger: { kind: "response", forced: true, on: { on: "dealDamage", targetIs: { categories: ["hero"] } } },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "forced", amount: { kind: "const", value: 1 } },
  ],
});

const optionalMark = stubAbility("optional-mark", {
  trigger: { kind: "response", forced: false, on: { on: "dealDamage", targetIs: { categories: ["hero"] } } },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "optional", amount: { kind: "const", value: 1 } },
  ],
});

const forcedThreat = stubAbility("forced-threat", {
  trigger: { kind: "response", forced: true, on: { on: "dealDamage", targetIs: { categories: ["hero"] } } },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
});

const heroWith = (...abilities: readonly StubAbility[]) =>
  stubIdentity({
    id: "hero",
    hp: 12,
    atk: 2,
    thw: 2,
    def: 1,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: abilities.map((a) => a.ref),
  });

/** Plays to the point where the villain's attack is about to deal damage to p1. */
function toVillainAttack(identity: ReturnType<typeof heroWith>, deps: ReturnType<typeof depsOf>) {
  const start = newGame({ identity, villain: VILLAIN, deps });
  const atDiscard = runWith(deps, start, toHero, endTurn);
  const hand = mustPlayer(atDiscard, p1).hand;
  const afterDiscard = resolvePending(atDiscard, [hand[0] as string], deps);
  return resolvePending(afterDiscard, ["decline"], deps);
}

const abilityOrder = (events: readonly GameEvent[]): readonly string[] =>
  events.filter((e) => e.type === "abilityResolved").map((e) => e.abilityId);

test("an interrupt resolves before its event and can cancel it", () => {
  const deps = depsOf(backflip);
  const identity = heroWith(backflip);
  const atInterrupt = toVillainAttack(identity, deps);

  const choice = atInterrupt.pendingChoice;
  expect(choice?.prompt.kind).toBe("chooseTriggers");
  expect(choice?.minSelections).toBe(0);
  const identityId = mustPlayer(atInterrupt, p1).identity.instanceId;
  expect(mustInstance(atInterrupt, identityId).damage).toBe(0);

  const cancelled = settle(
    resolvePending(atInterrupt, [choice?.options[0]?.optionId as string], deps),
    undefined,
    deps,
  );
  expect(mustInstance(cancelled, identityId).damage).toBe(0);

  // Declining the same interrupt lets the attack through: ATK 2 + 1 boost icon.
  const allowed = settle(resolvePending(atInterrupt, [], deps), undefined, deps);
  expect(mustInstance(allowed, identityId).damage).toBe(3);
});

test("a forced response resolves after its event, with no choice needed", () => {
  const deps = depsOf(forcedThreat);
  const identity = heroWith(forcedThreat);
  const state = settle(toVillainAttack(identity, deps), undefined, deps);
  const identityId = mustPlayer(state, p1).identity.instanceId;
  expect(mustInstance(state, identityId).damage).toBe(3);
  // 1 acceleration + 1 from the forced response after the hero took damage
  expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(2);
});

test("forced responses resolve before optional ones", () => {
  const deps = depsOf(forcedMark, optionalMark);
  const identity = heroWith(forcedMark, optionalMark);
  const atOptional = toVillainAttack(identity, deps);

  const identityId = mustPlayer(atOptional, p1).identity.instanceId;
  expect(atOptional.pendingChoice?.prompt.kind).toBe("chooseTriggers");
  // The forced tier already resolved by the time the optional tier asks.
  expect(mustInstance(atOptional, identityId).counters.forced).toBe(1);
  expect(mustInstance(atOptional, identityId).counters.optional).toBeUndefined();

  const done = settle(
    resolvePending(atOptional, [atOptional.pendingChoice?.options[0]?.optionId as string], deps),
    undefined,
    deps,
  );
  expect(mustInstance(done, identityId).counters.optional).toBe(1);
});

test("two simultaneous forced responses are ordered by the first player", () => {
  const deps = depsOf(forcedMark, forcedThreat);
  const identity = heroWith(forcedMark, forcedThreat);
  const atOrder = toVillainAttack(identity, deps);

  const choice = atOrder.pendingChoice;
  expect(choice?.prompt.kind).toBe("orderTriggers");
  expect(choice?.playerId).toBe(atOrder.firstPlayerId);
  expect(choice?.minSelections).toBe(2);
  const options = choice?.options.map((o) => o.optionId) ?? [];

  const forwards = applyCommand(
    atOrder,
    {
      type: "resolveChoice",
      playerId: p1,
      choiceId: choice?.choiceId as never,
      selectedOptionIds: options,
    },
    deps,
  );
  const backwards = applyCommand(
    atOrder,
    {
      type: "resolveChoice",
      playerId: p1,
      choiceId: choice?.choiceId as never,
      selectedOptionIds: [...options].reverse(),
    },
    deps,
  );
  expect(forwards.ok && backwards.ok).toBe(true);
  if (!forwards.ok || !backwards.ok) return;
  expect(abilityOrder(forwards.events)).toEqual(["forced-mark", "forced-threat"]);
  expect(abilityOrder(backwards.events)).toEqual(["forced-threat", "forced-mark"]);
});

test("the stack is inspectable while a choice is pending", () => {
  const deps = depsOf(backflip);
  const atInterrupt = toVillainAttack(heroWith(backflip), deps);
  const kinds = atInterrupt.stack.map((frame) => frame.kind);
  expect(kinds[0]).toBe("window");
  expect(kinds).toContain("event");
  expect(kinds).toContain("enemyAttack");
  expect(atInterrupt.pendingChoice?.frameId).toBe(atInterrupt.stack[0]?.frameId);
});
