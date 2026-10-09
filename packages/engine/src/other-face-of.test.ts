/**
 * docs/phase7-wave8.md §3.46: one printed card as two cards (`TargetQuery.otherFaceOf`).
 *
 * MC45 p. 14: "The [PRELATE] minions (179-183) are found on the reverse sides of the [OVERSEER] minions. Defeating a
 * [PRELATE] minion does not remove its [OVERSEER] version from the campaign." Ruling April 30, 2026, Ruling 4 (2); RRG
 * 1.8 "Double-Sided Card" (p. 17). Owner decision §4.1 Q21 = A: there are five physical cards, and the one serving as
 * the Overseer is not available as a Prelate in the same game, so four are set aside.
 *
 * Synthetic cards shaped like the five pairs: a "warden" minion whose reverse is a "prefect" minion.
 */

import { flat, trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { createGame } from "./setup.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { locateCard } from "./query.js";
import { matchesQuery, type EffectContext } from "./select.js";
import type { TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "./testing/scenario.js";
import { copiesOf, minionEngagedWith, P1, playFree } from "./testing/wave3.js";

const WARDEN = trait("WARDEN");
const PREFECT = trait("PREFECT");
const NAMES = ["ash", "birch", "cedar", "dogwood", "elm"] as const;
const pair = (name: string): readonly [AnyCard, AnyCard] => {
  const a = { ...stubMinion({ id: `${name}-warden`, atk: 2, sch: 1, hp: 4 }), traits: [WARDEN] };
  const b = { ...stubMinion({ id: `${name}-prefect`, atk: 1, sch: 2, hp: 3 }), traits: [PREFECT] };
  return [
    { ...a, otherFaceId: b.id as CardId },
    { ...b, otherFaceId: a.id as CardId },
  ];
};
const PAIRS = NAMES.map(pair);
const WARDENS = PAIRS.map(([a]) => a);
const PREFECTS = PAIRS.map(([, b]) => b);
/** A minion with no other face. */
const LONER = stubMinion({ id: "loner", atk: 1, sch: 1, hp: 1 });

const wardenInPlay: TargetRef = { kind: "each", query: { categories: ["minion"], trait: WARDEN } };
const REVERSE: TargetQuery = { categories: ["minion"], otherFaceOf: wardenInPlay };
/** "Remove from the game the set-aside minion that is the other face of the [WARDEN] minion in play." */
const BENCH = stubAbility("bench.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "encounterSetAside", filter: REVERSE },
      to: "removedFromGame",
    },
  ],
});
const BENCH_CARD = stubEvent({ id: "bench", cost: 0, abilities: [BENCH.ref] });
/** "Flip each [WARDEN] minion in play." */
const TURN = stubAbility("turn.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "flipCard", target: wardenInPlay }],
});
const TURN_CARD = stubEvent({ id: "turn", cost: 0, abilities: [TURN.ref] });
const deps: EngineDeps = depsOf(BENCH, TURN);

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });

/** P1 at their first turn: the five wardens and the loner in the encounter deck, the five prefects set aside. */
function table(): GameState {
  const created = createGame(
    {
      seed: 21,
      cards: [...DEFAULT_CARDS, TYRANT, SCHEME, NOISE, LONER, BENCH_CARD, TURN_CARD, ...WARDENS, ...PREFECTS],
      villainCardId: TYRANT.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [...WARDENS.map((card) => card.id), LONER.id, ...copiesOf(NOISE.id, 12)],
      setAside: PREFECTS.map((card) => card.id),
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, BENCH_CARD.id, BENCH_CARD.id, TURN_CARD.id] }],
    },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  return driveSession(startSession(created.state), deps).session.state;
}
const cardIds = (state: GameState, ids: readonly InstanceId[]): readonly string[] =>
  ids.map((id) => state.instances[id]!.cardId as string).sort();
const instanceOf = (state: GameState, card: AnyCard): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card.id)!.instanceId;
const CONTEXT: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };

