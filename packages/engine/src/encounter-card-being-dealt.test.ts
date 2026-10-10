/**
 * `TriggerEvent encounterCardBeingDealt` (docs/phase7-wave9.md §3.45): "Interrupt: When a player would be dealt an
 * encounter card, remove 1 recon counter from here instead." One event per card, before it leaves the encounter deck,
 * pushed only when an ability could react; the deal is the event's apply step.
 *
 * Sources: RRG 1.8 "Deal, Deal an Encounter Card" (p. 15); "Villain Phase" (p. 47) step three: "Deal one encounter
 * card to each player. Deal one additional card for each hazard icon on a card in play. These additional cards are
 * dealt in player order."; "Player Deck" (p. 33); "Surge" (p. 42: "the player resolving the card deals themself a
 * facedown encounter card", a deal by the owner's decision docs/phase7-wave9.md §4.1 Q19 = B); "'Would'" (p. 48);
 * "Replacement Effect" (p. 37): "When an effect is replaced, it is no longer considered imminent and no further
 * interrupts or responses to that effect can be triggered."; "Cost" (p. 13).
 *
 * Synthetic cards only: a screen that replaces a deal while it holds a recon counter, a watcher that only counts the
 * deals it hears coming, a witness of the cards dealt, and the things that deal.
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
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
import type { EncounterDealSource } from "./trigger-events.js";
import { auditVillainPhases } from "./villain/audit.js";

const you = { kind: "controller" } as const;
const self: TargetRef = { kind: "self" };
const n = (value: number) => ({ kind: "const", value }) as const;
const bump = (counterType: string): EffectSpec => ({ kind: "addCounters", target: self, counterType, amount: n(1) });

/** "Forced Interrupt: When a player would be dealt an encounter card, remove 1 recon counter from here instead." */
const screen = (id: string, source?: EncounterDealSource) =>
  stubAbility(id, {
    trigger: {
      kind: "interrupt",
      forced: true,
      would: true,
      on: { on: "encounterCardBeingDealt", ...(source ? { eventIs: { source } } : {}) },
      while: { kind: "counterAtLeast", of: self, counterType: "recon", amount: 1 },
    },
    effects: [
      {
        kind: "replaceTriggeringEvent",
        with: [{ kind: "removeCounters", target: self, counterType: "recon", amount: n(1) }],
      },
    ],
  });
const SCREEN_INTERRUPT = screen("screen.forced-interrupt");
const SCREEN = stubSupport({ id: "screen", cost: 0, abilities: [SCREEN_INTERRUPT.ref] });
/** The same, for the surge keyword's deal only. */
const SURGE_SCREEN_INTERRUPT = screen("surge-screen.forced-interrupt", "surge");
const SURGE_SCREEN = stubSupport({ id: "surge-screen", cost: 0, abilities: [SURGE_SCREEN_INTERRUPT.ref] });
/** "Forced Interrupt: When a player would be dealt an encounter card, place 1 seen counter here." */
const WATCHER_INTERRUPT = stubAbility("watcher.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "encounterCardBeingDealt" } },
  effects: [bump("seen")],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_INTERRUPT.ref] });
/** "Forced Response: After a player is dealt an encounter card, place 1 dealt counter here." */
const WITNESS_RESPONSE = stubAbility("witness.response", {
  trigger: { kind: "response", forced: true, on: { on: "encounterCardDealt" } },
  effects: [bump("dealt")],
});
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_RESPONSE.ref] });

const LOOKOUT = stubSideScheme({ id: "lookout", startingThreat: 3, icons: ["hazard"], boostIcons: 0 });
const RUSH = stubTreachery({ id: "rush", boostIcons: 0, keywords: [{ name: "surge" }] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[], cost?: AbilityCost) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...(cost ? { cost } : {}) });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "Deal yourself 1 facedown encounter card."
const DEAL = event("deal", [{ kind: "dealEncounterCard", player: you }]);
// "Deal yourself 3 facedown encounter cards."
const DEAL_3 = event("deal-3", [{ kind: "dealEncounterCard", player: you, count: n(3) }]);
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
const EVENTS = [DEAL, DEAL_3, PAY, TAKE_GRUNT, DRAW, REVEAL_TOP];
const SUPPORTS = [SCREEN, SURGE_SCREEN, WATCHER, WITNESS];

