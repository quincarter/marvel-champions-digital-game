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
  players: ["p1"],
  command: { type: "endTurn", playerId: "p1" },
  strict: false,
  ...over,
});

describe("judging a seat holder's proposal", () => {
  it("passes the acting hero's own command built on the current log", () => {
    expect(judgeProposal(check())).toEqual({ ok: true });
  });

  it("answers a command built on an older log stale, before anything else", () => {
    expect(judgeProposal(check({ base: 4 }))).toEqual({ ok: false, reason: "stale" });
    expect(judgeProposal(check({ base: 6, command: "junk" }))).toEqual({ ok: false, reason: "stale" });
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
    expect(judgeProposal(offTurn)).toEqual({ ok: true });
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
