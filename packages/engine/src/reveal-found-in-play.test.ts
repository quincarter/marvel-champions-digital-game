/**
 * docs/phase7-wave8.md §3.1: "find X and reveal it" (`revealCard` of a `TargetRef find`) when the card is already in
 * play, proven with synthetic cards shaped like Pursued by the Past ("find your nemesis minion and reveal it"), Ahab
 * ("find the Release the Hounds side scheme and reveal it") and Police State (an attachment already on a player).
 *
 * Sources: RRG 1.8 "Find" (p. 19): "If a player is instructed to 'find and reveal' a minion that is already in play,
 * that player engages that minion and resolves any keywords and/or triggered abilities that resolve as a result of that
 * minion being revealed … That minion retains all attached cards and tokens on it. That minion is not considered to be
 * entering play. That minion is considered to engage that player unless it was already engaged with that player." Not
 * searched: facedown encounter cards in an in-play area, the victory display. Ruling, June 25, 2026 (5): "Finding and
 * revealing an attachment already in play triggers its When Revealed abilities and keywords." RRG 1.8 "Search" (p. 39):
 * a searched deck is shuffled. Ruling, Feb 28, 2026 (4) answer 2: quickstrike resolves upon engagement, before the When
 * Revealed. The owner's decision, §4.1 Q17 = A: an attachment found on another player stays where it is.
 *
 * Synthetic cards only; the engine never names a card.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { createCtx, moveCard, updateInstance } from "./ctx.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState, ZoneId } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAttachment,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, seatIdentities } from "./testing/scenario.js";
import { playerCardIntoPlay } from "./testing/wave3.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;

/** "When Revealed: [the revealing player's identity gets a `counter`]": who resolved it, and how many times. */
const marks = (id: string, counter: string) =>
  stubAbility(id, {
    trigger: { kind: "whenRevealed" },
    effects: [
      {
        kind: "addCounters",
        target: { kind: "identityOf", player: you },
        counterType: counter,
        amount: { kind: "const", value: 1 },
      },
    ],
  });

const HUNTER_REVEALED = marks("hunter.when-revealed", "hunted");
const STRIKER_REVEALED = marks("striker.when-revealed", "struck");
const HOUNDS_REVEALED = marks("hounds.when-revealed", "hounded");
const SHACKLE_REVEALED = marks("shackle.when-revealed", "shackled");
const CUFF_REVEALED = marks("cuff.when-revealed", "cuffed");

/** The nemesis minion's shape: a When Revealed. */
const HUNTER = stubMinion({ id: "hunter", atk: 2, sch: 1, hp: 6, abilities: [HUNTER_REVEALED.ref] });
/** A minion with quickstrike and a When Revealed. */
const STRIKER = stubMinion({
  id: "striker",
  atk: 3,
  sch: 1,
  hp: 6,
  keywords: [{ name: "quickstrike" }],
  abilities: [STRIKER_REVEALED.ref],
});
/** Release the Hounds's shape: starting threat 5, a When Revealed. */
const HOUNDS = stubSideScheme({ id: "hounds", startingThreat: 5, abilities: [HOUNDS_REVEALED.ref] });
/** A side scheme with surge: starting threat 3. */
const ALARM = stubSideScheme({ id: "alarm", startingThreat: 3, keywords: [{ name: "surge" }] });
/** Escaped Mutant's shape as found by Police State: an attachment with no data host, with a When Revealed. */
const SHACKLE = stubAttachment({ id: "shackle", abilities: [SHACKLE_REVEALED.ref] });
/** An attachment with an "attach to" host (the villain), with a When Revealed. */
const CUFF = stubAttachment({ id: "cuff", attachesTo: { kind: "villain" }, abilities: [CUFF_REVEALED.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const findRef = (name: string): TargetRef => ({ kind: "find", query: { name } });
const findAndReveal = (name: string): EffectSpec => ({ kind: "revealCard", cards: findRef(name), player: you });
/** "… Then": runs only when the find and reveal before it resolved fully (RRG 1.8 "'Then'", p. 44). */
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
const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};

/** Pursued by the Past's shape: "Find the hunter and reveal it. Then …" */
const PURSUED = actionEvent("pursued", [findAndReveal(HUNTER.name), THEN_MARK]);
const CALL_STRIKER = actionEvent("call-striker", [findAndReveal(STRIKER.name)]);
/** Ahab's shape: "If the hounds are in play, place 3 threat on it. Otherwise, find the hounds and reveal it." */
const AHAB = actionEvent("ahab", [
  {
    kind: "if",
    condition: { kind: "exists", query: { name: HOUNDS.name } },
    then: [{ kind: "placeThreat", target: { kind: "named", name: HOUNDS.name }, amount: { kind: "const", value: 3 } }],
    otherwise: [findAndReveal(HOUNDS.name)],
  },
]);
/** "Find the hounds and reveal it", with no in-play branch of its own. */
const CALL_HOUNDS = actionEvent("call-hounds", [findAndReveal(HOUNDS.name)]);
const CALL_ALARM = actionEvent("call-alarm", [findAndReveal(ALARM.name)]);
/** Police State's shape: "Find the shackle and reveal it." */
const POLICE = actionEvent("police", [findAndReveal(SHACKLE.name)]);
const CALL_CUFF = actionEvent("call-cuff", [findAndReveal(CUFF.name)]);

/** A counter on the main scheme: every mark lands on one card, so the log orders them. */
const markScheme = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType,
  amount: { kind: "const", value: 1 },
});
const youEngage = { on: "minionEngaged", playerIs: "controller" } as const;
const WATCH_BEFORE = stubAbility("watch.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: youEngage },
  effects: [markScheme("before")],
});
const WATCH_AFTER = stubAbility("watch.response", {
  trigger: { kind: "response", forced: true, on: youEngage },
  effects: [markScheme("after")],
});
/** A forced interrupt and a forced response to "you engage a minion". */
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_BEFORE.ref, WATCH_AFTER.ref] });

