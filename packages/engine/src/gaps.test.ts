import { activeEncounterDeck } from "./query.js";
import { flat, type CardId } from "@mc/content";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { stubAttachment, stubMainScheme, stubMinion, stubVillain } from "./testing/fixtures.js";
import {
  ALLY,
  findInHand,
  newGame,
  newGameAtMulligan,
  payFor,
  resolvePending,
  run,
  settle,
  settleUntil,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const endTurn = (player = p1) => ({ type: "endTurn", playerId: player }) as const;
const toHero = (player = p1) => ({ type: "changeForm", playerId: player }) as const;

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(40), atk: 2, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(1) }],
});
const deckOf = (id: CardId, count = 20): readonly CardId[] => Array.from({ length: count }, () => id);

// RRG "Defend": any player may defend with a character they control.
test("the attacked player may defend with another player's hero or ally", () => {
  const start = newGame({ players: 2, villain: VILLAIN, mainScheme: SCHEME });
  const allyForP2 = findInHand(start, p2, ALLY.id);
  const withAlly = run(
    start,
    toHero(p1),
    endTurn(p1),
    toHero(p2),
    {
      type: "playCard",
      playerId: p2,
      cardInstanceId: allyForP2,
      payment: payFor(start, p2, 2),
      attachToInstanceId: null,
    },
    endTurn(p2),
  );
  const atDefense = settleUntil(withAlly, "declareDefender");

  const defense = atDefense.pendingChoice;
  expect(defense?.prompt.kind).toBe("declareDefender");
  // The attacked player still makes the decision.
  expect(defense?.playerId).toBe(p1);
  const options = defense?.options.map((o) => o.optionId) ?? [];
  expect(options).toContain(mustPlayer(atDefense, p1).identity.instanceId);
  expect(options).toContain(mustPlayer(atDefense, p2).identity.instanceId);
  expect(options).toContain(allyForP2);

  // RRG p.9: a defender controlled by another player becomes the target of the attack.
  const defended = resolvePending(atDefense, [allyForP2]);
  // The ally took the attack: it is either still in play with damage or was defeated by it
  // (a defeated card is discarded and its damage cleared, RRG "Defeat").
  const allyHit = mustInstance(defended, allyForP2).damage > 0 || mustPlayer(defended, p2).discard.includes(allyForP2);
  expect(allyHit).toBe(true);
  expect(mustInstance(defended, mustPlayer(defended, p1).identity.instanceId).damage).toBe(0);
});

test("a player with two engaged minions chooses which activates first", () => {
  const brute = stubMinion({ id: "brute", atk: 1, sch: 3, hp: 5, boostIcons: 0 });
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [brute],
    encounterDeck: deckOf(brute.id),
  });

  const roundTwo = settle(run(start, endTurn()));
  expect(mustPlayer(roundTwo, p1).playArea).toHaveLength(1);
  const roundThree = settle(run(roundTwo, endTurn()));
  expect(mustPlayer(roundThree, p1).playArea).toHaveLength(2);

  // Third villain phase: two minions are engaged, so their order is a choice.
  const atChoice = run(roundThree, endTurn());
  const minionChoice = settleUntil(atChoice, "chooseMinionToActivate");
  const choice = minionChoice.pendingChoice;
  expect(choice?.prompt.kind).toBe("chooseMinionToActivate");
  expect(choice?.playerId).toBe(p1);
  expect(choice?.options).toHaveLength(2);

  const settled = settle(resolvePending(minionChoice, [choice?.options[1]?.optionId as string]));
  expect(settled.round).toBe(4);
});

// RRG Appendix II step 15.
test("setup parks a mulligan choice and redraws what was discarded", () => {
  const start = newGameAtMulligan({ villain: VILLAIN, mainScheme: SCHEME });
  const choice = start.pendingChoice;
  expect(start.step).toEqual({ phase: "setup", kind: "mulligan", remainingPlayerIds: [p1] });
  expect(choice?.prompt).toEqual({ kind: "mulligan", handSize: 6 });
  expect(choice?.minSelections).toBe(0);

  const hand = mustPlayer(start, p1).hand;
  const after = resolvePending(start, [hand[0] as string, hand[1] as string]);
  expect(mustPlayer(after, p1).hand).toHaveLength(6);
  expect(mustPlayer(after, p1).discard).toEqual(expect.arrayContaining([hand[0], hand[1]]));
  // Mulliganed cards are not shuffled back in, so they cannot be redrawn.
  expect(mustPlayer(after, p1).hand).not.toContain(hand[0]);
  expect(after.step).toEqual({ phase: "player", kind: "turn", activePlayerId: p1, remainingPlayerIds: [] });
});

test("keeping the opening hand costs nothing and starts round 1", () => {
  const start = newGameAtMulligan({ villain: VILLAIN, mainScheme: SCHEME, players: 2 });
  const kept = settle(start);
  expect(mustPlayer(kept, p1).discard).toHaveLength(0);
  expect(mustPlayer(kept, p2).hand).toHaveLength(6);
  expect(kept.round).toBe(1);
});

// RRG "Attach To": an attachment with no legal target is discarded.
test("a player-side attachment with no legal target is discarded on reveal", () => {
  const attachment = stubAttachment({ id: "shackles", attachesTo: { kind: "ally" } });
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [attachment],
    encounterDeck: deckOf(attachment.id),
  });
  const state = settle(run(start, endTurn()));
  const revealed = activeEncounterDeck(state).discard.filter((id) => state.instances[id]?.cardId === attachment.id);
  expect(revealed.length).toBeGreaterThan(0);
  expect(state.villainArea).toHaveLength(0);
  expect(mustInstance(state, revealed[0] as InstanceId).attachedTo).toBeNull();
});

// RRG "First Player": with several legal hosts, the first player picks (here also the revealing player).
test("a player-side attachment asks the first player to choose its host", () => {
  const attachment = stubAttachment({ id: "shackles", attachesTo: { kind: "anyCharacter" } });
  const start = newGame({
    players: 2,
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [attachment],
    encounterDeck: deckOf(attachment.id),
  });
  const ally = findInHand(start, p1, ALLY.id);
  const withAlly = run(
    start,
    { type: "playCard", playerId: p1, cardInstanceId: ally, payment: payFor(start, p1, 2), attachToInstanceId: null },
    endTurn(p1),
    endTurn(p2),
  );
  const atChoice = settleUntil(withAlly, "chooseAttachmentTarget");

  const choice = atChoice.pendingChoice;
  expect(choice?.prompt.kind).toBe("chooseAttachmentTarget");
  expect(choice?.playerId).toBe(p1);
  expect(choice?.options.map((o) => o.optionId)).toContain(ally);

  const attached = settle(resolvePending(atChoice, [ally]));
  expect(mustInstance(attached, ally).attachments).toHaveLength(1);
});
