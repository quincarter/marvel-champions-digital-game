/**
 * docs/phase7-wave9.md §3.29 (a): hidden piles (`GameState.hiddenPiles`), the cards that have come out of them
 * (`GameState.revealedPileCards`), `EffectSpec dealHiddenPiles` / `gainFromHiddenPile` / `revealHiddenPile`, and what
 * a player is shown of them (`hiddenPileViews`, `sealHiddenPiles`, the event log, `legalActions`, `preview`).
 *
 * Sources: MC50 p. 5, "Preparing the Evidence": "1. Separate the nine evidence cards (185–193) by their card backs
 * into three sets of three cards. 2. Shuffle each set of three cards separately and put one card from each set into the
 * A.I.M. envelope **without looking at them**. 3. Shuffle the six remaining evidence cards together and put them in the
 * S.H.I.E.L.D. envelope **without looking at them**." MC50 p. 18: "When the players gain an evidence card, they turn it
 * faceup". MC50 p. 19: "the players take the evidence cards from the A.I.M. envelope".
 *
 * Synthetic cards only: nine clue cards of the set "clues" (three of each kind), a tenth of another set, a main scheme
 * whose Setup deals them into the piles "sealed" (one of each kind) and "open" (the other six), and a Desk support
 * whose abilities gain from and reveal the piles.
 */

import {
  cardId,
  cycleId,
  encounterSetId,
  EVIDENCE_KINDS,
  flat,
  setCode,
  unerrataedText,
  type CardId,
  type EvidenceCard,
  type EvidenceKind,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { createCtx } from "./ctx.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { preview } from "./preview.js";
import { dealHiddenPiles, placeHiddenPiles, revealedPileCardsOf } from "./resolve/hidden-piles.js";
import { resolveValue } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities, TREACHERY, VILLAIN } from "./testing/scenario.js";
import { copiesOf, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import { hiddenPileViews, sealHiddenPiles } from "./visibility.js";

const SEALED = "sealed";
const OPEN = "open";
const CLUES = "clues";

const clue = (id: string, evidence: EvidenceKind, set = CLUES): EvidenceCard => ({
  id: cardId(id),
  name: id,
  setCode: setCode("stub"),
  cycleId: cycleId("stub"),
  collectorNumber: id,
  quantityInSet: 1,
  unique: false,
  type: "evidence",
  evidence,
  encounterSetIds: [encounterSetId(set)],
  traits: [],
  text: unerrataedText(""),
  abilities: [],
});
/** Three clue cards of each kind: `clue-means-1` … `clue-opportunity-3`. */
const CLUE_CARDS = EVIDENCE_KINDS.flatMap((kind) => [1, 2, 3].map((n) => clue(`clue-${kind}-${n}`, kind)));
const CLUE_IDS = CLUE_CARDS.map((card) => card.id);
/** An evidence card of another set: never dealt. */
const STRAY = clue("stray-means", "means", "elsewhere");
const kindOf = (id: CardId): EvidenceKind => CLUE_CARDS.find((card) => card.id === id)!.evidence;

const one = { kind: "const", value: 1 } as const;
const self = { kind: "self" } as const;
const count = (value: number): ValueSpec => ({ kind: "const", value });
const deal: EffectSpec = {
  kind: "dealHiddenPiles",
  from: CLUES,
  groupBy: "evidenceKind",
  onePerGroupTo: SEALED,
  restTo: OPEN,
};
const gain = (pile: string, n: number, bind?: string): EffectSpec => ({
  kind: "gainFromHiddenPile",
  pile,
  count: count(n),
  ...(bind ? { bind } : {}),
});
const mark = (counterType: string): EffectSpec => ({ kind: "addCounters", target: self, counterType, amount: one });
const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "action" }, effects });

