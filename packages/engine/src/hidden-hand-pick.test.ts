/**
 * `EffectSpec chooseCards.hiddenHands` (owner answer 211, docs/phase7-wave11-scenarios.md §4.1): the first player
 * selects among cards in another player's hand (RRG 1.8 "First Player", p. 19) without the hand being revealed (p. 42,
 * "Table Talk": players are not required to disclose their hands). Proven with synthetic events in hand and an action
 * of p1's that picks one card among every hand and discards it.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { facedownOptionId } from "./choices.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";
import { offeredByOpenChoice } from "./visibility.js";

const def = (definition: AbilityDefinition) => definition;
const GEM = stubEvent({ id: "gem", cost: 2 });
const ORB = stubEvent({ id: "orb", cost: 2 });
const ORE = stubEvent({ id: "ore", cost: 2 });
const OWN = stubEvent({ id: "own", cost: 2 });

/** "The first player chooses a card in any hand; discard it." */
const pick: EffectSpec = {
  kind: "chooseCards",
  slot: "picked",
  from: { kind: "zone", zone: "hand", player: { kind: "each" } },
  chooser: { kind: "firstPlayer" },
  min: 1,
  max: 1,
  hiddenHands: true,
};
const discardPicked: EffectSpec = {
  kind: "moveCards",
  cards: { kind: "ref", ref: { kind: "slot", slot: "picked" } },
  to: "discard",
};
const ACTION = stubAbility("picker.action", def({ trigger: { kind: "action" }, effects: [pick, discardPicked] }));
const PICKER = stubSupport({ id: "picker", cost: 0, abilities: [ACTION.ref] });
const deps = depsOf(ACTION);

const handOf = (s: GameState, p: PlayerId): readonly InstanceId[] => s.players.find((x) => x.playerId === p)!.hand;
const discardOf = (s: GameState, p: PlayerId): readonly InstanceId[] =>
  s.players.find((x) => x.playerId === p)!.discard;
/** A copy of `card` in `p`'s deck or opening hand. */
const copyOf = (s: GameState, p: PlayerId, card: string): InstanceId => {
  const seat = s.players.find((x) => x.playerId === p)!;
  return [...seat.deck, ...seat.hand].find((i) => (s.instances[i]!.cardId as string) === card)!;
};

/** Two seats; p1 holds `own` copies of OWN, p2 holds GEM and ORB (or GEM alone); p1 uses the action. */
function open(o: { own: number; p2: readonly string[]; seed?: number }) {
  let state = gameAtFirstTurn({
    players: 2,
    seed: o.seed ?? 21,
    cards: [PICKER, GEM, ORB, ORE, OWN],
    deps,
    deck: [PICKER.id, GEM.id, ORB.id, ORE.id, OWN.id],
  });
  const put = playerCardIntoPlay(state, PICKER.id);
  state = put.state;
  const p1Hand = o.own > 0 ? [copyOf(state, P1, OWN.id)] : [];
  const p2Hand = o.p2.map((card) => copyOf(state, P2, card));
  state = {
    ...state,
    players: state.players.map((p) => {
      const hand = p.playerId === P1 ? p1Hand : p2Hand;
      return { ...p, deck: [...p.deck, ...p.hand].filter((i) => !hand.includes(i)), hand };
    }),
  };
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: put.id,
    abilityId: ACTION.ref.id,
    payment: [],
  };
  const used = sessionApply(startSession(state), command, deps);
  if (!used.ok) throw new Error(used.error.message);
  return { session: used.session, p1Hand, p2Hand };
}

/** The candidates as the open hidden pick offered them (the frame's `picked#offered` binding). */
const offeredOf = (s: GameState): readonly InstanceId[] => {
  const frame = s.stack.find((f) => "bindings" in f && (f.bindings as Record<string, unknown>)["picked#offered"]);
  return (frame as { bindings: Record<string, readonly InstanceId[]> }).bindings["picked#offered"]!;
};

