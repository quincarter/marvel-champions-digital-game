/**
 * docs/phase7-wave8.md §3.75 (b): `EffectSpec passEncounterCard { cards, from, to }` and `PlayerRef nextAfter`, proven
 * with synthetic cards shaped like The Crazy Gang ("Forced Response: After a non-[ELITE] minion schemes against a
 * player, deal that minion to that player as a facedown encounter card. Then, if there is more than 1 player in the
 * game, pass that facedown encounter card to the next player."; 2 starting threat per player, an acceleration icon),
 * Jester (SCH 0, ATK 1, 5 hit points, "When Revealed: You are confused"), Executioner (SCH 0, ATK 2, 4 hit points,
 * "When Revealed: Executioner attacks the friendly character with the fewest remaining hit points"), Azazel (ELITE,
 * SCH 2) and a permanent player upgrade attached to an enemy (Frostbite).
 *
 * Sources: RRG 1.8 "In Player Order" (p. 24): "The phrase 'next player' always refers to the next (clockwise) player
 * in player order"; "Deal, Deal an Encounter Card" (p. 15): a dealt card "is added to the queue of cards that player
 * resolves during the villain phase", and one dealt "during step three or four of the villain phase … is added to the
 * queue of cards that are being dealt and revealed in those same steps"; "Villain Phase" step 4 (p. 47): each player
 * reveals their encounter cards "one card at a time in the order in which they were dealt"; "Confuse, Confused"
 * (p. 13): a confused enemy does not scheme; "Leaves Play" (p. 27); "Permanent" (p. 32); "'Then'" (p. 44).
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
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import { eliminatePlayer } from "./resolve/defeat.js";
import { resolvePlayers } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec, PlayerRef, TargetQuery } from "./spec.js";
import type { GameState, ZoneId } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
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
const p3 = playerId("p3");
const p4 = playerId("p4");
const SEATS = [p1, p2, p3, p4] as const;
const you = { kind: "controller" } as const;
const eventPlayer = { kind: "eventPlayer" } as const;
const eventSource = { kind: "eventSource" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;
const nextAfter = (of: PlayerRef): PlayerRef => ({ kind: "nextAfter", of });

/** The Crazy Gang's Forced Response; ELITE is read when it resolves. */
const GANG_RESPONSE = stubAbility("gang.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "enemyScheme", sourceIs: { categories: ["minion"] } },
  },
  effects: [
    {
      kind: "if",
      condition: { kind: "refMatches", ref: eventSource, query: { not: { trait: trait("ELITE") } } },
      then: [
        { kind: "dealAsEncounterCard", cards: eventSource, player: eventPlayer },
        {
          kind: "then",
          effects: [
            {
              kind: "if",
              condition: {
                kind: "compare",
                left: { kind: "perPlayer", base: 0, perPlayer: 1 },
                op: "atLeast",
                right: n(2),
              },
              then: [{ kind: "passEncounterCard", cards: eventSource, from: eventPlayer, to: nextAfter(eventPlayer) }],
            },
          ],
        },
      ],
    },
  ],
});
/** The Crazy Gang's shape: 2 starting threat per player, an acceleration icon, 2 boost icons. */
const GANG = {
  ...stubSideScheme({
    id: "gang",
    startingThreat: 0,
    icons: ["acceleration"],
    boostIcons: 2,
    abilities: [GANG_RESPONSE.ref],
  }),
  startingThreat: { base: 0, perPlayer: 2 },
};

