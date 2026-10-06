/**
 * docs/phase7-wave7.md §4.1 Q53 = A (Plot Convenience 44050): `EffectSpec takeIntoHand { keepOwner }`, a card taken
 * into the hand of a player who does not own it and that stays its owner's. Synthetic cards: a "Locker" support any
 * player may use, "Action: add 1 card attached here to your hand."
 *
 * Sources: RRG 1.8 "Ownership and Control" (p. 31): "A player controls the cards in their own out-of-play areas (such
 * as the hand, the deck, and the discard pile)"; a change of control lasts until "That card leaves play, it is placed
 * in its owner's equivalent out-of-play area", "That card is an event that was played, it is placed in its owner's
 * discard pile", "That card is discarded from a player's hand, it is placed in its owner's discard pile".
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const def = (d: AbilityDefinition) => d;
const here = { kind: "each", query: { facedown: true, host: { kind: "self" } } } as const;
const take = (keepOwner: boolean) =>
  def({
    trigger: { kind: "action", triggerableBy: { kind: "each" } },
    effects: [
      {
        kind: "takeIntoHand",
        cards: { kind: "ref", ref: here },
        player: you,
        ...(keepOwner ? { keepOwner: true } : {}),
      },
    ],
  });
const LOCKER_ACTION = stubAbility("locker.action", take(true));
const LOCKER = stubSupport({ id: "locker", cost: 0, abilities: [LOCKER_ACTION.ref] });
/** The same without `keepOwner`: the taker becomes the owner, as before. */
const VAULT_ACTION = stubAbility("vault.action", take(false));
const VAULT = stubSupport({ id: "vault", cost: 0, abilities: [VAULT_ACTION.ref] });

const JAB_ACTION = stubAbility("jab.action", def({ trigger: { kind: "action" }, effects: [] }));
const JAB = stubEvent({ id: "jab", cost: 0, resources: 1, abilities: [JAB_ACTION.ref] });
const HOOK_ACTION = stubAbility("hook.action", def({ trigger: { kind: "action" }, effects: [] }));
const HOOK = stubEvent({ id: "hook", cost: 1, abilities: [HOOK_ACTION.ref] });
/** "Discard 1 card at random from your hand." with a one-card hand: an effect's discard from hand. */
const PURGE_ACTION = stubAbility(
  "purge.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "discardFromHand", player: you, amount: { kind: "const", value: 1 }, random: true }],
  }),
);
const PURGE = stubEvent({ id: "purge", cost: 0, abilities: [PURGE_ACTION.ref] });
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 1, resources: 1 });
/** "Deal 1 damage to each ally." */
const SWEEP_ACTION = stubAbility(
  "sweep.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "dealDamage",
        target: { kind: "each", query: { categories: ["ally"] } },
        amount: { kind: "const", value: 1 },
      },
    ],
  }),
);
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });

const deps: EngineDeps = depsOf(LOCKER_ACTION, VAULT_ACTION, JAB_ACTION, HOOK_ACTION, PURGE_ACTION, SWEEP_ACTION);
const CARDS = [LOCKER, VAULT, JAB, HOOK, PURGE, RECRUIT, SWEEP];

/** Two players at p1's turn; p1 controls `holder` with one of p1's own `banked` cards attached facedown. */
function table(holder: typeof LOCKER, banked: typeof JAB | typeof RECRUIT = JAB) {
  const start = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: 2,
    deck: [LOCKER.id, VAULT.id, JAB.id, HOOK.id, PURGE.id, RECRUIT.id, SWEEP.id],
  });
  const support = playerCardIntoPlay(start, holder.id, P1);
  const card = giveCard(support.state, P1, banked.id);
  const state: GameState = {
    ...card.state,
    players: card.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== card.id) } : p,
    ),
    instances: {
      ...card.state.instances,
      [card.id]: {
        ...mustInstance(card.state, card.id),
        attachedTo: support.id,
        faceup: false,
        facedownAs: { kind: "blank", traits: [] },
      },
      [support.id]: { ...mustInstance(card.state, support.id), attachments: [card.id] },
    },
  };
  return { state, support: support.id, card: card.id };
}

const use = (playerId: PlayerId, cardInstanceId: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId,
  cardInstanceId,
  abilityId: abilityId as never,
  payment: [],
});
const play = (playerId: PlayerId, id: InstanceId, payment: readonly Payment[] = []): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});
const drive = (state: GameState, ...commands: Command[]) => {
  const { session, events } = driveSession(startSession(state), deps, commands);
  return { session, state: session.state, events };
};
const hand = (state: GameState, player: PlayerId) => mustPlayer(state, player).hand;
const pile = (state: GameState, player: PlayerId) => mustPlayer(state, player).discard;
const moves = (events: readonly GameEvent[], id: InstanceId) =>
  events.flatMap((e) => (e.type === "cardMoved" && e.instanceId === id ? [e.to] : []));

