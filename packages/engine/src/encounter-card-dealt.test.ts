/**
 * `TriggerEvent encounterCardDealt` (docs/phase7-wave9.md §3.12): "Response: After a player is dealt an encounter
 * card, …". One event per facedown encounter card dealt, carrying the player and what dealt it, recorded only when an
 * ability in the registry listens and announced between frames, so the cards one step or one effect dealt share one
 * response window (RRG 1.8 "Triggering Condition", p. 45).
 *
 * Sources: RRG 1.8 "Deal, Deal an Encounter Card" (p. 15); "Villain Phase" (p. 47) step three: "Deal one encounter
 * card to each player. Deal one additional card for each hazard icon on a card in play. These additional cards are
 * dealt in player order."; "Player Deck" (p. 33): a player whose deck ran out "deals themself one facedown encounter
 * card".
 *
 * The surge keyword's card is a deal too (the owner's decision, docs/phase7-wave9.md §4.1 Q19 = B): RRG 1.8 "Surge"
 * (p. 42), "the player resolving the card deals themself a facedown encounter card from the top of the encounter deck",
 * the keyword being "equivalent to … 'When Revealed: Deal yourself 1 facedown encounter card.'" (ruling August 3, 2026,
 * Ruling 3, treats it as a When Revealed ability). Its event carries `source: "surge"` and its window opens once the
 * card is dealt, in or out of the villain phase, once per surge of a chain. The card is then a dealt card like any
 * other, revealed by step four (§4.1 Q22 = B; `surge-deals-facedown.test.ts`); a card swapped into its place in that
 * window is the card step four reveals there.
 *
 * Not a deal: "reveal the top card of the encounter deck" (`EffectSpec revealEncounterCard`; RRG 1.8 "Reveal", p. 38:
 * "If a player is instructed by card text to reveal an encounter card from the encounter deck or any other game area,
 * this same resolution procedure applies", with no card dealt).
 *
 * Synthetic cards only: a witness that counts each deal it hears, and the things that deal.
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { defaultPick } from "./testing/scenario.js";
import { stubEvent, stubMinion, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;

const WITNESS_ID = "witness.response";
/** "Forced Response: After a player is dealt an encounter card, place 1 dealt counter here." */
const WITNESS_RESPONSE = stubAbility(WITNESS_ID, {
  trigger: { kind: "response", forced: true, on: { on: "encounterCardDealt" } },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "dealt", amount: n(1) }],
});
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_RESPONSE.ref] });
/** A side scheme printing a hazard icon. */
const LOOKOUT = stubSideScheme({ id: "lookout", startingThreat: 3, icons: ["hazard"], boostIcons: 0 });
/** "Surge." */
const RUSH = stubTreachery({ id: "rush", boostIcons: 0, keywords: [{ name: "surge" }] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[], cost?: AbilityCost) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...(cost ? { cost } : {}) });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "Deal yourself 1 facedown encounter card."
const DEAL = event("deal", [{ kind: "dealEncounterCard", player: you }]);
// "Deal each player 2 facedown encounter cards."
const DEAL_ALL = event("deal-all", [{ kind: "dealEncounterCard", player: { kind: "each" }, count: n(2) }]);
// "Deal yourself 1 facedown encounter card → draw 1 card."
const PAY = event("pay", [{ kind: "draw", player: you, amount: n(1) }], { dealEncounterCards: 1 });
// "Deal the Grunt to yourself as a facedown encounter card."
const TAKE_GRUNT = event("take-grunt", [
  { kind: "dealAsEncounterCard", cards: { kind: "each", query: { name: "grunt" } }, player: you },
]);
// "Draw 1 card."
const DRAW = event("draw", [{ kind: "draw", player: you, amount: n(1) }]);
// "Reveal the top card of the encounter deck."
const REVEAL_TOP = event("reveal-top", [{ kind: "revealEncounterCard", player: you }]);
const EVENTS = [DEAL, DEAL_ALL, PAY, TAKE_GRUNT, DRAW, REVEAL_TOP];

