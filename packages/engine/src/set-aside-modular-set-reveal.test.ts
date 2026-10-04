/**
 * docs/phase7-wave6.md §3.62: `EffectSpec shuffleInSetAsideModularSet`'s `reveal` and `placement`, driven with stub
 * cards: three "genre" sets of a SHOW environment and four blank treacheries each.
 *
 * Sources: MojoMania 1B (`mojo` 39025b): "When Revealed: Choose 1 set-aside encounter set at random, reveal its SHOW
 * environment and shuffle its remaining cards into the encounter deck."; Wheel of Genres, Stopped (39026b): "Forced
 * Interrupt: At the start of step three of the villain phase (deal encounter cards), randomly choose 1 set-aside modular
 * set and reveal its SHOW environment. Shuffle the rest of that modular set and place it on top of the encounter deck.
 * Deal the first player 2 facedown encounter cards and flip this card."; Wheel of Genres, Spinning (39026a): "if there
 * are no set-aside modular encounter sets remaining, the players lose the game"; the SHOW environments (39035 …): "If
 * this card was revealed from the encounter deck, it gains surge"; MojoMania insert p. 18 (a SHOW environment revealed
 * by Wheel of Genres "was not 'revealed from the encounter deck'"); RRG 1.8 "Reveal" (p. 37), "Villain Phase" (p. 47).
 */

import { encounterSetId, trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId } from "./query.js";
import { nextInt, shuffle } from "./rng.js";
import { resolveValue } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { auditVillainPhases } from "./villain/audit.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, P1, playFree } from "./testing/wave3.js";

const SHOW_TRAIT = trait("SHOW");
const SHOW_QUERY: TargetQuery = { categories: ["environment"], trait: SHOW_TRAIT };

/** The SHOW environments' surge clause, with a counter that shows the When Revealed resolved. */
const SHOW_REVEALED = stubAbility("show.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "revealed", amount: { kind: "const", value: 1 } },
    { kind: "if", condition: { kind: "revealedFromEncounterDeck" }, then: [{ kind: "gainSurge" }] },
  ],
});
const show = (id: string, set: string | null): AnyCard => ({
  ...stubEnvironment({ id, traits: [SHOW_TRAIT], abilities: [SHOW_REVEALED.ref] }),
  encounterSetIds: set ? [encounterSetId(set)] : [],
});
interface Genre {
  readonly encounterSetId: string;
  readonly show: AnyCard | null;
  readonly rest: readonly AnyCard[];
  readonly cardIds: readonly CardId[];
}
function genre(letter: string, withShow = true): Genre {
  const set = `genre-${letter}`;
  const theShow = withShow ? show(`${letter}-show`, set) : null;
  const rest = [1, 2, 3, 4].map((n) => stubTreachery({ id: `${letter}${n}`, encounterSetIds: [set], boostIcons: 0 }));
  return {
    encounterSetId: set,
    show: theShow,
    rest,
    cardIds: [...(theShow ? [theShow.id] : []), ...rest.map((c) => c.id)],
  };
}
const GENRE_A = genre("a");
const GENRE_B = genre("b");
const GENRE_C = genre("c");
/** A set with no SHOW environment. */
const GENRE_PLAIN = genre("p", false);
const GENRES = [GENRE_A, GENRE_B, GENRE_C, GENRE_PLAIN];

