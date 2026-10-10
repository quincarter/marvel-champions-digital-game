/**
 * `CardSelector victoryDisplay { random, filter }`: a pick at random among the cards in the victory display. "Choose a
 * random BOLT minion from the victory display and reveal it." on a synthetic event (the Return), and the same pick of
 * two and of nine cards.
 *
 * Sources: RRG 1.8 "Victory Display" (p. 46: one out-of-play area shared by all players, its cards faceup). The pick is
 * one draw on the game's seeded RNG per card (`GameState.rng`), so a replay of the command log picks the same card; an
 * empty pool draws nothing. A card that is revealed out of the display is no longer counted there
 * (`ValueSpec victoryDisplayCount`).
 *
 * Synthetic cards only.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, mustInstance } from "./query.js";
import { cardsInPlay, resolveValue } from "./select.js";
import type { CardSelector, EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const BOLT = trait("BOLT");
const BOLT_MINIONS: TargetQuery = { categories: ["minion"], trait: BOLT };
const randomFromDisplay = (count: number, filter?: TargetQuery): CardSelector => ({
  kind: "victoryDisplay",
  random: { kind: "const", value: count },
  ...(filter ? { filter } : {}),
});
const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "action" }, effects });
const returning = (id: string, count: number, filter?: TargetQuery) =>
  action(id, [
    { kind: "selectCards", slot: "back", cards: randomFromDisplay(count, filter) },
    { kind: "revealCard", cards: { kind: "slot", slot: "back" }, player: you },
  ]);

/** "Choose a random BOLT minion from the victory display and reveal it." */
const RETURN_ACTION = returning("return.action", 1, BOLT_MINIONS);
/** "Choose 2 random cards from the victory display and reveal them." / "… 9 …" (more than are there). */
const RETURN_TWO_ACTION = returning("return-two.action", 2, { categories: ["minion"] });
const RETURN_ALL_ACTION = returning("return-all.action", 9, { categories: ["minion"] });

const BOLT_MINION = stubMinion({ id: "bolt", traits: [BOLT], hp: 6, atk: 1, sch: 1, boostIcons: 0 });
const THUG = stubMinion({ id: "thug", hp: 2, atk: 1, sch: 1, boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const RETURN = stubEvent({ id: "return", cost: 0, abilities: [RETURN_ACTION.ref] });
const RETURN_TWO = stubEvent({ id: "return-two", cost: 0, abilities: [RETURN_TWO_ACTION.ref] });
const RETURN_ALL = stubEvent({ id: "return-all", cost: 0, abilities: [RETURN_ALL_ACTION.ref] });
const EVENTS = [RETURN, RETURN_TWO, RETURN_ALL];

const deps: EngineDeps = depsOf(RETURN_ACTION, RETURN_TWO_ACTION, RETURN_ALL_ACTION);

interface Table {
  readonly state: GameState;
  /** What is in the victory display, in order. */
  readonly display: readonly InstanceId[];
}

/** `displayed` names the encounter cards moved from the deck to the victory display, in order (surgery). */
function table(displayed: readonly ("bolt" | "thug" | "filler")[], seed?: number): Table {
  let state = gameAtFirstTurn({
    cards: [BOLT_MINION, THUG, FILLER, ...EVENTS],
    deps,
    deck: EVENTS.map((e) => e.id),
    encounter: [...copiesOf(BOLT_MINION.id, 4), ...copiesOf(THUG.id, 4), ...copiesOf(FILLER.id, 20)],
    ...(seed !== undefined ? { seed } : {}),
  });
  const display: InstanceId[] = [];
  for (const name of displayed) {
    const deckId = activeEncounterDeckId(state);
    const piles = state.encounterDecks[deckId]!;
    const id = piles.deck.find((x) => mustInstance(state, x).cardId === name)!;
    state = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      victoryDisplay: [...state.victoryDisplay, id],
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), faceup: true } },
    };
    display.push(id);
  }
  return { state, display };
}

const boltsDisplayed = (state: GameState) =>
  resolveValue(
    state,
    { kind: "victoryDisplayCount", filter: BOLT_MINIONS },
    { selfInstanceId: null, controllerId: P1, event: null, bindings: {} },
  );
