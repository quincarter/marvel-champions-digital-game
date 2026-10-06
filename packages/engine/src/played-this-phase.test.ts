/**
 * docs/phase7-wave7.md §7.3 (Mulligan 44048): "You cannot play this card if you have played another card this phase."
 * `GameState.playedByPlayerThisPhase` and `Predicate playedThisPhase { player, cards, atLeast? }`. Synthetic cards: a
 * "Redo" event with that restriction, and a plain Action event, each cost 0.
 *
 * Sources: RRG 1.8 "Player Phase" (p. 34): the player phase is one phase, in which each player takes a turn. "Action"
 * (p. 6): an Action may be used "during their turn, or by request during other players' turns", so a player can have
 * played a card in an earlier turn of the phase or in another player's. "Play Restrictions and Permissions" (p. 33).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { evaluate } from "./select.js";
import { mustPlayer } from "./query.js";
import type { Predicate, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const ANY: TargetQuery = { categories: ["ally", "event", "upgrade", "support", "resource"] };
const played = (cards: TargetQuery = ANY, atLeast?: number): Predicate => ({
  kind: "playedThisPhase",
  player: you,
  cards,
  ...(atLeast !== undefined ? { atLeast } : {}),
});

const REDO_RULE = stubAbility("redo.constant", {
  trigger: { kind: "constant", playOnlyIf: { kind: "not", of: played() } },
  effects: [],
});
const REDO_ACTION = stubAbility("redo.action", { trigger: { kind: "action" }, effects: [] });
const REDO = stubEvent({ id: "redo", cost: 0, abilities: [REDO_RULE.ref, REDO_ACTION.ref] });
const JAB_ACTION = stubAbility("jab.action", { trigger: { kind: "action" }, effects: [] });
const JAB = stubEvent({ id: "jab", cost: 0, abilities: [JAB_ACTION.ref] });
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 3 });

const deps: EngineDeps = depsOf(REDO_RULE, REDO_ACTION, JAB_ACTION);
const DECK: readonly CardId[] = [...copiesOf(REDO.id, 2), ...copiesOf(JAB.id, 3), RECRUIT.id];
const start = (): GameState => gameAtFirstTurn({ cards: [REDO, JAB, RECRUIT], deps, deck: DECK, players: 2 });

const play = (playerId: PlayerId, id: InstanceId): Command => ({
  type: "playCard",
  playerId,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
/** Hands `player` a copy of `card` and plays it; throws if the play is refused. */
function plays(state: GameState, player: PlayerId, card: CardId, exclude: readonly InstanceId[] = []) {
  const given = giveCard(state, player, card, exclude);
  const { session } = driveSession(startSession(given.state), deps, [play(player, given.id)]);
  return { state: session.state, id: given.id, session };
}
/** Whether `player` may play a Redo now. */
function mayRedo(state: GameState, player: PlayerId): boolean {
  const given = giveCard(state, player, REDO.id);
  return applyCommand(given.state, play(player, given.id), deps).ok;
}
const holds = (state: GameState, player: PlayerId, predicate: Predicate): boolean =>
  evaluate(state, predicate, {
    selfInstanceId: mustPlayer(state, player).identity.instanceId,
    controllerId: player,
    event: null,
    bindings: {},
    deps,
  });
const endTurn = (state: GameState, player: PlayerId): GameState =>
  driveSession(startSession(state), deps, [{ type: "endTurn", playerId: player }]).session.state;

describe("the cards a player has played this phase", () => {
  it("nothing played: the record is absent, the predicate false, and the restricted card playable", () => {
    const state = start();
    expect(state.playedByPlayerThisPhase).toBeUndefined();
    expect(holds(state, P1, played())).toBe(false);
    expect(mayRedo(state, P1)).toBe(true);
  });

  it("a play is recorded for its player only, in order; replay equal", () => {
    const first = plays(start(), P1, JAB.id);
    const second = plays(first.state, P1, RECRUIT.id);
    expect(second.state.playedByPlayerThisPhase).toEqual({ [P1]: [first.id, second.id] });
    expect(holds(second.state, P1, played())).toBe(true);
    expect(holds(second.state, P2, played())).toBe(false);
    expect(mayRedo(second.state, P1)).toBe(false);
    expect(mayRedo(second.state, P2)).toBe(true);
    const replayed = replay(second.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(second.state);
  });

  it("reads the cards by query and count: one event and one ally played", () => {
    const first = plays(start(), P1, JAB.id);
    const second = plays(first.state, P1, RECRUIT.id);
    expect(holds(second.state, P1, played({ categories: ["event"] }))).toBe(true);
    expect(holds(second.state, P1, played({ categories: ["event"] }, 2))).toBe(false);
    expect(holds(second.state, P1, played({ categories: ["ally"] }))).toBe(true);
    expect(holds(second.state, P1, played({ categories: ["upgrade"] }))).toBe(false);
    expect(holds(second.state, P1, played(ANY, 2))).toBe(true);
    expect(holds(second.state, P1, played(ANY, 3))).toBe(false);
  });

  it("the restricted card's own play does not stop it, and it counts once played", () => {
    const first = plays(start(), P1, REDO.id);
    expect(first.state.playedByPlayerThisPhase).toEqual({ [P1]: [first.id] });
    expect(mayRedo(first.state, P1)).toBe(false);
  });

  it("outlasts the turn: a card p1 played in their turn still counts during p2's turn, where playedThisTurn is empty", () => {
    const first = plays(start(), P1, JAB.id);
    const next = endTurn(first.state, P1);
    expect(next.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P2 });
    expect(next.playedThisTurn?.[P1] ?? []).toEqual([]);
    expect(next.playedByPlayerThisPhase).toEqual({ [P1]: [first.id] });
    expect(mayRedo(next, P1)).toBe(false);
    expect(mayRedo(next, P2)).toBe(true);
  });

  it("an Action event played during another player's turn counts for the player who played it", () => {
    const offTurn = plays(start(), P2, JAB.id);
    expect(offTurn.state.step).toMatchObject({ kind: "turn", activePlayerId: P1 });
    expect(offTurn.state.playedByPlayerThisPhase).toEqual({ [P2]: [offTurn.id] });
    expect(mayRedo(offTurn.state, P2)).toBe(false);
    expect(mayRedo(offTurn.state, P1)).toBe(true);
    const next = endTurn(offTurn.state, P1);
    expect(mayRedo(next, P2)).toBe(false);
  });

  it("is removed when the player phase ends, and again absent in the next player phase", () => {
    const first = plays(start(), P1, JAB.id);
    const villain = endTurn(endTurn(first.state, P1), P2);
    expect(villain.playedByPlayerThisPhase).toBeUndefined();
    expect(villain.round).toBe(2);
    expect(villain.step).toMatchObject({ phase: "player", kind: "turn" });
    expect(mayRedo(villain, P1)).toBe(true);
  });
});