const CASE_SETUP = stubAbility("case.setup", { trigger: { kind: "setup" }, effects: [deal] });
/** "Action: Gain 2 cards from the open pile." (nothing else: unusable on an empty pile) */
const GAIN_TWO = action("desk.gain-two", [gain(OPEN, 2)]);
/** "Action: Gain 1 card from the open pile. If you gained one, place 1 found counter here. Place 1 tried counter here." */
const GAIN_ONE = action("desk.gain-one", [
  gain(OPEN, 1, "got"),
  { kind: "if", condition: { kind: "varAtLeast", name: "got.count", amount: 1 }, then: [mark("found")] },
  mark("tried"),
]);
/** "Action: Gain 9 cards from the open pile." (more than it ever holds) */
const GAIN_NINE = action("desk.gain-nine", [gain(OPEN, 9)]);
/** "Action: Reveal the sealed pile." */
const REVEAL = action("desk.reveal", [{ kind: "revealHiddenPile", pile: SEALED, bind: "shown" }, mark("opened")]);
/** "Action: Gain 1 card from the nowhere pile. Place 1 tried counter here." (a pile nobody prepared) */
const GAIN_NOWHERE = action("desk.gain-nowhere", [gain("nowhere", 1), mark("tried")]);
/** "Action: Prepare the clues." (again, after setup) */
const DEAL_AGAIN = action("redeal.action", [deal]);
/** "Action: Prepare the clues of a set with no evidence card, into two other piles." */
const DEAL_NOTHING = action("deal-nothing.action", [
  { kind: "dealHiddenPiles", from: "no-such-set", groupBy: "evidenceKind", onePerGroupTo: "a", restTo: "b" },
]);

const CASE = stubMainScheme({
  id: "case",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [CASE_SETUP.ref] },
  ],
});
const DESK = stubSupport({
  id: "desk",
  cost: 0,
  abilities: [GAIN_TWO.ref, GAIN_ONE.ref, GAIN_NINE.ref, REVEAL.ref, GAIN_NOWHERE.ref],
});
const REDEAL = stubEvent({ id: "redeal", cost: 0, abilities: [DEAL_AGAIN.ref] });
const DEAL_EMPTY = stubEvent({ id: "deal-nothing", cost: 0, abilities: [DEAL_NOTHING.ref] });

const deps: EngineDeps = depsOf(
  CASE_SETUP,
  GAIN_TWO,
  GAIN_ONE,
  GAIN_NINE,
  REVEAL,
  GAIN_NOWHERE,
  DEAL_AGAIN,
  DEAL_NOTHING,
);

interface Table {
  /** At player 1's first turn, the Desk in play under their control. */
  readonly state: GameState;
  readonly desk: InstanceId;
  /** Every event from `createGame` to the first turn. */
  readonly setupEvents: readonly GameEvent[];
  /** The session from the state `createGame` returned, for a replay that includes the setup's choices. */
  readonly setupSession: GameSession;
}

function table(seed = 21, players: 1 | 2 = 1): Table {
  const identities = seatIdentities(HERO, players);
  const created = createGame(
    {
      seed,
      cards: [...DEFAULT_CARDS, ...identities.slice(1), CASE, DESK, REDEAL, DEAL_EMPTY, ...CLUE_CARDS, STRAY],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: CASE.id,
      encounterDeck: copiesOf(TREACHERY.id, 30),
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, DESK.id, REDEAL.id, DEAL_EMPTY.id],
      })),
    },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  const driven = driveSession(startSession(created.state), deps);
  const desk = playerCardIntoPlay(driven.session.state, DESK.id);
  return {
    state: desk.state,
    desk: desk.id,
    setupEvents: [...created.events, ...driven.events],
    setupSession: driven.session,
  };
}

const use = (t: Table, ability: { readonly ref: { readonly id: string } }, state: GameState = t.state) =>
  driveSession(startSession(state), deps, [useCommand(t, ability)]);
const useCommand = (t: Table, ability: { readonly ref: { readonly id: string } }) =>
  ({
    type: "useAbility",
    playerId: P1,
    cardInstanceId: t.desk,
    abilityId: ability.ref.id,
    payment: [],
  }) as never;
const pile = (state: GameState, name: string): readonly CardId[] => state.hiddenPiles?.[name] ?? [];
const counters = (state: GameState, t: Table, type: string) => state.instances[t.desk]!.counters[type] ?? 0;
/** The serialized form of anything, searched for card ids. */
const idsIn = (value: unknown, ids: readonly CardId[]): CardId[] => {
  const text = JSON.stringify(value);
  return ids.filter((id) => text.includes(`"${id}"`));
};
/** What a player's view is built from, without the static card pool (which lists every card of the game by id). */
const viewOf = (state: GameState) => {
  const { cardPool: _pool, ...view } = sealHiddenPiles(state);
  return view;
};
const pileCount = (state: GameState, name: string) =>
  resolveValue(
    state,
    { kind: "hiddenPileCount", pile: name },
    { selfInstanceId: null, controllerId: P1, event: null, bindings: {} },
  );
