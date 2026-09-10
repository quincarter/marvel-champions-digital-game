import { cardId, flat, type CardId } from "@mc/content";
import { applyCommand } from "./engine.js";
import { playerId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer, remainingHitPoints } from "./query.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { expectOk, findInHand, newGame, resolvePending, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn = { type: "endTurn", playerId: p1 } as const;
const toHero = { type: "changeForm", playerId: p1 } as const;

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(20), atk: 2, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(1) }],
});

const deckOf = (id: CardId, count = 20): readonly CardId[] => Array.from({ length: count }, () => id);

test("a when-revealed treachery resolves through the stack and is then discarded", () => {
  const ability = stubAbility("shadow-of-the-past", {
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 } }],
  });
  const treachery = stubTreachery({ id: "treachery", boostIcons: 0, abilities: [ability.ref] });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [treachery],
    encounterDeck: deckOf(treachery.id),
    deps,
  });

  const state = settle(runWith(deps, start, endTurn), undefined, deps);
  // 1 acceleration + villain SCH 1 + 2 from the revealed treachery (boost card has no icons)
  expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(4);
  expect(state.encounterDiscard.length).toBe(2);
  expect(mustPlayer(state, p1).dealtEncounter).toHaveLength(0);
});

test("a boost ability on a flipped boost card resolves during the activation", () => {
  const ability = stubAbility("boost-threat", {
    trigger: { kind: "boost" },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 } }],
  });
  const treachery = stubTreachery({ id: "boosty", boostIcons: 0, abilities: [ability.ref] });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [treachery],
    encounterDeck: deckOf(treachery.id),
    deps,
  });

  const state = settle(runWith(deps, start, endTurn), undefined, deps);
  // 1 acceleration + villain SCH 1 + 3 from the boost card. RRG "Boost": a "Boost"
  // ability is only active while the card resolves as a boost card, not when revealed.
  expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(5);
});

test("an event's effect targets a minion through a chooseTarget choice", () => {
  const ability = stubAbility("blade-strike", {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "chooseTarget",
        slot: "victim",
        chooser: { kind: "controller" },
        query: { categories: ["minion"], engagedWith: "you" },
      },
      { kind: "dealDamage", target: { kind: "slot", slot: "victim" }, amount: { kind: "const", value: 3 } },
    ],
  });
  const event = stubEvent({ id: "strike", cost: 0, resources: 1, abilities: [ability.ref] });
  const minion = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [event, minion],
    deck: deckOf(event.id, 24),
    encounterDeck: deckOf(minion.id),
    deps,
  });

  const roundTwo = settle(runWith(deps, start, endTurn), undefined, deps);
  const minionId = mustPlayer(roundTwo, p1).playArea.find((id) => roundTwo.instances[id]?.cardId === minion.id);
  expect(minionId).toBeDefined();

  const atChoice = runWith(deps, roundTwo, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: findInHand(roundTwo, p1, event.id),
    payment: [],
    attachToInstanceId: null,
  });
  expect(atChoice.pendingChoice?.prompt).toEqual({ kind: "chooseTarget", slot: "victim", abilityId: null });
  expect(atChoice.pendingChoice?.options.map((o) => o.optionId)).toEqual([minionId]);

  const resolved = settle(resolvePending(atChoice, [minionId as string], deps), undefined, deps);
  expect(mustPlayer(resolved, p1).playArea).not.toContain(minionId);
  expect(resolved.encounterDiscard).toContain(minionId);
});

test("an event with no legal target for its choice resolves without effect and is still discarded", () => {
  const ability = stubAbility("blade-strike", {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "chooseTarget",
        slot: "victim",
        chooser: { kind: "controller" },
        query: { categories: ["minion"], engagedWith: "you" },
      },
      { kind: "dealDamage", target: { kind: "slot", slot: "victim" }, amount: { kind: "const", value: 3 } },
    ],
  });
  const event = stubEvent({ id: "strike", cost: 0, resources: 1, abilities: [ability.ref] });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [event],
    deck: deckOf(event.id, 24),
    deps,
  });
  const instanceId = findInHand(start, p1, event.id);
  const state = runWith(deps, start, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: instanceId,
    payment: [],
    attachToInstanceId: null,
  });
  expect(state.pendingChoice).toBeNull();
  expect(mustPlayer(state, p1).discard).toContain(instanceId);
});

test("useAbility pays an exhaust-plus-counter cost and enforces its limit", () => {
  const ability = stubAbility("web-shooter", {
    trigger: { kind: "action" },
    cost: { exhaustSelf: true, spendCounters: { counterType: "ammo", amount: 1 } },
    limit: { count: 1, period: "round" },
    effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
  });
  const upgrade = stubUpgrade({ id: "shooter", cost: 0, resources: 1, abilities: [ability.ref] });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [upgrade],
    deck: deckOf(upgrade.id, 24),
    deps,
  });
  const upgradeId = findInHand(start, p1, upgrade.id);
  const inPlay = runWith(deps, start, toHero, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: upgradeId,
    payment: [],
    attachToInstanceId: null,
  });
  const loaded = {
    ...inPlay,
    instances: {
      ...inPlay.instances,
      [upgradeId]: { ...mustInstance(inPlay, upgradeId), counters: { ammo: 2 } },
    },
  };

  const use = { type: "useAbility", playerId: p1, cardInstanceId: upgradeId, abilityId: ability.ref.id, payment: [] } as const;
  const used = runWith(deps, loaded, use);
  expect(remainingHitPoints(used, used.villain.instanceId)).toBe(18);
  expect(mustInstance(used, upgradeId).exhausted).toBe(true);
  expect(mustInstance(used, upgradeId).counters.ammo).toBe(1);

  const again = applyCommand(used, use, deps);
  expect(again.ok).toBe(false);
  if (!again.ok) expect(again.error.code).toBe("limit_reached");
});