const JESTER_REVEALED = stubAbility("jester.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "giveStatus", target: { kind: "identityOf", player: you }, status: "confused" }],
});
/** Jester's shape: SCH 0, ATK 1, 5 hit points, "When Revealed: You are confused." */
const JESTER = stubMinion({ id: "jester", atk: 1, sch: 0, hp: 5, boostIcons: 0, abilities: [JESTER_REVEALED.ref] });
const HEADSMAN_REVEALED = stubAbility("headsman.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "enemyAttack",
      enemies: { kind: "self" },
      targetCharacter: {
        kind: "superlative",
        among: { kind: "each", query: { categories: ["identity", "ally"] } },
        order: "lowest",
        measure: { kind: "remainingHp", of: { kind: "slot", slot: "candidate" } },
      },
    },
  ],
});
/** Executioner's shape: SCH 0, ATK 2, 4 hit points, attacks the friendly character with the fewest remaining hit points. */
const HEADSMAN = stubMinion({
  id: "headsman",
  atk: 2,
  sch: 0,
  hp: 4,
  boostIcons: 0,
  abilities: [HEADSMAN_REVEALED.ref],
});
/** Azazel's shape as it matters here: ELITE, SCH 2. */
const FIEND = stubMinion({ id: "fiend", atk: 2, sch: 2, hp: 3, boostIcons: 0, traits: [trait("ELITE")] });
/** A plain minion: SCH 1, ATK 1, 3 hit points. */
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** "When Revealed: Each minion engaged with you schemes." */
const SPUR_REVEALED = stubAbility("spur.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "enemyScheme", enemies: { kind: "each", query: { categories: ["minion"], engagedWithPlayer: you } } },
  ],
});
const SPUR = stubTreachery({ id: "spur", boostIcons: 0, abilities: [SPUR_REVEALED.ref] });
/** A player upgrade attached to a minion (Under Control's shape). */
const LEASH = stubUpgrade({ id: "leash", cost: 0 });
/** A permanent player upgrade attached to an enemy (Frostbite's shape). */
const FROST = stubUpgrade({ id: "frost", cost: 0, keywords: [{ name: "permanent" }] });
/** "Forced Interrupt: When attached enemy leaves play, set this card aside." */
const RIME_LEAVES = stubAbility("rime.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", targetIs: { hostOfSelf: true } } },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "setAside" }],
});
/** A permanent player upgrade that answers its host's leaving, so the leaving waits for an interrupt window. */
const RIME = stubUpgrade({ id: "rime", cost: 0, keywords: [{ name: "permanent" }], abilities: [RIME_LEAVES.ref] });
/** An ally with 3 hit points. */
const SQUIRE = stubAlly({ id: "squire", cost: 0, atk: 1, thw: 1, hp: 3 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const YOUR_THUG: TargetQuery = { name: THUG.name, engagedWithPlayer: you };
/** A counter on the main scheme, so a "then" that resolved can be counted. */
const markScheme = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "each", query: { categories: ["mainScheme"] } },
  counterType,
  amount: n(1),
});
/**
 * "Deal the thug engaged with you to yourself as a facedown encounter card. Then, pass that facedown encounter card to
 * the next player. Then …": the pass with no player count in front of it.
 */
const HANDOFF = actionEvent("handoff", [
  { kind: "chooseTarget", slot: "thug", query: YOUR_THUG, chooser: you },
  { kind: "dealAsEncounterCard", cards: { kind: "slot", slot: "thug" }, player: you },
  {
    kind: "then",
    effects: [
      { kind: "passEncounterCard", cards: { kind: "slot", slot: "thug" }, from: you, to: nextAfter(you) },
      { kind: "then", effects: [markScheme("passed")] },
    ],
  },
]);
/** "Pass the thug engaged with you to the next player": a card in play, never dealt, is not a facedown card to pass. */
const STRAY_PASS = actionEvent("stray-pass", [
  { kind: "chooseTarget", slot: "thug", query: YOUR_THUG, chooser: you },
  { kind: "passEncounterCard", cards: { kind: "slot", slot: "thug" }, from: you, to: nextAfter(you) },
]);
/** "Deal each other player an encounter card." */
const BURDEN = actionEvent("burden", [{ kind: "dealEncounterCard", player: { kind: "others", of: you } }]);

const EVENTS = [HANDOFF, STRAY_PASS, BURDEN];
const deps: EngineDeps = depsOf(
  ...EVENTS.map((e) => e.ability),
  GANG_RESPONSE,
  JESTER_REVEALED,
  HEADSMAN_REVEALED,
  SPUR_REVEALED,
  RIME_LEAVES,
);
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const ENCOUNTER = [GANG, JESTER, HEADSMAN, FIEND, SPUR, THUG, THUG, THUG, THUG];
const CARDS = [
  ...DEFAULT_CARDS,
  QUIET_VILLAIN,
  LONG_SCHEME,
  BLANK,
  LEASH,
  FROST,
  RIME,
  SQUIRE,
  GANG,
  JESTER,
  HEADSMAN,
  FIEND,
  SPUR,
  THUG,
  ...EVENTS.map((e) => e.card),
];

