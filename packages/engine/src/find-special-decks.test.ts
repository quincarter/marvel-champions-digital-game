/**
 * The owner's answer 54B (2026-10-13, docs/phase7-wave10.md §4.0): "A Find looks only in the areas where the named card
 * could be". A special deck (an identity's separate deck, a scenario deck) is looked through, and so shuffled, only
 * when the find can name one of that deck's own cards (`decksSearchedByFind`, `specialDeckCouldHold`, `select.ts`).
 *
 * Sources: RRG 1.8 "Find" (p. 19): "a player searches each game area where that card could be found"; "Players should
 * not unnecessarily search game areas if they know where the card they are looking for can be found". RRG 1.8 "Search"
 * (p. 39): "If any portion of a deck is searched, upon completion of that game step, game function, or card ability,
 * shuffle that entire deck."
 *
 * Synthetic cards only: an identity with a Task deck of encounter cards and a Boon deck of upgrades (shaped like
 * Hercules's Labor and Gift decks), and a scenario with a weapons deck and a side-scheme deck.
 */

import { encounterSetId, flat, type AnyCard, type HeroIdentityCard, type ScenarioSeparateDeck } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { createCtx, moveCard } from "./ctx.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, mustPlayer, separateDeckOf } from "./query.js";
import { decksSearchedByFind, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState, ZoneId } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubIdentity,
  stubMainScheme,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { BOON, BOONS, OGRE, TASK, TASK_ABILITIES, TASKS } from "./testing/owned-encounter-deck.js";
import { DEFAULT_CARDS, DEFAULT_DECK } from "./testing/scenario.js";

const p1 = playerId("p1");
const you = { kind: "controller" } as const;
const WEAPONS = "Weapons";
const SIDE = "side-scheme";

