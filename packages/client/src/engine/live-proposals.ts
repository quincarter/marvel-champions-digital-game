/**
 * A seat holder's proposal reaching the engine worker (issue #881), apart from the worker global so it can be tested:
 * judged and, when it passes, applied by the engine exactly as a host command is (same log, same checksums, streamed to
 * the room the same way), and the host's own table is told. Otherwise the proposer is told why, through the room.
 * Nothing a seat sends is trusted: `core.dispatchProposal` checks it against the table and the engine's own validation
 * has the last word.
 */
import type { Command } from "@mc/engine";
import type { ProposalRefusal } from "@mc/sync-worker/room-protocol";
import type { LiveControlMessage, LiveGameMessage } from "../live/live-room-protocol.js";
import type { EngineSessionCore, Snapshot } from "./session-core.js";

export interface ProposalHandlerDeps {
  readonly core: Pick<EngineSessionCore, "liveGameKey" | "dispatchProposal">;
  /** True while a start, resume or rewind is awaiting: there is no settled table to judge against. */
  readonly busy: () => boolean;
  readonly liveSend: (message: LiveGameMessage) => void;
  /** The accepted command, for the host's own table (`remoteDispatched`). */
  readonly remote: (command: Command, snapshot: Snapshot) => void;
  /** What follows an applied command, as after a host dispatch: saving, presence, the live stream. Each may throw. */
  readonly after: readonly ((command: Command, snapshot: Snapshot) => void)[];
}

export function handleProposal(
  deps: ProposalHandlerDeps,
  proposal: Extract<LiveControlMessage, { kind: "proposal" }>,
): void {
  const refuse = (reason: ProposalRefusal): void =>
    deps.liveSend({
      kind: "refuse",
      gameKey: proposal.gameKey,
      to: proposal.from,
      reason,
      base: proposal.base,
      ...(proposal.pid === undefined ? {} : { pid: proposal.pid }),
    });
  if (deps.busy() || deps.core.liveGameKey() !== proposal.gameKey) {
    refuse("stale");
    return;
  }
  let result: ReturnType<ProposalHandlerDeps["core"]["dispatchProposal"]>;
  try {
    result = deps.core.dispatchProposal(proposal.command, proposal.base, proposal.stamp, proposal.players);
  } catch {
    refuse("illegal");
    return;
  }
  if (!result.ok) {
    refuse(result.reason);
    return;
  }
  // The command is in the log now: nothing after this may turn it into a refusal.
  // Said before the log's own echo goes out, so the proposer holds it when the command arrives: that is how it tells
  // its own accepted proposal from an identical command someone else got into the log first.
  deps.liveSend({
    kind: "accept",
    gameKey: proposal.gameKey,
    to: proposal.from,
    base: proposal.base,
    ...(proposal.pid === undefined ? {} : { pid: proposal.pid }),
  });
  deps.remote(result.command, result.snapshot);
  for (const after of deps.after) {
    try {
      after(result.command, result.snapshot);
    } catch {
      // Saving, presence and the stream are nicer-to-have; the accepted command stands.
    }
  }
}