describe("takeIntoHand with keepOwner: a card in a hand that is not its owner's", () => {
  it("the taker holds and controls it; its owner does not change; nothing logs a new owner", () => {
    const t = table(LOCKER);
    const after = drive(t.state, use(P2, t.support, "locker.action"));
    expect(hand(after.state, P2)).toContain(t.card);
    expect(hand(after.state, P1)).not.toContain(t.card);
    expect(mustInstance(after.state, t.card)).toMatchObject({ ownerId: P1, controllerId: P2, attachedTo: null });
    expect(mustInstance(after.state, t.support).attachments).toEqual([]);
    expect(after.events.filter((e) => e.type === "ownershipChanged")).toEqual([]);
    const replayed = replay(after.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.state);
  });

  it("control: without keepOwner the taker becomes its owner, as before", () => {
    const t = table(VAULT);
    const after = drive(t.state, use(P2, t.support, "vault.action"));
    expect(mustInstance(after.state, t.card)).toMatchObject({ ownerId: P2, controllerId: P2 });
  });

  it("the owner taking their own card: theirs, in their hand, under their control", () => {
    const t = table(LOCKER);
    const after = drive(t.state, use(P1, t.support, "locker.action"));
    expect(hand(after.state, P1)).toContain(t.card);
    expect(mustInstance(after.state, t.card)).toMatchObject({ ownerId: P1, controllerId: P1 });
  });

  it("spent to pay a cost, it goes to its owner's discard pile, under its owner's control", () => {
    const t = table(LOCKER);
    const took = drive(t.state, use(P2, t.support, "locker.action")).state;
    const hook = giveCard(took, P2, HOOK.id);
    const after = drive(hook.state, play(P2, hook.id, [{ fromHand: t.card }]));
    expect(pile(after.state, P1)[0]).toBe(t.card);
    expect(pile(after.state, P2)).not.toContain(t.card);
    // The event p2 owns and played went to p2's own pile.
    expect(pile(after.state, P2)).toContain(hook.id);
    expect(mustInstance(after.state, t.card).controllerId).toBe(P1);
    expect(moves(after.events, t.card)).toEqual([{ kind: "discard", playerId: P1 }]);
    expect(after.events).toContainEqual({ type: "cardDiscardedFromHand", playerId: P2, instanceId: t.card });
  });

  it("discarded from that hand by an effect, it goes to its owner's discard pile", () => {
    const t = table(LOCKER);
    const took = drive(t.state, use(P2, t.support, "locker.action")).state;
    const purge = giveCard(took, P2, PURGE.id);
    // Only the borrowed card is left in p2's hand once the Purge is played.
    const alone: GameState = {
      ...purge.state,
      players: purge.state.players.map((p) => {
        if (p.playerId !== P2) return p;
        const rest = p.hand.filter((id) => id !== purge.id && id !== t.card);
        return { ...p, hand: [purge.id, t.card], deck: [...p.deck, ...rest] };
      }),
    };
    const after = drive(alone, play(P2, purge.id));
    expect(pile(after.state, P1)[0]).toBe(t.card);
    expect(pile(after.state, P2)).toEqual([purge.id]);
  });

  it("played as an event by the taker, it goes to its owner's discard pile", () => {
    const t = table(LOCKER);
    const took = drive(t.state, use(P2, t.support, "locker.action")).state;
    const after = drive(took, play(P2, t.card));
    expect(pile(after.state, P1)[0]).toBe(t.card);
    expect(pile(after.state, P2)).not.toContain(t.card);
    expect(mustInstance(after.state, t.card).controllerId).toBe(P1);
  });

  it("an ally the taker plays is theirs to control and still its owner's: defeated, it goes to its owner's pile", () => {
    const t = table(LOCKER, RECRUIT);
    const took = drive(t.state, use(P2, t.support, "locker.action")).state;
    const turn = drive(took, { type: "endTurn", playerId: P1 }).state;
    const inPlay = drive(turn, play(P2, t.card)).state;
    expect(mustPlayer(inPlay, P2).playArea).toContain(t.card);
    expect(mustInstance(inPlay, t.card)).toMatchObject({ ownerId: P1, controllerId: P2 });
    const sweep = giveCard(inPlay, P2, SWEEP.id);
    const after = drive(sweep.state, play(P2, sweep.id));
    expect(pile(after.state, P1)[0]).toBe(t.card);
    expect(pile(after.state, P2)).not.toContain(t.card);
    expect(mustInstance(after.state, t.card).controllerId).toBe(P1);
  });
});
