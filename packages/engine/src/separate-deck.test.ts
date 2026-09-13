/**
 * docs/phase7-wave1.md §3.5: an identity's separate deck as a zone (the Invocation deck), proven with a synthetic
 * "Sorcerer" shaped like Doctor Strange.
 *
 * Sources: the Doctor Strange insert, "The Invocation Deck" (quoted on `IdentitySeparateDeck`); RRG 1.8 "Deck" (p. 15),
 * "Special" (p. 40: "Special abilities may only be resolved through the explicit instruction of another card
 * ability"), "Tuck" (p. 45), Appendix II step 6 (p. 51); FAQ "Depowered (#20)" (p. 60: "merely resolved, not played").
 */

import { flat, type AnyCard, type CardId, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer, separateDeckOf } from "./query.js";
import { createGame } from "./setup.js";
import type { CardZoneQuery } from "./abilities.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, fromHand, giveCard, giveCards, MAIN_SCHEME, newGame, RESOURCE, VILLAIN } from "./testing/scenario.js";

const p1 = playerId("p1");
const INVOCATION = "Invocation";
const one = { kind: "const", value: 1 } as const;
const slot = { kind: "slot", slot: "invocation" } as const;
const topOfInvocation: CardZoneQuery = { zone: "separateDeck", separateDeck: INVOCATION, player: "you", top: 1 };

/** "Special: … Place this card in the Invocation deck discard pile." */
const SPELL_SPECIAL = stubAbility("spell.special", {
  trigger: { kind: "special" },
  effects: [
    { kind: "addCounters", target: { kind: "identityOf", player: { kind: "controller" } }, counterType: "spells", amount: one },
    { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "separateDiscard" },
  ],
});
const SPELLS: readonly AnyCard[] = ["a", "b", "c", "d", "e"].map((letter) => ({
  ...stubEvent({ id: `spell-${letter}`, cost: 2, abilities: [SPELL_SPECIAL.ref] }),
  deckLimit: 0,
  separateDeck: INVOCATION,
}));

/** Spell Mastery: "Exhaust [this identity] and pay the cost of the top card of the Invocation deck → resolve [its] Special." */
const SPELL_MASTERY = stubAbility("sorcerer.spell-mastery", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true, payPrintedCostOf: { slot: "invocation", from: topOfInvocation } },
  effects: [{ kind: "resolveSpecials", of: slot }],
});
/** Natural Talent: "Discard the top card of the Invocation deck. (Limit once per phase.)" */
const NATURAL_TALENT = stubAbility("sorcerer.natural-talent", {
  trigger: { kind: "action" },
  limit: { count: 1, period: "phase" },
  effects: [{ kind: "moveCards", cards: { kind: "separateDeck", player: { kind: "controller" }, name: INVOCATION, top: one }, to: "separateDiscard" }],
});
const SORCERER: HeroIdentityCard = {
  ...stubIdentity({
    id: "sorcerer",
    hp: 12,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 6,
    alterEgoHandSize: 6,
    heroAbilities: [SPELL_MASTERY.ref],
    alterEgoAbilities: [NATURAL_TALENT.ref],
  }),
  separateDecks: [
    {
      name: INVOCATION,
      cards: SPELLS.map((spell) => ({ cardId: spell.id, quantity: 1 })),
      topCardFaceup: true,
      discardPile: "own",
      whenEmpty: "reshuffleDiscardWithoutPenalty",
    },
  ],
};

/** Master of the Mystic Arts: "Pay the printed cost of the top card … → resolve its Special. Then, place it back on top … faceup." */
const MYSTIC_ARTS_ACTION = stubAbility("mystic-arts.action", {
  trigger: { kind: "action" },
  cost: { payPrintedCostOf: { slot: "invocation", from: topOfInvocation } },
  effects: [
    { kind: "resolveSpecials", of: slot },
    { kind: "moveCards", cards: { kind: "ref", ref: slot }, to: "separateDeckTop" },
  ],
});
const MYSTIC_ARTS = stubSupport({ id: "mystic-arts", cost: 0, abilities: [MYSTIC_ARTS_ACTION.ref] });

