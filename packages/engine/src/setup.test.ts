import { flat } from "@mc/content";
import { createGame } from "./setup.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer, scale, villainStage } from "./query.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME, VILLAIN, newGame } from "./testing/scenario.js";
import { stubMainScheme } from "./testing/fixtures.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

test("a one-player game starts in alter-ego form with a full hand", () => {
  const state = newGame();
  const player = mustPlayer(state, p1);
  expect(player.identity.form).toBe("alterEgo");
  expect(player.hand).toHaveLength(HERO.alterEgo.handSize);
  expect(player.deck).toHaveLength(DEFAULT_DECK.length - HERO.alterEgo.handSize);
  expect(state.round).toBe(1);
  expect(state.step).toEqual({
    phase: "player",
    kind: "turn",
    activePlayerId: p1,
    remainingPlayerIds: [],
  });
  expect(state.firstPlayerId).toBe(p1);
  expect(state.outcome).toBeNull();
  expect(state.pendingChoice).toBeNull();
});

test("villain and main scheme enter at their starting values", () => {
  const state = newGame();
  const villain = mustInstance(state, state.villain.instanceId);
  expect(villain.damage).toBe(0);
  expect(scale(villainStage(state).hp, state.startingPlayerCount)).toBe(20);
  expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(0);
});

test("starting threat scales per player", () => {
  const scheme = stubMainScheme({
    id: "scaling-scheme",
    stages: [{ startingThreat: { base: 1, perPlayer: 2 }, targetThreat: flat(30), acceleration: flat(1) }],
  });
  const solo = newGame({ mainScheme: scheme });
  const duo = newGame({ players: 2, mainScheme: scheme });
  expect(mustInstance(solo, solo.mainScheme.instanceId).threat).toBe(3);
  expect(mustInstance(duo, duo.mainScheme.instanceId).threat).toBe(5);
});

test("turn order runs from the first player clockwise", () => {
  const state = newGame({ players: 2 });
  expect(state.step).toEqual({
    phase: "player",
    kind: "turn",
    activePlayerId: p1,
    remainingPlayerIds: [p2],
  });
  expect(mustPlayer(state, p2).hand).toHaveLength(HERO.alterEgo.handSize);
});

test("the same seed produces the same shuffle, a different seed does not", () => {
  const a = newGame({ seed: 7 });
  const b = newGame({ seed: 7 });
  const c = newGame({ seed: 8 });
  expect(mustPlayer(a, p1).deck).toEqual(mustPlayer(b, p1).deck);
  expect(mustPlayer(a, p1).deck).not.toEqual(mustPlayer(c, p1).deck);
});

test("setup rejects an illegal player count and bad card references", () => {
  const bad = createGame({
    seed: 1,
    cards: DEFAULT_CARDS,
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: [],
    players: [],
  });
  expect(bad.ok).toBe(false);
  if (!bad.ok) expect(bad.error.code).toBe("invalid_setup");

  const wrongVillain = createGame({
    seed: 1,
    cards: DEFAULT_CARDS,
    villainCardId: HERO.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: [],
    players: [{ identityCardId: HERO.id, deck: [] }],
  });
  expect(wrongVillain.ok).toBe(false);
  if (!wrongVillain.ok) expect(wrongVillain.error.code).toBe("invalid_setup");
});