const SWAPPER_ID = "swapper.response";
/**
 * "Forced Response: After a surge deals a player an encounter card, look at each encounter card dealt to each player
 * and the top card of the encounter deck. You may swap any number of those cards."
 */
const SWAPPER_RESPONSE = stubAbility(SWAPPER_ID, {
  trigger: { kind: "response", forced: true, on: { on: "encounterCardDealt", eventIs: { source: "surge" } } },
  effects: [
    {
      kind: "lookAt",
      cards: {
        kind: "anyOf",
        of: [
          { kind: "dealtEncounter", player: { kind: "each" } },
          { kind: "encounter", zones: ["deck"], top: n(1) },
        ],
      },
      viewer: you,
      rearrange: true,
      bind: "seen",
    },
  ],
});
const SWAPPER = stubSupport({ id: "swapper", cost: 0, abilities: [SWAPPER_RESPONSE.ref] });

const HEARD: EngineDeps = depsOf(WITNESS_RESPONSE, ...EVENTS.map((e) => e.ability));
/** The same registry without the listener. */
const UNHEARD: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
/** A registry whose only listener is the swapper. */
const SWAPPING: EngineDeps = depsOf(SWAPPER_RESPONSE, ...EVENTS.map((e) => e.ability));

function start(deps: EngineDeps, players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: [WITNESS, SWAPPER, LOOKOUT, RUSH, GRUNT, FILLER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [WITNESS.id, SWAPPER.id, ...EVENTS.map((e) => e.card.id)],
    encounter: [...copiesOf(FILLER.id, 26), LOOKOUT.id, RUSH.id, RUSH.id, GRUNT.id],
  });
}

/** A game with P1's witness in play. */
function table(players: 1 | 2 = 1): { readonly state: GameState; readonly witness: InstanceId } {
  const witness = playerCardIntoPlay(start(HEARD, players), WITNESS.id);
  return { state: witness.state, witness: witness.id };
}

/** Every player ends their turn: the villain phase runs through to the next round. */
const playRound = (state: GameState, deps: EngineDeps) =>
  runCommands(state, deps, ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })));

/** Each `encounterCardDealt` announced, in order: the player and the source. (An announcement is logged once, as resolved.) */
const deals = (events: readonly GameEvent[]): readonly (readonly [PlayerId, string])[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "encounterCardDealt"
      ? [[e.event.playerId, e.event.source] as const]
      : [],
  );
