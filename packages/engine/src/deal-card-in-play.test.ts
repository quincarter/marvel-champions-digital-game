/**
 * docs/phase7-wave8.md §3.75 (a): `EffectSpec dealAsEncounterCard` takes a card in play, proven with synthetic cards
 * shaped like Brimstone Dimension ("When Defeated: The player who defeated this scheme finds [the fiend] and deals him
 * to themself as a facedown encounter card"; 5 starting threat, a hazard icon) and Azazel (ELITE, quickstrike, SCH 2,
 * ATK 2, 3 hit points).
 *
 * Sources: RRG 1.8 "Deal, Deal an Encounter Card" (p. 15): the card is placed facedown in front of the player and
 * "added to the queue of cards that player resolves during the villain phase"; "Leaves Play" (p. 27): what a card
 * carried is gone when it leaves play; "In Play and Out of Play" (p. 23): "facedown encounter cards dealt to a player
 * are out of play"; "Find" (p. 19): a find reaches a card in play and never the victory display; "Search" (p. 39): a
 * searched deck is shuffled; "Permanent" (p. 32); "'Then'" (p. 44); "Villain Phase" step 4 (p. 47): each player
 * reveals their encounter cards "one card at a time in the order in which they were dealt".
 *
 * Synthetic cards only; the engine never names a card.
 */

import { flat, trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { createCtx, moveCard, updateInstance } from "./ctx.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
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
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;

/** A counter on the main scheme: every mark lands on one card, so the log orders them. */
const markScheme = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType,
  amount: n(1),
});
const whenRevealed = (id: string, counter: string) =>
  stubAbility(id, { trigger: { kind: "whenRevealed" }, effects: [markScheme(counter)] });
const whenDefeated = (id: string, counter: string) =>
  stubAbility(id, { trigger: { kind: "whenDefeated" }, effects: [markScheme(counter)] });

const BRUTE_REVEALED = whenRevealed("brute.when-revealed", "bruteRevealed");
const BRUTE_DEFEATED = whenDefeated("brute.when-defeated", "bruteDefeated");
/** A minion with everything a defeat would show: a When Defeated, Victory 1; and toughness and a When Revealed. */
const BRUTE = stubMinion({
  id: "brute",
  atk: 1,
  sch: 1,
  hp: 6,
  boostIcons: 0,
  keywords: [{ name: "toughness" }, { name: "victory", value: 1 }],
  abilities: [BRUTE_REVEALED.ref, BRUTE_DEFEATED.ref],
});
/** Azazel's shape: ELITE, quickstrike, SCH 2, ATK 2, 3 hit points. */
const FIEND = stubMinion({
  id: "fiend",
  atk: 2,
  sch: 2,
  hp: 3,
  boostIcons: 0,
  traits: [trait("ELITE")],
  keywords: [{ name: "quickstrike" }],
});
/** A permanent minion of its own encounter set: no other set's card can make it leave play (RRG p. 32). */
const WARDEN = stubMinion({
  id: "warden",
  atk: 1,
  sch: 1,
  hp: 4,
  boostIcons: 0,
  encounterSetIds: ["wardens"],
  keywords: [{ name: "permanent" }],
});
/** An encounter attachment on a minion. */
const CUFF = stubAttachment({ id: "cuff", attachesTo: { kind: "minion" } });
/** A player upgrade attached to a minion (Under Control's shape: "Attach to a minion"). */
const LEASH = stubUpgrade({ id: "leash", cost: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** Brimstone Dimension's When Defeated. */
const RIFT_DEFEATED = stubAbility("rift.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    {
      kind: "dealAsEncounterCard",
      cards: { kind: "find", query: { name: FIEND.name } },
      player: { kind: "defeatingPlayer" },
    },
    { kind: "then", effects: [markScheme("riftThen")] },
  ],
});
/** Brimstone Dimension's shape: 5 starting threat, a hazard icon, 3 boost icons. */
const RIFT = stubSideScheme({
  id: "rift",
  startingThreat: 5,
  icons: ["hazard"],
  boostIcons: 3,
  abilities: [RIFT_DEFEATED.ref],
});

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const dealToYou = (name: string): EffectSpec => ({
  kind: "dealAsEncounterCard",
  cards: { kind: "each", query: { name } },
  player: you,
});
/** "Deal the brute to yourself as a facedown encounter card. Then …" */
const SEIZE_BRUTE = actionEvent("seize-brute", [
  dealToYou(BRUTE.name),
  { kind: "then", effects: [markScheme("then")] },
]);
/** The same for the permanent minion, from a card outside its set. */
const SEIZE_WARDEN = actionEvent("seize-warden", [
  dealToYou(WARDEN.name),
  { kind: "then", effects: [markScheme("then")] },
]);
/** "Remove 5 threat from the rift." */
const CLOSE_RIFT = actionEvent("close-rift", [
  { kind: "removeThreat", target: { kind: "named", name: RIFT.name }, amount: n(5) },
]);

