import { describe, expect, it } from "vitest";
import type { GameState } from "@mc/engine";
import { judgeProposal, type ProposalCheck } from "./proposal-judge.js";

const turn = (active: string): ProposalCheck["state"] =>
  ({
    outcome: null,
    pendingChoice: null,
    step: { phase: "player", kind: "turn", activePlayerId: active, ended: false },
  }) as unknown as Pick<GameState, "outcome" | "pendingChoice" | "step">;

const choice = (to: string): ProposalCheck["state"] =>
  ({
    outcome: null,
    pendingChoice: { playerId: to, choiceId: "c1" },
    step: { phase: "villain", kind: "x" },
  }) as unknown as Pick<GameState, "outcome" | "pendingChoice" | "step">;

const check = (over: Partial<ProposalCheck> = {}): ProposalCheck => ({
  state: turn("p1"),
  count: 5,
  base: 5,
  stamp: "S",
  stampNow: () => "S",
  players: ["p1"],
  command: { type: "endTurn", playerId: "p1" },
  strict: false,
  ...over,
});

describe("judging a seat holder's proposal", () => {
  it("passes the acting hero's own command built on the current log", () => {
    expect(judgeProposal(check())).toMatchObject({ ok: true });
  });

  it("answers a command built on an older log stale, before anything else", () => {
    expect(judgeProposal(check({ base: 4 }))).toEqual({ ok: false, reason: "stale" });
    expect(judgeProposal(check({ base: 6, command: "junk" }))).toEqual({ ok: false, reason: "stale" });
  });

  it("answers stale when the proposer saw another table at the same count (a rewind, then a new move)", () => {
    expect(judgeProposal(check({ stamp: "OTHER" }))).toEqual({ ok: false, reason: "stale" });
    expect(judgeProposal(check({ stamp: undefined }))).toEqual({ ok: false, reason: "stale" });
  });

  it("accepts a villain-phase choice addressed to the proposer's hero", () => {
    const answer = { type: "resolveChoice", playerId: "p2", choiceId: "c1", selectedOptionIds: ["a"] };
    expect(judgeProposal(check({ state: choice("p2"), players: ["p2"], command: answer }))).toEqual({
      ok: true,
      command: answer,
    });
  });

  it("refuses a concede: giving up is a request the host performs", () => {
    expect(judgeProposal(check({ command: { type: "concede", playerId: "p1" } }))).toEqual({
      ok: false,
      reason: "illegal",
    });
  });

  it("refuses a command type the engine does not have, and hands back a plain copy of a good one", () => {
    expect(judgeProposal(check({ command: { type: "__proto__", playerId: "p1" } }))).toEqual({
      ok: false,
      reason: "illegal",
    });
    expect(judgeProposal(check({ command: { type: "bogus", playerId: "p1" } }))).toEqual({
      ok: false,
      reason: "illegal",
    });
    const sent = { type: "endTurn", playerId: "p1" };
    const verdict = judgeProposal(check({ command: sent }));
    expect(verdict.ok && verdict.command).toEqual(sent);
    expect(verdict.ok && verdict.command).not.toBe(sent);
  });

  it("answers not-your-turn when the table waits on a hero the proposer does not play", () => {
    expect(judgeProposal(check({ players: ["p2"], command: { type: "endTurn", playerId: "p1" } }))).toEqual({
      ok: false,
      reason: "not-your-turn",
    });
    const answering = check({
      state: choice("p1"),
      players: ["p2"],
      command: { type: "resolveChoice", playerId: "p2" },
    });
    expect(judgeProposal(answering)).toEqual({ ok: false, reason: "not-your-turn" });
  });

  it("answers not-your-turn when nobody is to act (the villain phase, a finished game)", () => {
    const idle = { outcome: null, pendingChoice: null, step: { phase: "villain", kind: "x" } } as never;
    expect(judgeProposal(check({ state: idle }))).toEqual({ ok: false, reason: "not-your-turn" });
    const over = { ...turn("p1"), outcome: { result: "win" } } as never;
    expect(judgeProposal(check({ state: over }))).toEqual({ ok: false, reason: "not-your-turn" });
  });

  it("refuses a command made as a hero the proposer does not play, when it is the proposer's turn", () => {
    expect(judgeProposal(check({ command: { type: "endTurn", playerId: "p2" } }))).toEqual({
      ok: false,
      reason: "illegal",
    });
  });

  it("leaves an off-turn action of the proposer's own hero to the engine, but never during a choice", () => {
    const offTurn = check({ state: turn("p2"), command: { type: "playCard", playerId: "p1" } });
    expect(judgeProposal(offTurn)).toMatchObject({ ok: true });
    const duringChoice = check({ state: choice("p2"), command: { type: "playCard", playerId: "p1" } });
    expect(judgeProposal(duringChoice)).toEqual({ ok: false, reason: "not-your-turn" });
  });

  it("refuses malformed commands and any Manual adjust", () => {
    for (const command of [null, "x", 7, {}, { type: "endTurn" }, { type: 3, playerId: "p1" }]) {
      expect(judgeProposal(check({ command }))).toEqual({ ok: false, reason: "illegal" });
    }
    const adjust = { type: "adjust", playerId: "p1", adjustment: {} };
    expect(judgeProposal(check({ command: adjust }))).toEqual({ ok: false, reason: "illegal" });
    expect(judgeProposal(check({ command: adjust, strict: true }))).toEqual({ ok: false, reason: "strict" });
  });
});