const EVENTS = [PURSUED, CALL_STRIKER, AHAB, CALL_HOUNDS, CALL_ALARM, POLICE, CALL_CUFF];
const REVEALED = [HUNTER_REVEALED, STRIKER_REVEALED, HOUNDS_REVEALED, SHACKLE_REVEALED, CUFF_REVEALED];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability), ...REVEALED, WATCH_BEFORE, WATCH_AFTER);
const ENCOUNTER = [HUNTER, STRIKER, HOUNDS, ALARM, SHACKLE, CUFF];
const CARDS = [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, WATCH, ...ENCOUNTER, ...EVENTS.map((e) => e.card)];

function game(): GameState {
  const identities = seatIdentities(
    stubIdentity({ id: "seeker", hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 }),
    2,
  );
  const config: GameSetupConfig = {
    seed: 23,
    cards: [...CARDS, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: LONG_SCHEME.id,
    encounterDeck: [...Array.from({ length: 12 }, () => BLANK.id as CardId), ...ENCOUNTER.map((card) => card.id)],
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, WATCH.id, ...EVENTS.map((e) => e.card.id as CardId)],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const the = (state: GameState, card: { readonly id: CardId }): InstanceId =>
  (Object.keys(state.instances) as InstanceId[]).find((id) => state.instances[id]?.cardId === card.id)!;
const identityId = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const counterOn = (state: GameState, player: PlayerId, counter: string): number =>
  mustInstance(state, identityId(state, player)).counters[counter] ?? 0;
const encounterDeckZone = (state: GameState): ZoneId => ({
  kind: "encounterDeck",
  deckId: activeEncounterDeckId(state),
});
const encounterDiscardZone = (state: GameState): ZoneId => ({
  kind: "encounterDiscard",
  deckId: activeEncounterDeckId(state),
});

/** Test-only state surgery: puts a card somewhere, faceup or facedown. */
function place(state: GameState, id: InstanceId, zone: ZoneId, faceup = true): GameState {
  const ctx = createCtx(state, deps);
  moveCard(ctx, id, zone, "top");
  updateInstance(ctx, id, (i) => ({ ...i, faceup }));
  return ctx.state;
}
/** Surgery: a minion in play engaged with `player`, as if it had been there a while (no reveal, no When Revealed). */
function engagedWith(state: GameState, id: InstanceId, player: PlayerId): GameState {
  const ctx = createCtx(place(state, id, { kind: "playArea", playerId: player }), deps);
  updateInstance(ctx, id, (i) => ({ ...i, engagedWith: player, controllerId: null }));
  return ctx.state;
}
/** Surgery: a side scheme in play with `threat` on it. */
function schemeInPlay(state: GameState, id: InstanceId, threat: number): GameState {
  const ctx = createCtx(place(state, id, { kind: "villainArea" }), deps);
  updateInstance(ctx, id, (i) => ({ ...i, threat }));
  return ctx.state;
}
const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][InstanceId]>): GameState => {
  const ctx = createCtx(state, deps);
  updateInstance(ctx, id, (i) => ({ ...i, ...change }));
  return ctx.state;
};