const answer = (session: GameSession, selected: readonly string[]) => {
  const choice = session.state.pendingChoice!;
  const command: Command = {
    type: "resolveChoice",
    playerId: choice.playerId,
    choiceId: choice.choiceId,
    selectedOptionIds: [...selected],
  };
  const result = sessionApply(session, command, deps);
  if (!result.ok) throw new Error(result.error.message);
  return result;
};

describe("owner answer 211: a hidden-hand pick by the first player", () => {
  it("offers another player's hand cards facedown, naming no card or instance; the chooser's own faceup", () => {
    const t = open({ own: 1, p2: [GEM.id, ORB.id] });
    const choice = t.session.state.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    expect(choice.prompt).toMatchObject({ kind: "chooseCards", slot: "picked", facedown: true });
    expect(choice.options.map((o) => o.optionId)).toEqual([
      t.p1Hand[0],
      facedownOptionId(P2, 1),
      facedownOptionId(P2, 2),
    ]);
    const facedown = choice.options.slice(1);
    expect(facedown.map((o) => o.ref)).toEqual([
      { kind: "facedownCard", ownerId: P2 },
      { kind: "facedownCard", ownerId: P2 },
    ]);
    const shown = JSON.stringify(facedown);
    for (const leak of [...t.p2Hand, GEM.id, ORB.id]) expect(shown).not.toContain(leak);
    // The facedown cards are not "offered" for the visibility rules, so nothing turns them face-visible.
    for (const id of t.p2Hand) expect(offeredByOpenChoice(t.session.state, id)).toBe(false);
    // Plain serializable data.
    expect(JSON.parse(JSON.stringify(choice))).toEqual(choice);
  });

  it("the facedown card picked is the one discarded, and the log names it once picked", () => {
    const t = open({ own: 1, p2: [GEM.id, ORB.id] });
    // Option i is offered card i: the chooser's own card, then p2's cards in their shuffled order.
    const second = offeredOf(t.session.state)[2]!;
    const done = answer(t.session, [facedownOptionId(P2, 2)]);
    const state = done.session.state;
    expect(discardOf(state, P2)).toContain(second);
    expect(handOf(state, P2)).toEqual(t.p2Hand.filter((id) => id !== second));
    expect(handOf(state, P1)).toEqual(t.p1Hand);
    expect(done.events).toContainEqual({ type: "targetChosen", slot: "picked", instanceIds: [second] });
    // The offered list is not left behind in the frame, and the game replays to the same state.
    expect(JSON.stringify(state.stack)).not.toContain("picked#offered");
    const replayed = replay(done.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(state);
  });

  it("the chooser's own card is picked by its instance id, as any card option", () => {
    const t = open({ own: 1, p2: [GEM.id, ORB.id] });
    const done = answer(t.session, [t.p1Hand[0]!]);
    expect(discardOf(done.session.state, P1)).toContain(t.p1Hand[0]);
    expect(handOf(done.session.state, P2)).toEqual(t.p2Hand);
  });

  it("facedown cards are offered in a seeded shuffle: same seed, same order; not always hand order", () => {
    const orders = [21, 22, 23, 24, 25, 26].map((seed) => {
      const t = open({ own: 0, p2: [GEM.id, ORB.id, ORE.id], seed });
      const again = open({ own: 0, p2: [GEM.id, ORB.id, ORE.id], seed });
      const offered = offeredOf(t.session.state);
      expect(offeredOf(again.session.state)).toEqual(offered);
      expect([...offered].sort()).toEqual([...t.p2Hand].sort());
      return { offered, hand: t.p2Hand };
    });
    expect(orders.some(({ offered, hand }) => JSON.stringify(offered) !== JSON.stringify(hand))).toBe(true);
  });

  it("one candidate: nothing to choose, so no prompt; the card is discarded", () => {
    const t = open({ own: 0, p2: [GEM.id] });
    expect(t.session.state.pendingChoice?.prompt.kind).not.toBe("chooseCards");
    expect(discardOf(t.session.state, P2)).toContain(t.p2Hand[0]);
  });
});
