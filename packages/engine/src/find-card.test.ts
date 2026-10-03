/**
 * docs/phase7-wave6.md §3.48: "find" a card wherever it is in the game (`TargetRef find`, `EffectSpec findCard`), proven
 * with a synthetic "charm" upgrade shaped like Rogue's Touched (`rogue` 38002): "Find your Touched upgrade and set it
 * aside" (Anna Marie's Setup, erratum RRG 1.8 p. 69), "find Touched and attach it to another character" (Skin Contact).
 *
 * Sources: RRG 1.8 "Find" (p. 19): every game area where the card could be, except facedown encounter cards in an
 * in-play area, the victory display and removed-from-game cards; "players should not unnecessarily search game areas if
 * they know where the card they are looking for can be found". Ruling, December 17, 2025 (4) answer 3: "The **Find**
 * keyword can only search 'in game' areas." RRG 1.8 "Search" (p. 39): a searched deck is shuffled after. RRG 1.8 "Attach
 * To" (p. 8). RRG 1.8 "'Then'" (p. 44).
 *
 * Synthetic cards only; the engine never names a card.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { createCtx, moveCard, updateInstance } from "./ctx.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import { resolveRef } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState, ZoneId } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import {
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;

const CHARM = stubUpgrade({ id: "charm", cost: 0 });
const SECRET = stubTreachery({ id: "secret", boostIcons: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const CHARM_QUERY: TargetQuery = { categories: ["upgrade"], name: "charm" };
/** "… then": a follow-up that runs only when the find resolved fully. */
const THEN_MARK: EffectSpec = {
  kind: "then",
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: you },
      counterType: "then",
      amount: { kind: "const", value: 1 },
    },
  ],
};
const find = (to: Extract<EffectSpec, { kind: "findCard" }>["to"], extra: Partial<EffectSpec> = {}): EffectSpec =>
  ({ kind: "findCard", query: CHARM_QUERY, owner: you, to, ...extra }) as EffectSpec;

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Find your charm and set it aside. Then …" */
const ASIDE = actionEvent("find-aside", [find("setAside", { bind: "found" } as Partial<EffectSpec>), THEN_MARK]);
/** "Find a charm (anyone's) and set it aside." */
const ASIDE_ANY = actionEvent("find-aside-any", [{ kind: "findCard", query: CHARM_QUERY, to: "setAside" }]);
/** "Find your charm and attach it to the villain." */
const TO_VILLAIN = actionEvent("find-to-villain", [find({ attachTo: { kind: "villain" } })]);
/** "Find your charm and attach it to your identity." */
const TO_SELF = actionEvent("find-to-self", [find({ attachTo: { kind: "identityOf", player: you } })]);
/** "Find your charm and add it to your hand." */
const TO_HAND = actionEvent("find-to-hand", [find("hand")]);
/** "Find the secret treachery and set it aside" (an encounter card: no owner). */
const SECRET_ASIDE = actionEvent("find-secret", [
  { kind: "findCard", query: { name: "secret" }, to: "encounterSetAside" },
]);

const EVENTS = [ASIDE, ASIDE_ANY, TO_VILLAIN, TO_SELF, TO_HAND, SECRET_ASIDE];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
const BASE_CARDS = [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, SECRET, CHARM, ...EVENTS.map((e) => e.card)];
const EVENT_IDS = EVENTS.map((e) => e.card.id as CardId);