const back = (state: GameState, t: Table) => t.display.filter((id) => !state.victoryDisplay.includes(id));
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("a random card of a trait from the victory display, revealed", () => {
  it("0 eligible (an empty display): nothing is revealed and the RNG is not drawn", () => {
    const t = table([]);
    const { state, session } = playFree(t.state, deps, RETURN.id);
    expect(state.victoryDisplay).toEqual([]);
    expect(state.rng).toEqual(t.state.rng);
    expectReplays(session);
  });

  it("0 eligible (2 cards without the trait in the display): both stay, the RNG is not drawn", () => {
    const t = table(["thug", "filler"]);
    const { state, session } = playFree(t.state, deps, RETURN.id);
    expect(state.victoryDisplay).toEqual(t.display);
    expect(state.rng).toEqual(t.state.rng);
    expectReplays(session);
  });

  it("1 eligible: it is revealed, in play engaged with the player; the display's count of them goes from 1 to 0", () => {
    const t = table(["bolt"]);
    expect(boltsDisplayed(t.state)).toBe(1);
    const { state, session } = playFree(t.state, deps, RETURN.id);
    expect(state.victoryDisplay).toEqual([]);
    expect(cardsInPlay(state)).toContain(t.display[0]);
    expect(mustInstance(state, t.display[0]!)).toMatchObject({ engagedWith: P1, faceup: true, damage: 0 });
    expect(boltsDisplayed(state)).toBe(0);
    expectReplays(session);
  });

  it("3 eligible: exactly 1 of the three is revealed by one RNG draw, 2 stay in their order (count 3 to 2)", () => {
    const t = table(["bolt", "bolt", "bolt"]);
    const { state, session } = playFree(t.state, deps, RETURN.id);
    const gone = back(state, t);
    expect(gone).toHaveLength(1);
    expect(state.victoryDisplay).toEqual(t.display.filter((id) => id !== gone[0]));
    expect(mustInstance(state, gone[0]!).engagedWith).toBe(P1);
    expect(boltsDisplayed(state)).toBe(2);
    expect(state.rng).not.toEqual(t.state.rng);
    expectReplays(session);
  });

  it("the pick follows the seed: the same seed picks the same card twice, and seeds 1 to 40 reach each of the three", () => {
    const pickOf = (seed: number) => {
      const t = table(["bolt", "bolt", "bolt"], seed);
      const { state } = playFree(t.state, deps, RETURN.id);
      return t.display.findIndex((id) => !state.victoryDisplay.includes(id));
    };
    expect(pickOf(21)).toBe(pickOf(21));
    const reached = new Set(Array.from({ length: 40 }, (_, i) => pickOf(i + 1)));
    expect([...reached].sort()).toEqual([0, 1, 2]);
  });

  it("a filter by trait narrows the pool: 2 other minions, a treachery and 1 minion of the trait, always that one", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const t = table(["thug", "filler", "bolt", "thug"], seed);
      const { state, session } = playFree(t.state, deps, RETURN.id);
      expect(back(state, t)).toEqual([t.display[2]]);
      expect(state.victoryDisplay).toHaveLength(3);
      expectReplays(session);
    }
  });
});

describe("more than one card at random from the victory display", () => {
  it("2 of 3 minions: two different cards revealed, 1 stays, and the treachery there is never picked", () => {
    const t = table(["thug", "filler", "bolt", "thug"]);
    const { state, session } = playFree(t.state, deps, RETURN_TWO.id);
    const gone = back(state, t);
    expect(gone).toHaveLength(2);
    expect(gone).not.toContain(t.display[1]);
    expect(state.victoryDisplay).toHaveLength(2);
    for (const id of gone) expect(cardsInPlay(state)).toContain(id);
    expectReplays(session);
  });

  it("9 of 3: all 3 are revealed and no more", () => {
    const t = table(["thug", "bolt", "thug"]);
    const { state, session } = playFree(t.state, deps, RETURN_ALL.id);
    expect(state.victoryDisplay).toEqual([]);
    expect(back(state, t)).toHaveLength(3);
    expectReplays(session);
  });
});
