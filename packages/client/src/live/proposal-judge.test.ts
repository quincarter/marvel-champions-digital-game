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

  it("takes an Epic remote power from the acting hero like any action, and never an inbound pod event from a seat", () => {
    const power = { type: "remotePower", playerId: "p1", toGroupId: "t2", power: "attack" };
    expect(judgeProposal(check({ command: power }))).toMatchObject({ ok: true });
    // Another seat's hero is not the proposer's to play.
    expect(judgeProposal(check({ state: turn("p2"), players: ["p2"], command: power }))).toEqual({
      ok: false,
      reason: "illegal",
    });
    // The table host's own engine feeds the pod's words in: a seat proposing one is a forgery.
    const inbound = { type: "externalEvent", playerId: "p1", sequence: 1, event: { kind: "gameWon" } };
    expect(judgeProposal(check({ command: inbound }))).toEqual({ ok: false, reason: "illegal" });
  });
});

describe("judging a proposal in a Competitive room (issue #883)", () => {
  const teamOf = (id: string): string | undefined =>
    ({ p1: "registration", p2: "registration", p3: "resistance", p4: "resistance" })[id];
  const off = (player: string) => ({ type: "playCard", playerId: player });

  it("lets a teammate of the active hero take an off-turn action, and refuses the other team's seat", () => {
    expect(judgeProposal(check({ state: turn("p1"), players: ["p2"], command: off("p2"), teamOf }))).toMatchObject({
      ok: true,
    });
    expect(judgeProposal(check({ state: turn("p1"), players: ["p3"], command: off("p3"), teamOf }))).toEqual({
      ok: false,
      reason: "not-your-turn",
    });
    // Without teams (a cooperative room) the same off-turn action is the engine's to judge.
    expect(judgeProposal(check({ state: turn("p1"), players: ["p3"], command: off("p3") }))).toMatchObject({
      ok: true,
    });
  });

  it("refuses a player the lobby has no team for", () => {
    expect(judgeProposal(check({ state: turn("p1"), players: ["p9"], command: off("p9"), teamOf }))).toEqual({
      ok: false,
      reason: "not-your-turn",
    });
  });

  it("still takes the answer to a choice addressed to the inactive team's seat, and no one else's", () => {
    const answer = { type: "resolveChoice", playerId: "p3", choiceId: "c1", selectedOptionIds: ["a"] };
    expect(judgeProposal(check({ state: choice("p3"), players: ["p3"], command: answer, teamOf }))).toMatchObject({
      ok: true,
    });
    // Its teammate is not the one asked (the first player answers, N1), and the active team cannot answer for it.
    const teammate = { ...answer, playerId: "p4" };
    expect(judgeProposal(check({ state: choice("p3"), players: ["p4"], command: teammate, teamOf }))).toEqual({
      ok: false,
      reason: "not-your-turn",
    });
    expect(judgeProposal(check({ state: choice("p3"), players: ["p1"], command: off("p1"), teamOf }))).toEqual({
      ok: false,
      reason: "not-your-turn",
    });
  });
});

describe("a Competitive room's concede (plan N12 A)", () => {
  const teamOf = (id: string): string | undefined => ({ p1: "registration", p2: "resistance" })[id];
  it("takes a seat's own concession, for the team or alone, even off its turn", () => {
    const team = judgeProposal(check({ teamOf, players: ["p2"], command: { type: "concede", playerId: "p2" } }));
    expect(team).toMatchObject({ ok: true, command: { type: "concede", playerId: "p2" } });
    const alone = judgeProposal(
      check({ teamOf, players: ["p2"], command: { type: "concede", playerId: "p2", alone: true } }),
    );
    expect(alone).toMatchObject({ ok: true, command: { alone: true } });
  });

  it("refuses a concession for a seat the proposer does not hold, and any concede outside Competitive", () => {
    expect(judgeProposal(check({ teamOf, players: ["p2"], command: { type: "concede", playerId: "p1" } }))).toEqual({
      ok: false,
      reason: "illegal",
    });
    expect(judgeProposal(check({ players: ["p2"], command: { type: "concede", playerId: "p2" } }))).toEqual({
      ok: false,
      reason: "illegal",
    });
  });
});
