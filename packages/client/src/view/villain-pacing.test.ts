import { describe, expect, it } from "vitest";
import type { RoomVillainCursor } from "../live/room-state.js";
import {
  cursorFor,
  cursorToSend,
  followPlan,
  followsHost,
  hostCursorOf,
  pacingOf,
  phaseKeyOf,
} from "./villain-pacing.js";

const cursor = (at: number, state: RoomVillainCursor["state"] = "playing", key = "3"): RoomVillainCursor => ({
  key,
  at,
  state,
});

describe("villain pacing", () => {
  it("leads with the host unless the lobby says each player paces", () => {
    expect(pacingOf(null)).toBe("host");
    expect(pacingOf({})).toBe("host");
    expect(pacingOf({ villainPacing: "host" })).toBe("host");
    expect(pacingOf({ villainPacing: "each" })).toBe("each");
  });

  it("follows the host only as a seated guest, in a room where the host leads", () => {
    const room = (villainPacing?: "host" | "each") => ({ settings: villainPacing ? { villainPacing } : {} });
    expect(followsHost(null)).toBe(false);
    expect(followsHost({ seatGame: false, room: room("host") })).toBe(false);
    expect(followsHost({ seatGame: true, room: room("each") })).toBe(false);
    expect(followsHost({ seatGame: true, room: room("host") })).toBe(true);
    expect(followsHost({ seatGame: true, room: room() })).toBe(true);
    expect(followsHost({ seatGame: true, room: { settings: null } })).toBe(true);
  });

  it("ignores a cursor left from another phase", () => {
    expect(cursorFor(cursor(4, "playing", "2"), phaseKeyOf(3))).toBeNull();
    expect(cursorFor(cursor(4, "closed", "2"), phaseKeyOf(3))).toBeNull();
    expect(cursorFor(cursor(4), phaseKeyOf(3))).toEqual(cursor(4));
    expect(cursorFor(null, "3")).toBeNull();
  });
});

describe("followPlan", () => {
  it("waits on the host before it has started, and with no cursor at all", () => {
    expect(followPlan({ cursor: null, total: 9, choiceDue: false })).toEqual({
      waiting: true,
      reveal: 0,
      closed: false,
    });
    expect(followPlan({ cursor: cursor(0, "gate"), total: 9, choiceDue: false })).toEqual({
      waiting: true,
      reveal: 0,
      closed: false,
    });
  });

  it("shows beats only as far as the host has", () => {
    expect(followPlan({ cursor: cursor(4), total: 9, choiceDue: false })).toEqual({
      waiting: false,
      reveal: 4,
      closed: false,
    });
  });

  it("never shows past the beats this device knows of, nor a negative count", () => {
    expect(followPlan({ cursor: cursor(12), total: 9, choiceDue: false }).reveal).toBe(9);
    expect(followPlan({ cursor: cursor(0), total: 0, choiceDue: false }).reveal).toBe(0);
  });

  it("closes when the host's screen closed", () => {
    expect(followPlan({ cursor: cursor(9, "closed"), total: 9, choiceDue: false })).toEqual({
      waiting: false,
      reveal: 9,
      closed: true,
    });
    // A guest whose own decision is open is not held, but a closed host still closes it.
    expect(followPlan({ cursor: cursor(9, "closed"), total: 9, choiceDue: true }).closed).toBe(true);
  });

  it("brings a decision for this seat up at once, before the host has started or got there", () => {
    expect(followPlan({ cursor: null, total: 6, choiceDue: true })).toEqual({
      waiting: false,
      reveal: 6,
      closed: false,
    });
    expect(followPlan({ cursor: cursor(0, "gate"), total: 6, choiceDue: true }).waiting).toBe(false);
    expect(followPlan({ cursor: cursor(2), total: 6, choiceDue: true }).reveal).toBe(6);
  });
});

describe("the host's cursor", () => {
  it("reports the gate, the beats shown, and the close", () => {
    expect(hostCursorOf({ key: "3", revealed: 0, waitingToStart: true, closed: false })).toEqual({
      key: "3",
      at: 0,
      state: "gate",
    });
    expect(hostCursorOf({ key: "3", revealed: 5, waitingToStart: false, closed: false })).toEqual({
      key: "3",
      at: 5,
      state: "playing",
    });
    expect(hostCursorOf({ key: "3", revealed: 5, waitingToStart: false, closed: true }).state).toBe("closed");
  });

  it("sends only what changed", () => {
    const a = hostCursorOf({ key: "3", revealed: 1, waitingToStart: false, closed: false });
    expect(cursorToSend(null, a)).toEqual(a);
    expect(cursorToSend(a, { ...a })).toBeNull();
    expect(cursorToSend(a, { ...a, at: 2 })).toEqual({ ...a, at: 2 });
    expect(cursorToSend(a, { ...a, state: "closed" })?.state).toBe("closed");
    expect(cursorToSend(a, { ...a, key: "4" })?.key).toBe("4");
  });
});