const HEARD: EngineDeps = depsOf(
  SCREEN_INTERRUPT,
  SURGE_SCREEN_INTERRUPT,
  WATCHER_INTERRUPT,
  WITNESS_RESPONSE,
  ...EVENTS.map((e) => e.ability),
);
/** The same registry with no ability that hears a deal coming. */
const UNHEARD: EngineDeps = depsOf(WITNESS_RESPONSE, ...EVENTS.map((e) => e.ability));

function start(deps: EngineDeps, players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: [...SUPPORTS, LOOKOUT, RUSH, GRUNT, FILLER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [...SUPPORTS.map((s) => s.id), ...EVENTS.map((e) => e.card.id)],
    encounter: [...copiesOf(FILLER.id, 26), LOOKOUT.id, RUSH.id, RUSH.id, GRUNT.id],
  });
}

/** `card` in P1's play area with `recon` recon counters on it (surgery). */
function withCard(state: GameState, card: { readonly id: string }, recon = 0) {
  const put = playerCardIntoPlay(state, card.id as never);
  const instance = mustInstance(put.state, put.id);
  return {
    id: put.id,
    state: {
      ...put.state,
      instances: { ...put.state.instances, [put.id]: { ...instance, counters: recon > 0 ? { recon } : {} } },
    } as GameState,
  };
}

const playRound = (state: GameState, deps: EngineDeps) =>
  runCommands(state, deps, ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })));

/** The encounter deck, top card first. */
const deckOf = (state: GameState): readonly InstanceId[] => Object.values(state.encounterDecks)[0]!.deck;
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

type Phase = "initiated" | "resolved" | "cancelled";
/** Each "would be dealt" event logged in `phase`, in order: the player and the source. */
const coming = (events: readonly GameEvent[], phase: Phase): readonly (readonly [PlayerId, string])[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === phase && e.event.kind === "encounterCardBeingDealt"
      ? [[e.event.playerId, e.event.source] as const]
      : [],
  );
const anyComing = (events: readonly GameEvent[]) =>
  events.some((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardBeingDealt");
/** The interrupt windows opened for a deal about to be made. */
const windows = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "windowOpened" && e.event.kind === "encounterCardBeingDealt").length;
/** The cards that reached a player's dealt cards, in order: the player and the card. */
const dealtTo = (events: readonly GameEvent[]): readonly (readonly [PlayerId, InstanceId])[] =>
  events.flatMap((e) =>
    e.type === "cardMoved" && e.to.kind === "dealtEncounter" ? [[e.to.playerId, e.instanceId] as const] : [],
  );
const revealed = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [e.cardId as string] : []));
const counter = (state: GameState, id: InstanceId, type: string) => mustInstance(state, id).counters[type] ?? 0;
function expectReplays(session: GameSession, deps: EngineDeps) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}
const violations = (session: GameSession, deps: EngineDeps) => auditVillainPhases(session.log, deps).violations;