function game(options: { players?: number; charm?: boolean } = {}): GameState {
  const identities = seatIdentities(
    stubIdentity({ id: "seeker", hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 }),
    options.players ?? 1,
  );
  const config: GameSetupConfig = {
    seed: 11,
    cards: [...BASE_CARDS, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: LONG_SCHEME.id,
    encounterDeck: [...Array.from({ length: 15 }, () => BLANK.id as CardId), SECRET.id],
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...EVENT_IDS, ...(options.charm === false ? [] : [CHARM.id])],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const instancesOf = (state: GameState, card: { readonly id: CardId }): readonly InstanceId[] =>
  (Object.keys(state.instances) as InstanceId[]).filter((id) => state.instances[id]?.cardId === card.id);
const charmOf = (state: GameState, owner: PlayerId = p1): InstanceId =>
  instancesOf(state, CHARM).find((id) => state.instances[id]?.ownerId === owner)!;
const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const identityId = (state: GameState, player: PlayerId = p1): InstanceId =>
  mustPlayer(state, player).identity.instanceId;

/** Test-only state surgery: puts a card somewhere (faceup in the open areas, as the engine keeps them). */
function place(state: GameState, id: InstanceId, zone: ZoneId, faceup = true): GameState {
  const ctx = createCtx(state, deps);
  moveCard(ctx, id, zone, "top");
  updateInstance(ctx, id, (i) => ({ ...i, faceup }));
  return ctx.state;
}

/** Plays the event from p1's hand (cost 0) and returns the state and the events it logged. */
function play(state: GameState, card: { readonly id: CardId }, player: PlayerId = p1) {
  const given = giveCard(state, player, card.id);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  expect(result.state.pendingChoice).toBeNull();
  return { ...result, before: given.state };
}

const typed = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const movesOf = (events: readonly GameEvent[], id: InstanceId) =>
  typed(events, "cardMoved").filter((e) => e.instanceId === id);

describe("§3.48 EffectSpec findCard: from each game area", () => {
  it("from the deck: set aside, then the deck is shuffled (RRG 1.8 'Search', p. 39); the 'then' resolves", () => {
    const start = game();
    const charm = charmOf(start);
    expect(mustPlayer(start, p1).deck).toContain(charm);
    const { state, events, before } = play(start, ASIDE.card);
    const deckBefore = mustPlayer(before, p1).deck.filter((id) => id !== charm);
    const player = mustPlayer(state, p1);
    expect(player.setAside).toEqual([charm]);
    expect(player.deck).not.toContain(charm);
    expect([...player.deck].sort()).toEqual([...deckBefore].sort());
    expect(typed(events, "cardFound")).toEqual([
      {
        type: "cardFound",
        instanceId: charm,
        cardId: CHARM.id,
        from: { kind: "deck", playerId: p1 },
        alreadyThere: false,
        deckShuffled: true,
      },
    ]);
    // Found, then moved, then the deck shuffled: in that order, once.
    const found = events.findIndex((e) => e.type === "cardFound");
    const moved = events.findIndex((e) => e.type === "cardMoved" && e.instanceId === charm);
    const shuffles = typed(events, "deckShuffled");
    expect(shuffles).toHaveLength(1);
    expect(shuffles[0]!.zone).toEqual({ kind: "deck", playerId: p1 });
    expect(found).toBeLessThan(moved);
    expect(moved).toBeLessThan(events.indexOf(shuffles[0]!));
    expect(mustInstance(state, identityId(state)).counters.then).toBe(1);
  });

  it("from the discard pile: set aside, and the deck is not searched, so not shuffled", () => {
    const start = game();
    const charm = charmOf(start);
    const at = place(start, charm, { kind: "discard", playerId: p1 });
    const { state, events, before } = play(at, ASIDE.card);
    const deckBefore = mustPlayer(before, p1).deck;
    expect(mustPlayer(state, p1).setAside).toEqual([charm]);
    expect(mustPlayer(state, p1).discard).not.toContain(charm);
    expect(typed(events, "cardFound")[0]).toMatchObject({
      from: { kind: "discard", playerId: p1 },
      alreadyThere: false,
      deckShuffled: false,
    });
    expect(typed(events, "deckShuffled")).toEqual([]);
    expect(mustPlayer(state, p1).deck).toEqual(deckBefore);
  });

  it("from the hand: set aside, no shuffle", () => {
    const start = game();
    const charm = charmOf(start);
    const at = place(start, charm, { kind: "hand", playerId: p1 });
    const { state, events } = play(at, ASIDE.card);
    expect(mustPlayer(state, p1).setAside).toEqual([charm]);
    expect(mustPlayer(state, p1).hand).not.toContain(charm);
    expect(typed(events, "cardFound")[0]).toMatchObject({ from: { kind: "hand", playerId: p1 }, deckShuffled: false });
    expect(typed(events, "deckShuffled")).toEqual([]);
  });

  it("already set aside: found where it is, nothing moves, nothing is shuffled, and the 'then' still resolves", () => {
    const start = game();
    const charm = charmOf(start);
    const at = place(start, charm, { kind: "setAside", playerId: p1 });
    const { state, events, before } = play(at, ASIDE.card);
    const deckBefore = mustPlayer(before, p1).deck;
    expect(mustPlayer(state, p1).setAside).toEqual([charm]);
    expect(typed(events, "cardFound")).toEqual([
      {
        type: "cardFound",
        instanceId: charm,
        cardId: CHARM.id,
        from: { kind: "setAside", playerId: p1 },
        alreadyThere: true,
        deckShuffled: false,
      },
    ]);
    expect(movesOf(events, charm)).toEqual([]);
    expect(typed(events, "deckShuffled")).toEqual([]);
    expect(mustPlayer(state, p1).deck).toEqual(deckBefore);
    expect(mustInstance(state, identityId(state)).counters.then).toBe(1);
  });

  it("attached to another character, then set aside: it leaves that host", () => {
    const start = game();
    const charm = charmOf(start);
    const at = place(start, charm, { kind: "attachment", hostInstanceId: villainId(start) });
    expect(mustInstance(at, villainId(at)).attachments).toEqual([charm]);
    const { state, events } = play(at, ASIDE.card);
    expect(mustInstance(state, villainId(state)).attachments).toEqual([]);
    expect(mustInstance(state, charm).attachedTo).toBeNull();
    expect(mustPlayer(state, p1).setAside).toEqual([charm]);
    expect(typed(events, "cardFound")[0]).toMatchObject({
      from: { kind: "attachment", hostInstanceId: villainId(state) },
      deckShuffled: false,
    });
  });

  it("attached to another character, then attached to you: it moves host to host", () => {
    const start = game();
    const charm = charmOf(start);
    const at = place(start, charm, { kind: "attachment", hostInstanceId: villainId(start) });
    const { state, events } = play(at, TO_SELF.card);
    expect(mustInstance(state, villainId(state)).attachments).toEqual([]);
    expect(mustInstance(state, identityId(state)).attachments).toEqual([charm]);
    expect(mustInstance(state, charm)).toMatchObject({ attachedTo: identityId(state), faceup: true });
    expect(movesOf(events, charm)).toEqual([
      {
        type: "cardMoved",
        instanceId: charm,
        cardId: CHARM.id,
        from: { kind: "attachment", hostInstanceId: villainId(state) },
        to: { kind: "attachment", hostInstanceId: identityId(state) },
      },
    ]);
    expect(typed(events, "deckShuffled")).toEqual([]);
  });

  it("from the deck, attached to the villain: faceup on its host, and the deck shuffled", () => {
    const start = game();
    const charm = charmOf(start);
    const { state, events } = play(start, TO_VILLAIN.card);
    expect(mustInstance(state, villainId(state)).attachments).toEqual([charm]);
    expect(mustInstance(state, charm)).toMatchObject({ attachedTo: villainId(state), faceup: true, ownerId: p1 });
    expect(mustPlayer(state, p1).deck).not.toContain(charm);
    expect(typed(events, "deckShuffled").map((e) => e.zone)).toEqual([{ kind: "deck", playerId: p1 }]);
  });

  it("already on the named host: found, nothing moves", () => {
    const start = game();
    const charm = charmOf(start);
    const at = place(start, charm, { kind: "attachment", hostInstanceId: villainId(start) });
    const { state, events } = play(at, TO_VILLAIN.card);
    expect(mustInstance(state, villainId(state)).attachments).toEqual([charm]);
    expect(typed(events, "cardFound")[0]).toMatchObject({ alreadyThere: true, deckShuffled: false });
    expect(movesOf(events, charm)).toEqual([]);
  });

  it("from the deck to the hand", () => {
    const start = game();
    const charm = charmOf(start);
    const { state } = play(start, TO_HAND.card);
    expect(mustPlayer(state, p1).hand).toContain(charm);
    expect(mustPlayer(state, p1).deck).not.toContain(charm);
  });
});

describe("§3.48 what a find does not search", () => {
  const notFound = (state: GameState, events: readonly GameEvent[], before: GameState, charm: InstanceId) => {
    expect(typed(events, "cardFound")).toEqual([]);
    expect(movesOf(events, charm)).toEqual([]);
    expect(typed(events, "deckShuffled")).toEqual([]);
    expect(mustPlayer(state, p1).deck).toEqual(mustPlayer(before, p1).deck);
    expect(events).toContainEqual({ type: "preThenUnresolved", cause: "findFoundNothing" });
    expect(events).toContainEqual({ type: "thenSkipped" });
    expect(mustInstance(state, identityId(state)).counters.then).toBeUndefined();
  };

  it("a removed-from-game card is not found (RRG 1.8 'Find', p. 19)", () => {
    const start = game();
    const charm = charmOf(start);
    const at = place(start, charm, { kind: "removedFromGame" });
    const { state, events, before } = play(at, ASIDE.card);
    expect(state.removedFromGame).toContain(charm);
    notFound(state, events, before, charm);
  });

  it("a card in the victory display is not found (RRG 1.8 'Find', p. 19)", () => {
    const start = game();
    const charm = charmOf(start);
    const at = place(start, charm, { kind: "victoryDisplay" });
    const { state, events, before } = play(at, ASIDE.card);
    expect(state.victoryDisplay).toContain(charm);
    notFound(state, events, before, charm);
  });

  it("a card outside the game is not found (ruling, Dec 17, 2025 (4) #3: Find searches 'in game' areas only)", () => {
    // The charm is in the card pool (the player's collection) but in no deck: it is outside the current game.
    const start = game({ charm: false });
    expect(instancesOf(start, CHARM)).toEqual([]);
    const { state, events, before } = play(start, ASIDE.card);
    const deckBefore = mustPlayer(before, p1).deck;
    expect(instancesOf(state, CHARM)).toEqual([]);
    expect(typed(events, "cardFound")).toEqual([]);
    expect(typed(events, "deckShuffled")).toEqual([]);
    expect(mustPlayer(state, p1).deck).toEqual(deckBefore);
    expect(events).toContainEqual({ type: "preThenUnresolved", cause: "findFoundNothing" });
  });

  it("a facedown encounter card dealt to a player is not found; a faceup one in the encounter discard pile is", () => {
    const start = game();
    const [secret] = instancesOf(start, SECRET);
    const dealt = place(start, secret!, { kind: "dealtEncounter", playerId: p1 }, false);
    const first = play(dealt, SECRET_ASIDE.card);
    expect(typed(first.events, "cardFound")).toEqual([]);
    expect(mustPlayer(first.state, p1).dealtEncounter).toContain(secret);

    const deckId = start.encounterDeckOrder[0]!;
    const discarded = place(start, secret!, { kind: "encounterDiscard", deckId });
    const second = play(discarded, SECRET_ASIDE.card);
    expect(second.state.encounterSetAside).toContain(secret);
    expect(typed(second.events, "cardFound")[0]).toMatchObject({ deckShuffled: false });
    expect(typed(second.events, "deckShuffled")).toEqual([]);
  });

  it("an encounter card in the encounter deck is found, and that deck is shuffled", () => {
    const start = game();
    const [secret] = instancesOf(start, SECRET);
    const deckId = start.encounterDeckOrder[0]!;
    const { state, events } = play(start, SECRET_ASIDE.card);
    expect(state.encounterSetAside).toContain(secret);
    expect(activeEncounterDeck(state).deck).not.toContain(secret);
    expect(typed(events, "deckShuffled").map((e) => e.zone)).toEqual([{ kind: "encounterDeck", deckId }]);
  });
});

describe("§3.48 owner and search order", () => {
  it("'your' charm: p1 finds their own in their deck, not p2's in the open; without an owner the open one comes first", () => {
    const start = game({ players: 2 });
    const mine = charmOf(start, p1);
    const theirs = charmOf(start, p2);
    const at = place(place(start, mine, { kind: "deck", playerId: p1 }, false), theirs, {
      kind: "discard",
      playerId: p2,
    });

    const owned = play(at, ASIDE.card);
    expect(mustPlayer(owned.state, p1).setAside).toEqual([mine]);
    expect(mustPlayer(owned.state, p2).discard).toContain(theirs);
    expect(typed(owned.events, "deckShuffled").map((e) => e.zone)).toEqual([{ kind: "deck", playerId: p1 }]);

    // "Players should not unnecessarily search game areas": p2's charm in a discard pile is found before p1's deck is
    // searched, so no deck is shuffled, and it goes to its owner's set-aside area.
    const any = play(at, ASIDE_ANY.card);
    expect(mustPlayer(any.state, p2).setAside).toEqual([theirs]);
    expect(mustPlayer(any.state, p1).deck).toContain(mine);
    expect(typed(any.events, "deckShuffled")).toEqual([]);
  });

  it("TargetRef find names every match in search order: in play, set aside, hand, discard, then decks", () => {
    const dealt = game({ players: 2 });
    const mine = charmOf(dealt, p1);
    const theirs = charmOf(dealt, p2);
    // Both in their owners' decks, whatever the opening hands drew.
    const start = place(
      place(dealt, mine, { kind: "deck", playerId: p1 }, false),
      theirs,
      { kind: "deck", playerId: p2 },
      false,
    );
    const context = { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps };
    const ref: TargetRef = { kind: "find", query: CHARM_QUERY };
    expect(resolveRef(start, ref, context)).toEqual([mine, theirs]);
    const inDiscard = place(start, theirs, { kind: "discard", playerId: p2 });
    expect(resolveRef(inDiscard, ref, context)).toEqual([theirs, mine]);
    const onVillain = place(inDiscard, mine, { kind: "attachment", hostInstanceId: villainId(start) });
    expect(resolveRef(onVillain, ref, context)).toEqual([mine, theirs]);
    expect(resolveRef(onVillain, { ...ref, owner: { kind: "id", playerId: p2 } }, context)).toEqual([theirs]);
    expect(resolveRef(place(onVillain, mine, { kind: "removedFromGame" }), ref, context)).toEqual([theirs]);
  });
});

describe("§3.48 gating, setup, replay", () => {
  it("finding nothing never stops the ability being initiated: the event stays playable", () => {
    const start = game();
    const gone = place(start, charmOf(start), { kind: "removedFromGame" });
    const given = giveCard(gone, p1, ASIDE.card.id);
    const legal = legalActions(given.state, p1, deps);
    if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
    expect(legal.legal.some((a) => a.example.type === "playCard" && a.example.cardInstanceId === given.id)).toBe(true);
  });

  it("a Setup finds the charm in the deck and sets it aside; the game replays deep-equal", () => {
    const SETUP = stubAbility("finder.setup", { trigger: { kind: "setup" }, effects: [find("setAside")] });
    const setupDeps = depsOf(SETUP);
    const FINDER = stubIdentity({
      id: "finder",
      hp: 10,
      atk: 2,
      thw: 2,
      def: 2,
      rec: 3,
      heroHandSize: 5,
      alterEgoHandSize: 6,
      alterEgoAbilities: [SETUP.ref],
    });
    const result = createGame(
      {
        seed: 3,
        cards: [...BASE_CARDS, FINDER],
        villainCardId: QUIET_VILLAIN.id,
        mainSchemeCardId: LONG_SCHEME.id,
        encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
        includeIdentitySets: false,
        players: [{ identityCardId: FINDER.id, deck: [...DEFAULT_DECK, CHARM.id] }],
      },
      setupDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const { session, events } = driveSession(startSession(result.state), setupDeps);
    const charm = charmOf(session.state);
    const all = [...result.events, ...events];
    const found = typed(all, "cardFound");
    expect(found).toHaveLength(1);
    expect(mustPlayer(session.state, p1).setAside).toEqual([charm]);
    expect(mustPlayer(session.state, p1).hand).not.toContain(charm);
    expect(mustPlayer(session.state, p1).deck).not.toContain(charm);
    // If the opening hand drew it, it was found in the hand and no extra shuffle followed; otherwise the deck was.
    const shuffledAfter = all.slice(all.indexOf(found[0]!)).filter((e) => e.type === "deckShuffled");
    expect(shuffledAfter.length).toBe(found[0]!.deckShuffled ? 1 : 0);

    const replayed = replay(session.log, setupDeps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a game with no find logs no cardFound, round after round", () => {
    const plain = runCommands(game(), deps, { type: "endTurn", playerId: p1 }, { type: "endTurn", playerId: p1 });
    expect(plain.state.round).toBeGreaterThan(1);
    expect(typed(plain.events, "cardFound")).toEqual([]);
  });
});
