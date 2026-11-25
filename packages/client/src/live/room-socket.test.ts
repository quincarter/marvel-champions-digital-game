import { describe, expect, it, vi } from "vitest";
import {
  MAX_FAILED_ATTEMPTS,
  RECONNECT_CAP_MS,
  RoomSocket,
  createRoom,
  parseServerMessage,
  reconnectDelay,
  roomSocketUrl,
  type RoomSocketDeps,
  type WebSocketLike,
} from "./room-socket.js";

class FakeSocket implements WebSocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(message: unknown): void {
    this.onmessage?.({ data: typeof message === "string" ? message : JSON.stringify(message) });
  }
  closeWithCode(code: number): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  drop(): void {
    this.readyState = 3;
    this.onclose?.({});
  }
}

const welcome = {
  v: 1,
  ch: "room",
  kind: "welcome",
  you: { id: "p1", role: "host" },
  caps: [],
  participants: [],
  tables: [],
};

function setup() {
  FakeSocket.all = [];
  const timers: { run: () => void; ms: number; live: boolean }[] = [];
  const deps: RoomSocketDeps = {
    WebSocket: FakeSocket,
    setTimer: (run, ms) => {
      const timer = { run, ms, live: true };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      (handle as { live: boolean }).live = false;
    },
    random: () => 0.5,
  };
  const connection: boolean[] = [];
  const messages: unknown[] = [];
  const socket = new RoomSocket({
    baseUrl: "https://sync.example",
    roomId: "abcdefghijkl",
    token: "t".repeat(32),
    onConnection: (c) => connection.push(c),
    onMessage: (m) => messages.push(m),
    deps,
  });
  return { socket, timers, connection, messages };
}

describe("room socket", () => {
  it("builds the wss url", () => {
    expect(roomSocketUrl("https://sync.example/", "abcdefghijkl")).toBe("wss://sync.example/room/abcdefghijkl/ws");
    expect(roomSocketUrl("http://localhost:8787", "abcdefghijkl")).toBe("ws://localhost:8787/room/abcdefghijkl/ws");
  });

  it("says hello on open and is connected only after the welcome", () => {
    const { socket, connection } = setup();
    socket.connect();
    const ws = FakeSocket.all[0]!;
    expect(ws.url).toBe("wss://sync.example/room/abcdefghijkl/ws");
    expect(socket.send({ v: 1, ch: "game", kind: "end", table: "t1", outcome: null })).toBe(false);
    ws.open();
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({
      ch: "room",
      kind: "hello",
      token: "t".repeat(32),
      caps: ["watch"],
    });
    expect(connection).toEqual([]);
    ws.receive(welcome);
    expect(connection).toEqual([true]);
    expect(socket.send({ v: 1, ch: "game", kind: "end", table: "t1", outcome: null })).toBe(true);
  });

  it("ignores unknown channels, kinds, versions and junk", () => {
    const { socket, messages } = setup();
    socket.connect();
    const ws = FakeSocket.all[0]!;
    ws.open();
    ws.receive({ v: 1, ch: "voice", kind: "x" });
    ws.receive({ v: 1, ch: "game", kind: "teleport" });
    ws.receive({ v: 2, ch: "room", kind: "welcome" });
    ws.receive("not json");
    ws.receive({ v: 1, ch: "game", kind: "resend", table: "t1" });
    expect(messages).toEqual([{ v: 1, ch: "game", kind: "resend", table: "t1" }]);
    expect(parseServerMessage(5)).toBeNull();
  });

  it("reconnects with backoff after a drop, and resets after a welcome", () => {
    const { socket, timers, connection } = setup();
    socket.connect();
    FakeSocket.all[0]!.open();
    FakeSocket.all[0]!.receive(welcome);
    FakeSocket.all[0]!.drop();
    expect(connection).toEqual([true, false]);
    expect(timers).toHaveLength(1);
    timers[0]!.run();
    expect(FakeSocket.all).toHaveLength(2);
    // A second drop before any welcome backs off further.
    FakeSocket.all[1]!.drop();
    expect(timers[1]!.ms).toBeGreaterThan(timers[0]!.ms);
    timers[1]!.run();
    FakeSocket.all[2]!.open();
    FakeSocket.all[2]!.receive(welcome);
    FakeSocket.all[2]!.drop();
    expect(timers[2]!.ms).toBe(timers[0]!.ms);
  });

  it("caps the delay and jitters it", () => {
    expect(reconnectDelay(0, () => 1)).toBe(1000);
    expect(reconnectDelay(0, () => 0)).toBe(500);
    expect(reconnectDelay(30, () => 1)).toBe(RECONNECT_CAP_MS);
  });

  it("does not reconnect after being replaced as host (close code 4000)", () => {
    const { socket, timers } = setup();
    socket.connect();
    const ws = FakeSocket.all[0]!;
    ws.open();
    ws.receive(welcome);
    ws.readyState = 3;
    ws.onclose?.({ code: 4000 });
    expect(timers).toHaveLength(0);
  });

  it("stops reconnecting when the room closes or close() is called", () => {
    const { socket, timers } = setup();
    const closed = vi.fn();
    socket.connect();
    FakeSocket.all[0]!.open();
    socket.close();
    expect(timers).toHaveLength(0);
    expect(FakeSocket.all[0]!.onclose).toBeNull();

    const second = new RoomSocket({
      baseUrl: "https://sync.example",
      roomId: "abcdefghijkl",
      onConnection: () => {},
      onMessage: () => {},
      onClosed: closed,
      deps: {
        WebSocket: FakeSocket,
        setTimer: () => {
          throw new Error("no timer expected");
        },
        clearTimer: () => {},
        random: () => 0,
      },
    });
    second.connect();
    const ws = FakeSocket.all.at(-1)!;
    ws.open();
    ws.receive({ v: 1, ch: "room", kind: "closed", reason: "ended" });
    ws.drop();
    expect(closed).toHaveBeenCalledWith("ended");
  });
});

