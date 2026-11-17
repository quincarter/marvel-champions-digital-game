/**
 * Issue #791: Undo past reveals lifts Undo's stop at a draw, reveal or random pick, and says so on the offer, so the
 * board warns first and marks the game adjusted. Every other line Undo draws stays.
 */
import { describe, expect, test } from "vitest";
import type { Command, GameEvent, GameState, PlayerId } from "@mc/engine";
import type { BackOutTrailEntry } from "./back-out.js";
import { UNDO_REASONS, undoOf, undoStepsOf, undoTargetsOf } from "./undo.js";

const P1 = "p1" as PlayerId;
const P2 = "p2" as PlayerId;

type GameLike = Pick<GameState, "outcome" | "pendingChoice" | "step">;

const turnOf = (activePlayerId: PlayerId): GameLike =>
  ({
    outcome: null,
    pendingChoice: null,
    step: { phase: "player", kind: "turn", activePlayerId, remainingPlayerIds: [] },
  }) as GameLike;

const command = (type: Command["type"], playerId: PlayerId = P1): Command =>
  ({
    type,
    playerId,
    cardInstanceId: "i1",
    abilityId: "a1",
    payment: [],
    attachToInstanceId: null,
  }) as unknown as Command;

const entry = (cmd: Command, events: readonly GameEvent[] = [], draws?: [number, number]): BackOutTrailEntry => ({
  playerId: cmd.playerId,
  command: cmd,
  events,
  ...(draws ? { rngDraws: { before: draws[0], after: draws[1] } } : {}),
});

const event = (type: string, extra: object = {}): GameEvent => ({ type, ...extra }) as unknown as GameEvent;

const drew = entry(command("useAbility"), [event("cardDrawn", { playerId: P1, instanceId: "x" })]);
const PAST = { pastReveals: true };

describe("undoOf with Undo past reveals", () => {
  test("without the rule, a move that drew still stops Undo", () => {
    expect(undoOf([drew], turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.revealed });
    expect(undoOf([drew], turnOf(P1), P1, { pastReveals: false })).toMatchObject({ kind: "unavailable" });
  });

  test("on, a move that drew can be taken back, and the offer says it was a reveal", () => {
    expect(undoOf([drew], turnOf(P1), P1, PAST)).toEqual({
      kind: "available",
      target: 0,
      command: drew.command,
      revealed: true,
    });
  });

  test("on, a move that used the random number generator can be taken back too", () => {
    const random = entry(command("playCard"), [], [3, 4]);
    expect(undoOf([random], turnOf(P1), P1, PAST)).toMatchObject({ kind: "available", revealed: true });
  });

  test("on, a move with nothing hidden is offered as before, without the reveal mark", () => {
    const offer = undoOf([entry(command("basicThwart"))], turnOf(P1), P1, PAST);
    expect(offer).toMatchObject({ kind: "available", target: 0 });
    expect(offer).not.toHaveProperty("revealed");
  });

  test("without the rule, the turn's start and another seat's move still stop it", () => {
    const start = entry(command("endTurn", P2), [event("turnStarted", { playerId: P1 })]);
    expect(undoOf([start], turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.nothing });
    const theirs = [entry(command("playCard")), entry(command("resolveChoice", P2))];
    expect(undoOf(theirs, turnOf(P1), P1)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.otherPlayer });
  });

  test("on, it reaches back through the villain phase: an End turn goes with the phase it led to", () => {
    // The owner's report (2026-11-17): round 2 begins after both turns and a villain phase full of answers.
    const trail = [
      entry(command("resolveChoice", P1)), // mulligans: setup, no move
      entry(command("resolveChoice", P2)),
      entry(command("basicAttack", P1)),
      entry(command("endTurn", P1), [event("turnEnded"), event("turnStarted", { playerId: P2 })]),
      entry(command("basicAttack", P2)),
      entry(command("endTurn", P2), [event("turnEnded"), event("stepChanged")]),
      entry(command("resolveChoice", P1), [event("encounterCardRevealed")]),
      entry(command("resolveChoice", P2), [event("roundStarted"), event("turnStarted", { playerId: P1 })]),
    ];
    expect(undoOf(trail, turnOf(P1), P1, PAST)).toMatchObject({ kind: "available", target: 5, revealed: true });
    expect(undoTargetsOf(trail, turnOf(P1), P1, PAST)).toEqual([5, 4, 3, 2]);
  });

  test("on, another seat's move and a Manual adjust can be taken back; setup's mulligans can't", () => {
    const theirs = [entry(command("playCard")), entry(command("resolveChoice", P2))];
    expect(undoOf(theirs, turnOf(P1), P1, PAST)).toMatchObject({ kind: "available", target: 0, revealed: true });
    const adjusted = [entry(command("basicThwart")), entry(command("adjust"), [event("manualAdjustment")])];
    expect(undoOf(adjusted, turnOf(P1), P1, PAST)).toMatchObject({ kind: "available", target: 1, revealed: true });
    const setup = [entry(command("resolveChoice", P1)), entry(command("resolveChoice", P2))];
    expect(undoOf(setup, turnOf(P1), P1, PAST)).toEqual({ kind: "unavailable", reason: UNDO_REASONS.nothing });
  });

  test("Jump to a moment reaches past a reveal only with the rule on, and marks which steps were reveals", () => {
    const trail = [entry(command("basicThwart")), drew, entry(command("basicAttack"))];
    expect(undoTargetsOf(trail, turnOf(P1), P1)).toEqual([2]);
    expect(undoTargetsOf(trail, turnOf(P1), P1, PAST)).toEqual([2, 1, 0]);
    expect(undoStepsOf(trail, turnOf(P1), P1, PAST)).toEqual([
      { target: 2, revealed: false },
      { target: 1, revealed: true },
      { target: 0, revealed: false },
    ]);
  });
});
