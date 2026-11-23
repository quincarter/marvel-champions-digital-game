import { describe, expect, it } from "vitest";
import { hostGameStep, type HostGameRoom } from "./host-game-resume.js";

const room = (over: Partial<HostGameRoom> = {}): HostGameRoom => ({
  role: "host",
  connection: "connected",
  roomId: "r1",
  ...over,
});
const loaded = { screenLoaded: true, resumed: true };

describe("when a reloaded host may open its board", () => {
  it("opens only for the connected host of the room the rejoin named", () => {
    expect(hostGameStep(loaded, "r1", room()).step).toEqual({ kind: "open", toLobby: false });
    // The room id is learned from the first host state.
    expect(hostGameStep(loaded, null, room()).step).toEqual({ kind: "open", toLobby: false });
  });

  it("waits while the host welcome is delayed: connecting, reconnecting, or no room yet", () => {
    for (const connection of ["connecting", "reconnecting"] as const) {
      expect(hostGameStep(loaded, "r1", room({ connection })).step.kind).toBe("wait");
    }
    expect(hostGameStep(loaded, "r1", room({ role: "none", connection: "idle", roomId: null })).step.kind).toBe("wait");
  });

  it("waits for the save too, even with the host confirmed", () => {
    expect(hostGameStep({ screenLoaded: false, resumed: false }, "r1", room()).step.kind).toBe("wait");
  });

  it("a guest fallback can never open the host board: the game is put away, the guest lobby opens once connected", () => {
    expect(hostGameStep(loaded, "r1", room({ role: "guest", connection: "connecting" })).step).toEqual({
      kind: "put-away",
      toLobby: false,
    });
    expect(hostGameStep(loaded, "r1", room({ role: "guest" })).step).toEqual({ kind: "put-away", toLobby: true });
  });

  it("a host of a different room does not open this game", () => {
    expect(hostGameStep(loaded, "r1", room({ roomId: "r2" })).step.kind).toBe("wait");
  });

  it("a save that could not be resumed lands the confirmed host in its lobby", () => {
    expect(hostGameStep({ screenLoaded: true, resumed: false }, "r1", room()).step).toEqual({
      kind: "open",
      toLobby: true,
    });
  });
});
