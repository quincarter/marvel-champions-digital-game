import { describe, expect, it } from "vitest";
import {
  ChatPopoutRelay,
  Heartbeat,
  POPOUT_BEAT_MS,
  POPOUT_TIMEOUT_MS,
  parsePopoutSnapshot,
  parsePopoutToRoom,
  parseRoomToPopout,
  popoutChannelName,
  popoutSnapshotOf,
  type PopoutChannel,
  type PopoutToRoom,
  type RoomToPopout,
} from "./chat-popout-protocol.js";
import { NO_ROOM, type RoomState } from "./room-state.js";

const room = (extra: Partial<RoomState> = {}): RoomState => ({
  ...NO_ROOM,
  role: "host",
  connection: "connected",
  roomId: "r1",
  code: "ABC123",
  settings: { chat: true } as RoomState["settings"],
  chat: [
    { from: "p0", name: "Ava", text: "hi", at: 1, mine: true },
    { from: "p1", name: null, text: "yo", at: 2, mine: false },
  ] as RoomState["chat"],
  chatLive: 2,
  ...extra,
});

function rig() {
  const sent: RoomToPopout[] = [];
  const said: string[] = [];
  const opens: boolean[] = [];
  const names: string[] = [];
  let now = 0;
  let tick: (() => void) | null = null;
  let closed = 0;
  const channel: PopoutChannel<PopoutToRoom, RoomToPopout> = {
    postMessage: (m) => sent.push(m),
    onmessage: null,
    close: () => closed++,
  };
  const relay = new ChatPopoutRelay({
    open: (name) => {
      names.push(name);
      return channel;
    },
    say: (t) => said.push(t),
    onOpenChange: (o) => opens.push(o),
    now: () => now,
    every: (fn) => {
      tick = fn;
      return () => (tick = null);
    },
  });
  const hear = (m: PopoutToRoom) => channel.onmessage?.({ data: m });
  return {
    relay,
    sent,
    said,
    opens,
    names,
    hear,
    advance: (ms: number) => {
      now += ms;
      tick?.();
    },
    closedCount: () => closed,
  };
}

describe("Heartbeat", () => {
  it("is dead before the first beat and after the timeout", () => {
    const hb = new Heartbeat();
    expect(hb.alive(0)).toBe(false);
    hb.beat(100);
    expect(hb.alive(100 + POPOUT_TIMEOUT_MS)).toBe(true);
    expect(hb.alive(101 + POPOUT_TIMEOUT_MS)).toBe(false);
    hb.stop();
    expect(hb.alive(100)).toBe(false);
  });
  it("gives a window more than two missed beats of grace", () => {
    expect(POPOUT_TIMEOUT_MS).toBeGreaterThan(2 * POPOUT_BEAT_MS);
  });
});

describe("popoutSnapshotOf", () => {
  it("carries the lines, the code and whether chat is on or the room over", () => {
    const s = popoutSnapshotOf(room());
    expect(s).toMatchObject({ code: "ABC123", live: 2, chatOn: true, ended: false });
    expect(s.lines).toEqual([
      { name: "Ava", text: "hi", mine: true },
      { name: "?", text: "yo", mine: false },
    ]);
    expect(popoutSnapshotOf(room({ connection: "ended" })).ended).toBe(true);
    expect(popoutSnapshotOf(room({ settings: { chat: false } as RoomState["settings"] })).chatOn).toBe(false);
  });
  it("names the channel per room", () => {
    expect(popoutChannelName("a")).not.toBe(popoutChannelName("b"));
  });
});