/** A SHOW environment that starts in the encounter deck: revealed from there, it surges. */
const DECK_SHOW = show("deck-show", null);
const BOOST = stubTreachery({ id: "boost", boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** MojoMania 1B: "…reveal its SHOW environment and shuffle its remaining cards into the encounter deck." */
const MANIA = action("mania", [{ kind: "shuffleInSetAsideModularSet", reveal: SHOW_QUERY }]);
/** Wheel of Genres, Stopped, as an action: "…Shuffle the rest of that modular set and place it on top of the encounter deck." */
const SPIN = action("spin", [{ kind: "shuffleInSetAsideModularSet", reveal: SHOW_QUERY, placement: "shuffledOnTop" }]);
/** The effect with neither field, as The Hood uses it. */
const PLAIN = action("plain", [{ kind: "shuffleInSetAsideModularSet" }]);
/** Wheel of Genres, Spinning: "if there are no set-aside modular encounter sets remaining, the players lose the game. Otherwise, …" */
const CHECK = action("check", [
  {
    kind: "if",
    condition: {
      kind: "compare",
      left: { kind: "setAsideModularSetCount" },
      op: "equalTo",
      right: { kind: "const", value: 0 },
    },
    then: [{ kind: "endGame", result: "loss" }],
    otherwise: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
  },
]);
const ACTIONS = [MANIA, SPIN, PLAIN, CHECK];
/** Wheel of Genres, Stopped, less its flip. */
const WHEEL_INTERRUPT = stubAbility("wheel.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "villainStepStarting", eventIs: { step: "dealEncounterCards" } },
  },
  effects: [
    { kind: "shuffleInSetAsideModularSet", reveal: SHOW_QUERY, placement: "shuffledOnTop" },
    { kind: "dealEncounterCard", player: { kind: "firstPlayer" }, count: { kind: "const", value: 2 } },
  ],
});
const WHEEL = stubEnvironment({ id: "wheel", abilities: [WHEEL_INTERRUPT.ref] });

const deps: EngineDeps = depsOf(SHOW_REVEALED, WHEEL_INTERRUPT, ...ACTIONS.map((a) => a.ability));
const CARDS: readonly AnyCard[] = [
  ...DEFAULT_CARDS,
  ...GENRES.flatMap((g) => [...(g.show ? [g.show] : []), ...g.rest]),
  DECK_SHOW,
  BOOST,
  FILLER,
  WHEEL,
  ...ACTIONS.map((a) => a.card),
];