/** The response windows opened for a deal. */
const windows = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "windowOpened" && e.event.kind === "encounterCardDealt").length;
const counted = (state: GameState, witness: InstanceId) => mustInstance(state, witness).counters.dealt ?? 0;
const moved = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter").length;
function expectReplays(session: GameSession, deps: EngineDeps) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("encounterCardDealt: after a player is dealt an encounter card", () => {
  it("solo, step three: 1 card, 1 event, 1 window", () => {
    const t = table();
    const { state, events, session } = playRound(t.state, HEARD);
    expect(deals(events)).toEqual([[P1, "villainPhase"]]);
    expect(windows(events)).toBe(1);
    expect(counted(state, t.witness)).toBe(1);
    expect(state.pendingEncounterDealt).toBeUndefined();
    expectReplays(session, HEARD);
  });

  it("two players, step three: 1 event per player in player order, sharing 1 window", () => {
    const t = table(2);
    const { state, events, session } = playRound(t.state, HEARD);
    expect(deals(events)).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
    ]);
    expect(windows(events)).toBe(1);
    expect(counted(state, t.witness)).toBe(2);
    expectReplays(session, HEARD);
  });

  it("the window opens after every card of the step is dealt and before any is revealed", () => {
    const t = table(2);
    const { events } = playRound(t.state, HEARD);
    const at = (match: (e: GameEvent) => boolean) => events.findIndex(match);
    const lastDeal = events.findLastIndex((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter");
    const window = at((e) => e.type === "windowOpened" && e.event.kind === "encounterCardDealt");
    const firstReveal = at((e) => e.type === "encounterCardRevealed");
    expect(lastDeal).toBeGreaterThan(-1);
    expect(window).toBeGreaterThan(lastDeal);
    expect(firstReveal).toBeGreaterThan(window);
  });

  it("a hazard icon in play: the additional card is its own event, in the same window", () => {
    const t = table(2);
    const lookout = encounterCardInVillainArea(t.state, LOOKOUT.id, 3);
    const { state, events } = playRound(lookout.state, HEARD);
    expect(deals(events)).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
      [P1, "hazard"],
    ]);
    expect(windows(events)).toBe(1);
    expect(counted(state, t.witness)).toBe(3);
  });

  it("a card effect's deal in the player phase: 1 event at once, and step three's is another", () => {
    const t = table();
    const played = playFree(t.state, HEARD, DEAL.card.id);
    expect(deals(played.events)).toEqual([[P1, "ability"]]);
    expect(windows(played.events)).toBe(1);
    expect(counted(played.state, t.witness)).toBe(1);
    expect(mustPlayer(played.state, P1).dealtEncounter).toHaveLength(1);

    const round = playRound(played.state, HEARD);
    expect(deals(round.events)).toEqual([[P1, "villainPhase"]]);
    expect(counted(round.state, t.witness)).toBe(2);
  });

  it("one effect dealing 2 cards to each of 2 players: 4 events, 1 window", () => {
    const t = table(2);
    const { state, events, session } = playFree(t.state, HEARD, DEAL_ALL.card.id);
    expect(deals(events).map(([, source]) => source)).toEqual(["ability", "ability", "ability", "ability"]);
    expect(
      deals(events)
        .map(([player]) => player)
        .sort(),
    ).toEqual([P1, P1, P2, P2]);
    expect(windows(events)).toBe(1);
    expect(counted(state, t.witness)).toBe(4);
    expectReplays(session, HEARD);
  });

  it("a deal paid as a cost is a deal", () => {
    const t = table();
    const { state, events } = playFree(t.state, HEARD, PAY.card.id);
    expect(deals(events)).toEqual([[P1, "ability"]]);
    expect(counted(state, t.witness)).toBe(1);
  });

  it("a card in play dealt to a player as a facedown encounter card is a deal", () => {
    const t = table();
    const grunt = minionEngagedWith(t.state, GRUNT.id);
    const { state, events } = playFree(grunt.state, HEARD, TAKE_GRUNT.card.id);
    expect(deals(events)).toEqual([[P1, "ability"]]);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([grunt.id]);
    expect(counted(state, t.witness)).toBe(1);
  });

  it("a player deck that runs out deals its player a card: 1 event", () => {
    const t = table();
    // Surgery: 1 card left in P1's deck, the rest in the discard pile, so drawing it resets the deck.
    const seat = mustPlayer(t.state, P1);
    const [last, ...rest] = seat.deck;
    const thin: GameState = {
      ...t.state,
      players: t.state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [last!], discard: [...p.discard, ...rest] } : p,
      ),
    };
    const { state, events } = playFree(thin, HEARD, DRAW.card.id);
    expect(events.some((e) => e.type === "playerDeckReset" && e.playerId === P1)).toBe(true);
    expect(deals(events)).toEqual([[P1, "deckReset"]]);
    expect(counted(state, t.witness)).toBe(1);
  });

  /** The encounter deck with a card of each of `codes` on top, the first of them topmost (test surgery). */
  const stacked = (state: GameState, ...codes: readonly string[]): GameState => {
    const [deckId, piles] = Object.entries(state.encounterDecks)[0]!;
    const rest = [...piles.deck];
    const top = codes.map((code) => {
      const at = rest.findIndex((id) => mustInstance(state, id).cardId === code);
      if (at < 0) throw new Error(`no ${code} left in the encounter deck`);
      return rest.splice(at, 1)[0]!;
    });
    return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: [...top, ...rest] } } };
  };
  const revealed = (events: readonly GameEvent[]) =>
    events.flatMap((e) => (e.type === "encounterCardRevealed" ? [e.cardId as string] : []));
  /** The log index of each `type` event about a deal: the cards reaching a player's dealt cards, the windows, the reveals. */
  const indexes = (events: readonly GameEvent[], match: (e: GameEvent) => boolean) =>
    events.flatMap((e, index) => (match(e) ? [index] : []));
  const dealMoves = (events: readonly GameEvent[]) =>
    indexes(events, (e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter");
  const dealWindows = (events: readonly GameEvent[]) =>
    indexes(events, (e) => e.type === "windowOpened" && e.event.kind === "encounterCardDealt");
  const reveals = (events: readonly GameEvent[]) => indexes(events, (e) => e.type === "encounterCardRevealed");

  it("1 surge in step four: 1 more event and 1 more window, after the surge card is dealt and before it is revealed", () => {
    const t = table();
    // A filler on top for the villain's boost card, then the surge card for step three, then the card it deals.
    const { state, events, session } = playRound(stacked(t.state, FILLER.id, RUSH.id, FILLER.id), HEARD);
    expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
    expect(moved(events)).toBe(2);
    expect(deals(events)).toEqual([
      [P1, "villainPhase"],
      [P1, "surge"],
    ]);
    expect(windows(events)).toBe(2);
    expect(counted(state, t.witness)).toBe(2);
    expect(revealed(events)).toEqual([RUSH.id, FILLER.id]);
    // Step three's card, its window, the surging card's reveal; then the surge's card, its window, its reveal.
    const [, surgeDeal] = dealMoves(events) as [number, number];
    const [, surgeWindow] = dealWindows(events) as [number, number];
    const [surging, surgeReveal] = reveals(events) as [number, number];
    expect(surgeDeal).toBeGreaterThan(surging);
    expect(surgeWindow).toBeGreaterThan(surgeDeal);
    expect(surgeReveal).toBeGreaterThan(surgeWindow);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([]);
    expect(state.pendingEncounterDealt).toBeUndefined();
    expectReplays(session, HEARD);
  });

  it("a chain of 2 surges: 2 more events and 2 more windows, each between its card's deal and its reveal", () => {
    const t = table();
    const { state, events, session } = playRound(stacked(t.state, FILLER.id, RUSH.id, RUSH.id, FILLER.id), HEARD);
    expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(2);
    expect(moved(events)).toBe(3);
    expect(deals(events)).toEqual([
      [P1, "villainPhase"],
      [P1, "surge"],
      [P1, "surge"],
    ]);
    expect(windows(events)).toBe(3);
    expect(counted(state, t.witness)).toBe(3);
    expect(revealed(events)).toEqual([RUSH.id, RUSH.id, FILLER.id]);
    const moves = dealMoves(events);
    const opened = dealWindows(events);
    const turned = reveals(events);
    for (const i of [0, 1, 2]) {
      expect(opened[i]).toBeGreaterThan(moves[i]!);
      expect(turned[i]).toBeGreaterThan(opened[i]!);
      if (i > 0) expect(moves[i]).toBeGreaterThan(turned[i - 1]!);
    }
    expectReplays(session, HEARD);
  });

  // Q22: the surge's card is not revealed in the player phase; it waits facedown for the next step four.
  it("a surging card revealed in the player phase: the reveal is not a deal, the surge's card is (1 event, 1 window), and it waits facedown", () => {
    const t = table();
    const { state, events, session } = playFree(stacked(t.state, RUSH.id, FILLER.id), HEARD, REVEAL_TOP.card.id);
    expect(state.step.phase).toBe("player");
    // Both cards passed through P1's dealt cards; only the surge's was dealt.
    expect(moved(events)).toBe(2);
    expect(deals(events)).toEqual([[P1, "surge"]]);
    expect(windows(events)).toBe(1);
    expect(counted(state, t.witness)).toBe(1);
    expect(revealed(events)).toEqual([RUSH.id]);
    const [window] = dealWindows(events) as [number];
    expect(window).toBeGreaterThan(dealMoves(events)[1]!);
    expect(mustPlayer(state, P1).dealtEncounter.map((id) => mustInstance(state, id))).toMatchObject([
      { cardId: FILLER.id, faceup: false },
    ]);
    expectReplays(session, HEARD);
  });

  it("the surge card swapped with the deck top in that window: the surge reveals the card now in its place", () => {
    const swapper = playerCardIntoPlay(start(SWAPPING), SWAPPER.id);
    // Boost filler, the surging card for step three, the minion the surge deals, and a filler under it.
    const state = stacked(swapper.state, FILLER.id, RUSH.id, GRUNT.id, FILLER.id);
    const swap = (s: GameState) =>
      s.pendingChoice?.prompt.kind === "rearrange"
        ? s.pendingChoice.options.map((o) => o.optionId).reverse()
        : defaultPick(s);
    const out = runCommandsPicking(state, SWAPPING, swap, { type: "endTurn", playerId: P1 });
    // Step three's window is not the swapper's (its source is the villain phase): 1 look, of 2 cards.
    const looks = out.events.filter((e) => e.type === "cardsRearranged");
    expect(looks).toHaveLength(1);
    expect(looks[0]).toMatchObject({ moved: 2 });
    expect(revealed(out.events)).toEqual([RUSH.id, FILLER.id]);
    // The minion went to the top of the encounter deck, facedown, and engaged nobody.
    const deck = Object.values(out.state.encounterDecks)[0]!.deck;
    expect(mustInstance(out.state, deck[0]!).cardId).toBe(GRUNT.id);
    expect(mustInstance(out.state, deck[0]!).engagedWith ?? null).toBeNull();
    expect(mustPlayer(out.state, P1).dealtEncounter).toEqual([]);
    expect(out.state.stack).toEqual([]);
    expectReplays(out.session, SWAPPING);

    // Not swapped: the minion is revealed and engages P1.
    const kept = runCommands(state, SWAPPING, { type: "endTurn", playerId: P1 });
    expect(revealed(kept.events)).toEqual([RUSH.id, GRUNT.id]);
    expect(kept.events.filter((e) => e.type === "cardsRearranged")).toMatchObject([{ moved: 0 }]);
  });

  it("a surge with no listener in the registry, or one out of play: the same log and state, nothing announced", () => {
    const surging = (deps: EngineDeps) => playRound(stacked(start(deps), FILLER.id, RUSH.id, RUSH.id, FILLER.id), deps);
    const unheard = surging(UNHEARD);
    const heard = surging(HEARD);
    expect(unheard.events.filter((e) => e.type === "surgeTriggered")).toHaveLength(2);
    expect(revealed(unheard.events)).toEqual([RUSH.id, RUSH.id, FILLER.id]);
    expect(unheard.events).toEqual(heard.events);
    expect(unheard.state).toEqual(heard.state);
    expect(deals(unheard.events)).toEqual([]);
    expect(windows(unheard.events)).toBe(0);
    expect("pendingEncounterDealt" in unheard.state).toBe(false);
    expectReplays(unheard.session, UNHEARD);
    expectReplays(heard.session, HEARD);
  });

  it("a listener in the registry but not in play: nothing announced, no window, nothing left pending", () => {
    const { state, events } = playRound(start(HEARD, 2), HEARD);
    expect(deals(events)).toEqual([]);
    expect(windows(events)).toBe(0);
    expect(moved(events)).toBe(2);
    expect("pendingEncounterDealt" in state).toBe(false);
  });

  it("no listener in the registry: the same log and state as with one out of play, and nothing recorded", () => {
    const unheard = playRound(start(UNHEARD, 2), UNHEARD);
    const heard = playRound(start(HEARD, 2), HEARD);
    expect(unheard.events).toEqual(heard.events);
    expect(unheard.state).toEqual(heard.state);
    expect(unheard.events.some((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardDealt")).toBe(false);
    expect("pendingEncounterDealt" in unheard.state).toBe(false);
    expectReplays(unheard.session, UNHEARD);

    const dealt = playFree(start(UNHEARD), UNHEARD, DEAL.card.id);
    expect(windows(dealt.events)).toBe(0);
    expect("pendingEncounterDealt" in dealt.state).toBe(false);
    expect(mustPlayer(dealt.state, P1).dealtEncounter).toHaveLength(1);
  });
});