/** `player` plays the event (cost 0) from hand, every choice answered by default. */
function play(state: GameState, card: { readonly id: CardId }, player: PlayerId = p1) {
  const given = giveCard(state, player, card.id);
  const command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  } as const;
  const result = runCommands(given.state, deps, command);
  expect(result.state.pendingChoice).toBeNull();
  expect(result.state.stack).toEqual([]);
  return { ...result, before: given.state };
}

const typed = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const movesOf = (events: readonly GameEvent[], id: InstanceId) =>
  typed(events, "cardMoved").filter((e) => e.instanceId === id);
/** Every trigger event of `kind` the log announced (any phase) for `id`. */
const announced = (events: readonly GameEvent[], kind: string, id: InstanceId) =>
  typed(events, "triggerEvent").filter(
    (e) => e.event.kind === kind && "instanceId" in e.event && e.event.instanceId === id,
  );
const revealsOf = (events: readonly GameEvent[], id: InstanceId) =>
  typed(events, "encounterCardRevealed").filter((e) => e.instanceId === id);

describe("§3.1 test 1: a minion found in play and revealed (RRG 1.8 'Find', p. 19)", () => {
  /** The hunter engaged with p2: 2 damage, a stunned status card, 3 counters, and the cuff attached to it. */
  function hunted(): { state: GameState; hunter: InstanceId; cuff: InstanceId } {
    const start = game();
    const hunter = the(start, HUNTER);
    const cuff = the(start, CUFF);
    let state = engagedWith(start, hunter, p2);
    state = patch(state, hunter, {
      damage: 2,
      statuses: { stunned: 1, confused: 0, tough: 0 },
      counters: { grudge: 3 },
    });
    state = place(state, cuff, { kind: "attachment", hostInstanceId: hunter });
    return { state, hunter, cuff };
  }

  it("engaged with player 2 with 2 damage and a stunned card: it engages player 1 and keeps everything on it", () => {
    const { state: at, hunter, cuff } = hunted();
    expect(mustPlayer(at, p2).playArea).toContain(hunter);
    const { state, events } = play(at, PURSUED.card);

    const minion = mustInstance(state, hunter);
    expect(minion.engagedWith).toBe(p1);
    expect(mustPlayer(state, p1).playArea).toContain(hunter);
    expect(mustPlayer(state, p2).playArea).not.toContain(hunter);
    expect(minion.damage).toBe(2);
    expect(minion.statuses).toEqual({ stunned: 1, confused: 0, tough: 0 });
    expect(minion.counters).toEqual({ grudge: 3 });
    expect(minion.attachments).toEqual([cuff]);
    expect(mustInstance(state, cuff).attachedTo).toBe(hunter);
    expect(minion.faceup).toBe(true);
    expect(minion.exhausted).toBe(false);

    // Its one move is the engagement: play area to play area. It never passed through the dealt encounter cards.
    expect(movesOf(events, hunter)).toEqual([
      {
        type: "cardMoved",
        instanceId: hunter,
        cardId: HUNTER.id,
        from: { kind: "playArea", playerId: p2 },
        to: { kind: "playArea", playerId: p1 },
      },
    ]);
    expect(movesOf(events, cuff)).toEqual([]);
    // Not considered to be entering play.
    expect(announced(events, "cardEntersPlay", hunter)).toEqual([]);
    expect(announced(events, "cardEntersPlay", cuff)).toEqual([]);
    // Its When Revealed resolved once, for player 1.
    expect(counterOn(state, p1, "hunted")).toBe(1);
    expect(counterOn(state, p2, "hunted")).toBe(0);
    expect(revealsOf(events, hunter)).toEqual([
      { type: "encounterCardRevealed", instanceId: hunter, cardId: HUNTER.id, playerId: p1 },
    ]);
    // The cuff on it was not revealed: its own When Revealed did not resolve.
    expect(counterOn(state, p1, "cuffed")).toBe(0);
    // The log says why: found in play, revealed where it is, engaged.
    expect(typed(events, "cardFound")).toEqual([
      {
        type: "cardFound",
        instanceId: hunter,
        cardId: HUNTER.id,
        from: { kind: "playArea", playerId: p2 },
        alreadyThere: true,
        deckShuffled: false,
      },
    ]);
    expect(typed(events, "revealedInPlay")).toEqual([
      { type: "revealedInPlay", instanceId: hunter, cardId: HUNTER.id, playerId: p1, engaged: true },
    ]);
    // Found in the open: no deck was searched.
    expect(typed(events, "deckShuffled")).toEqual([]);
    // The find and reveal resolved fully, so the "then" resolves.
    expect(counterOn(state, p1, "then")).toBe(1);
  });

  it("the order in the log: found, revealed, engaged, then the When Revealed", () => {
    const { state: at, hunter } = hunted();
    const { events } = play(at, PURSUED.card);
    const found = events.findIndex((e) => e.type === "cardFound");
    const revealed = events.findIndex((e) => e.type === "encounterCardRevealed");
    const moved = events.findIndex((e) => e.type === "cardMoved" && e.instanceId === hunter);
    const inPlay = events.findIndex((e) => e.type === "revealedInPlay");
    const whenRevealed = events.findIndex((e) => e.type === "counterAdded");
    expect(found).toBeGreaterThanOrEqual(0);
    expect(found).toBeLessThan(revealed);
    expect(revealed).toBeLessThan(moved);
    expect(moved).toBeLessThan(inPlay);
    expect(inPlay).toBeLessThan(whenRevealed);
  });

  it("already engaged with the finder: it does not engage again, moves nowhere, and its When Revealed resolves", () => {
    const start = game();
    const hunter = the(start, HUNTER);
    const at = patch(engagedWith(start, hunter, p1), hunter, { damage: 4 });
    const { state, events } = play(at, PURSUED.card);
    expect(mustInstance(state, hunter).engagedWith).toBe(p1);
    expect(mustInstance(state, hunter).damage).toBe(4);
    expect(mustPlayer(state, p1).playArea.filter((id) => id === hunter)).toEqual([hunter]);
    expect(movesOf(events, hunter)).toEqual([]);
    expect(announced(events, "cardEntersPlay", hunter)).toEqual([]);
    expect(typed(events, "revealedInPlay")).toEqual([
      { type: "revealedInPlay", instanceId: hunter, cardId: HUNTER.id, playerId: p1, engaged: false },
    ]);
    expect(counterOn(state, p1, "hunted")).toBe(1);
    expect(counterOn(state, p1, "then")).toBe(1);
  });

  it("two players, the finder is player 2: the minion leaves player 1 and engages player 2", () => {
    const start = game();
    const hunter = the(start, HUNTER);
    const at = patch(engagedWith(start, hunter, p1), hunter, {
      damage: 2,
      statuses: { stunned: 1, confused: 0, tough: 0 },
    });
    const { state, events } = play(at, PURSUED.card, p2);
    expect(mustInstance(state, hunter).engagedWith).toBe(p2);
    expect(mustPlayer(state, p2).playArea).toContain(hunter);
    expect(mustPlayer(state, p1).playArea).not.toContain(hunter);
    expect(mustInstance(state, hunter).damage).toBe(2);
    expect(mustInstance(state, hunter).statuses.stunned).toBe(1);
    expect(announced(events, "cardEntersPlay", hunter)).toEqual([]);
    expect(counterOn(state, p2, "hunted")).toBe(1);
    expect(counterOn(state, p1, "hunted")).toBe(0);
    expect(counterOn(state, p2, "then")).toBe(1);
    expect(typed(events, "revealedInPlay")).toEqual([
      { type: "revealedInPlay", instanceId: hunter, cardId: HUNTER.id, playerId: p2, engaged: true },
    ]);
  });
});