describe("§3.46 the other face of a card, as a card of its own", () => {
  it.each([3, 2])(
    "with warden %i in play, exactly its own prefect is removed from the game and four stay set aside",
    (n) => {
      const drawn = minionEngagedWith(table(), WARDENS[n]!.id);
      const run = playFree(drawn.state, deps, BENCH_CARD.id);
      expect(cardIds(run.state, run.state.removedFromGame)).toEqual([PREFECTS[n]!.id]);
      expect(cardIds(run.state, run.state.encounterSetAside)).toEqual(
        PREFECTS.filter((_, index) => index !== n)
          .map((card) => card.id as string)
          .sort(),
      );
      // The warden itself is untouched: the two are separate cards in this game.
      expect(locateCard(run.state, drawn.id)).toMatchObject({ kind: "playArea" });
      const replayed = replay(run.session.log, deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(run.state);
    },
  );

  it("no warden in play (a standalone game): nothing matches and all five prefects stay set aside", () => {
    const run = playFree(table(), deps, BENCH_CARD.id);
    expect(run.state.removedFromGame).toEqual([]);
    expect(run.state.encounterSetAside).toHaveLength(5);
  });

  it("a second game with another warden removes the other prefect and has the first set aside again", () => {
    const first = playFree(minionEngagedWith(table(), WARDENS[3]!.id).state, deps, BENCH_CARD.id).state;
    const retry = playFree(minionEngagedWith(table(), WARDENS[2]!.id).state, deps, BENCH_CARD.id).state;
    expect(cardIds(first, first.removedFromGame)).toEqual([PREFECTS[3]!.id]);
    expect(cardIds(retry, retry.removedFromGame)).toEqual([PREFECTS[2]!.id]);
    expect(cardIds(retry, retry.encounterSetAside)).toContain(PREFECTS[3]!.id);
  });

  it("is read from card data, in either direction, wherever the cards are; a card is never its own other face", () => {
    const drawn = minionEngagedWith(table(), WARDENS[0]!.id);
    const state = drawn.state;
    const prefect = instanceOf(state, PREFECTS[0]!);
    const ctx = CONTEXT;
    const of = (ref: TargetRef): TargetQuery => ({ otherFaceOf: ref });
    const exactly = (id: InstanceId): TargetRef => ({
      kind: "find",
      query: { name: state.cardPool[state.instances[id]!.cardId]!.name },
    });
    // The set-aside prefect is the other face of the warden in play, and the warden of the prefect.
    expect(matchesQuery(state, prefect, of(wardenInPlay), ctx)).toBe(true);
    expect(matchesQuery(state, drawn.id, of(exactly(prefect)), ctx)).toBe(true);
    // Not itself, not another pair's prefect, not a card with no other face.
    expect(matchesQuery(state, drawn.id, of(wardenInPlay), ctx)).toBe(false);
    expect(matchesQuery(state, instanceOf(state, PREFECTS[1]!), of(wardenInPlay), ctx)).toBe(false);
    expect(matchesQuery(state, instanceOf(state, LONER), of(wardenInPlay), ctx)).toBe(false);
    expect(matchesQuery(state, prefect, of(exactly(instanceOf(state, LONER))), ctx)).toBe(false);
    // A ref naming nothing matches nothing.
    expect(
      matchesQuery(state, prefect, of({ kind: "each", query: { categories: ["ally"], trait: WARDEN } }), ctx),
    ).toBe(false);
    // A warden still in the encounter deck (out of play) is read the same way.
    const deckWarden = instanceOf(state, WARDENS[4]!);
    expect(matchesQuery(state, instanceOf(state, PREFECTS[4]!), of(exactly(deckWarden)), ctx)).toBe(true);
  });

  it("a flipped instance is read as the face it is on: once the warden in play has turned to its prefect face, the set-aside prefect is the same card, not its other face", () => {
    const drawn = minionEngagedWith(table(), WARDENS[1]!.id);
    const flipped = playFree(drawn.state, deps, TURN_CARD.id).state;
    expect(flipped.instances[drawn.id]!.cardId).toBe(PREFECTS[1]!.id);
    const setAsidePrefect = flipped.encounterSetAside.find((id) => flipped.instances[id]!.cardId === PREFECTS[1]!.id)!;
    const inPlay: TargetRef = { kind: "each", query: { categories: ["minion"], trait: PREFECT } };
    expect(matchesQuery(flipped, setAsidePrefect, { otherFaceOf: inPlay }, CONTEXT)).toBe(false);
  });
});
