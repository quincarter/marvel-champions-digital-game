/**
 * docs/phase7-wave6.md §3.27: "You take the first turn during the player phase" (`RuleSpec takesFirstTurn`). Synthetic
 * card shaped like Field Commander (`cyclops` 33004): "You take the first turn during the player phase. (When your turn
 * is done, play proceeds in player order, starting with the first player. You do not take another turn.)"
 *
 * Sources: RRG 1.8 "First Player" (p. 19) and "In Player Order" (p. 24). §4.1 Q16: the rule is read as the player phase
 * begins, so gaining it mid-phase changes the next player phase; the first player token and every other "in player
 * order" sequence (here: the villain's activations) stay; nothing changes when its player already is the first player.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_DECK, newGameAtMulligan } from "./testing/scenario.js";
import { P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const P3: PlayerId = playerId("p3");

const def = (definition: AbilityDefinition) => definition;

const COMMANDER_RULE = stubAbility(
  "commander.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "takesFirstTurn", player: { kind: "controller" } }] },
    effects: [],
  }),
);
const COMMANDER = stubUpgrade({ id: "commander", cost: 0, abilities: [COMMANDER_RULE.ref] });

const deps = depsOf(COMMANDER_RULE);

/** Three seats (p1 first), still at the setup mulligan, so the first player phase has not begun. */
function atMulligan(): GameState {
  return newGameAtMulligan({ players: 3, extraCards: [COMMANDER], deck: [...DEFAULT_DECK, COMMANDER.id], deps });
}

/** Drives `commands` through a fresh session and checks the log replays to the same state. */
function run(state: GameState, commands: readonly Command[] = []) {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}

const endTurn = (player: PlayerId): Command => ({ type: "endTurn", playerId: player });
const turnStep = (activePlayerId: PlayerId, remainingPlayerIds: readonly PlayerId[]) => ({
  phase: "player",
  kind: "turn",
  activePlayerId,
  remainingPlayerIds,
});
const turnsStarted = (events: readonly GameEvent[]) =>
  events.flatMap((event) => (event.type === "turnStarted" ? [event.playerId] : []));
const activationsAgainst = (events: readonly GameEvent[]) =>
  events.flatMap((event) => (event.type === "enemyActivated" ? [event.playerId] : []));

/** Surgery: the commander card leaves `player`'s play area for their discard pile. */
function discardFromPlay(state: GameState, player: PlayerId, id: InstanceId): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, playArea: p.playArea.filter((x) => x !== id), discard: [...p.discard, id] } : p,
    ),
  };
}

describe("§3.27 `takesFirstTurn`", () => {
  it("p2 takes the first turn, then p1 and p3 in player order; the token and the villain phase stay in player order", () => {
    const withRule = playerCardIntoPlay(atMulligan(), COMMANDER.id, P2).state;
    const first = run(withRule);
    expect(first.state.round).toBe(1);
    expect(first.state.firstPlayerId).toBe(P1);
    expect(first.state.step).toEqual(turnStep(P2, [P1, P3]));

    const round = run(first.state, [endTurn(P2), endTurn(P1), endTurn(P3)]);
    expect(turnsStarted(round.events)).toEqual([P1, P3, P2]);
    // The villain activates against each player in player order from the first player, p1 (RRG 1.8 p. 24).
    expect(activationsAgainst(round.events)).toEqual([P1, P2, P3]);
    // The token passed as normal, to p2, who already has it: their own first turn changes nothing.
    expect(round.state.round).toBe(2);
    expect(round.state.firstPlayerId).toBe(P2);
    expect(round.state.step).toEqual(turnStep(P2, [P3, P1]));
  });

  it("gained mid-phase it waits for the next player phase, where p3 goes first and p2, p1 follow", () => {
    const start = run(atMulligan());
    expect(start.state.step).toEqual(turnStep(P1, [P2, P3]));

    const midPhase = playerCardIntoPlay(start.state, COMMANDER.id, P3).state;
    const rest = run(midPhase, [endTurn(P1)]);
    // This phase's order was fixed as it began: p2 is next, not p3.
    expect(rest.state.step).toEqual(turnStep(P2, [P3]));

    // p3 takes one turn this phase, not another after.
    const round = run(rest.state, [endTurn(P2), endTurn(P3)]);
    expect(turnsStarted(round.events)).toEqual([P3, P3]);
    expect(activationsAgainst(round.events)).toEqual([P1, P2, P3]);
    expect(round.state.round).toBe(2);
    expect(round.state.firstPlayerId).toBe(P2);
    expect(round.state.step).toEqual(turnStep(P3, [P2, P1]));
  });

  it("once the rule is gone, the next player phase is in player order again", () => {
    const placed = playerCardIntoPlay(atMulligan(), COMMANDER.id, P3);
    const first = run(placed.state);
    expect(first.state.step).toEqual(turnStep(P3, [P1, P2]));

    const gone = discardFromPlay(first.state, P3, placed.id);
    expect(mustPlayer(gone, P3).playArea).not.toContain(placed.id);
    const round = run(gone, [endTurn(P3), endTurn(P1), endTurn(P2)]);
    expect(round.state.round).toBe(2);
    expect(round.state.firstPlayerId).toBe(P2);
    expect(round.state.step).toEqual(turnStep(P2, [P3, P1]));
  });
});
