import { activeVillain } from "./query.js";
import { cardId, flat, type HeroIdentityCard } from "@mc/content";
import { createGame } from "./setup.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer, scale, villainStage } from "./query.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME, VILLAIN, newGame } from "./testing/scenario.js";
import type { EngineDeps } from "./abilities.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubIdentity, stubMainScheme, stubVillain } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

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

/**
 * RRG 1.8 "Ability" (p. 4): "Player card abilities cannot resolve during game setup, unless prefaced by a 'Setup'
 * timing trigger." A Setup-keyword player ally that enters play at setup (Appendix II step 11) with a Forced Response
 * "After this ally enters play, deal 3 damage to the villain" must not resolve it then. (Reachability: a player card
 * with the setup keyword and a response to something that happens in setup; no pool card was confirmed, so this is a
 * rule proof, not a card bug.)
 */
const SETUP_RESPONSE = stubAbility("setup-scout.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 3 } }],
});
const SETUP_SCOUT = stubAlly({
  id: "setup-scout",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 2,
  keywords: [{ name: "setup" }],
  abilities: [SETUP_RESPONSE.ref],
});
const SOFT = stubVillain({ id: "soft-villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const setupDeps: EngineDeps = depsOf(SETUP_RESPONSE);

describe("a player card's response during game setup (RRG 1.8 'Ability', p. 4)", () => {
  it("a Setup-keyword ally's 'After this ally enters play' response does not resolve at setup", () => {
    const state = gameAtFirstTurn({
      cards: [SETUP_SCOUT, SOFT],
      deps: setupDeps,
      villain: SOFT,
      deck: [SETUP_SCOUT.id],
    });
    const scout = Object.values(state.instances).find((i) => i.cardId === SETUP_SCOUT.id)!;
    expect(mustPlayer(state, P1).playArea).toContain(scout.instanceId); // control: it did enter play at setup
    expect(state.instances[state.villains[0]!.instanceId]?.damage).toBe(0);
  });
});
