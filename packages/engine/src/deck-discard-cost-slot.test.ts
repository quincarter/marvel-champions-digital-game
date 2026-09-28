/**
 * `AbilityCost.discardFromDeckSlot`: the cards a "discard the top N cards of your deck →" cost discarded, bound on the
 * ability's own frame so its effects can name them. Synthetic support shaped like Aunt May & Uncle Ben (`spdr` 31007):
 * "Action: Exhaust Aunt May & Uncle Ben and discard the top 2 cards of your deck (top 3 cards instead if you are in
 * alter-ego form) → add each SP//dr card discarded this way to your hand." Here the marker is the `justice` aspect.
 *
 * Sources: RRG 1.8 "Cost" (p. 13): a cost is paid in full; "Player Deck" (p. 33): "If the player's deck empties while
 * the player was discarding cards from their deck, no further cards are discarded from the newly shuffled deck", so a
 * deck of fewer cards cannot pay (`planCost`). docs/phase7-wave3.md §4 Q18 (Teen Spirit): a bound card the reset
 * shuffled into the new deck is still named by its slot.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

const MAY_ABILITY = stubAbility(
  "may.action",
  def({
    trigger: { kind: "action" },
    cost: {
      exhaustSelf: true,
      discardFromDeck: {
        kind: "conditional",
        if: { kind: "form", form: "alterEgo", player: { kind: "controller" } },
        then: { kind: "const", value: 3 },
        else: { kind: "const", value: 2 },
      },
      discardFromDeckSlot: "milled",
    },
    effects: [
      {
        kind: "moveCards",
        cards: { kind: "ref", ref: { kind: "slot", slot: "milled" }, filter: { aspect: "justice" } },
        to: "hand",
      },
    ],
  }),
);
const MAY = stubUpgrade({ id: "may", cost: 0, abilities: [MAY_ABILITY.ref] });
const MATCH = stubEvent({ id: "match", cost: 0, aspect: "justice" });
const OTHER = stubEvent({ id: "other", cost: 0 });
const deps = depsOf(MAY_ABILITY);

/**
 * p1 with the support in play, in `form`; the deck's top is `top` (in order), then `rest` more OTHER copies; the discard
 * pile holds `discard` OTHER copies. Every other card p1 owns goes to the hand (surgery before the session starts).
 */
function start(
  form: "hero" | "alterEgo",
  top: readonly ("match" | "other")[],
  rest: number,
  discard = 0,
): { state: GameState; may: InstanceId; top: readonly InstanceId[] } {
  const base = gameAtFirstTurn({
    cards: [MAY, MATCH, OTHER],
    deps,
    deck: [MAY.id, ...copiesOf(MATCH.id, 4), ...copiesOf(OTHER.id, 12)],
  });
  const may = playerCardIntoPlay(base, MAY.id);
  const seat = mustPlayer(may.state, P1);
  const pool = [...seat.hand, ...seat.deck, ...seat.discard];
  const taken = new Set<InstanceId>();
  const take = (card: "match" | "other"): InstanceId => {
    const cardId = card === "match" ? MATCH.id : OTHER.id;
    const id = pool.find((candidate) => !taken.has(candidate) && may.state.instances[candidate]?.cardId === cardId);
    if (!id) throw new Error(`no ${card} copy left`);
    taken.add(id);
    return id;
  };
  const topIds = top.map(take);
  const restIds = Array.from({ length: rest }, () => take("other"));
  const discardIds = Array.from({ length: discard }, () => take("other"));
  const state: GameState = {
    ...may.state,
    players: may.state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: pool.filter((id) => !taken.has(id)),
            deck: [...topIds, ...restIds],
            discard: discardIds,
            identity: { ...p.identity, form },
          }
        : p,
    ),
  };
  return { state, may: may.id, top: topIds };
}

const use = (may: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: may,
  abilityId: MAY_ABILITY.ref.id,
  payment: [],
});

describe("discardFromDeckSlot: the cards a deck-discard cost discarded, named by its effects", () => {
  it("hero form discards exactly 2; only the matching one goes to hand, the other stays in the discard pile", () => {
    const { state, may, top } = start("hero", ["match", "other", "match"], 5);
    const { session } = driveSession(startSession(state), deps, [use(may)]);
    const seat = mustPlayer(session.state, P1);
    expect(mustInstance(session.state, may).exhausted).toBe(true);
    expect(seat.hand).toContain(top[0]);
    expect(seat.discard).toEqual([top[1]]);
    // The third card was not discarded: it is still the top of the deck.
    expect(seat.deck[0]).toBe(top[2]);
    expect(seat.hand).not.toContain(top[2]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("alter-ego form discards exactly 3 (the value is read when the cost is paid)", () => {
    const { state, may, top } = start("alterEgo", ["other", "match", "match", "match"], 5);
    const { session } = driveSession(startSession(state), deps, [use(may)]);
    const seat = mustPlayer(session.state, P1);
    expect(seat.hand).toEqual(expect.arrayContaining([top[1], top[2]]));
    expect(seat.discard).toEqual([top[0]]);
    expect(seat.deck[0]).toBe(top[3]);
  });

  it("with no matching card discarded, nothing goes to hand", () => {
    const { state, may, top } = start("hero", ["other", "other"], 5);
    const handBefore = mustPlayer(state, P1).hand;
    const { session } = driveSession(startSession(state), deps, [use(may)]);
    const seat = mustPlayer(session.state, P1);
    expect(seat.hand).toEqual(handBefore);
    expect([...seat.discard].sort()).toEqual([...top].sort());
  });

  it("a deck of fewer cards than the cost cannot pay it (RRG 1.8 'Cost' p. 13, 'Player Deck' p. 33)", () => {
    const { state, may } = start("hero", ["match"], 0, 4);
    const result = applyCommand(startSession(state).state, use(may), deps);
    expect(result.ok).toBe(false);
    expect(mustInstance(state, may).exhausted).toBe(false);
  });

  it("a deck the cost empties resets at once; the slot still names a card shuffled into the new deck (§4 Q18)", () => {
    const { state, may, top } = start("hero", ["other", "match"], 0);
    const { session } = driveSession(startSession(state), deps, [use(may)]);
    const seat = mustPlayer(session.state, P1);
    expect(seat.dealtEncounter).toHaveLength(1);
    expect(seat.hand).toContain(top[1]);
    expect(seat.hand).not.toContain(top[0]);
    expect([...seat.deck, ...seat.discard]).toContain(top[0]);
  });
});
