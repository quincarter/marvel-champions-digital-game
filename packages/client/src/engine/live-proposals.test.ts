import { describe, expect, it, vi } from "vitest";
import type { Command } from "@mc/engine";
import type { LiveControlMessage, LiveGameMessage } from "../live/live-room-protocol.js";
import { handleProposal, type ProposalHandlerDeps } from "./live-proposals.js";
import type { Snapshot } from "./session-core.js";

type Proposal = Extract<LiveControlMessage, { kind: "proposal" }>;
const proposal: Proposal = {
  kind: "proposal",
  gameKey: "g1",
  from: "ava",
  players: ["p1"],
  command: { type: "endTurn", playerId: "p1" },
  base: 3,
  stamp: "S",
};
const command = { type: "endTurn", playerId: "p1" } as Command;
const snapshot = { version: 4 } as unknown as Snapshot;

function setup(
  over: { busy?: boolean; key?: string | null; dispatch?: ProposalHandlerDeps["core"]["dispatchProposal"] } = {},
) {
  const sent: LiveGameMessage[] = [];
  const remote = vi.fn();
  const after = vi.fn();
  const dispatchProposal = vi.fn(over.dispatch ?? (() => ({ ok: true as const, command, snapshot })));
  const deps: ProposalHandlerDeps = {
    core: { liveGameKey: () => (over.key === undefined ? "g1" : over.key), dispatchProposal },
    busy: () => over.busy === true,
    liveSend: (m) => sent.push(m),
    remote,
    after: [after],
  };
  return { deps, sent, remote, after, dispatchProposal };
}

describe("a proposal in the engine worker", () => {
  it("is refused stale, and never dispatched, while a start, resume or rewind is awaiting", () => {
    const t = setup({ busy: true });
    handleProposal(t.deps, proposal);
    expect(t.sent).toEqual([{ kind: "refuse", gameKey: "g1", to: "ava", reason: "stale", base: 3 }]);
    expect(t.dispatchProposal).not.toHaveBeenCalled();
  });

  it("is refused stale when it names another game than the one on the table", () => {
    for (const key of ["g2", null]) {
      const t = setup({ key });
      handleProposal(t.deps, proposal);
      expect(t.sent).toEqual([{ kind: "refuse", gameKey: "g1", to: "ava", reason: "stale", base: 3 }]);
      expect(t.dispatchProposal).not.toHaveBeenCalled();
    }
  });

  it("is applied, handed to the host's own table with its snapshot and followed by the usual steps", () => {
    const t = setup();
    handleProposal(t.deps, proposal);
    expect(t.dispatchProposal).toHaveBeenCalledWith(proposal.command, 3, "S", ["p1"]);
    expect(t.remote).toHaveBeenCalledWith(command, snapshot);
    expect(t.after).toHaveBeenCalledWith(command, snapshot);
    // The proposer is told, by its own id, that this proposal was the one applied.
    expect(t.sent).toEqual([{ kind: "accept", gameKey: "g1", to: "ava", base: 3 }]);
  });

  it("passes the engine's reason on, and calls an engine throw illegal", () => {
    const refused = setup({ dispatch: () => ({ ok: false, reason: "not-your-turn" }) });
    handleProposal(refused.deps, proposal);
    expect(refused.sent).toMatchObject([{ reason: "not-your-turn" }]);
    expect(refused.remote).not.toHaveBeenCalled();
    const threw = setup({
      dispatch: () => {
        throw new Error("boom");
      },
    });
    handleProposal(threw.deps, proposal);
    expect(threw.sent).toMatchObject([{ reason: "illegal" }]);
  });

  it("stays accepted when a step after the dispatch throws", () => {
    const t = setup();
    const failing: ProposalHandlerDeps = {
      ...t.deps,
      after: [
        () => {
          throw new Error("presence");
        },
        t.after,
      ],
    };
    handleProposal(failing, proposal);
    expect(t.remote).toHaveBeenCalledTimes(1);
    expect(t.after).toHaveBeenCalledTimes(1);
    expect(t.sent).toEqual([{ kind: "accept", gameKey: "g1", to: "ava", base: 3 }]);
  });
});
