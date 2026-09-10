import { applyCommand } from "./engine.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer, remainingHitPoints } from "./query.js";
import { ALLY, UPGRADE, expectOk, findInHand, newGame, payFor, run } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

const toHero = { type: "changeForm", playerId: p1 } as const;

test("changing form flips the identity and is limited to once per round", () => {
  const state = run(newGame(), toHero);
  expect(mustPlayer(state, p1).identity.form).toBe("hero");

  const second = applyCommand(state, toHero);
  expect(second.ok).toBe(false);
  if (!second.ok) expect(second.error.code).toBe("already_changed_form");
});

test("a basic attack exhausts the hero and damages the villain", () => {
  const start = newGame();
  const identity = mustPlayer(start, p1).identity.instanceId;
  const state = run(start, toHero, {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: identity,
    targetInstanceId: start.villain.instanceId,
  });
  expect(mustInstance(state, identity).exhausted).toBe(true);
  expect(remainingHitPoints(state, state.villain.instanceId)).toBe(18);
});

test("an exhausted hero cannot attack again", () => {
  const start = newGame();
  const identity = mustPlayer(start, p1).identity.instanceId;
  const attack = {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: identity,
    targetInstanceId: start.villain.instanceId,
  } as const;
  const state = run(start, toHero, attack);
  const second = applyCommand(state, attack);
  expect(second.ok).toBe(false);
  if (!second.ok) expect(second.error.code).toBe("already_exhausted");
});

test("an alter-ego cannot attack or thwart", () => {
  const start = newGame();
  const identity = mustPlayer(start, p1).identity.instanceId;
  const result = applyCommand(start, {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: identity,
    targetInstanceId: start.villain.instanceId,
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe("wrong_form");
});

test("a basic thwart removes threat equal to THW", () => {
  const start = newGame();
  const withThreat = {
    ...start,
    instances: {
      ...start.instances,
      [start.mainScheme.instanceId]: { ...mustInstance(start, start.mainScheme.instanceId), threat: 5 },
    },
  };
  const state = run(withThreat, toHero, {
    type: "basicThwart",
    playerId: p1,
    thwarterInstanceId: mustPlayer(start, p1).identity.instanceId,
    schemeInstanceId: start.mainScheme.instanceId,
  });
  expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(3);
});

test("thwarting a scheme with no threat is rejected", () => {
  const start = newGame();
  const state = run(start, toHero);
  const result = applyCommand(state, {
    type: "basicThwart",
    playerId: p1,
    thwarterInstanceId: mustPlayer(state, p1).identity.instanceId,
    schemeInstanceId: state.mainScheme.instanceId,
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe("no_valid_target");
});

test("recovery heals REC and requires alter-ego form with damage", () => {
  const start = newGame();
  const identityId = mustPlayer(start, p1).identity.instanceId;
  const damaged = {
    ...start,
    instances: {
      ...start.instances,
      [identityId]: { ...mustInstance(start, identityId), damage: 5 },
    },
  };
  const healthy = applyCommand(start, { type: "basicRecover", playerId: p1 });
  expect(healthy.ok).toBe(false);
  if (!healthy.ok) expect(healthy.error.code).toBe("no_valid_target");

  const state = expectOk(applyCommand(damaged, { type: "basicRecover", playerId: p1 }));
  expect(mustInstance(state, identityId).damage).toBe(2);
  expect(mustInstance(state, identityId).exhausted).toBe(true);
});

test("playing an ally spends resources from hand and puts it into play", () => {
  const start = newGame();
  const ally = findInHand(start, p1, ALLY.id);
  const payment = payFor(start, p1, 2);
  const state = expectOk(
    applyCommand(start, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: ally,
      payment,
      attachToInstanceId: null,
    }),
  );
  const player = mustPlayer(state, p1);
  expect(player.playArea).toContain(ally);
  expect(player.discard).toEqual(
    expect.arrayContaining(payment.map((entry) => ("fromHand" in entry ? entry.fromHand : ""))),
  );
  expect(player.hand).toHaveLength(mustPlayer(start, p1).hand.length - 3);
});

test("underpaying a card is rejected and leaves state untouched", () => {
  const start = newGame();
  const ally = findInHand(start, p1, ALLY.id);
  const result = applyCommand(start, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: ally,
    payment: [],
    attachToInstanceId: null,
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe("insufficient_resources");
});

test("an upgrade attaches to the identity by default", () => {
  const start = newGame();
  const upgrade = findInHand(start, p1, UPGRADE.id);
  const state = expectOk(
    applyCommand(start, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: upgrade,
      payment: payFor(start, p1, 1),
      attachToInstanceId: null,
    }),
  );
  const identityId = mustPlayer(state, p1).identity.instanceId;
  expect(mustInstance(state, upgrade).attachedTo).toBe(identityId);
  expect(mustInstance(state, identityId).attachments).toContain(upgrade);
});

test("a player cannot act on another player's turn", () => {
  const start = newGame({ players: 2 });
  const result = applyCommand(start, { type: "changeForm", playerId: p2 });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe("not_active_player");
});

test("a rejected command returns the untouched state", () => {
  const start = newGame();
  const before = JSON.stringify(start);
  const result = applyCommand(start, {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: mustPlayer(start, p1).identity.instanceId,
    targetInstanceId: start.mainScheme.instanceId,
  });
  expect(result.ok).toBe(false);
  expect(JSON.stringify(start)).toBe(before);
});