describe("§3.1 reveal keywords of a minion found in play: quickstrike", () => {
  /** p1 in hero form with the striker engaged with p2. */
  function struck(engaged: PlayerId): { state: GameState; striker: InstanceId } {
    const start = runCommands(game(), deps, { type: "changeForm", playerId: p1 }).state;
    expect(mustPlayer(start, p1).identity.form).toBe("hero");
    const striker = the(start, STRIKER);
    return { state: engagedWith(start, striker, engaged), striker };
  }
  const attacksBy = (events: readonly GameEvent[], id: InstanceId) =>
    typed(events, "triggerEvent").filter(
      (e) => e.phase === "initiated" && e.event.kind === "enemyAttack" && e.event.enemyInstanceId === id,
    );

  it("it engaged the finder, a hero: it attacks once for 3, before its When Revealed (ruling Feb 28, 2026 (4))", () => {
    const { state: at, striker } = struck(p2);
    const { state, events } = play(at, CALL_STRIKER.card);
    expect(mustInstance(state, striker).engagedWith).toBe(p1);
    expect(attacksBy(events, striker)).toHaveLength(1);
    // Undefended (the default answer declines to defend): ATK 3 against 10 hit points.
    expect(mustInstance(state, identityId(state, p1)).damage).toBe(3);
    expect(mustInstance(state, identityId(state, p2)).damage).toBe(0);
    expect(counterOn(state, p1, "struck")).toBe(1);
    const attack = events.indexOf(attacksBy(events, striker)[0]!);
    const whenRevealed = events.findIndex((e) => e.type === "counterAdded");
    expect(events.findIndex((e) => e.type === "revealedInPlay")).toBeLessThan(attack);
    expect(attack).toBeLessThan(whenRevealed);
    expect(announced(events, "cardEntersPlay", striker)).toEqual([]);
  });

  it("already engaged with the finder: it did not engage, so no quickstrike; the When Revealed still resolves", () => {
    const { state: at, striker } = struck(p1);
    const { state, events } = play(at, CALL_STRIKER.card);
    expect(attacksBy(events, striker)).toEqual([]);
    expect(mustInstance(state, identityId(state, p1)).damage).toBe(0);
    expect(counterOn(state, p1, "struck")).toBe(1);
  });
});