const SIDEKICK = stubAlly({ id: "sidekick", cost: 0, atk: 1, thw: 1, hp: 3 });
const BLANK = stubTreachery({ id: "blank-54b", boostIcons: 0 });
const weapon = (id: string) => ({
  ...stubAttachment({ id, attachesTo: { kind: "villain" } }),
  encounterSetIds: [encounterSetId("weapons-54b")],
});
const WEAPON_A = weapon("weapon-a");
const WEAPON_B = weapon("weapon-b");
const SCHEME_X = stubSideScheme({ id: "scheme-x", startingThreat: 2, boostIcons: 0 });
const SCHEME_Y = stubSideScheme({ id: "scheme-y", startingThreat: 2, boostIcons: 0 });
const DECKS: readonly ScenarioSeparateDeck[] = [
  {
    name: WEAPONS,
    contents: { encounterSetIds: [encounterSetId("weapons-54b")] },
    discardPile: "encounter",
    whenEmpty: "remainsEmpty",
  },
  {
    name: SIDE,
    contents: { cardType: "side_scheme" },
    discardPile: "own",
    whenEmpty: "reshuffleDiscardWithoutPenalty",
  },
];
const SETUP = stubAbility("scheme-54b.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "buildScenarioDeck", name: WEAPONS },
    { kind: "buildScenarioDeck", name: SIDE },
  ],
});
const LONG = stubMainScheme({
  id: "long-54b",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [SETUP.ref] }],
});
const QUIET = stubVillain({ id: "quiet-54b", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

const action = (id: string, effects: readonly EffectSpec[]): StubAbility =>
  stubAbility(`seeker-54b.${id}`, { trigger: { kind: "action" }, effects });
const ALLY_QUERY: TargetQuery = { name: SIDEKICK.name };
const MINION_QUERY: TargetQuery = { categories: ["minion"] };
const SCHEME_QUERY: TargetQuery = { categories: ["sideScheme"] };
/** "Action: Find your Sidekick and put it into play." */
const FIND_ALLY = action("find-ally", [{ kind: "findCard", query: ALLY_QUERY, owner: you, to: "play" }]);
/** "Action: Find a minion. Reveal it." */
const FIND_MINION = action("find-minion", [{ kind: "findCard", query: MINION_QUERY, to: "reveal", choose: true }]);
/** "Action: Find a side scheme that is not in play and reveal it." */
const FIND_SCHEME = action("find-scheme", [
  { kind: "findCard", query: SCHEME_QUERY, to: "reveal", choose: true, outOfPlay: true },
]);
const ACTIONS = [FIND_ALLY, FIND_MINION, FIND_SCHEME];
const deps: EngineDeps = depsOf(...TASK_ABILITIES, SETUP, ...ACTIONS);

const SEEKER: HeroIdentityCard = {
  ...stubIdentity({
    id: "seeker-54b",
    hp: 12,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: ACTIONS.map((a) => a.ref),
    alterEgoAbilities: ACTIONS.map((a) => a.ref),
  }),
  separateDecks: [
    {
      name: TASK,
      cardFamily: "encounter",
      cards: TASKS.map((card) => ({ cardId: card.id, quantity: 1 })),
      topCardFaceup: false,
      discardPile: "none",
      whenEmpty: "stayEmpty",
    },
    {
      name: BOON,
      cardFamily: "player",
      cards: BOONS.map((card) => ({ cardId: card.id, quantity: 1 })),
      topCardFaceup: false,
      discardPile: "none",
      whenEmpty: "stayEmpty",
    },
  ],
};

function game(): GameState {
  const cards: readonly AnyCard[] = [
    ...DEFAULT_CARDS,
    SEEKER,
    ...TASKS,
    ...BOONS,
    SIDEKICK,
    BLANK,
    OGRE,
    WEAPON_A,
    WEAPON_B,
    SCHEME_X,
    SCHEME_Y,
    LONG,
    QUIET,
  ];
  const result = createGame(
    {
      seed: 23,
      cards,
      villainCardId: QUIET.id,
      mainSchemeCardId: LONG.id,
      encounterDeck: [
        ...Array.from({ length: 12 }, () => BLANK.id),
        OGRE.id,
        WEAPON_A.id,
        WEAPON_B.id,
        SCHEME_X.id,
        SCHEME_Y.id,
      ],
      scenarioDecks: DECKS,
      includeIdentitySets: false,
      players: [{ identityCardId: SEEKER.id, deck: [...DEFAULT_DECK, SIDEKICK.id] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const state = runCommands(result.state, deps).state;
  // The fixture's premise: both scenario decks and both separate decks hold more than one card, so a shuffle shows.
  expect(state.scenarioDecks[WEAPONS]!.deck).toHaveLength(2);
  expect(state.scenarioDecks[SIDE]!.deck).toHaveLength(2);
  expect(separateDeckOf(state, p1, TASK).deck).toHaveLength(3);
  expect(separateDeckOf(state, p1, BOON).deck).toHaveLength(3);
  return state;
}

const the = (state: GameState, card: { readonly id: string }): InstanceId =>
  (Object.keys(state.instances) as InstanceId[]).find((id) => state.instances[id]?.cardId === card.id)!;
/** Test-only state surgery: puts a card somewhere. */
function place(state: GameState, id: InstanceId, zone: ZoneId): GameState {
  const ctx = createCtx(state, deps);
  moveCard(ctx, id, zone, "top");
  return ctx.state;
}
const use = (state: GameState, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: mustPlayer(state, p1).identity.instanceId,
  abilityId: ability.ref.id,
  payment: [],
});
const shuffled = (events: readonly GameEvent[]): readonly ZoneId[] =>
  events.filter((e): e is Extract<GameEvent, { type: "deckShuffled" }> => e.type === "deckShuffled").map((e) => e.zone);
const found = (events: readonly GameEvent[]) => events.filter((e) => e.type === "cardFound");

const PLAYER_DECK: ZoneId = { kind: "deck", playerId: p1 };
const TASK_DECK: ZoneId = { kind: "separateDeck", playerId: p1, name: TASK };
const BOON_DECK: ZoneId = { kind: "separateDeck", playerId: p1, name: BOON };
const SIDE_DECK: ZoneId = { kind: "scenarioDeck", name: SIDE };
const WEAPONS_DECK: ZoneId = { kind: "scenarioDeck", name: WEAPONS };
const encounterDeck = (state: GameState): ZoneId => ({ kind: "encounterDeck", deckId: activeEncounterDeckId(state) });

/** The order of every special deck: what a find must leave alone when it did not look through it. */
const specialOrders = (state: GameState) => ({
  task: separateDeckOf(state, p1, TASK).deck,
  boon: separateDeckOf(state, p1, BOON).deck,
  weapons: state.scenarioDecks[WEAPONS]!.deck,
  side: state.scenarioDecks[SIDE]!.deck,
});
const context = (state: GameState): EffectContext => ({
  selfInstanceId: mustPlayer(state, p1).identity.instanceId,
  controllerId: p1,
  event: null,
  bindings: {},
  deps,
});

describe("54B: a find for a player's card does not look through that player's special decks", () => {
  it("'find your Sidekick' with the ally removed from the game: the player deck is searched and shuffled; the Task and Boon decks keep their order", () => {
    const start = game();
    const at = place(start, the(start, SIDEKICK), { kind: "removedFromGame" });
    const { state, events } = runCommands(at, deps, use(at, FIND_ALLY));
    expect(found(events)).toEqual([]);
    expect(shuffled(events)).toEqual([PLAYER_DECK]);
    expect(specialOrders(state)).toEqual(specialOrders(at));
    expect(activeEncounterDeck(state).deck).toEqual(activeEncounterDeck(at).deck);
    // The player deck holds the same cards.
    expect([...mustPlayer(state, p1).deck].sort()).toEqual([...mustPlayer(at, p1).deck].sort());
  });

  it("'find your Sidekick' with the ally in the player deck: found there, that deck alone shuffled", () => {
    const start = game();
    const at = place(start, the(start, SIDEKICK), PLAYER_DECK);
    const { state, events } = runCommands(at, deps, use(at, FIND_ALLY));
    expect(mustPlayer(state, p1).playArea).toContain(the(state, SIDEKICK));
    expect(shuffled(events)).toEqual([PLAYER_DECK]);
    expect(specialOrders(state)).toEqual(specialOrders(at));
  });

  it("a find for a card of the Boon deck does look through it, and not through the Task deck", () => {
    const at = game();
    const boon: TargetQuery = { name: BOONS[0]!.name };
    // "Your" boon: the owner's player deck is looked through before the separate decks (`findDecks`), then the deck
    // the card is made for. The Task deck is made of other cards.
    expect(decksSearchedByFind(at, boon, context(at), new Set([p1]), undefined)).toEqual([PLAYER_DECK, BOON_DECK]);
  });

  it("a find for a card of the Task deck looks through the Task deck, and not through the Boon deck", () => {
    const at = game();
    const task: TargetQuery = { name: TASKS[0]!.name };
    const searched = decksSearchedByFind(at, task, context(at), new Set([p1]), undefined);
    expect(searched).toContainEqual(TASK_DECK);
    expect(searched).not.toContainEqual(BOON_DECK);
    // One of the deck's own cards that has left it (a Task card in play) still makes the deck one it could be in.
    const inPlay = place(at, the(at, TASKS[0]!), { kind: "playArea", playerId: p1 });
    expect(
      decksSearchedByFind(inPlay, { categories: ["attachment"] }, context(inPlay), null, undefined),
    ).toContainEqual(TASK_DECK);
  });
});

describe("54B: a find for an encounter card looks through the special decks made of such cards only", () => {
  it("'find a minion': the encounter deck is shuffled; the Task, Boon, weapons and side-scheme decks keep their order", () => {
    const at = game();
    const ogre = the(at, OGRE);
    expect(activeEncounterDeck(at).deck).toContain(ogre);
    const { state, events } = runCommands(at, deps, use(at, FIND_MINION));
    expect(found(events)).toHaveLength(1);
    expect(mustPlayer(state, p1).playArea).toContain(ogre);
    expect(shuffled(events)).toEqual([encounterDeck(at)]);
    expect(specialOrders(state)).toEqual(specialOrders(at));
  });

  it("'find a side scheme that is not in play': the encounter deck and the side-scheme deck are shuffled; the weapons, Task and Boon decks keep their order", () => {
    const at = game();
    const before = specialOrders(at);
    // Two side schemes, both in the side-scheme deck: the player picks (the first offered).
    const { state, events } = runCommands(at, deps, use(at, FIND_SCHEME));
    expect(found(events)).toHaveLength(1);
    // A side scheme is an encounter card, so the encounter deck is one it could be in; so is the deck made of them.
    expect(shuffled(events)).toEqual([encounterDeck(at), SIDE_DECK]);
    const after = specialOrders(state);
    expect(after.side).toHaveLength(1);
    expect({ task: after.task, boon: after.boon, weapons: after.weapons }).toEqual({
      task: before.task,
      boon: before.boon,
      weapons: before.weapons,
    });
  });

  it("a scenario deck whose cards keep an encounter-deck home is looked through for one of the cards in it", () => {
    const at = game();
    const attachments: TargetQuery = { categories: ["attachment"] };
    // Attachments: the weapons in the weapons deck, and the Task deck's two attachments. Not the Boon upgrades, nor
    // the side schemes. The owner of a Task card is a player, so that player's deck is among those it could be in.
    expect(decksSearchedByFind(at, attachments, context(at), null, undefined)).toEqual([
      PLAYER_DECK,
      TASK_DECK,
      encounterDeck(at),
      WEAPONS_DECK,
    ]);
  });

  it("a card with no copy in the game could be in a player deck or an encounter deck, and in no special deck", () => {
    const at = game();
    expect(decksSearchedByFind(at, { name: "Nobody At All" }, context(at), null, undefined)).toEqual([
      PLAYER_DECK,
      encounterDeck(at),
    ]);
  });
});