/**
 * `players` seats (10 hit points, in alter-ego form), a villain with ATK 0 and SCH 0, a main scheme with no threat and
 * no acceleration, and 20 blank cards (0 boost icons) on top of the encounter deck.
 */
function game(players: 1 | 2 | 3 | 4): GameState {
  const identities = seatIdentities(
    stubIdentity({ id: "seeker", hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 }),
    players,
  );
  const config: GameSetupConfig = {
    seed: 37,
    cards: [...CARDS, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: LONG_SCHEME.id,
    encounterDeck: [...Array.from({ length: 20 }, () => BLANK.id as CardId), ...ENCOUNTER.map((card) => card.id)],
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, LEASH.id, FROST.id, RIME.id, SQUIRE.id, ...EVENTS.map((e) => e.card.id as CardId)],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return blanksOnTop(runCommands(result.state, deps).state);
}

/** Surgery: the blank cards on top of the encounter deck, so boost cards and step three's cards are blanks. */
function blanksOnTop(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const isBlank = (id: InstanceId) => state.instances[id]?.cardId === BLANK.id;
  const deck = [...piles.deck.filter(isBlank), ...piles.deck.filter((id) => !isBlank(id))];
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck } } };
}

const all = (state: GameState, card: { readonly id: CardId }, owner?: PlayerId): readonly InstanceId[] =>
  (Object.keys(state.instances) as InstanceId[]).filter(
    (id) => state.instances[id]?.cardId === card.id && (owner === undefined || state.instances[id]?.ownerId === owner),
  );
const the = (state: GameState, card: { readonly id: CardId }, owner?: PlayerId): InstanceId =>
  all(state, card, owner)[0]!;
const identityId = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const mainSchemeCounter = (state: GameState, counter: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[counter] ?? 0;

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
/** Surgery: the gang in play with its starting threat, 2 per player. */
function gangInPlay(state: GameState): GameState {
  const gang = the(state, GANG);
  return patch(place(state, gang, { kind: "villainArea" }), gang, { threat: 2 * state.players.length });
}
/** Surgery: `player` in hero form, so enemies attack them instead of scheming. */
const inHeroForm = (state: GameState, player: PlayerId): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === player ? { ...p, identity: { ...p.identity, form: "hero" } } : p)),
});

const endTurns = (players: readonly PlayerId[]): readonly Command[] =>
  players.map((playerId) => ({ type: "endTurn", playerId }) as const);
/** The player phase ends for every seat, so the villain phase runs through to the next round. */
const endRound = (state: GameState): readonly Command[] =>
  endTurns(SEATS.filter((id) => state.players.some((p) => p.playerId === id && !p.eliminated)));
/** `player` plays the event (cost 0) from hand, after `before` and before `after`. */
function play(
  state: GameState,
  card: { readonly id: CardId },
  player: PlayerId,
  before: readonly Command[] = [],
  after: readonly Command[] = [],
) {
  const given = giveCard(state, player, card.id);
  const command: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return runCommands(given.state, deps, ...before, command, ...after);
}

const typed = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const movesOf = (events: readonly GameEvent[], id: InstanceId) =>
  typed(events, "cardMoved")
    .filter((e) => e.instanceId === id)
    .map((e) => ({ from: e.from, to: e.to }));
const revealsBy = (events: readonly GameEvent[], player: PlayerId) =>
  typed(events, "encounterCardRevealed")
    .filter((e) => e.playerId === player)
    .map((e) => e.instanceId);
const defeatsOf = (events: readonly GameEvent[]) =>
  typed(events, "triggerEvent").filter((e) => e.event.kind === "characterDefeated");
/** The scheme activations that began, by enemy. */
const schemesBy = (events: readonly GameEvent[], enemy: InstanceId) =>
  typed(events, "triggerEvent").filter(
    (e) => e.phase === "initiated" && e.event.kind === "enemyScheme" && e.event.enemyInstanceId === enemy,
  );