describe("ChatPopoutRelay", () => {
  it("opens a channel for the room and answers hello with the snapshot, telling main the window is open", () => {
    const r = rig();
    r.relay.onState(room());
    expect(r.names).toEqual([popoutChannelName("r1")]);
    expect(r.sent).toEqual([]);
    r.hear({ kind: "hello" });
    expect(r.opens).toEqual([true]);
    expect(r.sent[0]).toMatchObject({ kind: "snapshot", snapshot: { code: "ABC123" } });
  });
  it("relays each state change to an open window, and nothing to a closed one", () => {
    const r = rig();
    r.relay.onState(room());
    r.relay.onState(room({ chatLive: 3 }));
    expect(r.sent).toEqual([]);
    r.hear({ kind: "hello" });
    r.relay.onState(room({ chatLive: 3 }));
    expect(r.sent.filter((m) => m.kind === "snapshot")).toHaveLength(2);
  });
  it("sends a window's line through the lobby's say, only while open", () => {
    const r = rig();
    r.relay.onState(room());
    r.hear({ kind: "say", text: "early" });
    expect(r.said).toEqual([]);
    r.hear({ kind: "hello" });
    r.hear({ kind: "say", text: "hello room" });
    expect(r.said).toEqual(["hello room"]);
  });
  it("takes the chat back on bye", () => {
    const r = rig();
    r.relay.onState(room());
    r.hear({ kind: "hello" });
    r.hear({ kind: "bye" });
    expect(r.opens).toEqual([true, false]);
    expect(r.relay.isOpen).toBe(false);
  });
  it("takes the chat back when the beats stop, and keeps it while they come", () => {
    const r = rig();
    r.relay.onState(room());
    r.hear({ kind: "hello" });
    r.advance(POPOUT_BEAT_MS);
    r.hear({ kind: "beat" });
    r.advance(POPOUT_BEAT_MS);
    r.hear({ kind: "beat" });
    expect(r.relay.isOpen).toBe(true);
    expect(r.sent.filter((m) => m.kind === "beat")).toHaveLength(2);
    r.advance(POPOUT_TIMEOUT_MS + 1);
    expect(r.relay.isOpen).toBe(false);
    expect(r.opens).toEqual([true, false]);
  });
  it("takes a beat from a window it had written off as a hello, so a reloaded tab gets its pop-out back", () => {
    const r = rig();
    r.relay.onState(room());
    r.hear({ kind: "beat" });
    expect(r.relay.isOpen).toBe(true);
    expect(r.sent[0]).toMatchObject({ kind: "snapshot" });
    r.advance(POPOUT_TIMEOUT_MS + 1);
    expect(r.relay.isOpen).toBe(false);
    r.hear({ kind: "beat" });
    expect(r.relay.isOpen).toBe(true);
    expect(r.opens).toEqual([true, false, true]);
  });
  it("drops messages that are not an object or carry an unknown kind", () => {
    const r = rig();
    r.relay.onState(room());
    for (const bad of [null, 7, "hello", [], { kind: "nope" }, { kind: "say" }, { kind: "say", text: 3 }]) {
      (r.hear as (m: unknown) => void)(bad);
    }
    expect(r.relay.isOpen).toBe(false);
    expect(r.said).toEqual([]);
  });
  it("recall tells the window to close and shows the chat in the lobby again", () => {
    const r = rig();
    r.relay.onState(room());
    r.hear({ kind: "hello" });
    r.relay.recall();
    expect(r.sent.at(-1)).toEqual({ kind: "recall" });
    expect(r.opens).toEqual([true, false]);
  });
  it("tells the window the room is left, and drops the channel", () => {
    const r = rig();
    r.relay.onState(room());
    r.hear({ kind: "hello" });
    r.relay.onState(NO_ROOM);
    expect(r.sent.at(-1)).toEqual({ kind: "left" });
    expect(r.opens).toEqual([true, false]);
    expect(r.closedCount()).toBe(1);
  });
  it("moves to a new channel when the room changes", () => {
    const r = rig();
    r.relay.onState(room());
    r.relay.onState(room({ roomId: "r2" }));
    expect(r.names).toEqual([popoutChannelName("r1"), popoutChannelName("r2")]);
  });
});

describe("message parsers", () => {
  const snapshot = {
    code: "ABC123",
    lines: [{ name: "Ava", text: "hi", mine: true }],
    live: 1,
    chatOn: true,
    ended: false,
  };
  it("accept the known messages and nothing else", () => {
    expect(parsePopoutToRoom({ kind: "say", text: "x" })).toEqual({ kind: "say", text: "x" });
    expect(parsePopoutToRoom({ kind: "bye", extra: 1 })).toEqual({ kind: "bye" });
    expect(parsePopoutToRoom({ kind: "say", text: 1 })).toBeNull();
    expect(parsePopoutToRoom(undefined)).toBeNull();
    expect(parseRoomToPopout({ kind: "recall" })).toEqual({ kind: "recall" });
    expect(parseRoomToPopout({ kind: "snapshot", snapshot })).toEqual({ kind: "snapshot", snapshot });
    expect(parseRoomToPopout({ kind: "bogus" })).toBeNull();
    expect(parseRoomToPopout("snapshot")).toBeNull();
  });
  it("check a snapshot's shape before it is rendered", () => {
    expect(parsePopoutSnapshot(snapshot)).toEqual(snapshot);
    expect(parsePopoutSnapshot({ ...snapshot, lines: "no" })).toBeNull();
    expect(parsePopoutSnapshot({ ...snapshot, lines: [{ name: "A", text: 1, mine: true }] })).toBeNull();
    expect(parsePopoutSnapshot({ ...snapshot, lines: [null] })).toBeNull();
    expect(parsePopoutSnapshot({ ...snapshot, chatOn: "yes" })).toBeNull();
    expect(parsePopoutSnapshot({ ...snapshot, code: 5 })).toBeNull();
    expect(parseRoomToPopout({ kind: "snapshot", snapshot: { code: "x" } })).toBeNull();
  });
});