/** A game at the first turn with `genres` set aside, in that order. */
function game(genres: readonly Genre[], seed = 62): GameState {
  const result = createGame(
    {
      seed,
      cards: CARDS,
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [WHEEL.id, DECK_SHOW.id, BOOST.id, ...copiesOf(FILLER.id, 12)],
      players: [
        { identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...ACTIONS.flatMap((a) => [a.card.id, a.card.id])] },
      ],
      setAsideModularSets: genres.map((g) => ({ encounterSetId: g.encounterSetId, cardIds: g.cardIds })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const encounterDeck = (state: GameState): readonly InstanceId[] =>
  state.encounterDecks[activeEncounterDeckId(state)]!.deck;
const cardIds = (state: GameState, ids: readonly InstanceId[]): readonly string[] =>
  ids.map((id) => String(state.instances[id]?.cardId));
const instancesOf = (state: GameState, cards: readonly AnyCard[]): readonly InstanceId[] =>
  cards.map((card) => Object.values(state.instances).find((i) => i.cardId === card.id)!.instanceId);
const setsLeft = (state: GameState): readonly string[] =>
  (state.setAsideModularSets ?? []).map((set) => set.encounterSetId);
const count = (state: GameState): number =>
  resolveValue(
    state,
    { kind: "setAsideModularSetCount" },
    { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps },
    deps,
  );
const revealedCounter = (state: GameState, card: AnyCard): number =>
  Object.values(state.instances).find((i) => i.cardId === card.id)?.counters.revealed ?? 0;
const inPlay = (state: GameState, card: AnyCard): boolean =>
  state.villainArea.some((id) => state.instances[id]?.cardId === card.id);
const shuffledIn = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "setAsideModularSetShuffledIn" ? [e] : []));

const GENRE_CARDS = new Set<string>(GENRES.flatMap((g) => g.cardIds));
/** What the effect did, in order, as the log tells it. */
function trace(state: GameState, events: readonly GameEvent[]): readonly string[] {
  const lines: string[] = [];
  for (const e of events) {
    if (e.type === "cardMoved" && GENRE_CARDS.has(e.cardId)) lines.push(`${e.cardId}: ${e.from.kind} -> ${e.to.kind}`);
    if (e.type === "cardMoved" && !GENRE_CARDS.has(e.cardId) && e.to.kind === "dealtEncounter")
      lines.push(`${e.cardId}: ${e.from.kind} -> ${e.to.kind}`);
    if (e.type === "encounterCardRevealed") lines.push(`${e.playerId} reveals ${e.cardId}`);
    if (e.type === "abilityResolved" && e.abilityId === SHOW_REVEALED.ref.id) lines.push("When Revealed resolved");
    if (e.type === "surgeTriggered") lines.push("surge");
    if (e.type === "deckShuffled" && e.zone.kind === "encounterDeck") lines.push("encounter deck shuffled");
    if (e.type === "setAsideModularSetShuffledIn")
      lines.push(`${e.encounterSetId} ${e.placement}: ${cardIds(state, e.instanceIds).join(", ")}`);
    if (e.type === "triggerEvent" && e.event.kind === "villainStepStarting")
      lines.push(`start of step three ${e.phase}`);
    if (e.type === "stepChanged" && e.from.kind === "dealEncounterCards" && e.to.kind !== "dealEncounterCards")
      lines.push(`step ${e.to.kind}`);
  }
  return lines;
}

function expectReplays(session: { readonly log: Parameters<typeof replay>[0]; readonly state: GameState }): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§3.62 shuffleInSetAsideModularSet with `reveal` (MojoMania 1B)", () => {
  it("reveals the chosen set's SHOW environment from the set-aside area, then shuffles the rest into the encounter deck", () => {
    const before = game([GENRE_A]);
    const deckBefore = encounterDeck(before);
    const { state, events, session } = playFree(before, deps, MANIA.card.id);
    expect(trace(state, events)).toEqual([
      "a-show: encounterSetAside -> dealtEncounter",
      "p1 reveals a-show",
      "a-show: dealtEncounter -> villainArea",
      "When Revealed resolved",
      // Only now does the rest of the set move.
      "a1: encounterSetAside -> encounterDeck",
      "a2: encounterSetAside -> encounterDeck",
      "a3: encounterSetAside -> encounterDeck",
      "a4: encounterSetAside -> encounterDeck",
      "encounter deck shuffled",
      "genre-a shuffleIn: a1, a2, a3, a4",
    ]);
    // The When Revealed resolved, and it did not surge: the card was not revealed from the encounter deck.
    expect(revealedCounter(state, GENRE_A.show!)).toBe(1);
    expect(inPlay(state, GENRE_A.show!)).toBe(true);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(1);
    expect(encounterDeck(state)).toHaveLength(deckBefore.length + 4);
    for (const id of instancesOf(state, GENRE_A.rest)) expect(encounterDeck(state)).toContain(id);
    expect(state.encounterSetAside.some((id) => GENRE_CARDS.has(String(state.instances[id]?.cardId)))).toBe(false);
    expect(state.players[0]!.dealtEncounter).toEqual([]);
    expect(setsLeft(state)).toEqual([]);
    expectReplays(session);
  });

  it("the same SHOW environment revealed from the encounter deck does surge (the stub's clause is live)", () => {
    const base = game([GENRE_A]);
    const deckId = activeEncounterDeckId(base);
    const piles = base.encounterDecks[deckId]!;
    const top = [BOOST, DECK_SHOW].map((card) => piles.deck.find((id) => base.instances[id]?.cardId === card.id)!);
    const state: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { ...piles, deck: [...top, ...piles.deck.filter((id) => !top.includes(id))] },
      },
    };
    const { events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]);
    expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
  });

  it("the random pick among several set-aside sets is the game's seeded RNG's, and replays", () => {
    const genres = [GENRE_A, GENRE_B, GENRE_C];
    const chosen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const before = game(genres, seed);
      const [pick] = nextInt(before.rng, genres.length);
      const expected = genres[pick]!;
      const { state, events, session } = playFree(before, deps, MANIA.card.id);
      const [logged] = shuffledIn(events);
      expect(logged?.encounterSetId).toBe(expected.encounterSetId);
      expect(events.flatMap((e) => (e.type === "encounterCardRevealed" ? [String(e.cardId)] : []))).toEqual([
        String(expected.show!.id),
      ]);
      expect(setsLeft(state)).toEqual(genres.filter((g) => g !== expected).map((g) => g.encounterSetId));
      // The other sets stay set aside, whole.
      for (const other of genres.filter((g) => g !== expected))
        for (const id of instancesOf(state, [other.show!, ...other.rest]))
          expect(state.encounterSetAside).toContain(id);
      expect(count(state)).toBe(2);
      expectReplays(session);
      // The same seed picks the same set again.
      const again = playFree(game(genres, seed), deps, MANIA.card.id);
      expect(again.state).toEqual(state);
      chosen.add(expected.encounterSetId);
    }
    // Not always the first set (nor any one set): the pick varies with the seed.
    expect(chosen.size).toBeGreaterThan(1);
  });

  it("a set with no card matching `reveal` reveals nothing and moves whole", () => {
    const { state, events } = playFree(game([GENRE_PLAIN]), deps, MANIA.card.id);
    expect(trace(state, events)).toEqual([
      "p1: encounterSetAside -> encounterDeck",
      "p2: encounterSetAside -> encounterDeck",
      "p3: encounterSetAside -> encounterDeck",
      "p4: encounterSetAside -> encounterDeck",
      "encounter deck shuffled",
      "genre-p shuffleIn: p1, p2, p3, p4",
    ]);
  });

  it("without `reveal` the SHOW environment is shuffled in with the rest, as before, and the log names the placement", () => {
    const before = game([GENRE_A]);
    const { state, events } = playFree(before, deps, PLAIN.card.id);
    expect(shuffledIn(events)).toEqual([
      {
        type: "setAsideModularSetShuffledIn",
        encounterSetId: "genre-a",
        instanceIds: before.setAsideModularSets![0]!.instanceIds,
        placement: "shuffleIn",
      },
    ]);
    expect(events.some((e) => e.type === "encounterCardRevealed")).toBe(false);
    expect(encounterDeck(state)).toContain(instancesOf(state, [GENRE_A.show!])[0]);
    expect(revealedCounter(state, GENRE_A.show!)).toBe(0);
  });

  it("with one set left, then none: the last set comes in, the count reads 0, and a second use does nothing", () => {
    const one = game([GENRE_B]);
    expect(count(one)).toBe(1);
    // Wheel of Genres, Spinning, with a set still set aside: "Otherwise, …".
    const threatOn = (state: GameState): number => state.instances[state.mainScheme.instanceId]?.threat ?? Number.NaN;
    const checked = playFree(one, deps, CHECK.card.id).state;
    expect(checked.outcome).toBeNull();
    expect(threatOn(checked)).toBe(threatOn(one) + 1);

    const none = playFree(one, deps, MANIA.card.id).state;
    expect(inPlay(none, GENRE_B.show!)).toBe(true);
    expect(count(none)).toBe(0);
    expect(none.setAsideModularSets).toEqual([]);

    const deck = encounterDeck(none);
    const again = playFree(none, deps, MANIA.card.id);
    expect(trace(again.state, again.events)).toEqual([]);
    expect(encounterDeck(again.state)).toEqual(deck);
    expect(again.state.rng).toEqual(none.rng);

    // "…if there are no set-aside modular encounter sets remaining, the players lose the game."
    const lost = playFree(none, deps, CHECK.card.id).state;
    expect(lost.outcome?.result).toBe("loss");
  });
});

