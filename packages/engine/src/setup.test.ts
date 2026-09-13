import { activeVillain } from "./query.js";
import { cardId, flat, type HeroIdentityCard } from "@mc/content";
import { createGame } from "./setup.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer, scale, villainStage } from "./query.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME, VILLAIN, newGame } from "./testing/scenario.js";
import { stubIdentity, stubMainScheme } from "./testing/fixtures.js";

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
  const villain = mustInstance(state, activeVillain(state).instanceId);
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

/**
 * RRG "Unique": "The players as a group are permitted to have only one copy of each
 * unique card (by title) in play", with the identity carve-out "If two identities share
 * the same title, but each has a different alter-ego, they may coexist in play."
 */
describe("unique identities across the table", () => {
  const SECOND_HERO = stubIdentity({
    id: "hero2",
    name: "Second Hero",
    hp: 10,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  });
  /** Same title as SECOND_HERO, different person behind the mask (the Spider-Man case). */
  const OTHER_SECOND_HERO: HeroIdentityCard = {
    ...SECOND_HERO,
    id: cardId("hero2-alt"),
    alterEgo: { ...SECOND_HERO.alterEgo, faceName: "Someone Else" },
  };

  const twoSeats = (a: HeroIdentityCard, b: HeroIdentityCard) =>
    createGame({
      seed: 1,
      cards: [...DEFAULT_CARDS, SECOND_HERO, OTHER_SECOND_HERO],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      players: [
        { identityCardId: a.id, deck: [...DEFAULT_DECK] },
        { identityCardId: b.id, deck: [...DEFAULT_DECK] },
      ],
    });

  test("two seats cannot sit down as the same identity", () => {
    const result = twoSeats(HERO, HERO);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("duplicate_unique_card");
      // The message names the hero so a client can show it verbatim.
      expect(result.error.message).toContain(HERO.name);
      expect(result.error.message).toContain(HERO.alterEgo.faceName);
      expect(result.error.message).toContain("p1");
      expect(result.error.message).toContain("p2");
    }
  });

  test("two different heroes are still a legal table", () => {
    const result = twoSeats(HERO, SECOND_HERO);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(mustPlayer(result.state, p1).identity.cardId).toBe(HERO.id);
      expect(mustPlayer(result.state, p2).identity.cardId).toBe(SECOND_HERO.id);
    }
  });

  test("two identities sharing a title but not an alter-ego may coexist", () => {
    // RRG "Unique": the Peter Parker / Miles Morales case. A coarse id-equality check
    // would wrongly reject this, so the predicate keys on (title, alter-ego face name).
    expect(SECOND_HERO.name).toBe(OTHER_SECOND_HERO.name);
    expect(SECOND_HERO.alterEgo.faceName).not.toBe(OTHER_SECOND_HERO.alterEgo.faceName);
    const result = twoSeats(SECOND_HERO, OTHER_SECOND_HERO);
    expect(result.ok).toBe(true);
  });

  test("a third seat collides with an earlier one, not just the seat before it", () => {
    const result = createGame({
      seed: 1,
      cards: [...DEFAULT_CARDS, SECOND_HERO, OTHER_SECOND_HERO],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      players: [HERO, SECOND_HERO, HERO].map((identity) => ({ identityCardId: identity.id, deck: [...DEFAULT_DECK] })),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("p3");
  });
});