const EVENTS = [SEIZE_BRUTE, SEIZE_WARDEN, CLOSE_RIFT];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability), BRUTE_REVEALED, BRUTE_DEFEATED, RIFT_DEFEATED);
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const ENCOUNTER = [BRUTE, FIEND, WARDEN, CUFF, RIFT];
const CARDS = [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, LEASH, ...ENCOUNTER, ...EVENTS.map((e) => e.card)];

/** Two players (10 hit points, ATK 2, DEF 2), a villain with ATK 0 and SCH 0, 12 blank cards in the encounter deck. */
function game(): GameState {
  const identities = seatIdentities(
    stubIdentity({ id: "seeker", hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 }),
    2,
  );
  const config: GameSetupConfig = {
    seed: 31,
    cards: [...CARDS, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: LONG_SCHEME.id,
    encounterDeck: [...Array.from({ length: 12 }, () => BLANK.id as CardId), ...ENCOUNTER.map((card) => card.id)],
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, LEASH.id, ...EVENTS.map((e) => e.card.id as CardId)],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return blanksOnTop(runCommands(result.state, deps).state);
}

/** Surgery: the blank cards on top of the encounter deck, so step three deals blanks whatever the shuffle was. */
function blanksOnTop(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const isBlank = (id: InstanceId) => state.instances[id]?.cardId === BLANK.id;
  const deck = [...piles.deck.filter(isBlank), ...piles.deck.filter((id) => !isBlank(id))];
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck } } };
}

const the = (state: GameState, card: { readonly id: CardId }, owner?: PlayerId): InstanceId =>
  (Object.keys(state.instances) as InstanceId[]).find(
    (id) => state.instances[id]?.cardId === card.id && (owner === undefined || state.instances[id]?.ownerId === owner),
  )!;
const mainSchemeCounter = (state: GameState, counter: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[counter] ?? 0;
const encounterDeckZone = (state: GameState): ZoneId => ({
  kind: "encounterDeck",
  deckId: activeEncounterDeckId(state),
});

/** Test-only state surgery: puts a card somewhere, faceup or facedown. */
function place(state: GameState, id: InstanceId, zone: ZoneId, faceup = true): GameState {
  const ctx = createCtx(state, deps);
  moveCard(ctx, id, zone, "top");
  updateInstance(ctx, id, (i) => ({ ...i, faceup }));
  return ctx.state;
}
const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][InstanceId]>): GameState => {
  const ctx = createCtx(state, deps);
  updateInstance(ctx, id, (i) => ({ ...i, ...change }));
  return ctx.state;
};
/** Surgery: a minion in play engaged with `player`, as if it had been there a while (no reveal, no When Revealed). */
const engagedWith = (state: GameState, id: InstanceId, player: PlayerId): GameState =>
  patch(place(state, id, { kind: "playArea", playerId: player }), id, { engagedWith: player, controllerId: null });

