import { describe, expect, it } from "vitest";
import {
  ChatPopoutRelay,
  Heartbeat,
  isPopoutToken,
  mintPopoutToken,
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

const TOKEN = "0123456789abcdef0123456789abcdef";
const OTHER = "fedcba9876543210fedcba9876543210";

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
    start: () => {
      relay.onState(room());
      relay.arm(TOKEN);
    },
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
    expect(popoutChannelName("a", TOKEN)).not.toBe(popoutChannelName("b", TOKEN));
    expect(popoutChannelName("a", TOKEN)).not.toBe(popoutChannelName("a", OTHER));
  });
});

describe("ChatPopoutRelay", () => {
  it("opens a channel for the room and answers hello with the snapshot, telling main the window is open", () => {
    const r = rig();
    r.start();
    expect(r.names).toEqual([popoutChannelName("r1", TOKEN)]);
    expect(r.sent).toEqual([]);
    r.hear({ kind: "hello" });
    expect(r.opens).toEqual([true]);
    expect(r.sent[0]).toMatchObject({ kind: "snapshot", snapshot: { code: "ABC123" } });
  });
  it("relays each state change to an open window, and nothing to a closed one", () => {
    const r = rig();
    r.start();
    r.relay.onState(room({ chatLive: 3 }));
    expect(r.sent).toEqual([]);
    r.hear({ kind: "hello" });
    r.relay.onState(room({ chatLive: 3 }));
    expect(r.sent.filter((m) => m.kind === "snapshot")).toHaveLength(2);
  });
  it("sends a window's line through the lobby's say, only while open", () => {
    const r = rig();
    r.start();
    r.hear({ kind: "say", text: "early" });
    expect(r.said).toEqual([]);
    r.hear({ kind: "hello" });
    r.hear({ kind: "say", text: "hello room" });
    expect(r.said).toEqual(["hello room"]);
  });
  it("takes the chat back on bye", () => {
    const r = rig();
    r.start();
    r.hear({ kind: "hello" });
    r.hear({ kind: "bye" });
    expect(r.opens).toEqual([true, false]);
    expect(r.relay.isOpen).toBe(false);
  });
  it("takes the chat back when the beats stop, and keeps it while they come", () => {
    const r = rig();
    r.start();
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
    r.start();
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
    r.start();
    for (const bad of [null, 7, "hello", [], { kind: "nope" }, { kind: "say" }, { kind: "say", text: 3 }]) {
      (r.hear as (m: unknown) => void)(bad);
    }
    expect(r.relay.isOpen).toBe(false);
    expect(r.said).toEqual([]);
  });
  it("recall tells the window to close and shows the chat in the lobby again", () => {
    const r = rig();
    r.start();
    r.hear({ kind: "hello" });
    r.relay.recall();
    expect(r.sent.at(-1)).toEqual({ kind: "recall" });
    expect(r.opens).toEqual([true, false]);
  });
  it("tells the window the room is left, and drops the channel", () => {
    const r = rig();
    r.start();
    r.hear({ kind: "hello" });
    r.relay.onState(NO_ROOM);
    expect(r.sent.at(-1)).toEqual({ kind: "left" });
    expect(r.opens).toEqual([true, false]);
    expect(r.closedCount()).toBe(1);
  });
  it("moves to a new channel when the room changes", () => {
    const r = rig();
    r.start();
    r.relay.onState(room({ roomId: "r2" }));
    // The old room's channel is closed, and nothing listens for the new room until this tab arms for it.
    expect(r.closedCount()).toBe(1);
    r.relay.arm(OTHER);
    expect(r.names).toEqual([popoutChannelName("r1", TOKEN), popoutChannelName("r2", OTHER)]);
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

/** A browser's BroadcastChannel namespace: every channel of one name hears the others' posts, never its own. */
function makeBus() {
  const channels = new Map<string, Set<PopoutChannel<unknown, unknown>>>();
  return {
    open<In, Out>(name: string): PopoutChannel<In, Out> {
      const set = channels.get(name) ?? new Set();
      channels.set(name, set);
      const channel: PopoutChannel<In, Out> = {
        onmessage: null,
        postMessage: (message) => {
          for (const other of set)
            if (other !== channel) (other as PopoutChannel<unknown, unknown>).onmessage?.({ data: message });
        },
        close: () => void set.delete(channel as PopoutChannel<unknown, unknown>),
      };
      set.add(channel as PopoutChannel<unknown, unknown>);
      return channel;
    },
  };
}

describe("two tabs of one browser in the same room", () => {
  function tab(bus: ReturnType<typeof makeBus>, id: string, roomId = "r1") {
    const said: string[] = [];
    const opens: boolean[] = [];
    const relay = new ChatPopoutRelay({
      open: (name) => bus.open(name) as PopoutChannel<PopoutToRoom, RoomToPopout>,
      say: (t) => said.push(`${id}:${t}`),
      onOpenChange: (o) => opens.push(o),
      now: () => 0,
      every: () => () => {},
    });
    relay.onState(room({ roomId }));
    return { relay, said, opens };
  }
  /** A pop-out window on `token`'s channel: what it hears, and a way to speak. */
  function windowOn(bus: ReturnType<typeof makeBus>, roomId: string, token: string) {
    const heard: RoomToPopout[] = [];
    const channel = bus.open<RoomToPopout, PopoutToRoom>(popoutChannelName(roomId, token));
    channel.onmessage = (e) => heard.push(e.data);
    return { heard, post: (m: PopoutToRoom) => channel.postMessage(m) };
  }

  it("answers one pop-out with one relay: one line is sent once, and the other tab's chat stays put", () => {
    const bus = makeBus();
    const a = tab(bus, "host");
    const b = tab(bus, "guest");
    b.relay.arm(OTHER);
    a.relay.arm(TOKEN);
    const popout = windowOn(bus, "r1", TOKEN);
    popout.post({ kind: "hello" });
    popout.post({ kind: "say", text: "hello room" });
    expect(a.relay.isOpen).toBe(true);
    expect(a.said).toEqual(["host:hello room"]);
    expect(a.opens).toEqual([true]);
    expect(b.relay.isOpen).toBe(false);
    expect(b.said).toEqual([]);
    expect(b.opens).toEqual([]);
    // Exactly one snapshot came back, from the initiating relay.
    expect(popout.heard.filter((m) => m.kind === "snapshot")).toHaveLength(1);
    // Its bye and recall touch only its own tab.
    popout.post({ kind: "bye" });
    expect(a.relay.isOpen).toBe(false);
    expect(b.opens).toEqual([]);
  });

  it("gives nothing to a pop-out that carries a stale or foreign token", () => {
    const bus = makeBus();
    const a = tab(bus, "host");
    const b = tab(bus, "guest");
    a.relay.arm(TOKEN);
    const stranger = windowOn(bus, "r1", OTHER);
    stranger.post({ kind: "hello" });
    stranger.post({ kind: "say", text: "let me in" });
    expect(stranger.heard).toEqual([]);
    expect(a.relay.isOpen).toBe(false);
    expect(b.relay.isOpen).toBe(false);
    expect(a.said).toEqual([]);
    expect(b.said).toEqual([]);
    // The right token in another room is not this room's channel either.
    const elsewhere = windowOn(bus, "r2", TOKEN);
    elsewhere.post({ kind: "hello" });
    expect(elsewhere.heard).toEqual([]);
    expect(a.relay.isOpen).toBe(false);
  });

  it("never joins a channel it did not arm, and ignores a malformed token", () => {
    const bus = makeBus();
    const a = tab(bus, "host");
    a.relay.arm("not a token");
    a.relay.arm("");
    const popout = windowOn(bus, "r1", "not a token");
    popout.post({ kind: "hello" });
    expect(a.relay.isOpen).toBe(false);
    expect(popout.heard).toEqual([]);
  });

  it("replaces its token on a new pop-out: the earlier window is told to close and loses the channel", () => {
    const bus = makeBus();
    const a = tab(bus, "host");
    a.relay.arm(TOKEN);
    const first = windowOn(bus, "r1", TOKEN);
    first.post({ kind: "hello" });
    expect(a.relay.isOpen).toBe(true);
    a.relay.arm(OTHER);
    expect(first.heard.at(-1)).toEqual({ kind: "recall" });
    expect(a.relay.isOpen).toBe(false);
    first.post({ kind: "say", text: "from the old window" });
    expect(a.said).toEqual([]);
    const second = windowOn(bus, "r1", OTHER);
    second.post({ kind: "hello" });
    second.post({ kind: "say", text: "from the new one" });
    expect(a.said).toEqual(["host:from the new one"]);
  });

  it("arms only once a room is joined, and drops the token on leaving it", () => {
    const bus = makeBus();
    const relay = new ChatPopoutRelay({
      open: (name) => bus.open(name) as PopoutChannel<PopoutToRoom, RoomToPopout>,
      say: () => {},
      onOpenChange: () => {},
      now: () => 0,
      every: () => () => {},
    });
    relay.arm(TOKEN);
    const early = windowOn(bus, "r1", TOKEN);
    early.post({ kind: "hello" });
    expect(relay.isOpen).toBe(false);
    relay.onState(room());
    relay.arm(TOKEN);
    early.post({ kind: "hello" });
    expect(relay.isOpen).toBe(true);
    relay.onState(NO_ROOM);
    expect(early.heard.at(-1)).toEqual({ kind: "left" });
    early.post({ kind: "hello" });
    expect(relay.isOpen).toBe(false);
  });
});

describe("mintPopoutToken", () => {
  it("is 32 hex characters from the random source, and two mints differ", () => {
    const token = mintPopoutToken();
    expect(isPopoutToken(token)).toBe(true);
    expect(mintPopoutToken()).not.toBe(token);
    expect(mintPopoutToken((b) => b.fill(255))).toBe("f".repeat(32));
    expect(isPopoutToken("xyz")).toBe(false);
    expect(isPopoutToken(7)).toBe(false);
  });
});