describe("§3.1 the engagement's own windows (RRG 1.8 'Engage', p. 18; 'Reveal', p. 38)", () => {
  const schemeCounter = (state: GameState, counter: string): number =>
    mustInstance(state, state.mainScheme.instanceId).counters[counter] ?? 0;
  const added = (events: readonly GameEvent[], counter: string): number =>
    events.findIndex((e) => e.type === "counterAdded" && e.counterType === counter);

  it("it engaged the finder: 1 interrupt before the When Revealed, 1 'after you engage' response after the reveal", () => {
    const start = playerCardIntoPlay(game(), WATCH.id, p1).state;
    const hunter = the(start, HUNTER);
    const { state, events } = play(engagedWith(start, hunter, p2), PURSUED.card);
    expect(schemeCounter(state, "before")).toBe(1);
    expect(schemeCounter(state, "after")).toBe(1);
    expect(counterOn(state, p1, "hunted")).toBe(1);
    expect(added(events, "before")).toBeGreaterThanOrEqual(0);
    expect(added(events, "before")).toBeLessThan(added(events, "hunted"));
    expect(added(events, "hunted")).toBeLessThan(added(events, "after"));
  });

  it("already engaged with the finder: it did not engage, so neither window opens", () => {
    const start = playerCardIntoPlay(game(), WATCH.id, p1).state;
    const hunter = the(start, HUNTER);
    const { state } = play(engagedWith(start, hunter, p1), PURSUED.card);
    expect(schemeCounter(state, "before")).toBe(0);
    expect(schemeCounter(state, "after")).toBe(0);
    expect(counterOn(state, p1, "hunted")).toBe(1);
  });
});

