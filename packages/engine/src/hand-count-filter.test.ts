/**
 * docs/phase7-wave5.md §4.1 Q69: `ValueSpec handCount` takes an optional card `filter`, matched against the named
 * player's hand every time the value is read. For Evil Doppelgänger (`sm` 27154): "Evil Doppelgänger gets +X SCH
 * and +X ATK, where X is equal to the number of identity-specific cards in the engaged player's hand."
 *
 * "Identity-specific" is RRG 1.8 "Identity-Specific Card" (p. 23), the engine's existing `identitySetOf` predicate
 * (`aspect: "hero:<identity card id>"`). "The engaged player" is `PlayerRef engagedWith(self)`; a minion engaged with
 * no one names no player, so X is 0. Synthetic cards only; the engine never names a card.
 */
import type { Aspect } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { characterProfile, mustPlayer } from "./query.js";
import { resolveValue, type EffectContext } from "./select.js";
import type { PlayerRef, TargetQuery, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubMinion } from "./testing/fixtures.js";
import { giveCards, HERO, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2 } from "./testing/wave3.js";

const engaged: PlayerRef = { kind: "engagedWith", of: { kind: "self" } };
const identitySpecific: TargetQuery = { identitySetOf: { kind: "each" } };
const x: ValueSpec = { kind: "handCount", player: engaged, filter: identitySpecific };

const DOPPEL_CONSTANT = stubAbility("doppel.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      { stat: "sch", amount: x, target: { self: true } },
      { stat: "atk", amount: x, target: { self: true } },
    ],
  },
  effects: [],
});
const DOPPEL = stubMinion({ id: "doppel", atk: 1, sch: 1, hp: 5, abilities: [DOPPEL_CONSTANT.ref] });
/** P1's identity-specific card (the stub hero's set) and P2's (the re-titled second seat, `seatIdentities`). */
const P1_SIGNATURE = stubAlly({
  id: "p1-signature",
  cost: 1,
  atk: 1,
  thw: 1,
  hp: 2,
  aspect: `hero:${HERO.id}` as Aspect,
});
const P2_SIGNATURE = stubAlly({
  id: "p2-signature",
  cost: 1,
  atk: 1,
  thw: 1,
  hp: 2,
  aspect: `hero:${HERO.id}-p2` as Aspect,
});
const BASIC = stubAlly({ id: "basic-ally", cost: 1, atk: 1, thw: 1, hp: 2 });

const deps: EngineDeps = depsOf(DOPPEL_CONSTANT);

const game = (players: 1 | 2 = 1): GameState =>
  gameAtFirstTurn({
    cards: [DOPPEL, P1_SIGNATURE, P2_SIGNATURE, BASIC],
    deps,
    players,
    deck: [...copiesOf(P1_SIGNATURE.id, 3), ...copiesOf(P2_SIGNATURE.id, 3), ...copiesOf(BASIC.id, 3)],
    encounter: [...copiesOf(TREACHERY.id, 29), DOPPEL.id],
  });

/** Test surgery: discards every hand so the counts below are exact rather than whatever the opening draw left. */
const emptyHands = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand] })),
});
const give = (state: GameState, player: PlayerId, ...cards: readonly string[]): GameState =>
  giveCards(state, player, ...cards).state;
const dropFromHand = (state: GameState, player: PlayerId, id: InstanceId): GameState => ({
  ...state,
  players: state.players.map((p) =>
    p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id), discard: [...p.discard, id] } : p,
  ),
});
const stats = (state: GameState, id: InstanceId) => {
  const profile = characterProfile(state, id, deps);
  return { atk: profile?.atk, sch: profile?.sch };
};

describe("ValueSpec handCount with a filter (Q69)", () => {
  it("without a filter still counts the whole hand", () => {
    const state = give(emptyHands(game()), P1, P1_SIGNATURE.id, BASIC.id);
    const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
    expect(resolveValue(state, { kind: "handCount", player: { kind: "controller" } }, context, deps)).toBe(2);
    expect(
      resolveValue(
        state,
        { kind: "handCount", player: { kind: "controller" }, filter: identitySpecific },
        context,
        deps,
      ),
    ).toBe(1);
  });

  it("a constant stat bonus tracks identity-specific cards entering and leaving the engaged player's hand", () => {
    const table = minionEngagedWith(emptyHands(game()), DOPPEL.id);
    expect(stats(table.state, table.id)).toEqual({ atk: 1, sch: 1 });
    const two = give(table.state, P1, P1_SIGNATURE.id, P1_SIGNATURE.id);
    expect(stats(two, table.id)).toEqual({ atk: 3, sch: 3 });
    const leaving = mustPlayer(two, P1).hand[0] as InstanceId;
    expect(stats(dropFromHand(two, P1, leaving), table.id)).toEqual({ atk: 2, sch: 2 });
  });

  it("a card that is not identity-specific does not count", () => {
    const table = minionEngagedWith(emptyHands(game()), DOPPEL.id);
    const state = give(table.state, P1, BASIC.id, BASIC.id, P1_SIGNATURE.id);
    expect(mustPlayer(state, P1).hand).toHaveLength(3);
    expect(stats(state, table.id)).toEqual({ atk: 2, sch: 2 });
  });

  it("reads only the engaged player's hand, never another player's", () => {
    const start = emptyHands(game(2));
    const onP1 = minionEngagedWith(start, DOPPEL.id, P1);
    const state = give(give(onP1.state, P1, P1_SIGNATURE.id), P2, P2_SIGNATURE.id, P2_SIGNATURE.id);
    expect(stats(state, onP1.id)).toEqual({ atk: 2, sch: 2 });
    // The same table with the minion engaged with P2 instead: P2's two identity-specific cards count.
    const moved: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== onP1.id) }
          : p.playerId === P2
            ? { ...p, playArea: [...p.playArea, onP1.id] }
            : p,
      ),
      instances: { ...state.instances, [onP1.id]: { ...state.instances[onP1.id]!, engagedWith: P2 } },
    };
    expect(stats(moved, onP1.id)).toEqual({ atk: 3, sch: 3 });
  });

  it("a minion engaged with no one names no engaged player, so X is 0", () => {
    const table = minionEngagedWith(give(emptyHands(game()), P1, P1_SIGNATURE.id), DOPPEL.id);
    expect(stats(table.state, table.id)).toEqual({ atk: 2, sch: 2 });
    const unengaged: GameState = {
      ...table.state,
      instances: { ...table.state.instances, [table.id]: { ...table.state.instances[table.id]!, engagedWith: null } },
    };
    expect(stats(unengaged, table.id)).toEqual({ atk: 1, sch: 1 });
  });
});