const revealedCount = (state: GameState, name?: string) =>
  resolveValue(
    state,
    { kind: "revealedPileCardCount", ...(name ? { pile: name } : {}) },
    { selfInstanceId: null, controllerId: P1, event: null, bindings: {} },
  );
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§3.29 (a) the piles dealt at setup (MC50 p. 5)", () => {
  it("2 piles: 3 cards in the sealed one, one of each kind, and the other 6 in the open one; nothing is left over", () => {
    const { state } = table();
    expect(Object.keys(state.hiddenPiles!)).toEqual([SEALED, OPEN]);
    expect(pile(state, SEALED)).toHaveLength(3);
    expect(pile(state, SEALED).map(kindOf)).toEqual(["means", "motive", "opportunity"]);
    expect(pile(state, OPEN)).toHaveLength(6);
    expect(EVIDENCE_KINDS.map((kind) => pile(state, OPEN).filter((id) => kindOf(id) === kind).length)).toEqual([
      2, 2, 2,
    ]);
    expect([...pile(state, SEALED), ...pile(state, OPEN)].sort()).toEqual([...CLUE_IDS].sort());
    expect(state.revealedPileCards).toBeUndefined();
    expect([pileCount(state, SEALED), pileCount(state, OPEN), revealedCount(state)]).toEqual([3, 6, 0]);
  });

  it("only the evidence cards of the named set are dealt: the tenth card, of another set, is in neither pile", () => {
    const { state } = table();
    expect(state.cardPool[STRAY.id]).toBeDefined();
    expect(idsIn(state.hiddenPiles, [STRAY.id])).toEqual([]);
  });

  it("a dealt card is not an instance and is in no zone: the game has no instance of any evidence card", () => {
    const { state } = table();
    const dealt = new Set<string>([...CLUE_IDS, STRAY.id]);
    expect(Object.values(state.instances).filter((instance) => dealt.has(instance.cardId))).toEqual([]);
  });

  it("the deal is logged once, with the 2 sizes (3 and 6) and no card id", () => {
    const { setupEvents } = table();
    const dealt = setupEvents.filter((event) => event.type === "hiddenPilesDealt");
    expect(dealt).toEqual([
      {
        type: "hiddenPilesDealt",
        from: CLUES,
        piles: [
          { pile: SEALED, size: 3 },
          { pile: OPEN, size: 6 },
        ],
        kept: false,
      },
    ]);
  });

  it("the deal follows the seed: the same seed deals the same piles in the same order, and seeds 1 to 40 put each of the 9 cards in the sealed pile", () => {
    expect(table(7).state.hiddenPiles).toEqual(table(7).state.hiddenPiles);
    const sealed = new Set<CardId>();
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const { state } = table(seed);
      for (const id of pile(state, SEALED)) sealed.add(id);
      orders.add(pile(state, OPEN).join());
    }
    expect([...sealed].sort()).toEqual([...CLUE_IDS].sort());
    expect(orders.size).toBeGreaterThan(20);
  });

  it("the Setup resolves inside createGame, so the replay baseline holds the piles and a replay of setup's choices keeps them", () => {
    const { setupSession } = table(3);
    expect(setupSession.log.initialState.hiddenPiles).toEqual(setupSession.state.hiddenPiles);
    expect(setupSession.log.commands.length).toBeGreaterThan(0);
    expectReplays(setupSession);
    // Setting the same game up again from its seed deals the same piles.
    expect(table(3).setupSession.state.hiddenPiles).toEqual(setupSession.state.hiddenPiles);
  });
});

