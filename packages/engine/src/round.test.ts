import { activeEncounterDeck, activeVillain } from "./query.js";
import { applyCommand } from "./engine.js";
import { playerId } from "./ids.js";
import { minionsEngagedWith, mustInstance, mustPlayer } from "./query.js";
import { stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { newGame, resolvePending, run, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const endTurn = (player = p1) => ({ type: "endTurn", playerId: player }) as const;
const toHero = (player = p1) => ({ type: "changeForm", playerId: player }) as const;

test("a solo round ends with the villain scheming against an alter-ego and a new round starting", () => {
  const start = newGame();
  const afterTurn = run(start, endTurn());

  const choice = afterTurn.pendingChoice;
  expect(choice?.prompt.kind).toBe("discardDownToHandSize");
  expect(choice?.minSelections).toBe(0);

  const state = resolvePending(afterTurn, []);
  // acceleration 1 + (villain SCH 1 + 1 boost icon)
  expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(3);
  expect(state.round).toBe(2);
  expect(state.step).toEqual({ phase: "player", kind: "turn", activePlayerId: p1, remainingPlayerIds: [] });
  expect(activeEncounterDeck(state).discard.length).toBe(2);
  expect(state.pendingChoice).toBeNull();
});

test("the villain attacks a hero and the defend decision is a pending choice", () => {
  const start = newGame();
  const afterTurn = run(start, toHero(), endTurn());
  // hero hand size is 5 but the alter-ego drew 6, so one card must be discarded
  const discard = afterTurn.pendingChoice;
  expect(discard?.minSelections).toBe(1);
  const firstOption = discard?.options[0]?.optionId as string;

  const atDefense = resolvePending(afterTurn, [firstOption]);
  const defense = atDefense.pendingChoice;
  expect(defense?.prompt.kind).toBe("declareDefender");
  expect(defense?.playerId).toBe(p1);
  const identityId = mustPlayer(atDefense, p1).identity.instanceId;
  expect(defense?.options.map((o) => o.optionId)).toEqual(["decline", identityId]);
});

test("declining defense takes ATK plus boost icons; defending reduces it by DEF and exhausts the hero", () => {
  const start = newGame();
  const atDiscard = run(start, toHero(), endTurn());
  const atDefense = resolvePending(atDiscard, [atDiscard.pendingChoice?.options[0]?.optionId as string]);
  expect(atDefense.pendingChoice?.prompt.kind).toBe("declareDefender");
  const identityId = mustPlayer(atDefense, p1).identity.instanceId;

  const undefended = resolvePending(atDefense, ["decline"]);
  expect(mustInstance(undefended, identityId).damage).toBe(3);

  const defended = resolvePending(atDefense, [identityId]);
  expect(mustInstance(defended, identityId).damage).toBe(1);
  // RRG "End of Player Phase": readying happens at the end of the *player* phase,
  // so a hero that defended is still exhausted throughout their next turn.
  expect(mustInstance(defended, identityId).exhausted).toBe(true);
  expect(defended.step).toEqual({ phase: "player", kind: "turn", activePlayerId: p1, remainingPlayerIds: [] });
});

test("cards exhausted during a turn ready at the end of the player phase, before the villain attacks", () => {
  const start = newGame();
  const identityId = mustPlayer(start, p1).identity.instanceId;
  const afterAttack = run(start, toHero(), {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: identityId,
    targetInstanceId: activeVillain(start).instanceId,
  });
  expect(mustInstance(afterAttack, identityId).exhausted).toBe(true);

  const atDiscard = run(afterAttack, endTurn());
  const atDefense = resolvePending(atDiscard, [atDiscard.pendingChoice?.options[0]?.optionId as string]);
  expect(mustInstance(atDefense, identityId).exhausted).toBe(false);
  expect(atDefense.pendingChoice?.options.map((o) => o.optionId)).toContain(identityId);
});

test("the end of the player phase discards down to hand size and then draws back up", () => {
  const start = newGame();
  const beforeDiscard = run(start, toHero(), endTurn());
  const hand = mustPlayer(beforeDiscard, p1).hand;
  expect(hand).toHaveLength(6);
  const state = resolvePending(beforeDiscard, [hand[0] as string, hand[1] as string]);
  // discarded 2 from 6, then drew back up to the hero hand size of 5
  expect(mustPlayer(state, p1).hand).toHaveLength(5);
  expect(mustPlayer(state, p1).discard).toContain(hand[0]);
});

test("two players take turns in order and the first player token passes", () => {
  const start = newGame({ players: 2 });
  const afterP1 = run(start, endTurn(p1));
  expect(afterP1.step).toEqual({
    phase: "player",
    kind: "turn",
    activePlayerId: p2,
    remainingPlayerIds: [],
  });

  const state = settle(run(afterP1, endTurn(p2)));
  expect(state.firstPlayerId).toBe(p2);
  expect(state.round).toBe(2);
  expect(state.step).toEqual({
    phase: "player",
    kind: "turn",
    activePlayerId: p2,
    remainingPlayerIds: [p1],
  });
  // acceleration 1 + two villain scheme activations of SCH 1 + 1 boost icon each
  expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(5);
});

test("a revealed minion engages the revealing player and activates the following villain phase", () => {
  const minion = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
  const start = newGame({ extraCards: [minion], encounterDeck: Array.from({ length: 20 }, () => minion.id) });

  const roundTwo = settle(run(start, endTurn()));
  expect(minionsEngagedWith(roundTwo, p1)).toHaveLength(1);
  // acceleration 1 + villain SCH 1 (boost card has no icons)
  expect(mustInstance(roundTwo, roundTwo.mainScheme.instanceId).threat).toBe(2);

  const roundThree = settle(run(roundTwo, endTurn()));
  // acceleration 1 + villain SCH 1 + minion SCH 1
  expect(mustInstance(roundThree, roundThree.mainScheme.instanceId).threat).toBe(5);
  expect(minionsEngagedWith(roundThree, p1)).toHaveLength(2);
});

test("a crisis icon blocks basic thwarting of the main scheme", () => {
  const sideScheme = stubSideScheme({ id: "crisis-ss", startingThreat: 3, icons: ["crisis"], boostIcons: 0 });
  const start = newGame({
    extraCards: [sideScheme],
    encounterDeck: Array.from({ length: 20 }, () => sideScheme.id),
  });
  const roundTwo = settle(run(start, endTurn()));
  const inPlay = roundTwo.villainArea.find((id) => roundTwo.instances[id]?.cardId === sideScheme.id);
  expect(inPlay).toBeDefined();

  const hero = run(roundTwo, toHero());
  const blocked = applyCommand(hero, {
    type: "basicThwart",
    playerId: p1,
    thwarterInstanceId: mustPlayer(hero, p1).identity.instanceId,
    schemeInstanceId: hero.mainScheme.instanceId,
  });
  expect(blocked.ok).toBe(false);
  if (!blocked.ok) expect(blocked.error.message).toContain("crisis");
});

test("commands other than resolveChoice are rejected while a choice is pending", () => {
  const pending = run(newGame(), endTurn());
  expect(pending.pendingChoice).not.toBeNull();
  const result = applyCommand(pending, toHero());
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe("choice_pending");
});

test("a choice must be resolved by the right player with a legal number of selections", () => {
  const pending = run(newGame(), toHero(), endTurn());
  const choice = pending.pendingChoice;
  expect(choice).not.toBeNull();
  const tooFew = applyCommand(pending, {
    type: "resolveChoice",
    playerId: p1,
    choiceId: choice?.choiceId as never,
    selectedOptionIds: [],
  });
  expect(tooFew.ok).toBe(false);
  if (!tooFew.ok) expect(tooFew.error.code).toBe("invalid_choice");

  const notAnOption = applyCommand(pending, {
    type: "resolveChoice",
    playerId: p1,
    choiceId: choice?.choiceId as never,
    selectedOptionIds: ["not-a-card"],
  });
  expect(notAnOption.ok).toBe(false);
  if (!notAnOption.ok) expect(notAnOption.error.code).toBe("invalid_choice");
});
