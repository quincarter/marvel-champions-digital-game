/**
 * An Epic Multiplayer pod coordinator's inbound event reaching the engine worker (issue #882), apart from the worker
 * global so it can be tested: applied as the group's own `Command externalEvent`, so it is in this table's log (a group
 * replays alone), streams to the room and its watchers like any command, and shows on the host's own table.
 * It comes from the organizer's coordinator through the pod link, never from a seat, so it is not judged as a proposal;
 * the engine's own checks (`externalEvent`: a remote coordinator, the next sequence) have the last word.
 */
import type { Command } from "@mc/engine";
import type { LiveControlMessage } from "../live/live-room-protocol.js";
import type { EngineSessionCore, Snapshot } from "./session-core.js";

export interface PodInboundDeps {
  readonly core: Pick<EngineSessionCore, "liveGameKey" | "dispatch" | "podInboundCommand" | "podReleaseCommand">;
  /** True while a start, resume or rewind is awaiting: the event waits (it is never dropped) until the table settles. */
  readonly busy: () => boolean;
  /** Runs `run` again a little later. */
  readonly later: (run: () => void) => void;
  /** The applied command, for the host's own table (`remoteDispatched`). */
  readonly remote: (command: Command, snapshot: Snapshot) => void;
  /** What follows an applied command, as after a host dispatch: saving, presence, the live stream. Each may throw. */
  readonly after: readonly ((command: Command, snapshot: Snapshot) => void)[];
}

/**
 * The table host ends a wait for a coordinator that is gone (`Command podRelease`): applied like an inbound event, and
 * refused by the engine unless the group really is waiting.
 */
export function handlePodRelease(
  deps: PodInboundDeps,
  message: Extract<LiveControlMessage, { kind: "pod-release" }>,
): void {
  if (deps.busy()) {
    deps.later(() => handlePodRelease(deps, message));
    return;
  }
  if (deps.core.liveGameKey() !== message.gameKey) return;
  const command = deps.core.podReleaseCommand();
  if (!command) return;
  try {
    const result = deps.core.dispatch(command);
    if (!result.ok) return;
    deps.remote(command, result.snapshot);
    for (const after of deps.after) {
      try {
        after(command, result.snapshot);
      } catch {
        // Saving and the stream are nicer-to-have; the release stands.
      }
    }
  } catch {
    // Nothing changed.
  }
}

export function handlePodInbound(
  deps: PodInboundDeps,
  message: Extract<LiveControlMessage, { kind: "pod-inbound" }>,
): void {
  if (deps.busy()) {
    deps.later(() => handlePodInbound(deps, message));
    return;
  }
  // An event for another game (the table was left) is no concern of this one.
  if (deps.core.liveGameKey() !== message.gameKey) return;
  const command = deps.core.podInboundCommand(message.sequence, message.event);
  if (!command) return;
  let result: ReturnType<PodInboundDeps["core"]["dispatch"]>;
  try {
    result = deps.core.dispatch(command);
  } catch {
    return;
  }
  // Refused (not the next sequence, say): nothing changed, and the link asks the organizer again at its next sync.
  if (!result.ok) return;
  deps.remote(command, result.snapshot);
  for (const after of deps.after) {
    try {
      after(command, result.snapshot);
    } catch {
      // Saving, presence and the stream are nicer-to-have; the applied event stands.
    }
  }
}