test("a once-per-round limit resets when the round does", () => {
  const ability = stubAbility("once", {
    trigger: { kind: "action" },
    limit: { count: 1, period: "round" },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
  });
  const upgrade = stubUpgrade({ id: "once-card", cost: 0, resources: 1, abilities: [ability.ref] });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [upgrade],
    deck: deckOf(upgrade.id, 24),
    deps,
  });
  const upgradeId = findInHand(start, p1, upgrade.id);
  const use = { type: "useAbility", playerId: p1, cardInstanceId: upgradeId, abilityId: ability.ref.id, payment: [] } as const;

  const afterFirst = runWith(deps, start, { type: "playCard", playerId: p1, cardInstanceId: upgradeId, payment: [], attachToInstanceId: null }, use);
  expect(applyCommand(afterFirst, use, deps).ok).toBe(false);

  const nextRound = settle(runWith(deps, afterFirst, endTurn), undefined, deps);
  expect(nextRound.round).toBe(2);
  expect(applyCommand(nextRound, use, deps).ok).toBe(true);
});

test("a resource ability can pay part of a card's cost", () => {
  const ability = stubAbility("energy-cell", {
    trigger: { kind: "resource" },
    cost: { exhaustSelf: true },
    generates: 1,
    effects: [],
  });
  const support = stubSupport({ id: "cell", cost: 0, resources: 1, abilities: [ability.ref] });
  const pricey = stubUpgrade({ id: "pricey", cost: 1, resources: 1 });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [support, pricey],
    deck: [...deckOf(support.id, 12), ...deckOf(pricey.id, 12)],
    deps,
  });
  const supportId = findInHand(start, p1, support.id);
  const inPlay = runWith(deps, start, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: supportId,
    payment: [],
    attachToInstanceId: null,
  });
  const priceyId = findInHand(inPlay, p1, pricey.id);
  const handBefore = mustPlayer(inPlay, p1).hand.length;

  const paid = runWith(deps, inPlay, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: priceyId,
    payment: [{ ability: { instanceId: supportId, abilityId: ability.ref.id } }],
    attachToInstanceId: null,
  });
  expect(mustInstance(paid, supportId).exhausted).toBe(true);
  expect(mustInstance(paid, priceyId).attachedTo).toBe(mustPlayer(paid, p1).identity.instanceId);
  // Only the played card left hand: nothing was discarded to pay for it.
  expect(mustPlayer(paid, p1).hand).toHaveLength(handBefore - 1);

  const exhausted = applyCommand(
    paid,
    {
      type: "playCard",
      playerId: p1,
      cardInstanceId: findInHand(paid, p1, pricey.id),
      payment: [{ ability: { instanceId: supportId, abilityId: ability.ref.id } }],
      attachToInstanceId: null,
    },
    deps,
  );
  expect(exhausted.ok).toBe(false);
  if (!exhausted.ok) expect(exhausted.error.code).toBe("already_exhausted");
});

test("a constant ability modifies ATK without touching printed stats", () => {
  const ability = stubAbility("mighty", {
    trigger: {
      kind: "constant",
      modifiers: [{ stat: "atk", amount: 1, target: { categories: ["hero"], controller: "you" } }],
    },
    effects: [],
  });
  const upgrade = stubUpgrade({ id: "mighty-card", cost: 0, resources: 1, abilities: [ability.ref] });
  const deps = depsOf(ability);
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [upgrade],
    deck: deckOf(upgrade.id, 24),
    deps,
  });
  const upgradeId = findInHand(start, p1, upgrade.id);
  const identityId = mustPlayer(start, p1).identity.instanceId;

  const inPlay = runWith(deps, start, toHero, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: upgradeId,
    payment: [],
    attachToInstanceId: null,
  });
  expect(characterProfile(inPlay, identityId, deps)?.atk).toBe(3);
  expect(characterProfile(inPlay, identityId)?.atk).toBe(2);

  const attacked = runWith(deps, inPlay, {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: identityId,
    targetInstanceId: inPlay.villain.instanceId,
  });
  expect(remainingHitPoints(attacked, attacked.villain.instanceId, deps)).toBe(17);
});

test("unknown ability ids are rejected rather than silently ignored", () => {
  const start = newGame({ villain: VILLAIN, mainScheme: SCHEME });
  const result = applyCommand(start, {
    type: "useAbility",
    playerId: p1,
    cardInstanceId: mustPlayer(start, p1).identity.instanceId,
    abilityId: cardId("nope") as never,
    payment: [],
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe("unknown_ability");
});

test("expectOk keeps rejected ability commands from changing state", () => {
  const start = newGame({ villain: VILLAIN, mainScheme: SCHEME });
  const before = JSON.stringify(start);
  expectOk(applyCommand(start, toHero));
  expect(JSON.stringify(start)).toBe(before);
});