const playCommand = (state: GameState, card: { readonly id: CardId }, player: PlayerId) => {
  const given = giveCard(state, player, card.id);
  const command: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return { state: given.state, command };
};
/** `player` plays the event (cost 0) from hand, then `more`; every choice answered by default. */
function play(state: GameState, card: { readonly id: CardId }, player: PlayerId, ...more: readonly Command[]) {
  const { state: given, command } = playCommand(state, card, player);
  return runCommands(given, deps, command, ...more);
}
const END_ROUND: readonly Command[] = [
  { type: "endTurn", playerId: p1 },
  { type: "endTurn", playerId: p2 },
];

const typed = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const movesOf = (events: readonly GameEvent[], id: InstanceId) =>
  typed(events, "cardMoved")
    .filter((e) => e.instanceId === id)
    .map((e) => ({ from: e.from, to: e.to }));
const defeatsOf = (events: readonly GameEvent[]) =>
  typed(events, "triggerEvent").filter((e) => e.event.kind === "characterDefeated");
function expectReplays(session: ReturnType<typeof runCommands>["session"]): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§3.75 (a): a minion in play dealt to a player as a facedown encounter card", () => {
  /**
   * The brute engaged with p2: 2 damage, a stunned status card, 3 counters, exhausted, an encounter attachment and
   * p2's upgrade attached to it.
   */
  function carrying() {
    const start = game();
    const brute = the(start, BRUTE);
    const cuff = the(start, CUFF);
    const leash = the(start, LEASH, p2);
    let state = engagedWith(start, brute, p2);
    state = patch(state, brute, {
      damage: 2,
      statuses: { stunned: 1, confused: 0, tough: 0 },
      counters: { grudge: 3 },
      exhausted: true,
    });
    state = place(state, cuff, { kind: "attachment", hostInstanceId: brute });
    state = place(state, leash, { kind: "attachment", hostInstanceId: brute });
    return { state, brute, cuff, leash };
  }

  it("leaves play facedown to that player's dealt cards, with nothing it carried", () => {
    const { state: at, brute, cuff, leash } = carrying();
    const { state, events } = play(at, SEIZE_BRUTE.card, p1);

    // Dealt to the player the effect names (p1), not the player it was engaged with (p2): out of play, facedown.
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([brute]);
    expect(mustPlayer(state, p2).playArea).not.toContain(brute);
    expect(mustInstance(state, brute)).toMatchObject({
      faceup: false,
      damage: 0,
      statuses: { stunned: 0, confused: 0, tough: 0 },
      counters: {},
      exhausted: false,
      engagedWith: null,
    });
    // One move, from play to the dealt cards: it was never in a discard pile.
    expect(movesOf(events, brute)).toEqual([
      { from: { kind: "playArea", playerId: p2 }, to: { kind: "dealtEncounter", playerId: p1 } },
    ]);
    expect(typed(events, "cardDiscardedFromPlay").filter((e) => e.instanceId === brute)).toEqual([]);
    // RRG p. 27: its attachments are discarded, the encounter card to the encounter discard pile and the player's
    // upgrade to its owner's.
    expect(activeEncounterDeck(state).discard).toContain(cuff);
    expect(mustPlayer(state, p2).discard).toContain(leash);
    expect(mustInstance(state, cuff).attachedTo).toBeNull();
    expect(mustInstance(state, leash).attachedTo).toBeNull();
    // The deal resolved fully, so the "then" resolves.
    expect(mainSchemeCounter(state, "then")).toBe(1);
    expect(typed(events, "preThenUnresolved")).toEqual([]);
  });

  it("is not defeated: no When Defeated, no victory display, no defeat in the log", () => {
    const { state: at, brute } = carrying();
    const { state, events } = play(at, SEIZE_BRUTE.card, p1);
    expect(mainSchemeCounter(state, "bruteDefeated")).toBe(0);
    expect(state.victoryDisplay).not.toContain(brute);
    expect(defeatsOf(events)).toEqual([]);
  });

  it("is revealed in the next reveal step, before the card step three deals, and enters play as a new card", () => {
    const { state: at, brute } = carrying();
    const { state, events, session } = play(at, SEIZE_BRUTE.card, p1, ...END_ROUND);

    // In the order dealt (RRG p. 47): the brute was dealt in the player phase, before step three's card.
    const p1Reveals = typed(events, "encounterCardRevealed").filter((e) => e.playerId === p1);
    expect(p1Reveals).toHaveLength(2);
    expect(p1Reveals[0]).toMatchObject({ instanceId: brute, cardId: BRUTE.id });
    expect(p1Reveals[1]).toMatchObject({ cardId: BLANK.id });
    // A new card: engaged with the player who revealed it, 6 hit points, its toughness and When Revealed again.
    expect(mustPlayer(state, p1).playArea).toContain(brute);
    expect(mustInstance(state, brute)).toMatchObject({
      faceup: true,
      damage: 0,
      statuses: { stunned: 0, confused: 0, tough: 1 },
      counters: {},
      exhausted: false,
      engagedWith: p1,
    });
    expect(mainSchemeCounter(state, "bruteRevealed")).toBe(1);
    expect(mainSchemeCounter(state, "bruteDefeated")).toBe(0);
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([]);
    expect(defeatsOf(events)).toEqual([]);
    expectReplays(session);
  });

  it("a card that cannot leave play is not dealt, nothing else changes, and the 'then' does not resolve", () => {
    const start = game();
    const warden = the(start, WARDEN);
    const cuff = the(start, CUFF);
    let at = engagedWith(start, warden, p2);
    at = patch(at, warden, { damage: 2, statuses: { stunned: 1, confused: 0, tough: 0 }, counters: { grudge: 3 } });
    at = place(at, cuff, { kind: "attachment", hostInstanceId: warden });
    const { state, events, session } = play(at, SEIZE_WARDEN.card, p1);

    expect(mustPlayer(state, p1).dealtEncounter).toEqual([]);
    expect(mustPlayer(state, p2).playArea).toContain(warden);
    expect(mustInstance(state, warden)).toMatchObject({
      faceup: true,
      damage: 2,
      statuses: { stunned: 1, confused: 0, tough: 0 },
      counters: { grudge: 3 },
      engagedWith: p2,
    });
    expect(mustInstance(state, cuff).attachedTo).toBe(warden);
    expect(movesOf(events, warden)).toEqual([]);
    expect(movesOf(events, cuff)).toEqual([]);
    expect(typed(events, "leavePlayBlocked")).toEqual([
      { type: "leavePlayBlocked", instanceId: warden, reason: "permanent" },
    ]);
    // RRG p. 44: the text before the "then" did not fully resolve.
    expect(typed(events, "preThenUnresolved")).toEqual([
      { type: "preThenUnresolved", cause: "cardNotDealt", instanceId: warden },
    ]);
    expect(typed(events, "thenSkipped")).toHaveLength(1);
    expect(mainSchemeCounter(state, "then")).toBe(0);
    expectReplays(session);
  });
});

