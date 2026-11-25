/**
 * A pod coordinator's inbound event in the engine worker (Epic Multiplayer, issue #882): `handlePodInbound` with a fake
 * session core. The engine's own `externalEvent` rules are covered by the engine's pod tests.
 */
import type { Command, PodInboundEvent } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import type { LiveControlMessage } from "../live/live-room-protocol.js";
import { handlePodInbound, handlePodRelease, type PodInboundDeps } from "./live-pod.js";
import type { Snapshot } from "./session-core.js";

type Inbound = Extract<LiveControlMessage, { kind: "pod-inbound" }>;

const EVENT: PodInboundEvent = { kind: "sharedAck", seq: 1 };
const message = (over: Partial<Inbound> = {}): Inbound => ({
  kind: "pod-inbound",
  gameKey: "game",
  sequence: 1,
  event: EVENT,
  ...over,
});
const SNAPSHOT = { version: 7 } as unknown as Snapshot;

function setup(
  over: { busy?: () => boolean; dispatchOk?: boolean; key?: string | null; command?: Command | null } = {},
) {
  const calls: string[] = [];
  const later: (() => void)[] = [];
  const command: Command | null =
    over.command === undefined
      ? ({ type: "externalEvent", playerId: "p1", sequence: 1, event: EVENT } as unknown as Command)
      : over.command;
  const deps: PodInboundDeps = {
    core: {
      liveGameKey: () => (over.key === undefined ? "game" : over.key),
      podInboundCommand: vi.fn((sequence: number) => {
        calls.push(`command ${sequence}`);
        return command;
      }),
      dispatch: vi.fn(() => {
        calls.push("dispatch");
        return over.dispatchOk === false
          ? { ok: false as const, error: { code: "internal_error", message: "no", command: command as Command } }
          : { ok: true as const, snapshot: SNAPSHOT };
      }),
    } as unknown as PodInboundDeps["core"],
    busy: over.busy ?? (() => false),
    later: (run) => later.push(run),
    remote: () => calls.push("remote"),
    after: [() => calls.push("after-1"), () => calls.push("after-2")],
  };
  return { deps, calls, later };
}

describe("a pod coordinator's inbound event in the engine worker", () => {
  it("applies it as the group's own command, then tells the host's table and runs what follows a command", () => {
    const { deps, calls } = setup();
    handlePodInbound(deps, message());
    expect(calls).toEqual(["command 1", "dispatch", "remote", "after-1", "after-2"]);
  });

  it("waits while a start, resume or rewind is awaiting, and applies it once the table settles", () => {
    let busy = true;
    const { deps, calls, later } = setup({ busy: () => busy });
    handlePodInbound(deps, message());
    expect(calls).toEqual([]);
    expect(later).toHaveLength(1);
    // Still busy at the retry: waits again, never drops.
    later.shift()?.();
    expect(later).toHaveLength(1);
    busy = false;
    later.shift()?.();
    expect(calls).toEqual(["command 1", "dispatch", "remote", "after-1", "after-2"]);
  });

  it("ignores an event for another game", () => {
    const { deps, calls } = setup({ key: "other" });
    handlePodInbound(deps, message());
    expect(calls).toEqual([]);
  });

  it("ignores an event for a game with no remote coordinator", () => {
    const { deps, calls } = setup({ command: null });
    handlePodInbound(deps, message());
    expect(calls).toEqual(["command 1"]);
  });

  it("changes nothing when the engine refuses it (the link asks again at its next sync)", () => {
    const { deps, calls } = setup({ dispatchOk: false });
    handlePodInbound(deps, message());
    expect(calls).toEqual(["command 1", "dispatch"]);
  });

  it("keeps the applied event when saving or the stream throws", () => {
    const { deps, calls } = setup();
    const throwing: PodInboundDeps = {
      ...deps,
      after: [
        () => {
          throw new Error("disk full");
        },
        () => calls.push("after-2"),
      ],
    };
    handlePodInbound(throwing, message());
    expect(calls).toEqual(["command 1", "dispatch", "remote", "after-2"]);
  });

  it("applies a release as the group's own command, and only for the game it names", () => {
    const { deps, calls } = setup();
    const core = deps.core as unknown as { podReleaseCommand: () => Command | null };
    core.podReleaseCommand = () => ({ type: "podRelease", playerId: "p1" }) as unknown as Command;
    handlePodRelease(deps, { kind: "pod-release", gameKey: "game" });
    expect(calls).toEqual(["dispatch", "remote", "after-1", "after-2"]);
    handlePodRelease(deps, { kind: "pod-release", gameKey: "other" });
    expect(calls).toHaveLength(4);
  });
});