describe("§3.1 tests 2 and 3: where a find does not look (RRG 1.8 'Find', p. 19)", () => {
  it("test 2: facedown as player 2's dealt encounter card: not found; nothing is revealed and it stays facedown", () => {
    const start = game();
    const hunter = the(start, HUNTER);
    const at = place(start, hunter, { kind: "dealtEncounter", playerId: p2 }, false);
    const { state, events } = play(at, PURSUED.card);
    expect(mustPlayer(state, p2).dealtEncounter).toEqual([hunter]);
    expect(mustInstance(state, hunter).faceup).toBe(false);
    expect(mustInstance(state, hunter).engagedWith).toBeNull();
    expect(typed(events, "cardFound")).toEqual([]);
    expect(typed(events, "encounterCardRevealed")).toEqual([]);
    expect(typed(events, "revealedInPlay")).toEqual([]);
    expect(movesOf(events, hunter)).toEqual([]);
    expect(counterOn(state, p1, "hunted")).toBe(0);
    // Nothing found: the text before the "then" did not resolve (RRG 1.8 p. 44).
    expect(counterOn(state, p1, "then")).toBe(0);
    // The encounter deck, where it could have been, was still searched (docs/phase7-wave6.md §4.1 Q77).
    expect(typed(events, "deckShuffled").map((e) => e.zone)).toEqual([encounterDeckZone(state)]);
  });

  it("test 2: facedown as a boost card on the villain: not found; it stays facedown on the villain", () => {
    const start = game();
    const hunter = the(start, HUNTER);
    const at = place(start, hunter, { kind: "boost", hostInstanceId: villainId(start) }, false);
    const { state, events } = play(at, PURSUED.card);
    expect(mustInstance(state, hunter).faceup).toBe(false);
    expect(typed(events, "cardFound")).toEqual([]);
    expect(typed(events, "encounterCardRevealed")).toEqual([]);
    expect(movesOf(events, hunter)).toEqual([]);
    expect(counterOn(state, p1, "hunted")).toBe(0);
    expect(counterOn(state, p1, "then")).toBe(0);
  });

  it("test 3: in the victory display: not found", () => {
    const start = game();
    const hunter = the(start, HUNTER);
    const at = place(start, hunter, { kind: "victoryDisplay" });
    const { state, events } = play(at, PURSUED.card);
    expect(state.victoryDisplay).toContain(hunter);
    expect(typed(events, "cardFound")).toEqual([]);
    expect(typed(events, "encounterCardRevealed")).toEqual([]);
    expect(movesOf(events, hunter)).toEqual([]);
    expect(counterOn(state, p1, "hunted")).toBe(0);
    expect(counterOn(state, p1, "then")).toBe(0);
  });
});

