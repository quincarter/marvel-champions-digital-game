/**
 * `Predicate lastPlayedThisRound` over `GameState.playedInOrderThisRound`: "If the last card you played this round was
 * a [title] event, reduce the cost to play this card by 1." (Kickflip, a custom-content card; docs/custom-content-packs.md
 * §6), as a cost modifier read from the hand (`CostModifierSpec activeIn: "hand"`).
 *
 * Sources: RRG 1.8 "Cost" (p. 13), "Modifiers" (p. 29), "Max, Maximum" (p. 28: a card counts as played once played,
 * even if canceled), "Round" (p. 39).
 *
 * Synthetic events, one seat. `trick` and `kick` carry the Stunt trait (the stand-in for "a [title] event"); `plain`
 * does not. `kick` costs 2, reduced by 1 when the last card its holder played this round was a Stunt event.
 */

import { trait, type EventCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { playCostOf } from "./actions.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { giveCard, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const STUNT = trait("Stunt");
const stuntEvent: TargetQuery = { categories: ["event"], trait: STUNT };

const NOTHING = stubAbility("nothing.action", { trigger: { kind: "action" }, effects: [] } satisfies AbilityDefinition);
const KICK_DISCOUNT = stubAbility("kick.discount", {
  trigger: {
    kind: "constant",
    costModifiers: [
      {
        delta: -1,
        appliesTo: { self: true },
        activeIn: "hand",
        while: { kind: "lastPlayedThisRound", player: { kind: "controller" }, cards: stuntEvent },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);

const withTraits = (card: EventCard, traits: EventCard["traits"]): EventCard => ({ ...card, traits });
const TRICK = withTraits(stubEvent({ id: "trick", cost: 0, abilities: [NOTHING.ref] }), [STUNT]);
const PLAIN = stubEvent({ id: "plain", cost: 0, abilities: [NOTHING.ref] });
const KICK = withTraits(stubEvent({ id: "kick", cost: 2, abilities: [NOTHING.ref, KICK_DISCOUNT.ref] }), [STUNT]);

/** "Forced Interrupt: When you play a Stunt event, cancel it. Then, discard this card." */
const COUNTER_INTERRUPT = stubAbility("counter.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: stuntEvent },
  },
  effects: [{ kind: "cancelTriggeringEvent" }, { kind: "discardFromPlay", target: { kind: "self" } }],
} satisfies AbilityDefinition);
const COUNTER = stubUpgrade({ id: "counter", cost: 0, abilities: [COUNTER_INTERRUPT.ref] });

const deps: EngineDeps = depsOf(NOTHING, KICK_DISCOUNT, COUNTER_INTERRUPT);

function start(): { state: GameState; kick: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [TRICK, PLAIN, KICK, COUNTER],
    deps,
    deck: [...copiesOf(TRICK.id, 3), ...copiesOf(PLAIN.id, 3), ...copiesOf(KICK.id, 3), RESOURCE.id, COUNTER.id],
  });
  const given = giveCard(base, P1, KICK.id);
  return { state: given.state, kick: given.id };
}

/** Hands p1 each card in turn and plays it for 0. */
function playAll(state: GameState, cards: readonly EventCard[]): GameSession {
  let session = startSession(state);
  for (const card of cards) {
    const given = giveCard(session.state, P1, card.id);
    const command: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    };
    session = driveSession(startSession(given.state), deps, [command]).session;
  }
  return session;
}

const kickCost = (state: GameState, kick: InstanceId): number | undefined => playCostOf(state, P1, kick, deps)?.current;

describe("Predicate lastPlayedThisRound: the last card you played this round, by play order", () => {
  it("nothing played this round: the full cost", () => {
    const s = start();
    expect(kickCost(s.state, s.kick)).toBe(2);
    expect(s.state.playedInOrderThisRound).toBeUndefined();
  });

  it("the last card played was a Stunt event: 1 less", () => {
    const s = start();
    const after = playAll(s.state, [TRICK]).state;
    expect(kickCost(after, s.kick)).toBe(1);
  });

  it("a Stunt event, then another card: the last one is not a Stunt event, so no reduction", () => {
    const s = start();
    const after = playAll(s.state, [TRICK, PLAIN]).state;
    expect(after.playedInOrderThisRound?.[P1]).toHaveLength(2);
    expect(kickCost(after, s.kick)).toBe(2);
  });

  it("another card, then a Stunt event: 1 less", () => {
    const s = start();
    const after = playAll(s.state, [PLAIN, TRICK]).state;
    expect(kickCost(after, s.kick)).toBe(1);
  });

  it("the play is paid at the reduced cost: one resource card after a Stunt event, and Kick is then the last card", () => {
    const s = start();
    const after = playAll(s.state, [TRICK]).state;
    const resource = giveCard(after, P1, RESOURCE.id);
    const command: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: s.kick,
      payment: [{ fromHand: resource.id }],
      attachToInstanceId: null,
    };
    const result = applyCommand(resource.state, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.playedInOrderThisRound?.[P1]?.at(-1)).toBe(s.kick);
    expect(mustPlayer(result.state, P1).discard).toContain(resource.id);
    // Control: with nothing played first, one resource does not pay the full cost of 2.
    const unpaid = giveCard(s.state, P1, RESOURCE.id);
    expect(applyCommand(unpaid.state, { ...command, payment: [{ fromHand: unpaid.id }] }, deps).ok).toBe(false);
  });

  it("a canceled play still counts as played (RRG 1.8 'Max, Maximum', p. 28): a canceled Stunt event is the last card", () => {
    const s = start();
    const countered = playerCardIntoPlay(s.state, COUNTER.id);
    const after = playAll(playAll(countered.state, [PLAIN]).state, [TRICK]).state;
    // The interrupt fired: the counter is gone, and the Stunt event was still recorded as the last play.
    expect(mustPlayer(after, P1).playArea).not.toContain(countered.id);
    const last = after.playedInOrderThisRound?.[P1]?.at(-1);
    expect(last !== undefined && after.instances[last]?.cardId).toBe(TRICK.id);
    expect(kickCost(after, s.kick)).toBe(1);
  });

  it("the record is gone when the round ends", () => {
    const s = start();
    const played = playAll(s.state, [TRICK]).state;
    const { session } = driveSession(startSession(played), deps, [{ type: "endTurn", playerId: P1 }]);
    expect(session.state.round).toBe(played.round + 1);
    expect(session.state.playedInOrderThisRound).toBeUndefined();
    expect(kickCost(session.state, s.kick)).toBe(2);
  });

  it("replays to the same state", () => {
    const s = start();
    const session = playAll(s.state, [PLAIN, TRICK]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