describe("§3.29 (a) no player is shown a hidden pile's card", () => {
  it("the view of the state holds the 2 sizes and none of the 9 card ids, for 1 and for 2 players", () => {
    for (const players of [1, 2] as const) {
      const { state } = table(21, players);
      expect(hiddenPileViews(state)).toEqual([
        { pile: SEALED, size: 3 },
        { pile: OPEN, size: 6 },
      ]);
      const sealed = sealHiddenPiles(state);
      expect("hiddenPiles" in sealed).toBe(false);
      expect(sealed.hiddenPileSizes).toEqual({ [SEALED]: 3, [OPEN]: 6 });
      expect(idsIn(viewOf(state), CLUE_IDS)).toEqual([]);
      // The same test finds all 9 in the state the engine keeps, so it is a real search.
      expect(idsIn(state.hiddenPiles, CLUE_IDS)).toHaveLength(9);
    }
  });

  it("sealing changes nothing else, and a state with no pile is returned as it is", () => {
    const { state } = table();
    const { hiddenPileSizes: _sizes, ...sealed } = sealHiddenPiles(state);
    const { hiddenPiles: _piles, ...rest } = state;
    expect(sealed).toEqual(rest);
    const { hiddenPiles: _gone, ...bare } = state;
    expect(sealHiddenPiles(bare)).toBe(bare);
    expect(hiddenPileViews(bare)).toEqual([]);
  });

  it("no event of the game names one: setup, a whole round with the villain phase, and a second deal attempt (0 of 9 ids in every event)", () => {
    const t = table(21, 2);
    const round = driveSession(startSession(t.state), deps, [
      { type: "endTurn", playerId: P1 },
      { type: "endTurn", playerId: P2 },
    ]);
    const again = playFree(round.session.state, deps, REDEAL.id, round.session.state.firstPlayerId);
    const events = [...t.setupEvents, ...round.events, ...again.events];
    expect(events.length).toBeGreaterThan(20);
    for (const event of events) expect(idsIn(event, CLUE_IDS), event.type).toEqual([]);
    expect(again.state.hiddenPiles).toEqual(t.state.hiddenPiles);
  });

  it("no legal-action listing, open prompt or stack frame names one, at setup's first choice and on a player's turn", () => {
    const t = table();
    for (const state of [t.setupSession.log.initialState, t.state]) {
      for (const seat of state.players) expect(idsIn(legalActions(state, seat.playerId, deps), CLUE_IDS)).toEqual([]);
      expect(idsIn(state.pendingChoice, CLUE_IDS)).toEqual([]);
      expect(idsIn(state.stack, CLUE_IDS)).toEqual([]);
    }
  });

  it("a preview of a gain stops at the gain and names none of the pile's cards, even when the gain takes every card left without a random draw", () => {
    const t = table();
    // 9 of 6: every card comes out, and the last of them is no draw.
    const all = preview(t.state, useCommand(t, GAIN_NINE), deps);
    expect(all.stop).toEqual({ kind: "hiddenInformation", at: "hiddenPileCardsGained" });
    expect(idsIn(all, CLUE_IDS)).toEqual([]);
    const two = preview(t.state, useCommand(t, GAIN_TWO), deps);
    expect(two.stop).toEqual({ kind: "hiddenInformation", at: "hiddenPileCardsGained" });
    expect(idsIn(two, CLUE_IDS)).toEqual([]);
    const shown = preview(t.state, useCommand(t, REVEAL), deps);
    expect(shown.stop).toEqual({ kind: "hiddenInformation", at: "hiddenPileRevealed" });
    expect(idsIn(shown, CLUE_IDS)).toEqual([]);
  });
});