describe("§3.1 tests 4 and 5: a side scheme found and revealed", () => {
  it("test 4: in the encounter discard pile: it enters play with 5 threat and the encounter deck is not shuffled", () => {
    const start = game();
    const hounds = the(start, HOUNDS);
    const at = place(start, hounds, encounterDiscardZone(start));
    const { state, events, before } = play(at, AHAB.card);
    expect(state.villainArea).toContain(hounds);
    expect(mustInstance(state, hounds).threat).toBe(5);
    expect(announced(events, "cardEntersPlay", hounds).length).toBeGreaterThan(0);
    expect(typed(events, "revealedInPlay")).toEqual([]);
    expect(typed(events, "cardFound")).toEqual([
      {
        type: "cardFound",
        instanceId: hounds,
        cardId: HOUNDS.id,
        from: encounterDiscardZone(start),
        alreadyThere: false,
        deckShuffled: false,
      },
    ]);
    expect(typed(events, "deckShuffled")).toEqual([]);
    expect(activeEncounterDeck(state).deck).toEqual(activeEncounterDeck(before).deck);
    expect(counterOn(state, p1, "hounded")).toBe(1);
  });

  it("test 4: in the encounter deck: found, revealed with 5 threat, and the deck is shuffled once", () => {
    const start = game();
    const hounds = the(start, HOUNDS);
    expect(activeEncounterDeck(start).deck).toContain(hounds);
    const { state, events, before } = play(start, AHAB.card);
    expect(state.villainArea).toContain(hounds);
    expect(mustInstance(state, hounds).threat).toBe(5);
    expect(typed(events, "cardFound")).toEqual([
      {
        type: "cardFound",
        instanceId: hounds,
        cardId: HOUNDS.id,
        from: encounterDeckZone(start),
        alreadyThere: false,
        deckShuffled: true,
      },
    ]);
    const shuffles = typed(events, "deckShuffled");
    expect(shuffles.map((e) => e.zone)).toEqual([encounterDeckZone(start)]);
    const rest = activeEncounterDeck(before).deck.filter((id) => id !== hounds);
    expect(activeEncounterDeck(state).deck).toHaveLength(rest.length);
    expect([...activeEncounterDeck(state).deck].sort()).toEqual([...rest].sort());
    expect(counterOn(state, p1, "hounded")).toBe(1);
    expect(revealsOf(events, hounds)).toHaveLength(1);
  });

  it("test 5: in play at 2 threat: 5 threat, by the card's own 'place 3 threat' branch; the find is not reached", () => {
    const start = game();
    const hounds = the(start, HOUNDS);
    const at = schemeInPlay(start, hounds, 2);
    const { state, events } = play(at, AHAB.card);
    expect(mustInstance(state, hounds).threat).toBe(5);
    expect(typed(events, "cardFound")).toEqual([]);
    expect(typed(events, "encounterCardRevealed")).toEqual([]);
    expect(counterOn(state, p1, "hounded")).toBe(0);
  });

  it("found in play at 2 threat and revealed: it stays, gains no starting threat, and its When Revealed resolves", () => {
    const start = game();
    const hounds = the(start, HOUNDS);
    const at = schemeInPlay(start, hounds, 2);
    const { state, events } = play(at, CALL_HOUNDS.card);
    expect(state.villainArea.filter((id) => id === hounds)).toEqual([hounds]);
    expect(mustInstance(state, hounds).threat).toBe(2);
    expect(movesOf(events, hounds)).toEqual([]);
    expect(announced(events, "cardEntersPlay", hounds)).toEqual([]);
    expect(typed(events, "triggerEvent").filter((e) => e.event.kind === "placeThreat")).toEqual([]);
    expect(typed(events, "revealedInPlay")).toEqual([
      { type: "revealedInPlay", instanceId: hounds, cardId: HOUNDS.id, playerId: p1, engaged: false },
    ]);
    expect(counterOn(state, p1, "hounded")).toBe(1);
    expect(typed(events, "deckShuffled")).toEqual([]);
  });

  // Q22: the surge's card is dealt to the finder facedown and is not revealed at once.
  it("a side scheme with surge found in play at 1 threat: 1 threat still, and the finder is dealt 1 more card", () => {
    const start = game();
    const alarm = the(start, ALARM);
    const at = schemeInPlay(start, alarm, 1);
    const { state, events } = play(at, CALL_ALARM.card);
    expect(mustInstance(state, alarm).threat).toBe(1);
    expect(state.villainArea).toContain(alarm);
    expect(typed(events, "surgeTriggered")).toEqual([{ type: "surgeTriggered", instanceId: alarm, playerId: p1 }]);
    const reveals = typed(events, "encounterCardRevealed");
    expect(reveals).toHaveLength(1);
    expect(reveals[0]).toMatchObject({ instanceId: alarm, playerId: p1 });
    const dealt = state.players.find((p) => p.playerId === p1)!.dealtEncounter;
    expect(dealt).toHaveLength(1);
    expect(mustInstance(state, dealt[0]!).faceup).toBe(false);
  });
});

describe("§3.1 an attachment found in play and revealed (ruling June 25, 2026 (5); §4.1 Q17 = A)", () => {
  it("attached to player 2's identity, found by player 1: it stays on player 2; its When Revealed resolves for player 1", () => {
    const start = game();
    const shackle = the(start, SHACKLE);
    const host = identityId(start, p2);
    const at = place(start, shackle, { kind: "attachment", hostInstanceId: host });
    expect(mustInstance(at, shackle).attachedTo).toBe(host);
    const { state, events } = play(at, POLICE.card);
    expect(mustInstance(state, shackle).attachedTo).toBe(host);
    expect(mustInstance(state, host).attachments).toEqual([shackle]);
    expect(mustInstance(state, identityId(state, p1)).attachments).toEqual([]);
    expect(movesOf(events, shackle)).toEqual([]);
    expect(announced(events, "cardEntersPlay", shackle)).toEqual([]);
    expect(activeEncounterDeck(state).discard).not.toContain(shackle);
    expect(typed(events, "revealedInPlay")).toEqual([
      { type: "revealedInPlay", instanceId: shackle, cardId: SHACKLE.id, playerId: p1, engaged: false },
    ]);
    expect(counterOn(state, p1, "shackled")).toBe(1);
    expect(counterOn(state, p2, "shackled")).toBe(0);
  });

  it("an 'attach to the villain' attachment found on a minion: it stays on the minion, not moved to the villain", () => {
    const start = game();
    const cuff = the(start, CUFF);
    const hunter = the(start, HUNTER);
    const at = place(engagedWith(start, hunter, p2), cuff, { kind: "attachment", hostInstanceId: hunter });
    const { state, events } = play(at, CALL_CUFF.card);
    expect(mustInstance(state, cuff).attachedTo).toBe(hunter);
    expect(mustInstance(state, villainId(state)).attachments).toEqual([]);
    expect(mustInstance(state, hunter).engagedWith).toBe(p2);
    expect(movesOf(events, cuff)).toEqual([]);
    expect(announced(events, "cardEntersPlay", cuff)).toEqual([]);
    expect(counterOn(state, p1, "cuffed")).toBe(1);
  });
});