describe("createRoom", () => {
  const room = { roomId: "abcdefghijkl", hostToken: "h".repeat(32), table: "t1" };
  const respond = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

  it("answers the room", async () => {
    expect(await createRoom({ baseUrl: "https://s", fetch: respond(201, room) })).toEqual({ ok: true, room });
  });
  it("maps failures", async () => {
    expect(await createRoom({ baseUrl: null, fetch: respond(201, room) })).toEqual({
      ok: false,
      failure: "unavailable",
    });
    expect(await createRoom({ baseUrl: "https://s", fetch: respond(429, { reason: "rate-limited" }) })).toEqual({
      ok: false,
      failure: "rate-limited",
    });
    expect(await createRoom({ baseUrl: "https://s", fetch: respond(503, { reason: "disabled" }) })).toEqual({
      ok: false,
      failure: "disabled",
    });
    expect(await createRoom({ baseUrl: "https://s", fetch: respond(201, { ...room, roomId: "x" }) })).toEqual({
      ok: false,
      failure: "unavailable",
    });
    expect(await createRoom({ baseUrl: "https://s", fetch: respond(404, { reason: "not-found" }) })).toEqual({
      ok: false,
      failure: "rejected",
    });
    expect(await createRoom({ baseUrl: "https://s", fetch: respond(403, { reason: "origin" }) })).toEqual({
      ok: false,
      failure: "rejected",
    });
    expect(await createRoom({ baseUrl: "https://s", fetch: respond(408, {}) })).toEqual({
      ok: false,
      failure: "unavailable",
    });
    expect(await createRoom({ baseUrl: "https://s", fetch: respond(500, { reason: "server" }) })).toEqual({
      ok: false,
      failure: "unavailable",
    });
    const boom = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await createRoom({ baseUrl: "https://s", fetch: boom })).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("room socket, a room that is gone or replaced", () => {
  it("treats close code 1011 before any welcome as a gone room, with no reconnect", () => {
    const { timers } = setup();
    const onGone = vi.fn();
    const socket = new RoomSocket({
      baseUrl: "https://sync.example",
      roomId: "abcdefghijkl",
      onConnection: () => {},
      onMessage: () => {},
      onGone,
      deps: {
        WebSocket: FakeSocket,
        setTimer: () => {
          throw new Error("no timer expected");
        },
        clearTimer: () => {},
        random: () => 0,
      },
    });
    socket.connect();
    FakeSocket.all.at(-1)!.closeWithCode(1011);
    expect(onGone).toHaveBeenCalledTimes(1);
    expect(timers).toHaveLength(0);
  });

  it("gives up after MAX_FAILED_ATTEMPTS connections in a row that never got a welcome", () => {
    const onGone = vi.fn();
    const timers: (() => void)[] = [];
    const socket = new RoomSocket({
      baseUrl: "https://sync.example",
      roomId: "abcdefghijkl",
      onConnection: () => {},
      onMessage: () => {},
      onGone,
      deps: {
        WebSocket: FakeSocket,
        setTimer: (run) => {
          timers.push(run);
          return run;
        },
        clearTimer: () => {},
        random: () => 0,
      },
    });
    socket.connect();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      FakeSocket.all.at(-1)!.closeWithCode(1006);
      timers.pop()!();
    }
    FakeSocket.all.at(-1)!.closeWithCode(1006);
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it("an error followed by a 4000 close still counts as replaced", () => {
    const onReplaced = vi.fn();
    const socket = new RoomSocket({
      baseUrl: "https://sync.example",
      roomId: "abcdefghijkl",
      onConnection: () => {},
      onMessage: () => {},
      onReplaced,
      deps: { WebSocket: FakeSocket, setTimer: () => 0, clearTimer: () => {}, random: () => 0 },
    });
    socket.connect();
    const ws = FakeSocket.all.at(-1)!;
    ws.onerror?.({});
    ws.closeWithCode(4000);
    expect(onReplaced).toHaveBeenCalledTimes(1);
  });
});

describe("room socket hello device", () => {
  const deps: RoomSocketDeps = {
    WebSocket: FakeSocket,
    setTimer: () => undefined,
    clearTimer: () => undefined,
    random: () => 0.5,
  };
  const helloOf = (device?: { platform: "linux"; form: "desktop" }) => {
    FakeSocket.all = [];
    const socket = new RoomSocket({
      baseUrl: "https://sync.example",
      roomId: "abcdefghijkl",
      ...(device ? { device } : {}),
      onConnection: () => undefined,
      onMessage: () => undefined,
      deps,
    });
    socket.connect();
    FakeSocket.all[0]!.open();
    return JSON.parse(FakeSocket.all[0]!.sent[0]!) as Record<string, unknown>;
  };

  it("carries the device in the hello when there is one, and only those two fields", () => {
    const hello = helloOf({ platform: "linux", form: "desktop" });
    expect(hello.device).toEqual({ platform: "linux", form: "desktop" });
  });

  it("leaves it out when there is none", () => {
    expect("device" in helloOf()).toBe(false);
  });
});