describe("§3.75 tests 6 to 8: the rift (5 threat) is defeated and its When Defeated finds the fiend", () => {
  /** The rift in play with 5 threat, and the fiend put by `where`. */
  function rifted(where: (state: GameState, fiend: InstanceId) => GameState) {
    const start = game();
    const rift = the(start, RIFT);
    const fiend = the(start, FIEND);
    const state = where(patch(place(start, rift, { kind: "villainArea" }), rift, { threat: 5 }), fiend);
    return { state, rift, fiend };
  }
  /** The fiend engaged with p2, with 2 damage: 1 hit point left of 3. */
  const fiendWithP2 = (state: GameState, fiend: InstanceId) =>
    patch(engagedWith(state, fiend, p2), fiend, { damage: 2 });

  it("test 6: found in play engaged with player 2 with 2 damage, he is facedown in front of player 1", () => {
    const { state: at, rift, fiend } = rifted(fiendWithP2);
    const { state, events } = play(at, CLOSE_RIFT.card, p1);

    expect(state.villainArea).not.toContain(rift);
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([fiend]);
    expect(mustPlayer(state, p2).playArea).not.toContain(fiend);
    expect(mustInstance(state, fiend)).toMatchObject({ faceup: false, damage: 0, engagedWith: null });
    // Found in the open, so no deck was searched or shuffled; he moves, so he was not "already there".
    expect(typed(events, "cardFound")).toEqual([
      {
        type: "cardFound",
        instanceId: fiend,
        cardId: FIEND.id,
        from: { kind: "playArea", playerId: p2 },
        alreadyThere: false,
        deckShuffled: false,
      },
    ]);
    expect(typed(events, "deckShuffled")).toEqual([]);
    expect(movesOf(events, fiend)).toEqual([
      { from: { kind: "playArea", playerId: p2 }, to: { kind: "dealtEncounter", playerId: p1 } },
    ]);
    expect(mainSchemeCounter(state, "riftThen")).toBe(1);
  });

  it("test 6: he is revealed in the next villain phase with 3 hit points and, against a hero, attacks", () => {
    const { state: at, fiend } = rifted(fiendWithP2);
    const { state, events, session } = play(
      at,
      CLOSE_RIFT.card,
      p1,
      { type: "changeForm", playerId: p1 },
      ...END_ROUND,
    );

    expect(mustPlayer(state, p1).identity.form).toBe("hero");
    expect(mustPlayer(state, p1).playArea).toContain(fiend);
    expect(mustInstance(state, fiend)).toMatchObject({ faceup: true, damage: 0, engagedWith: p1 });
    // Quickstrike: one attack, by the fiend, against player 1, for his ATK of 2 (undefended, no boost icons).
    const attacks = typed(events, "triggerEvent").filter(
      (e) => e.phase === "initiated" && e.event.kind === "enemyAttack" && e.event.enemyInstanceId === fiend,
    );
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.event).toMatchObject({ attackedPlayerId: p1 });
    expect(mustInstance(state, mustPlayer(state, p1).identity.instanceId).damage).toBe(2);
    // The rift left play before step three, so its hazard icon dealt nobody a second card: one reveal each of a
    // step-three card, and the fiend.
    expect(typed(events, "encounterCardRevealed").map((e) => [e.playerId, e.cardId])).toEqual([
      [p1, FIEND.id],
      [p1, BLANK.id],
      [p2, BLANK.id],
    ]);
    expectReplays(session);
  });

  it("found in the encounter deck: he is dealt from it and the deck is shuffled", () => {
    const { state: at, fiend } = rifted((state, id) => place(state, id, encounterDeckZone(state), false));
    const { state, events } = play(at, CLOSE_RIFT.card, p1);
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([fiend]);
    expect(mustInstance(state, fiend).faceup).toBe(false);
    expect(typed(events, "cardFound")).toEqual([expect.objectContaining({ instanceId: fiend, deckShuffled: true })]);
    const shuffles = typed(events, "deckShuffled");
    expect(shuffles.map((e) => e.zone)).toEqual([encounterDeckZone(state)]);
    // Shuffled after he left it.
    expect(shuffles[0]!.order).not.toContain(fiend);
  });

  it("test 7: in the victory display, he is not found and nothing is dealt", () => {
    const { state: at, fiend } = rifted((state, id) => place(state, id, { kind: "victoryDisplay" }));
    const { state, events, session } = play(at, CLOSE_RIFT.card, p1);
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([]);
    expect(mustPlayer(state, p2).dealtEncounter).toEqual([]);
    expect(state.victoryDisplay).toContain(fiend);
    expect(movesOf(events, fiend)).toEqual([]);
    expect(typed(events, "cardFound")).toEqual([]);
    expect(typed(events, "preThenUnresolved")).toEqual([{ type: "preThenUnresolved", cause: "findFoundNothing" }]);
    expect(mainSchemeCounter(state, "riftThen")).toBe(0);
    expectReplays(session);
  });

  it("test 8: no characterDefeated is logged for the fiend dealt from play", () => {
    const { state: at } = rifted(fiendWithP2);
    const { events } = play(at, CLOSE_RIFT.card, p1, { type: "changeForm", playerId: p1 }, ...END_ROUND);
    expect(defeatsOf(events)).toEqual([]);
    // The scheme's own defeat is the only one.
    expect(
      typed(events, "triggerEvent").filter((e) => e.event.kind === "schemeDefeated" && e.phase === "initiated"),
    ).toHaveLength(1);
  });
});