describe("§3.29 (a) gaining cards from a hidden pile (MC50 p. 18: turned faceup)", () => {
  it("gain 2 of 6: 2 different cards leave the open pile (4 left) and are open to every player; the sealed 3 stay hidden", () => {
    const t = table();
    const { session, events } = use(t, GAIN_TWO);
    const state = session.state;
    const gained = revealedPileCardsOf(state, OPEN);
    expect(new Set(gained).size).toBe(2);
    for (const id of gained) expect(pile(t.state, OPEN)).toContain(id);
    expect(pile(state, OPEN)).toEqual(pile(t.state, OPEN).filter((id) => !gained.includes(id)));
    expect(pile(state, SEALED)).toEqual(pile(t.state, SEALED));
    expect(state.revealedPileCards).toEqual({ [OPEN]: gained });
    expect([
      pileCount(state, OPEN),
      revealedCount(state, OPEN),
      revealedCount(state),
      revealedCount(state, SEALED),
    ]).toEqual([4, 2, 2, 0]);
    // The log names the 2 gained cards, and only those 2.
    expect(events.filter((event) => event.type === "hiddenPileCardsGained")).toEqual([
      { type: "hiddenPileCardsGained", pile: OPEN, cardIds: gained, requested: 2, remaining: 4 },
    ]);
    expect(idsIn(events, CLUE_IDS).sort()).toEqual([...gained].sort());
    // Every view now holds those 2, and still none of the 7 hidden ones.
    expect(idsIn(viewOf(state), CLUE_IDS).sort()).toEqual([...gained].sort());
    expect(hiddenPileViews(state)).toEqual([
      { pile: SEALED, size: 3 },
      { pile: OPEN, size: 4 },
    ]);
    expect(state.rng).not.toEqual(t.state.rng);
    expectReplays(session);
  });

  it("the gain follows the seed of the game it is in, and from the same state it is the same 2 cards", () => {
    const t = table(9);
    expect(revealedPileCardsOf(use(t, GAIN_TWO).session.state)).toEqual(
      revealedPileCardsOf(use(t, GAIN_TWO).session.state),
    );
    // With the piles as they are and only the random stream moved on, other cards come out for some of 20 streams.
    const picks = new Set<string>();
    for (let draws = 0; draws < 20; draws++) {
      const moved: GameState = { ...t.state, rng: { value: (t.state.rng.value + draws * 7919) >>> 0, draws } };
      picks.add(revealedPileCardsOf(use(t, GAIN_TWO, moved).session.state).join());
    }
    expect(picks.size).toBeGreaterThan(5);
  });

  it("three gains of 2 empty the pile (6, 4, 2, 0); the ability that only gains is then not legal and is refused, and nothing was paid or changed", () => {
    const t = table();
    let state = t.state;
    for (const left of [4, 2, 0]) {
      state = use(t, GAIN_TWO, state).session.state;
      expect(pile(state, OPEN)).toHaveLength(left);
    }
    expect(revealedPileCardsOf(state, OPEN)).toHaveLength(6);
    expect([...revealedPileCardsOf(state, OPEN)].sort()).toEqual([...pile(t.state, OPEN)].sort());
    expect(hiddenPileViews(state)).toEqual([
      { pile: SEALED, size: 3 },
      { pile: OPEN, size: 0 },
    ]);
    const offered = (s: GameState) => {
      const actions = legalActions(s, P1, deps);
      return actions.kind === "turn" ? JSON.stringify(actions.legal).includes(GAIN_TWO.ref.id) : false;
    };
    expect(offered(t.state)).toBe(true);
    expect(offered(state)).toBe(false);
    expect(() => use(t, GAIN_TWO, state)).toThrow(/no valid target/);
  });

  it("an empty pile inside a longer effect: 0 cards gained, logged with none, and the rest resolves (tried 1, found 0)", () => {
    const t = table();
    const emptied = use(t, GAIN_NINE).session.state;
    expect(pile(emptied, OPEN)).toEqual([]);
    const { session, events } = use(t, GAIN_ONE, emptied);
    expect(events.filter((event) => event.type === "hiddenPileCardsGained")).toEqual([
      { type: "hiddenPileCardsGained", pile: OPEN, cardIds: [], requested: 1, remaining: 0 },
    ]);
    expect([counters(session.state, t, "tried"), counters(session.state, t, "found")]).toEqual([1, 0]);
    expect(session.state.rng).toEqual(emptied.rng);
    expectReplays(session);
  });

  it("gain 1 with a bind: 1 card, `<bind>.count` is 1 (found 1, tried 1), 5 left", () => {
    const t = table();
    const { session } = use(t, GAIN_ONE);
    expect(pile(session.state, OPEN)).toHaveLength(5);
    expect([counters(session.state, t, "tried"), counters(session.state, t, "found")]).toEqual([1, 1]);
    expectReplays(session);
  });

  it("gain 9 of 6: all 6 come out and no more; then gains keep the order they came out in", () => {
    const t = table();
    const first = use(t, GAIN_TWO).session.state;
    const firstTwo = revealedPileCardsOf(first, OPEN);
    const { session, events } = use(t, GAIN_NINE, first);
    expect(pile(session.state, OPEN)).toEqual([]);
    expect(revealedPileCardsOf(session.state, OPEN)).toHaveLength(6);
    expect(revealedPileCardsOf(session.state, OPEN).slice(0, 2)).toEqual(firstTwo);
    expect(events.find((event) => event.type === "hiddenPileCardsGained")).toMatchObject({
      requested: 9,
      remaining: 0,
    });
  });

  it("a pile nobody prepared: nothing is gained, no pile is made, the rest resolves (tried 1)", () => {
    const t = table();
    const { session, events } = use(t, GAIN_NOWHERE);
    expect(Object.keys(session.state.hiddenPiles!)).toEqual([SEALED, OPEN]);
    expect(session.state.revealedPileCards).toBeUndefined();
    expect(events.find((event) => event.type === "hiddenPileCardsGained")).toMatchObject({
      pile: "nowhere",
      cardIds: [],
      remaining: 0,
    });
    expect(counters(session.state, t, "tried")).toBe(1);
    expect(pileCount(session.state, "nowhere")).toBe(0);
  });
});