const dealt = (playerId: PlayerId): ZoneId => ({ kind: "dealtEncounter", playerId });
const inPlayOf = (playerId: PlayerId): ZoneId => ({ kind: "playArea", playerId });
function expectReplays(session: ReturnType<typeof runCommands>["session"]): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§3.75 (b): PlayerRef nextAfter, the next clockwise player still in the game (RRG p. 24)", () => {
  const next = (state: GameState, of: PlayerId) =>
    resolvePlayers(state, nextAfter({ kind: "id", playerId: of }), { bindings: {}, vars: {} } as never);

  it("2, 3 and 4 players: the next seat, and the last seat wraps to the first", () => {
    expect(next(game(2), p1)).toEqual([p2]);
    expect(next(game(2), p2)).toEqual([p1]);
    const three = game(3);
    expect([p1, p2, p3].map((id) => next(three, id))).toEqual([[p2], [p3], [p1]]);
    const four = game(4);
    expect([p1, p2, p3, p4].map((id) => next(four, id))).toEqual([[p2], [p3], [p4], [p1]]);
  });

  it("an eliminated player is passed over", () => {
    const ctx = createCtx(game(3), deps);
    eliminatePlayer(ctx, p2);
    expect(next(ctx.state, p1)).toEqual([p3]);
    expect(next(ctx.state, p3)).toEqual([p1]);
  });

  it("one player: nobody, a player is not their own next player; and nobody after nobody", () => {
    const solo = game(1);
    expect(next(solo, p1)).toEqual([]);
    expect(resolvePlayers(solo, nextAfter({ kind: "scoped" }), { bindings: {}, vars: {} } as never)).toEqual([]);
    // Two seats with one eliminated is a one-player game for this purpose.
    const ctx = createCtx(game(2), deps);
    eliminatePlayer(ctx, p2);
    expect(next(ctx.state, p1)).toEqual([]);
  });
});