/** Counterspell's shape: something that reacts to a card being played. */
const WATCHER_RESPONSE = stubAbility("watcher.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardPlayed" } },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "sawPlay", amount: one }],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_RESPONSE.ref] });

/** Open the Dark Dimension: "When Revealed: Place the top card of the Invocation deck facedown under this scheme. When Defeated: Shuffle the Invocation card under here into the Invocation deck." */
const DARK_REVEALED = stubAbility("dark.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "tuckCards",
      cards: { kind: "separateDeck", player: { kind: "each" }, name: INVOCATION, top: one },
      under: { kind: "self" },
      facedown: true,
    },
  ],
});
const DARK_DEFEATED = stubAbility("dark.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "moveCards", cards: { kind: "tucked", under: { kind: "self" } }, to: "separateDeckShuffle" }],
});
const DARK = stubSideScheme({ id: "dark", startingThreat: 1, boostIcons: 0, abilities: [DARK_REVEALED.ref, DARK_DEFEATED.ref] });
const DISCARD_SCHEMES_ACTION = stubAbility("discard-schemes.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "discardFromPlay", target: { kind: "each", query: { categories: ["sideScheme"] } } }],
});
const DISCARD_SCHEMES = stubEvent({ id: "discard-schemes", cost: 0, abilities: [DISCARD_SCHEMES_ACTION.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps: EngineDeps = depsOf(SPELL_SPECIAL, SPELL_MASTERY, NATURAL_TALENT, MYSTIC_ARTS_ACTION, WATCHER_RESPONSE, DARK_REVEALED, DARK_DEFEATED, DISCARD_SCHEMES_ACTION);
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

function setup(encounter: readonly CardId[] = copies(BLANK.id, 12)) {
  const result = createGame(
    {
      seed: 11,
      cards: [...DEFAULT_CARDS, SORCERER, ...SPELLS, MYSTIC_ARTS, WATCHER, DARK, DISCARD_SCHEMES, BLANK],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: encounter,
      players: [{ identityCardId: SORCERER.id, deck: [...DEFAULT_DECK, MYSTIC_ARTS.id, WATCHER.id, ...copies(DISCARD_SCHEMES.id, 2)] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

/** p1's first turn, with two resource cards guaranteed in hand. */
function game(encounter?: readonly CardId[]): { readonly state: GameState; readonly resources: readonly InstanceId[] } {
  const started = runCommands(setup(encounter).state, deps).state;
  const given = giveCards(started, p1, RESOURCE.id, RESOURCE.id);
  return { state: given.state, resources: given.ids };
}

const invocation = (state: GameState) => separateDeckOf(state, p1, INVOCATION);
const identityId = (state: GameState) => mustPlayer(state, p1).identity.instanceId;
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const faceups = (state: GameState, ids: readonly InstanceId[]) => ids.map((id) => mustInstance(state, id).faceup);

const spellMastery = (state: GameState, resources: readonly InstanceId[], pick: InstanceId = invocation(state).deck[0] as InstanceId): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: identityId(state),
  abilityId: SPELL_MASTERY.ref.id,
  payment: fromHand(...resources),
  costChoices: { invocation: [pick] },
});

function playFree(state: GameState, card: AnyCard) {
  const given = giveCard(state, p1, card.id);
  return runCommands(given.state, deps, { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null });
}

const inPlay = (state: GameState, card: AnyCard): InstanceId => {
  const id = mustPlayer(state, p1).playArea.find((candidate) => state.instances[candidate]?.cardId === card.id);
  if (!id) throw new Error(`no ${card.id} in play`);
  return id;
};

describe("§3.5 an identity's separate deck (Invocation)", () => {
  it("setup builds and shuffles the five-card deck, owned by that player, with only the top card faceup", () => {
    const { state, events } = setup();
    const piles = invocation(state);
    expect(piles.deck).toHaveLength(5);
    expect(piles.discard).toEqual([]);
    expect(new Set(piles.deck.map((id) => mustInstance(state, id).cardId))).toEqual(new Set(SPELLS.map((spell) => spell.id)));
    for (const id of piles.deck) {
      expect(mustInstance(state, id)).toMatchObject({ ownerId: p1, home: { kind: "separateDeck", name: INVOCATION } });
      expect(mustPlayer(state, p1).deck).not.toContain(id);
    }
    expect(faceups(state, piles.deck)).toEqual([true, false, false, false, false]);
    expect(events).toContainEqual(expect.objectContaining({ type: "deckShuffled", zone: { kind: "separateDeck", playerId: p1, name: INVOCATION } }));
    // A Core identity has none.
    expect(mustPlayer(newGame(), p1).separateDecks).toEqual({});
  });

  it("Spell Mastery pays the top card's printed cost and resolves its Special, which lands in the Invocation discard pile; nothing counts it as played", () => {
    const { state: start, resources } = game();
    const withWatcher = playFree(start, WATCHER).state;
    const watcher = inPlay(withWatcher, WATCHER);
    // Control: playing a card is seen.
    const seen = playFree(withWatcher, DISCARD_SCHEMES).state;
    const sawPlay = mustInstance(seen, watcher).counters.sawPlay ?? 0;
    expect(sawPlay).toBeGreaterThan(0);

    const hero = runCommands(seen, deps, toHero).state;
    const before = invocation(hero);
    const [top, ...rest] = before.deck as [InstanceId, ...InstanceId[]];
    // Only the top card can be chosen.
    expect(applyCommand(hero, spellMastery(hero, resources, rest[0]), deps).ok).toBe(false);

    const { state, events } = runCommands(hero, deps, spellMastery(hero, resources, top));
    expect(invocation(state)).toEqual({ deck: rest, discard: [top] });
    expect(mustPlayer(state, p1).discard).not.toContain(top);
    expect(mustPlayer(state, p1).discard).toEqual(expect.arrayContaining([...resources]));
    expect(faceups(state, rest)).toEqual([true, false, false, false]);
    expect(mustInstance(state, identityId(state))).toMatchObject({ exhausted: true, counters: { spells: 1 } });
    expect(ofType(events, "cardPlayed")).toEqual([]);
    expect(mustInstance(state, watcher).counters.sawPlay).toBe(sawPlay);
  });

  it("the deck that empties takes its discard pile back at once, with no encounter card and no acceleration token", () => {
    const { state: start, resources } = game();
    const hero = runCommands(start, deps, toHero).state;
    const [last, ...others] = invocation(hero).deck as [InstanceId, ...InstanceId[]];
    const primed: GameState = {
      ...hero,
      players: hero.players.map((p) => (p.playerId === p1 ? { ...p, separateDecks: { [INVOCATION]: { deck: [last], discard: others } } } : p)),
    };
    const dealtBefore = mustPlayer(primed, p1).dealtEncounter;

    const { state, events } = runCommands(primed, deps, spellMastery(primed, resources, last));
    expect(invocation(state).deck).toHaveLength(5);
    expect(invocation(state).discard).toEqual([]);
    expect(faceups(state, invocation(state).deck).filter(Boolean)).toHaveLength(1);
    expect(ofType(events, "separateDeckReset")).toEqual([{ type: "separateDeckReset", playerId: p1, name: INVOCATION }]);
    expect(ofType(events, "accelerationTokenAdded")).toEqual([]);
    expect(mustPlayer(state, p1).dealtEncounter).toEqual(dealtBefore);
    expect(state.mainScheme.accelerationTokens).toBe(0);
  });

  it("Master of the Mystic Arts resolves the top card and places it back on top faceup", () => {
    const { state: start, resources } = game();
    const withArts = playFree(start, MYSTIC_ARTS).state;
    const [top] = invocation(withArts).deck as [InstanceId];
    const { state } = runCommands(withArts, deps, {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: inPlay(withArts, MYSTIC_ARTS),
      abilityId: MYSTIC_ARTS_ACTION.ref.id,
      payment: fromHand(...resources),
      costChoices: { invocation: [top] },
    });
    expect(invocation(state).deck[0]).toBe(top);
    expect(invocation(state).deck).toHaveLength(5);
    expect(invocation(state).discard).toEqual([]);
    expect(faceups(state, invocation(state).deck)).toEqual([true, false, false, false, false]);
    expect(mustInstance(state, identityId(state)).counters.spells).toBe(1);
  });

  it("Natural Talent discards the top card, once per phase", () => {
    const { state: start } = game();
    const [top, next] = invocation(start).deck as [InstanceId, InstanceId];
    const use: Command = { type: "useAbility", playerId: p1, cardInstanceId: identityId(start), abilityId: NATURAL_TALENT.ref.id, payment: [] };
    const { state } = runCommands(start, deps, use);
    expect(invocation(state).discard).toEqual([top]);
    expect(invocation(state).deck[0]).toBe(next);
    expect(mustInstance(state, next).faceup).toBe(true);
    expect(applyCommand(state, use, deps).ok).toBe(false);
  });

  it("Open the Dark Dimension tucks the top card facedown, and its When Defeated shuffles it back into the Invocation deck", () => {
    const { state: start } = game(copies(DARK.id, 12));
    const revealed = runCommands(start, deps, endTurn).state;
    const scheme = revealed.villainArea.find((id) => revealed.instances[id]?.cardId === DARK.id) as InstanceId;
    const [tucked] = mustInstance(revealed, scheme).tucked as [InstanceId];
    expect(mustInstance(revealed, tucked)).toMatchObject({ faceup: false, home: { kind: "separateDeck", name: INVOCATION } });
    expect(invocation(revealed).deck).toHaveLength(4);
    expect(mustInstance(revealed, invocation(revealed).deck[0] as InstanceId).faceup).toBe(true);

    const hero = runCommands(revealed, deps, toHero).state;
    const { state } = runCommands(hero, deps, { type: "basicThwart", playerId: p1, thwarterInstanceId: identityId(hero), schemeInstanceId: scheme });
    expect(state.villainArea).not.toContain(scheme);
    expect(invocation(state).deck).toHaveLength(5);
    expect(invocation(state).deck).toContain(tucked);
    expect(faceups(state, invocation(state).deck).filter(Boolean)).toHaveLength(1);
  });

  it("the scheme leaving play any other way discards the tucked card to the Invocation discard pile (RRG 1.8 'Tuck', p. 45)", () => {
    const { state: start } = game(copies(DARK.id, 12));
    const revealed = runCommands(start, deps, endTurn).state;
    const scheme = revealed.villainArea.find((id) => revealed.instances[id]?.cardId === DARK.id) as InstanceId;
    const [tucked] = mustInstance(revealed, scheme).tucked as [InstanceId];
    const { state } = playFree(revealed, DISCARD_SCHEMES);
    expect(invocation(state).discard).toEqual([tucked]);
    expect(mustPlayer(state, p1).discard).not.toContain(tucked);
    expect(mustInstance(state, tucked).faceup).toBe(true);
  });

  it("replay reproduces a game that used the Invocation deck", () => {
    const { state: start, resources } = game(copies(DARK.id, 12));
    const hero = runCommands(start, deps, toHero).state;
    const { session } = runCommands(hero, deps, spellMastery(hero, resources), endTurn);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    expect(flat(0)).toEqual({ base: 0, perPlayer: 0 });
  });
});