describe("§3.29 (a) a pile revealed (MC50 p. 19)", () => {
  it("the sealed pile's 3 cards come out in the pile's order, are in every view, and the pile is empty (size 0)", () => {
    const t = table();
    const sealedCards = pile(t.state, SEALED);
    const { session, events } = use(t, REVEAL);
    const state = session.state;
    expect(pile(state, SEALED)).toEqual([]);
    expect(state.revealedPileCards).toEqual({ [SEALED]: sealedCards });
    expect(revealedPileCardsOf(state, SEALED)).toEqual(sealedCards);
    expect(events.filter((event) => event.type === "hiddenPileRevealed")).toEqual([
      { type: "hiddenPileRevealed", pile: SEALED, cardIds: sealedCards },
    ]);
    expect(idsIn(viewOf(state), CLUE_IDS).sort()).toEqual([...sealedCards].sort());
    expect(hiddenPileViews(state)).toEqual([
      { pile: SEALED, size: 0 },
      { pile: OPEN, size: 6 },
    ]);
    expect(counters(state, t, "opened")).toBe(1);
    // Turning a pile over is no random draw.
    expect(state.rng).toEqual(t.state.rng);
    expectReplays(session);
  });

  it("after 2 cards were gained from the other pile, the revealed cards are kept by the pile each came out of (2 and 3)", () => {
    const t = table();
    const gained = use(t, GAIN_TWO).session.state;
    const state = use(t, REVEAL, gained).session.state;
    expect(Object.keys(state.revealedPileCards!)).toEqual([OPEN, SEALED]);
    expect([revealedCount(state, OPEN), revealedCount(state, SEALED), revealedCount(state)]).toEqual([2, 3, 5]);
    expect(revealedPileCardsOf(state)).toEqual([
      ...revealedPileCardsOf(state, OPEN),
      ...revealedPileCardsOf(state, SEALED),
    ]);
    // 4 cards are still hidden, and the view holds exactly the other 5.
    expect(idsIn(viewOf(state), CLUE_IDS)).toHaveLength(5);
    expect(idsIn(viewOf(state), pile(state, OPEN))).toEqual([]);
  });

  it("revealing an empty pile reveals nothing and is logged with no card", () => {
    const t = table();
    const once = use(t, REVEAL).session.state;
    const { session, events } = use(t, REVEAL, once);
    expect(session.state.revealedPileCards).toEqual(once.revealedPileCards);
    expect(events.find((event) => event.type === "hiddenPileRevealed")).toEqual({
      type: "hiddenPileRevealed",
      pile: SEALED,
      cardIds: [],
    });
  });
});