describe("§3.75 (b): passEncounterCard, a facedown dealt card passed to the next player", () => {
  /** Every seat engaged with one thug; `seat` (after the seats before it end their turns) plays the handoff. */
  function handoff(players: 2 | 3 | 4, seat: number, wholeRound = false) {
    const start = game(players);
    const thugs = all(start, THUG).slice(0, players);
    let state = start;
    thugs.forEach((thug, index) => (state = engagedWith(state, thug, SEATS[index]!)));
    const giver = SEATS[seat]!;
    const receiver = SEATS[(seat + 1) % players]!;
    const before = endTurns(SEATS.slice(0, seat));
    const after = wholeRound ? endTurns(SEATS.slice(seat, players)) : [];
    const result = play(state, HANDOFF.card, giver, before, after);
    return { ...result, thug: thugs[seat]!, thugs, giver, receiver };
  }

  for (const players of [2, 3, 4] as const) {
    for (let seat = 0; seat < players; seat++) {
      const wraps = seat === players - 1;
      it(`${players} players: player ${seat + 1} passes to player ${((seat + 1) % players) + 1}${wraps ? " (the last seat wraps to the first)" : ""}`, () => {
        const { state, events, session, thug, giver, receiver } = handoff(players, seat);
        // Dealt to the giver from play, then passed: facedown at the back of the receiver's queue, nobody else's.
        expect(movesOf(events, thug)).toEqual([
          { from: inPlayOf(giver), to: dealt(giver) },
          { from: dealt(giver), to: dealt(receiver) },
        ]);
        expect(typed(events, "encounterCardPassed")).toEqual([
          { type: "encounterCardPassed", instanceId: thug, fromPlayerId: giver, toPlayerId: receiver },
        ]);
        for (const id of SEATS.slice(0, players))
          expect(mustPlayer(state, id).dealtEncounter).toEqual(id === receiver ? [thug] : []);
        expect(mustInstance(state, thug)).toMatchObject({ faceup: false, engagedWith: null });
        // The pass resolved fully, so its own "then" resolves.
        expect(mainSchemeCounter(state, "passed")).toBe(1);
        expect(typed(events, "preThenUnresolved")).toEqual([]);
        expect(defeatsOf(events)).toEqual([]);
        expectReplays(session);
      });
    }

    it(`${players} players: the last seat's card is revealed by the first player in the next villain phase, before their step-three card`, () => {
      const { state, events, session, thug, thugs } = handoff(players, players - 1, true);
      const reveals = revealsBy(events, p1);
      expect(reveals).toHaveLength(2);
      expect(reveals[0]).toBe(thug);
      expect(mustInstance(state, reveals[1]!).cardId).toBe(BLANK.id);
      // A new card in play, engaged with the player who revealed it; player 1 keeps their own thug as well.
      expect(mustInstance(state, thug)).toMatchObject({ faceup: true, damage: 0, engagedWith: p1 });
      expect(mustInstance(state, thugs[0]!)).toMatchObject({ engagedWith: p1 });
      expect(mustPlayer(state, p1).dealtEncounter).toEqual([]);
      // Step two: every seat is in alter-ego form, so each thug still in play schemed for 1: one fewer than the seats.
      expect(mainThreat(state)).toBe(players - 1);
      expectReplays(session);
    });
  }

  it("3 players with player 2 eliminated: player 1 passes to player 3, and player 3 back to player 1", () => {
    const start = game(3);
    const [thugA, thugC] = all(start, THUG) as [InstanceId, InstanceId, ...InstanceId[]];
    const ctx = createCtx(engagedWith(engagedWith(start, thugA, p1), thugC, p3), deps);
    eliminatePlayer(ctx, p2);

    const first = play(ctx.state, HANDOFF.card, p1);
    expect(typed(first.events, "encounterCardPassed")).toEqual([
      { type: "encounterCardPassed", instanceId: thugA, fromPlayerId: p1, toPlayerId: p3 },
    ]);
    expect(mustPlayer(first.state, p3).dealtEncounter).toEqual([thugA]);
    expect(mustPlayer(first.state, p2).dealtEncounter).toEqual([]);

    const second = play(ctx.state, HANDOFF.card, p3, endTurns([p1]));
    expect(typed(second.events, "encounterCardPassed")).toEqual([
      { type: "encounterCardPassed", instanceId: thugC, fromPlayerId: p3, toPlayerId: p1 },
    ]);
    expect(mustPlayer(second.state, p1).dealtEncounter).toEqual([thugC]);
    expectReplays(first.session);
    expectReplays(second.session);
  });

  it("one player: there is no next player, the card stays in front of the player and the 'then' does not resolve", () => {
    const start = game(1);
    const thug = the(start, THUG);
    const { state, events, session } = play(engagedWith(start, thug, p1), HANDOFF.card, p1);
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([thug]);
    expect(mustInstance(state, thug).faceup).toBe(false);
    expect(movesOf(events, thug)).toEqual([{ from: inPlayOf(p1), to: dealt(p1) }]);
    expect(typed(events, "encounterCardPassed")).toEqual([]);
    expect(typed(events, "preThenUnresolved")).toEqual([
      { type: "preThenUnresolved", cause: "cardNotPassed", instanceId: thug },
    ]);
    expect(mainSchemeCounter(state, "passed")).toBe(0);
    expectReplays(session);
  });

  it("the passed card is revealed after the cards its holder already had and before the ones dealt after it", () => {
    const start = game(2);
    const thug = the(start, THUG);
    // Player 1 deals player 2 an encounter card, then passes the thug: player 2 holds [that card, the thug].
    const burdened = play(engagedWith(start, thug, p1), BURDEN.card, p1);
    const [earlier] = mustPlayer(burdened.state, p2).dealtEncounter as [InstanceId];
    const { state, events, session } = play(burdened.state, HANDOFF.card, p1, [], endTurns([p1, p2]));
    const reveals = revealsBy(events, p2);
    expect(reveals).toHaveLength(3);
    expect(reveals.slice(0, 2)).toEqual([earlier, thug]);
    // The third is the card step three dealt.
    expect(reveals[2]).not.toBe(earlier);
    expect(mustInstance(state, reveals[2]!).cardId).toBe(BLANK.id);
    expect(mustInstance(state, thug)).toMatchObject({ faceup: true, engagedWith: p2 });
    // Player 1 revealed only their own step-three card.
    expect(revealsBy(events, p1)).toHaveLength(1);
    expectReplays(session);
  });

  it("a card that is not facedown in front of the passing player is not passed", () => {
    const start = game(2);
    const [mine, theirs] = all(start, THUG) as [InstanceId, InstanceId, ...InstanceId[]];
    // The thug player 1 names is in play, engaged with them: it was never dealt, so it is not a facedown card to
    // pass. Another thug, facedown in front of player 2, is not named and stays where it is.
    const at = place(engagedWith(start, mine, p1), theirs, dealt(p2), false);
    const { state, events } = play(at, STRAY_PASS.card, p1);
    expect(typed(events, "encounterCardPassed")).toEqual([]);
    expect(movesOf(events, theirs)).toEqual([]);
    expect(movesOf(events, mine)).toEqual([]);
    expect(mustPlayer(state, p2).dealtEncounter).toEqual([theirs]);
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([]);
    expect(typed(events, "preThenUnresolved")).toEqual([
      { type: "preThenUnresolved", cause: "cardNotPassed", instanceId: mine },
    ]);
  });
});