describe("§3.1 regression: the same finds out of play are the ordinary reveal", () => {
  it("a minion in the encounter deck: it enters play engaged with the finder, and the deck is shuffled", () => {
    const start = game();
    const hunter = the(start, HUNTER);
    const { state, events } = play(start, PURSUED.card);
    expect(mustInstance(state, hunter).engagedWith).toBe(p1);
    expect(mustPlayer(state, p1).playArea).toContain(hunter);
    expect(mustInstance(state, hunter).damage).toBe(0);
    expect(announced(events, "cardEntersPlay", hunter).length).toBeGreaterThan(0);
    expect(typed(events, "revealedInPlay")).toEqual([]);
    expect(typed(events, "deckShuffled").map((e) => e.zone)).toEqual([encounterDeckZone(start)]);
    expect(counterOn(state, p1, "hunted")).toBe(1);
    expect(counterOn(state, p1, "then")).toBe(1);
  });

  it("a minion in the encounter discard pile, found by player 2: it enters play engaged with player 2; no shuffle", () => {
    const start = game();
    const hunter = the(start, HUNTER);
    const at = place(start, hunter, encounterDiscardZone(start));
    const { state, events } = play(at, PURSUED.card, p2);
    expect(mustInstance(state, hunter).engagedWith).toBe(p2);
    expect(mustPlayer(state, p2).playArea).toContain(hunter);
    expect(announced(events, "cardEntersPlay", hunter).length).toBeGreaterThan(0);
    expect(typed(events, "deckShuffled")).toEqual([]);
    expect(counterOn(state, p2, "hunted")).toBe(1);
    expect(counterOn(state, p1, "hunted")).toBe(0);
  });

  it("an attachment with no data host in the encounter deck: its When Revealed did not attach it, so it is discarded", () => {
    const start = game();
    const shackle = the(start, SHACKLE);
    const { state } = play(start, POLICE.card);
    expect(activeEncounterDeck(state).discard).toContain(shackle);
    expect(counterOn(state, p1, "shackled")).toBe(1);
  });

  it("an 'attach to the villain' attachment in the encounter deck: it attaches to the villain and enters play", () => {
    const start = game();
    const cuff = the(start, CUFF);
    const { state, events } = play(start, CALL_CUFF.card);
    expect(mustInstance(state, cuff).attachedTo).toBe(villainId(state));
    expect(announced(events, "cardEntersPlay", cuff).length).toBeGreaterThan(0);
    expect(counterOn(state, p1, "cuffed")).toBe(1);
  });
});

describe("§3.1 replay", () => {
  it("the same command list replays deep-equal: a minion found in play, then a side scheme found in play", () => {
    const start = game();
    const hunter = the(start, HUNTER);
    const hounds = the(start, HOUNDS);
    let at = patch(engagedWith(start, hunter, p2), hunter, { damage: 2 });
    at = schemeInPlay(at, hounds, 2);
    const first = giveCard(at, p1, PURSUED.card.id);
    const second = giveCard(first.state, p2, CALL_HOUNDS.card.id);
    const commands = [
      { type: "playCard", playerId: p1, cardInstanceId: first.id, payment: [], attachToInstanceId: null },
      { type: "playCard", playerId: p2, cardInstanceId: second.id, payment: [], attachToInstanceId: null },
    ] as const;
    const once = runCommands(second.state, deps, ...commands);
    const again = runCommands(second.state, deps, ...commands);
    expect(again.state).toEqual(once.state);
    expect(again.events).toEqual(once.events);
    expect(mustInstance(once.state, hunter).engagedWith).toBe(p1);
    expect(mustInstance(once.state, hunter).damage).toBe(2);
    expect(mustInstance(once.state, hounds).threat).toBe(2);
    expect(counterOn(once.state, p2, "hounded")).toBe(1);
    const replayed = replay(once.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(once.state);
  });
});