describe("encounterCardBeingDealt: when a player would be dealt an encounter card", () => {
  it("solo, step three, not replaced: 1 window before the card leaves the deck, then the deal and its response", () => {
    const watcher = withCard(start(HEARD), WATCHER);
    const witness = withCard(watcher.state, WITNESS);
    const { state, events, session } = playRound(witness.state, HEARD);
    expect(coming(events, "initiated")).toEqual([[P1, "villainPhase"]]);
    expect(coming(events, "resolved")).toEqual([[P1, "villainPhase"]]);
    expect(windows(events)).toBe(1);
    expect(counter(state, watcher.id, "seen")).toBe(1);
    expect(dealtTo(events)).toHaveLength(1);
    // The window opened with the card still on the deck.
    const window = events.findIndex((e) => e.type === "windowOpened" && e.event.kind === "encounterCardBeingDealt");
    const deal = events.findIndex((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter");
    expect(window).toBeGreaterThan(-1);
    expect(deal).toBeGreaterThan(window);
    // `encounterCardDealt` still follows a deal that was not replaced.
    expect(counter(state, witness.id, "dealt")).toBe(1);
    expect(revealed(events)).toEqual([FILLER.id]);
    expect(state.round).toBe(2);
    expect(violations(session, HEARD)).toEqual([]);
    expectReplays(session, HEARD);
  });

  it("solo, step three, replaced with 1 recon counter: 0 counters left, 0 cards dealt, the card stays on top", () => {
    const screened = withCard(start(HEARD), SCREEN, 1);
    const witness = withCard(screened.state, WITNESS);
    // The villain's boost card is the top card; step three's is the second.
    const stepThreeCard = deckOf(witness.state)[1]!;
    const { state, events, session } = playRound(witness.state, HEARD);
    expect(coming(events, "initiated")).toEqual([[P1, "villainPhase"]]);
    expect(coming(events, "cancelled")).toEqual([[P1, "villainPhase"]]);
    expect(coming(events, "resolved")).toEqual([]);
    expect(counter(state, screened.id, "recon")).toBe(0);
    expect(dealtTo(events)).toEqual([]);
    expect(revealed(events)).toEqual([]);
    expect(counter(state, witness.id, "dealt")).toBe(0);
    expect(deckOf(state)[0]).toBe(stepThreeCard);
    expect(mustInstance(state, stepThreeCard).faceup).toBe(false);
    // The villain phase went on to the next round's player phase.
    expect(state.round).toBe(2);
    expect(state.step).toMatchObject({ phase: "player", kind: "turn" });
    expect(state.stack).toEqual([]);
    expect("pendingEncounterDeals" in state).toBe(false);
    expect(violations(session, HEARD)).toEqual([]);
    expectReplays(session, HEARD);

    // The next deal takes that same card: with no counter left the screen is not asked.
    const next = playRound(state, HEARD);
    const [, boosted] = [deckOf(state)[0]!, deckOf(state)[1]!];
    expect(anyComing(next.events)).toBe(false);
    // Round 2: the card left on top is the boost card, the one under it is dealt.
    expect(dealtTo(next.events)).toEqual([[P1, boosted]]);
    expect(counter(next.state, witness.id, "dealt")).toBe(1);
  });

  it("two players, 1 recon counter: P1's deal is replaced and P2 is dealt the card P1 would have been", () => {
    const screened = withCard(start(HEARD, 2), SCREEN, 1);
    const p1Card = deckOf(screened.state)[2]!; // Two boost cards first, one for each player's activation.
    const { state, events, session } = playRound(screened.state, HEARD);
    expect(coming(events, "cancelled")).toEqual([[P1, "villainPhase"]]);
    // With the counter gone nothing can answer P2's deal: no event, the card is dealt at once.
    expect(coming(events, "initiated")).toEqual([[P1, "villainPhase"]]);
    expect(windows(events)).toBe(1);
    expect(dealtTo(events)).toEqual([[P2, p1Card]]);
    expect(counter(state, screened.id, "recon")).toBe(0);
    expect(revealed(events)).toHaveLength(1);
    expect(violations(session, HEARD)).toEqual([]);
    expectReplays(session, HEARD);
  });

  it("two players, 2 recon counters: each deal has its own window, in player order; 0 cards dealt", () => {
    const screened = withCard(start(HEARD, 2), SCREEN, 2);
    const top = deckOf(screened.state)[2]!;
    const { state, events, session } = playRound(screened.state, HEARD);
    expect(coming(events, "cancelled")).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
    ]);
    expect(windows(events)).toBe(2);
    // P1's event was over before P2's began.
    const logged = events.flatMap((e, index) =>
      e.type === "triggerEvent" && e.event.kind === "encounterCardBeingDealt" ? [[index, e.phase] as const] : [],
    );
    expect(logged.map(([, phase]) => phase)).toEqual(["initiated", "cancelled", "initiated", "cancelled"]);
    expect(dealtTo(events)).toEqual([]);
    expect(counter(state, screened.id, "recon")).toBe(0);
    expect(deckOf(state)[0]).toBe(top);
    expect(state.round).toBe(2);
    expect(violations(session, HEARD)).toEqual([]);
    expectReplays(session, HEARD);
  });

  it("two players, not replaced: P1's card is dealt before P2's window opens", () => {
    const watcher = withCard(start(HEARD, 2), WATCHER);
    const { state, events, session } = playRound(watcher.state, HEARD);
    expect(coming(events, "resolved")).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
    ]);
    expect(windows(events)).toBe(2);
    expect(counter(state, watcher.id, "seen")).toBe(2);
    const opened = events.flatMap((e, i) =>
      e.type === "windowOpened" && e.event.kind === "encounterCardBeingDealt" ? [i] : [],
    );
    const moves = events.flatMap((e, i) => (e.type === "cardMoved" && e.to.kind === "dealtEncounter" ? [i] : []));
    expect(dealtTo(events).map(([player]) => player)).toEqual([P1, P2]);
    expect(opened[0]).toBeLessThan(moves[0]!);
    expect(moves[0]).toBeLessThan(opened[1]!);
    expect(opened[1]).toBeLessThan(moves[1]!);
    // Nothing is revealed until every card of the step is dealt.
    expect(events.findIndex((e) => e.type === "encounterCardRevealed")).toBeGreaterThan(moves[1]!);
    expect(violations(session, HEARD)).toEqual([]);
    expectReplays(session, HEARD);
  });

  it("a hazard icon's card: its own event, after each player's; 3 counters replace all 3 deals", () => {
    const watcher = withCard(start(HEARD, 2), WATCHER);
    const lookout = encounterCardInVillainArea(watcher.state, LOOKOUT.id, 3);
    const watched = playRound(lookout.state, HEARD);
    expect(coming(watched.events, "resolved")).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
      [P1, "hazard"],
    ]);
    expect(dealtTo(watched.events).map(([player]) => player)).toEqual([P1, P2, P1]);
    expect(counter(watched.state, watcher.id, "seen")).toBe(3);

    const screened = withCard(start(HEARD, 2), SCREEN, 3);
    const hazard = encounterCardInVillainArea(screened.state, LOOKOUT.id, 3);
    const { state, events, session } = playRound(hazard.state, HEARD);
    expect(coming(events, "cancelled")).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
      [P1, "hazard"],
    ]);
    expect(dealtTo(events)).toEqual([]);
    expect(counter(state, screened.id, "recon")).toBe(0);
    expect(violations(session, HEARD)).toEqual([]);
    expectReplays(session, HEARD);

    // 2 counters: the hazard card is the one dealt, to P1.
    const two = withCard(start(HEARD, 2), SCREEN, 2);
    const partly = playRound(encounterCardInVillainArea(two.state, LOOKOUT.id, 3).state, HEARD);
    expect(dealtTo(partly.events).map(([player]) => player)).toEqual([P1]);
    expect(revealed(partly.events)).toHaveLength(1);
    expect(violations(partly.session, HEARD)).toEqual([]);
  });

  it("the surge keyword's deal (Q19 = B): heard with the surging card as its source; replaced, nothing is revealed", () => {
    const watcher = withCard(start(HEARD), WATCHER);
    // A filler for the villain's boost card, the surging card for step three, then the card it deals.
    const watched = playRound(stacked(watcher.state, FILLER.id, RUSH.id, FILLER.id), HEARD);
    expect(coming(watched.events, "resolved")).toEqual([
      [P1, "villainPhase"],
      [P1, "surge"],
    ]);
    expect(revealed(watched.events)).toEqual([RUSH.id, FILLER.id]);
    expect(watched.events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
    const rush = dealtTo(watched.events)[0]![1];
    const surge = watched.events.find(
      (e) => e.type === "triggerEvent" && e.event.kind === "encounterCardBeingDealt" && e.event.source === "surge",
    );
    expect(surge).toMatchObject({ event: { sourceInstanceId: rush } });
    expectReplays(watched.session, HEARD);

    const screened = withCard(start(HEARD), SURGE_SCREEN, 1);
    const witness = withCard(screened.state, WITNESS);
    const state = stacked(witness.state, FILLER.id, RUSH.id, GRUNT.id);
    const grunt = deckOf(state)[2]!;
    const out = playRound(state, HEARD);
    // Step three's own deal is not a surge's: not this screen's to answer.
    expect(coming(out.events, "initiated")).toEqual([[P1, "surge"]]);
    expect(coming(out.events, "cancelled")).toEqual([[P1, "surge"]]);
    expect(revealed(out.events)).toEqual([RUSH.id]);
    expect(dealtTo(out.events)).toHaveLength(1);
    expect(out.events.filter((e) => e.type === "surgeTriggered")).toHaveLength(0);
    expect(counter(out.state, screened.id, "recon")).toBe(0);
    // Only step three's card was dealt, and the minion the surge would have dealt is still on top, facedown.
    expect(counter(out.state, witness.id, "dealt")).toBe(1);
    expect(deckOf(out.state)[0]).toBe(grunt);
    expect(mustInstance(out.state, grunt).engagedWith ?? null).toBeNull();
    expect(out.state.round).toBe(2);
    expect(out.state.stack).toEqual([]);
    expect(violations(out.session, HEARD)).toEqual([]);
    expectReplays(out.session, HEARD);
  });

  it("a surging card revealed in the player phase: its deal is heard there too", () => {
    const screened = withCard(start(HEARD), SURGE_SCREEN, 1);
    const state = stacked(screened.state, RUSH.id, GRUNT.id);
    const grunt = deckOf(state)[1]!;
    const out = playFree(state, HEARD, REVEAL_TOP.card.id);
    expect(out.state.step.phase).toBe("player");
    expect(coming(out.events, "cancelled")).toEqual([[P1, "surge"]]);
    expect(revealed(out.events)).toEqual([RUSH.id]);
    expect(deckOf(out.state)[0]).toBe(grunt);
    expect(mustPlayer(out.state, P1).dealtEncounter).toEqual([]);
    expectReplays(out.session, HEARD);
  });

  it("a card ability's deal: replaced, 0 cards and the top card stays; the next deal takes that same card", () => {
    const screened = withCard(start(HEARD), SCREEN, 1);
    const top = deckOf(screened.state)[0]!;
    const first = playFree(screened.state, HEARD, DEAL.card.id);
    expect(coming(first.events, "cancelled")).toEqual([[P1, "ability"]]);
    const played = first.events.find((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardBeingDealt");
    // The dealing card is the event's source.
    expect(played).toMatchObject({ event: { sourceInstanceId: expect.any(String) } });
    expect(mustPlayer(first.state, P1).dealtEncounter).toEqual([]);
    expect(counter(first.state, screened.id, "recon")).toBe(0);
    expect(deckOf(first.state)[0]).toBe(top);
    expectReplays(first.session, HEARD);

    // A second copy, with no counter left: no event, and that same card is dealt.
    const again = playFree(first.state, HEARD, DEAL.card.id);
    expect(anyComing(again.events)).toBe(false);
    expect(mustPlayer(again.state, P1).dealtEncounter).toEqual([top]);
  });

  it("one effect dealing 3 cards with 1 recon counter: the first is replaced, 2 cards are dealt", () => {
    const screened = withCard(start(HEARD), SCREEN, 1);
    const [first, second] = deckOf(screened.state) as [InstanceId, InstanceId];
    const { state, events, session } = playFree(screened.state, HEARD, DEAL_3.card.id);
    expect(coming(events, "initiated")).toEqual([[P1, "ability"]]);
    expect(coming(events, "cancelled")).toEqual([[P1, "ability"]]);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([first, second]);
    expect(counter(state, screened.id, "recon")).toBe(0);
    expectReplays(session, HEARD);

    // Watched and not replaced: 3 windows, 3 cards, each dealt before the next window.
    const watcher = withCard(start(HEARD), WATCHER);
    const watched = playFree(watcher.state, HEARD, DEAL_3.card.id);
    expect(coming(watched.events, "resolved")).toHaveLength(3);
    expect(windows(watched.events)).toBe(3);
    expect(mustPlayer(watched.state, P1).dealtEncounter).toHaveLength(3);
    expect(counter(watched.state, watcher.id, "seen")).toBe(3);
    const order = watched.events.flatMap((e) =>
      e.type === "windowOpened" && e.event.kind === "encounterCardBeingDealt"
        ? ["window"]
        : e.type === "cardMoved" && e.to.kind === "dealtEncounter"
          ? ["deal"]
          : [],
    );
    expect(order).toEqual(["window", "deal", "window", "deal", "window", "deal"]);
    expectReplays(watched.session, HEARD);
  });

  it("a player deck that runs out: its deal is heard, and replaced the player is dealt 0 cards", () => {
    const thin = (state: GameState): GameState => {
      // Surgery: 1 card left in P1's deck, the rest in the discard pile, so drawing it resets the deck.
      const seat = mustPlayer(state, P1);
      const [last, ...rest] = seat.deck;
      return {
        ...state,
        players: state.players.map((p) =>
          p.playerId === P1 ? { ...p, deck: [last!], discard: [...p.discard, ...rest] } : p,
        ),
      };
    };
    const watcher = withCard(start(HEARD), WATCHER);
    const watched = playFree(thin(watcher.state), HEARD, DRAW.card.id);
    expect(watched.events.some((e) => e.type === "playerDeckReset")).toBe(true);
    expect(coming(watched.events, "resolved")).toEqual([[P1, "deckReset"]]);
    expect(mustPlayer(watched.state, P1).dealtEncounter).toHaveLength(1);
    expect("pendingEncounterDeals" in watched.state).toBe(false);
    expectReplays(watched.session, HEARD);

    const screened = withCard(start(HEARD), SCREEN, 1);
    const top = deckOf(screened.state)[0]!;
    const out = playFree(thin(screened.state), HEARD, DRAW.card.id);
    expect(out.events.some((e) => e.type === "playerDeckReset")).toBe(true);
    expect(coming(out.events, "cancelled")).toEqual([[P1, "deckReset"]]);
    expect(mustPlayer(out.state, P1).dealtEncounter).toEqual([]);
    expect(deckOf(out.state)[0]).toBe(top);
    expect(counter(out.state, screened.id, "recon")).toBe(0);
    expect("pendingEncounterDeals" in out.state).toBe(false);
    expectReplays(out.session, HEARD);
  });

  it("not announced: a deal paid as a cost, and a named card dealt to a player", () => {
    const screened = withCard(start(HEARD), SCREEN, 1);
    const paid = playFree(screened.state, HEARD, PAY.card.id);
    expect(anyComing(paid.events)).toBe(false);
    expect(mustPlayer(paid.state, P1).dealtEncounter).toHaveLength(1);
    expect(counter(paid.state, screened.id, "recon")).toBe(1);

    const grunt = minionEngagedWith(screened.state, GRUNT.id);
    const taken = playFree(grunt.state, HEARD, TAKE_GRUNT.card.id);
    expect(anyComing(taken.events)).toBe(false);
    expect(mustPlayer(taken.state, P1).dealtEncounter).toEqual([grunt.id]);
    expect(counter(taken.state, screened.id, "recon")).toBe(1);
  });

  it("a listener that cannot answer (0 counters, or out of play): no event, the log of a game without it", () => {
    const empty = withCard(start(HEARD, 2), SCREEN, 0);
    const lookout = encounterCardInVillainArea(empty.state, LOOKOUT.id, 3);
    const heard = playRound(lookout.state, HEARD);
    const unheard = playRound(lookout.state, UNHEARD);
    expect(anyComing(heard.events)).toBe(false);
    expect(windows(heard.events)).toBe(0);
    expect(dealtTo(heard.events)).toHaveLength(3);
    expect(heard.events).toEqual(unheard.events);
    expect(heard.state).toEqual(unheard.state);
    expectReplays(heard.session, HEARD);
    expectReplays(unheard.session, UNHEARD);
  });

  it("no listener in the registry: the same log and state as with one out of play", () => {
    const surging = (deps: EngineDeps) => playRound(stacked(start(deps), FILLER.id, RUSH.id, RUSH.id, FILLER.id), deps);
    const unheard = surging(UNHEARD);
    const heard = surging(HEARD);
    expect(revealed(unheard.events)).toEqual([RUSH.id, RUSH.id, FILLER.id]);
    expect(unheard.events).toEqual(heard.events);
    expect(unheard.state).toEqual(heard.state);
    expect(anyComing(unheard.events)).toBe(false);
    expect("pendingEncounterDeals" in unheard.state).toBe(false);
    expectReplays(unheard.session, UNHEARD);
    expectReplays(heard.session, HEARD);

    const dealt = playFree(start(UNHEARD), UNHEARD, DEAL_3.card.id);
    const same = playFree(start(HEARD), HEARD, DEAL_3.card.id);
    expect(dealt.events).toEqual(same.events);
    expect(mustPlayer(dealt.state, P1).dealtEncounter).toHaveLength(3);
  });
});