describe("§3.75 tests 1 to 5: the gang in play and a minion schemes in step two", () => {
  it("test 1: solo, Jester (SCH 0, 2 damage, a player upgrade attached) is dealt to the player and revealed in step four", () => {
    const start = gangInPlay(game(1));
    const jester = the(start, JESTER);
    const leash = the(start, LEASH, p1);
    let at = patch(engagedWith(start, jester, p1), jester, { damage: 2 });
    at = place(at, leash, { kind: "attachment", hostInstanceId: jester });
    expect(mustInstance(at, the(at, GANG)).threat).toBe(2);
    const { state, events, session } = runCommands(at, deps, ...endRound(at));

    // Step two: he schemed once, for 0; he left play for the player's dealt cards and was not passed.
    expect(schemesBy(events, jester)).toHaveLength(1);
    expect(movesOf(events, jester)).toEqual([
      { from: inPlayOf(p1), to: dealt(p1) },
      { from: dealt(p1), to: inPlayOf(p1) },
    ]);
    expect(typed(events, "encounterCardPassed")).toEqual([]);
    expect(typed(events, "preThenUnresolved")).toEqual([]);
    // The upgrade he carried is in its owner's discard pile.
    expect(mustPlayer(state, p1).discard).toContain(leash);
    // The main scheme holds the gang's acceleration icon (1, step one) and nothing from Jester or the villain (SCH 0).
    expect(mainThreat(state)).toBe(1);
    expect(mustInstance(state, the(state, GANG)).threat).toBe(2);
    // Step four, in the order dealt (RRG p. 47): Jester, dealt in step two, then the card step three dealt.
    const reveals = revealsBy(events, p1);
    expect(reveals).toHaveLength(2);
    expect(reveals[0]).toBe(jester);
    expect(mustInstance(state, reveals[1]!).cardId).toBe(BLANK.id);
    // He enters play as a new card: 5 hit points, and his When Revealed confuses the player.
    expect(mustInstance(state, jester)).toMatchObject({ faceup: true, damage: 0, engagedWith: p1 });
    expect(mustInstance(state, identityId(state, p1)).statuses.confused).toBe(1);
    expect(defeatsOf(events)).toEqual([]);
    expectReplays(session);
  });

  it("test 2: two players, the minion that schemed against player 1 is revealed by player 2 and attacks their weakest character", () => {
    const start = gangInPlay(game(2));
    const headsman = the(start, HEADSMAN);
    const squire = the(start, SQUIRE, p2);
    let at = engagedWith(start, headsman, p1);
    at = patch(place(at, squire, { kind: "playArea", playerId: p2 }), squire, { controllerId: p2 });
    expect(mustInstance(at, the(at, GANG)).threat).toBe(4);
    const { state, events, session } = runCommands(at, deps, ...endRound(at));

    expect(schemesBy(events, headsman)).toHaveLength(1);
    expect(movesOf(events, headsman)).toEqual([
      { from: inPlayOf(p1), to: dealt(p1) },
      { from: dealt(p1), to: dealt(p2) },
      { from: dealt(p2), to: inPlayOf(p2) },
    ]);
    expect(typed(events, "encounterCardPassed")).toEqual([
      { type: "encounterCardPassed", instanceId: headsman, fromPlayerId: p1, toPlayerId: p2 },
    ]);
    // Step four: player 1 reveals only their step-three card; player 2 reveals the passed card first, then theirs.
    expect(revealsBy(events, p1)).toHaveLength(1);
    const reveals = revealsBy(events, p2);
    expect(reveals).toHaveLength(2);
    expect(reveals[0]).toBe(headsman);
    expect(mustInstance(state, headsman)).toMatchObject({ faceup: true, damage: 0, engagedWith: p2 });
    // His When Revealed: one attack, ATK 2, on the friendly character with the fewest remaining hit points, the ally
    // with 3 (the identities have 10): 2 damage on it and none on either identity.
    const attacks = typed(events, "triggerEvent").filter(
      (e) => e.phase === "initiated" && e.event.kind === "enemyAttack" && e.event.enemyInstanceId === headsman,
    );
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.event).toMatchObject({ targetInstanceId: squire, attackedPlayerId: p2 });
    expect(mustInstance(state, squire).damage).toBe(2);
    expect(mustInstance(state, identityId(state, p1)).damage).toBe(0);
    expect(mustInstance(state, identityId(state, p2)).damage).toBe(0);
    // The gang's acceleration icon only: the minion and the villain schemed for 0.
    expect(mainThreat(state)).toBe(1);
    expect(defeatsOf(events)).toEqual([]);
    expectReplays(session);
  });

  it("test 3: a confused minion does not scheme: the confused card is discarded and it stays in play", () => {
    const start = gangInPlay(game(2));
    const thug = the(start, THUG);
    const at = patch(engagedWith(start, thug, p1), thug, { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const { state, events, session } = runCommands(at, deps, ...endRound(at));

    expect(schemesBy(events, thug)).toEqual([]);
    expect(movesOf(events, thug)).toEqual([]);
    expect(typed(events, "encounterCardPassed")).toEqual([]);
    expect(mustInstance(state, thug)).toMatchObject({
      faceup: true,
      engagedWith: p1,
      statuses: { stunned: 0, confused: 0, tough: 0 },
    });
    expect(mustPlayer(state, p1).playArea).toContain(thug);
    // No threat from him (SCH 1 unspent): the acceleration icon only.
    expect(mainThreat(state)).toBe(1);
    expectReplays(session);
  });

  it("test 4: an ELITE minion (SCH 2) schemes for 2 and stays in play", () => {
    const start = gangInPlay(game(2));
    const fiend = the(start, FIEND);
    const at = engagedWith(start, fiend, p1);
    const { state, events, session } = runCommands(at, deps, ...endRound(at));

    expect(schemesBy(events, fiend)).toHaveLength(1);
    expect(movesOf(events, fiend)).toEqual([]);
    expect(typed(events, "encounterCardPassed")).toEqual([]);
    expect(mustInstance(state, fiend)).toMatchObject({ faceup: true, engagedWith: p1 });
    // 1 from the acceleration icon and 2 from his scheme.
    expect(mainThreat(state)).toBe(3);
    expectReplays(session);
  });

  it("test 5: a permanent player upgrade on the minion is unattached, not discarded, and the minion is dealt and passed", () => {
    const start = gangInPlay(game(2));
    const thug = the(start, THUG);
    const frost = the(start, FROST, p2);
    const at = place(engagedWith(start, thug, p1), frost, { kind: "attachment", hostInstanceId: thug });
    const { state, events, session } = runCommands(at, deps, ...endRound(at));

    expect(schemesBy(events, thug)).toHaveLength(1);
    expect(typed(events, "encounterCardPassed")).toEqual([
      { type: "encounterCardPassed", instanceId: thug, fromPlayerId: p1, toPlayerId: p2 },
    ]);
    // RRG p. 32: the permanent copy does not leave play with its host. It is unattached in its owner's play area.
    expect(mustInstance(state, frost).attachedTo).toBeNull();
    expect(mustPlayer(state, p2).playArea).toContain(frost);
    expect(mustPlayer(state, p2).discard).not.toContain(frost);
    expect(movesOf(events, frost)).toEqual([{ from: { kind: "attachment", hostInstanceId: thug }, to: inPlayOf(p2) }]);
    // The thug, revealed by player 2 in step four, is a new card with nothing attached.
    expect(mustInstance(state, thug)).toMatchObject({ faceup: true, engagedWith: p2 });
    expect(state.instances[frost]!.attachedTo).toBeNull();
    // 1 from the acceleration icon and 1 from his scheme.
    expect(mainThreat(state)).toBe(2);
    expect(defeatsOf(events)).toEqual([]);
    expectReplays(session);
  });
});

describe("§3.75 test 5: an upgrade's own ability answers its host leaving play to be dealt", () => {
  it("the leaving waits for the interrupt, the copy is set aside, and the minion is then dealt and passed", () => {
    const start = gangInPlay(game(2));
    const thug = the(start, THUG);
    const rime = the(start, RIME, p2);
    const at = place(engagedWith(start, thug, p1), rime, { kind: "attachment", hostInstanceId: thug });
    const { state, events, session } = runCommands(at, deps, ...endRound(at));

    expect(mustPlayer(state, p2).setAside).toContain(rime);
    expect(mustInstance(state, rime).attachedTo).toBeNull();
    // The copy left first, in the interrupt window; then the thug's two moves, and its reveal by player 2.
    const moves = typed(events, "cardMoved").filter((e) => e.instanceId === rime || e.instanceId === thug);
    expect(moves.map((e) => [e.instanceId, e.to])).toEqual([
      [rime, { kind: "setAside", playerId: p2 }],
      [thug, dealt(p1)],
      [thug, dealt(p2)],
      [thug, inPlayOf(p2)],
    ]);
    expect(typed(events, "encounterCardPassed")).toEqual([
      { type: "encounterCardPassed", instanceId: thug, fromPlayerId: p1, toPlayerId: p2 },
    ]);
    expect(typed(events, "preThenUnresolved")).toEqual([]);
    expect(mustInstance(state, thug)).toMatchObject({ faceup: true, engagedWith: p2 });
    expect(defeatsOf(events)).toEqual([]);
    expectReplays(session);
  });
});

describe("§3.75 (b): a card passed during step four", () => {
  /**
   * Both players in hero form, so nobody schemes in step two. A thug is engaged with `spurred`, who holds a facedown
   * card that makes it scheme when revealed; the gang then deals it to them and passes it to the other player.
   */
  function spurred(holder: PlayerId) {
    const start = gangInPlay(game(2));
    const thug = the(start, THUG);
    const spur = the(start, SPUR);
    let at = inHeroForm(inHeroForm(start, p1), p2);
    at = place(engagedWith(at, thug, holder), spur, dealt(holder), false);
    return { ...runCommands(at, deps, ...endRound(at)), thug, spur };
  }

  it("to a player who has not revealed yet: they reveal it in the same step four", () => {
    const { state, events, session, thug, spur } = spurred(p1);
    expect(typed(events, "encounterCardPassed")).toEqual([
      { type: "encounterCardPassed", instanceId: thug, fromPlayerId: p1, toPlayerId: p2 },
    ]);
    expect(revealsBy(events, p1)[0]).toBe(spur);
    // Player 2's step-three card was dealt before the pass, so it is revealed first.
    const reveals = revealsBy(events, p2);
    expect(reveals).toHaveLength(2);
    expect(reveals[1]).toBe(thug);
    expect(mustInstance(state, thug)).toMatchObject({ faceup: true, engagedWith: p2 });
    expectReplays(session);
  });

  it("to a player who has finished revealing: step four goes around again and they reveal it (RRG p. 47)", () => {
    const { state, events, session, thug, spur } = spurred(p2);
    expect(typed(events, "encounterCardPassed")).toEqual([
      { type: "encounterCardPassed", instanceId: thug, fromPlayerId: p2, toPlayerId: p1 },
    ]);
    // Player 1 had revealed their step-three card before player 2's card made the thug scheme.
    const order = typed(events, "encounterCardRevealed").map((e) => [e.playerId, e.instanceId]);
    expect(order).toHaveLength(4);
    expect(order[0]![0]).toBe(p1);
    expect(order[1]).toEqual([p2, spur]);
    expect(order[2]![0]).toBe(p2);
    expect(order[3]).toEqual([p1, thug]);
    // "Until no dealt encounter cards remain": nothing waits for the next villain phase.
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([]);
    expect(mustPlayer(state, p2).dealtEncounter).toEqual([]);
    expect(mustInstance(state, thug)).toMatchObject({ faceup: true, engagedWith: p1 });
    expect(state.round).toBe(2);
    expectReplays(session);
  });
});