describe("§3.62 `placement: shuffledOnTop` (Wheel of Genres, Stopped)", () => {
  it("shuffles the rest of the set on its own and places it on top of the encounter deck, which keeps its order", () => {
    const before = game([GENRE_C], 7);
    const deckBefore = encounterDeck(before);
    const rest = instancesOf(before, GENRE_C.rest);
    // The pick (of one) draws first, then the shuffle of the four remaining cards.
    const [, afterPick] = nextInt(before.rng, 1);
    const [order, afterShuffle] = shuffle(rest, afterPick);
    expect(order).not.toEqual(rest);

    const { state, events, session } = playFree(before, deps, SPIN.card.id);
    const placed = cardIds(state, order);
    expect(trace(state, events)).toEqual([
      "c-show: encounterSetAside -> dealtEncounter",
      "p1 reveals c-show",
      "c-show: dealtEncounter -> villainArea",
      "When Revealed resolved",
      ...[...placed].reverse().map((id) => `${id}: encounterSetAside -> encounterDeck`),
      `genre-c shuffledOnTop: ${placed.join(", ")}`,
    ]);
    expect(encounterDeck(state)).toEqual([...order, ...deckBefore]);
    expect(state.rng).toEqual(afterShuffle);
    for (const id of order) expect(state.instances[id]?.faceup).toBe(false);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
    expect(revealedCounter(state, GENRE_C.show!)).toBe(1);
    expectReplays(session);
  });

  it("at the start of step three: the SHOW is revealed, the set goes on top, and its cards are the next ones dealt", () => {
    const genres = [GENRE_A, GENRE_B, GENRE_C];
    const base = encounterCardInVillainArea(game(genres, 11), WHEEL.id).state;
    // The villain's boost card on top, so step two takes it and nothing else leaves the deck before step three.
    const deckId = activeEncounterDeckId(base);
    const piles = base.encounterDecks[deckId]!;
    const boost = piles.deck.find((id) => base.instances[id]?.cardId === BOOST.id)!;
    const before: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { ...piles, deck: [boost, ...piles.deck.filter((id) => id !== boost)] },
      },
    };
    const { session, events } = driveSession(startSession(before), deps, [{ type: "endTurn", playerId: P1 }]);
    const state = session.state;
    const [logged] = shuffledIn(events);
    const chosen = genres.find((g) => g.encounterSetId === logged?.encounterSetId)!;
    const placed = cardIds(state, logged!.instanceIds);
    expect([...placed].sort()).toEqual(chosen.rest.map((c) => String(c.id)));
    const showId = String(chosen.show!.id);

    const lines = trace(state, events);
    const from = lines.indexOf("start of step three initiated");
    expect(lines.slice(from, lines.indexOf("step revealEncounterCards") + 1)).toEqual([
      "start of step three initiated",
      `${showId}: encounterSetAside -> dealtEncounter`,
      `p1 reveals ${showId}`,
      `${showId}: dealtEncounter -> villainArea`,
      "When Revealed resolved",
      ...[...placed].reverse().map((id) => `${id}: encounterSetAside -> encounterDeck`),
      `${chosen.encounterSetId} shuffledOnTop: ${placed.join(", ")}`,
      // "Deal the first player 2 facedown encounter cards": the top two of the set just placed.
      `${placed[0]}: encounterDeck -> dealtEncounter`,
      `${placed[1]}: encounterDeck -> dealtEncounter`,
      "start of step three resolved",
      // Step three's own deal: the next card of the set.
      `${placed[2]}: encounterDeck -> dealtEncounter`,
      "step revealEncounterCards",
    ]);
    // Step four reveals the three dealt cards; the SHOW's reveal came before them and nothing surged.
    expect(lines.filter((line) => line.startsWith("p1 reveals"))).toEqual([
      `p1 reveals ${showId}`,
      `p1 reveals ${placed[0]}`,
      `p1 reveals ${placed[1]}`,
      `p1 reveals ${placed[2]}`,
    ]);
    expect(lines).not.toContain("surge");
    expect(lines).not.toContain("encounter deck shuffled");
    // The fourth card of the set is still on top of the encounter deck.
    expect(cardIds(state, encounterDeck(state).slice(0, 1))).toEqual([placed[3]]);
    expect(inPlay(state, chosen.show!)).toBe(true);
    expect(revealedCounter(state, chosen.show!)).toBe(1);
    expect(setsLeft(state)).toEqual(genres.filter((g) => g !== chosen).map((g) => g.encounterSetId));

    const audit = auditVillainPhases(session.log, deps);
    expect(audit.violations).toEqual([]);
    expect(audit.phases[0]?.dealt.map((d) => String(state.instances[d.instanceId]?.cardId))).toEqual([placed[2]]);
    expectReplays(session);
  });
});