describe("§3.29 (a) piles that are already there, and a set with no evidence card", () => {
  it("a second deal deals nothing: the piles and the random stream are as they were, logged as kept with the sizes that stand (3 and 4)", () => {
    const t = table();
    const gained = use(t, GAIN_TWO).session.state;
    const { state, events, session } = playFree(gained, deps, REDEAL.id);
    expect(state.hiddenPiles).toEqual(gained.hiddenPiles);
    expect(state.revealedPileCards).toEqual(gained.revealedPileCards);
    expect(state.rng).toEqual(gained.rng);
    expect(events.filter((event) => event.type === "hiddenPilesDealt")).toEqual([
      {
        type: "hiddenPilesDealt",
        from: CLUES,
        piles: [
          { pile: SEALED, size: 3 },
          { pile: OPEN, size: 4 },
        ],
        kept: true,
      },
    ]);
    expectReplays(session);
  });

  it("piles placed from outside the game (3 hidden, 5 hidden, 1 already gained) are kept by a deal that follows", () => {
    const { hiddenPiles: _piles, ...bare } = table().state;
    const ctx = createCtx(bare, deps);
    const [a, b, c, d, e, f, g, h, i] = CLUE_IDS as [
      CardId,
      CardId,
      CardId,
      CardId,
      CardId,
      CardId,
      CardId,
      CardId,
      CardId,
    ];
    placeHiddenPiles(ctx, { [SEALED]: [a, d, g], [OPEN]: [b, c, e, f, h] }, { [OPEN]: [i] });
    expect(ctx.events).toEqual([]);
    dealHiddenPiles(ctx, deal as Extract<EffectSpec, { kind: "dealHiddenPiles" }>);
    expect(ctx.state.hiddenPiles).toEqual({ [SEALED]: [a, d, g], [OPEN]: [b, c, e, f, h] });
    expect(ctx.state.revealedPileCards).toEqual({ [OPEN]: [i] });
    expect(ctx.state.rng).toEqual(bare.rng);
    expect(ctx.events).toMatchObject([{ type: "hiddenPilesDealt", kept: true }]);
    expect(hiddenPileViews(ctx.state)).toEqual([
      { pile: SEALED, size: 3 },
      { pile: OPEN, size: 5 },
    ]);
    expect(idsIn(viewOf(ctx.state), CLUE_IDS)).toEqual([i]);
  });

  it("a set with no evidence card in the game: 2 empty piles, logged with sizes 0 and 0", () => {
    const t = table();
    const { state, events } = playFree(t.state, deps, DEAL_EMPTY.id);
    expect([pile(state, "a"), pile(state, "b")]).toEqual([[], []]);
    expect(Object.keys(state.hiddenPiles!)).toEqual([SEALED, OPEN, "a", "b"]);
    expect(events.find((event) => event.type === "hiddenPilesDealt")).toMatchObject({
      from: "no-such-set",
      piles: [
        { pile: "a", size: 0 },
        { pile: "b", size: 0 },
      ],
      kept: false,
    });
  });
});

describe("§3.29 (a) the state is plain data: save, load, replay", () => {
  it("a save and load round trip gives the same state, piles and revealed cards included, and the game goes on the same from it", () => {
    const t = table();
    const gained = use(t, GAIN_TWO).session.state;
    const loaded = JSON.parse(JSON.stringify(gained)) as GameState;
    expect(loaded).toEqual(gained);
    expect(loaded.hiddenPiles).toEqual(gained.hiddenPiles);
    expect(loaded.revealedPileCards).toEqual(gained.revealedPileCards);
    const fromLoaded = use(t, GAIN_TWO, loaded).session.state;
    const fromLive = use(t, GAIN_TWO, gained).session.state;
    expect(fromLoaded).toEqual(fromLive);
    expect(revealedPileCardsOf(fromLoaded, OPEN)).toHaveLength(4);
  });

  it("a replay of gain 2, reveal, gain 1 reproduces the piles, the revealed cards and the random stream", () => {
    const t = table(5);
    const { session } = driveSession(startSession(t.state), deps, [
      useCommand(t, GAIN_TWO),
      useCommand(t, REVEAL),
      useCommand(t, GAIN_ONE),
    ]);
    expect([pile(session.state, SEALED).length, pile(session.state, OPEN).length]).toEqual([0, 3]);
    expect([revealedCount(session.state, OPEN), revealedCount(session.state, SEALED)]).toEqual([3, 3]);
    expectReplays(session);
  });
});
