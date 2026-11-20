import { describe, expect, it, vi } from "vitest";
import type { Command } from "@mc/engine";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { liveGameOf } from "./live-game.js";
import { MemoryRoomStore } from "./live-room-store.js";
import { LiveRoomController } from "./live-room-controller.js";
import type { LiveGameMessage, RoomFeedOut } from "./live-room-protocol.js";
import { MemorySeatTokenStore } from "./room-seat-store.js";
import type { RoomState } from "./room-state.js";
import type { FeedPort } from "./room-session.js";
import type { CreateRoomDeps, CreateRoomResult, RoomSocketDeps, WebSocketLike } from "./room-socket.js";

class FakeSocket implements WebSocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: { ch: string; kind: string; [k: string]: unknown }[] = [];
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.readyState = 3;
  }
  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  /** The room's welcome for a lobby room. */
  welcome(role: "host" | "watcher", table?: { commands: number; ended: boolean; hasHeader: boolean }): void {
    this.open();
    this.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: { id: "me", role, name: "Me" },
      caps: ["watch", "chat", "seats"],
      participants: [
        { id: "host1", role: "host", name: "Hosty", build: BUILD },
        { id: "me", role, name: "Me", build: BUILD },
      ],
      tables: table ? [{ id: "t1", hostConnected: true, ...table }] : [],
    });
  }
  get hello(): { name?: string; build?: unknown; seatTokens?: string[]; token?: string } {
    return this.sent[0] as never;
  }
  closeWith(code: number): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  get kinds(): string[] {
    return this.sent.map((m) => `${m.ch}:${m.kind}`);
  }
}

const BUILD = { appVersion: "1.0.0", contentVersion: "p1" };
const lobbyMessage = (seats: object[] = [{ id: "s1", label: "Spider-Man" }]) => ({
  v: 1,
  ch: "room",
  kind: "lobby",
  code: "ABC234",
  settings: { playMode: "strict", tableRules: {}, mods: [], multiSeat: false, chat: true, ...BUILD },
  seats,
});

const cmd = (n: number): Command => ({ type: "test", n }) as unknown as Command;
const config = { scenarioId: "rhino", seed: 1, watchable: true, players: [] } as unknown as SessionConfig;
const gameMessage = (gameKey: string, room?: string): Extract<LiveGameMessage, { kind: "game" }> => ({
  kind: "game",
  gameKey,
  ...(room ? { room } : {}),
  game: liveGameOf({
    writer: { appVersion: "1", contentVersion: "1" },
    config,
    createdAt: 1,
    initialState: {} as unknown as StateWithoutPool,
    commands: [],
    outcome: null,
  }),
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

function setup(
  options: {
    seatStore?: MemorySeatTokenStore;
    store?: MemoryRoomStore;
    createRoom?: (deps: CreateRoomDeps) => Promise<CreateRoomResult>;
    onlineName?: string;
    now?: () => number;
  } = {},
) {
  FakeSocket.all = [];
  const states: RoomState[] = [];
  const timers: { run: () => void; live: boolean; ms: number }[] = [];
  const socket: RoomSocketDeps = {
    WebSocket: FakeSocket,
    setTimer: (run, ms) => {
      const t = { run, live: true, ms };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { live: boolean }).live = false;
    },
    random: () => 0.5,
  };
  const defaultCreate = async (_deps: CreateRoomDeps): Promise<CreateRoomResult> => ({
    ok: true,
    room: { roomId: "room00000001", hostToken: "h".repeat(32), table: "t1", code: "ABC234" },
  });
  const createRoom = vi.fn(options.createRoom ?? defaultCreate);
  const resolveRoomCode = vi.fn(async (_deps: CreateRoomDeps, _code: string) => ({
    ok: true as const,
    roomId: "room00000002",
  }));
  const seatStore = options.seatStore ?? new MemorySeatTokenStore();
  const controller = new LiveRoomController({
    syncUrl: "https://sync.example",
    watchBase: "https://web.example/",
    onStatus: () => undefined,
    socket,
    ...(options.now ? { now: options.now } : {}),
    ...(options.store ? { store: options.store } : {}),
    room: {
      build: BUILD,
      seatStore,
      ...(options.onlineName !== undefined ? { onlineName: options.onlineName } : {}),
      onState: (s) => states.push(s),
      createRoom,
      resolveRoomCode,
    },
  });
  controller.setEnabled(true);
  return { controller, states, createRoom, resolveRoomCode, seatStore, timers, last: () => states[states.length - 1]! };
}

describe("hosting a room", () => {
  it("makes a lobby room and says hello with the name, build and the host token", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    expect(t.createRoom.mock.calls[0]![0].lobby).toBe(true);
    const socket = FakeSocket.all[0]!;
    expect(socket.url).toBe("wss://sync.example/room/room00000001/ws");
    socket.open();
    expect(socket.hello).toMatchObject({ name: "Hosty", build: BUILD, token: "h".repeat(32) });
    expect(t.last()).toMatchObject({ role: "host", code: "ABC234", connection: "connecting" });
    expect(t.last().link).toBe("https://web.example/#join=ABC234");
  });

  it("refuses to connect without a name", () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "  " });
    expect(t.last()).toMatchObject({ connection: "ended", problem: "no-name" });
    expect(FakeSocket.all).toHaveLength(0);
  });

  it("holds the lobby, sets it, and judges seat requests", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("host", { commands: 0, ended: false, hasHeader: false });
    socket.receive(lobbyMessage([{ id: "s1", label: "Spider-Man", requested: ["g1"] }]));
    expect(t.last().connection).toBe("connected");
    expect(t.last().seats[0]).toMatchObject({ id: "s1", requests: [{ participant: "g1", name: "" }] });
    t.controller.onRoomCommand({ kind: "room-lobby", settings: { multiSeat: true } });
    t.controller.onRoomCommand({ kind: "room-seat", op: "assign", seat: "s1", participant: "g1" });
    t.controller.onRoomCommand({ kind: "room-seat", op: "deny", seat: "s1", participant: "g2" });
    t.controller.onRoomCommand({ kind: "room-say", text: "hi" });
    expect(socket.kinds).toEqual(["room:hello", "room:lobby-set", "room:seat-assign", "room:seat-deny", "chat:say"]);
  });

  it("streams the started game over the lobby's own socket", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("host", { commands: 0, ended: false, hasHeader: false });
    t.controller.onGameMessage(gameMessage("g1", "room00000001"));
    t.controller.onGameMessage({ kind: "command", gameKey: "g1", command: cmd(1), count: 1 });
    await flush();
    expect(FakeSocket.all).toHaveLength(1);
    expect(socket.kinds.filter((k) => k.startsWith("game:"))).toEqual(["game:start", "game:commands"]);
    expect(t.last().started).toBe(true);
    // No second room was made for the game.
    expect(t.createRoom).toHaveBeenCalledTimes(1);
  });

  it("remembers the lobby room with the game, so a resume returns to it as host", async () => {
    const store = new MemoryRoomStore();
    const t = setup({ store });
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    FakeSocket.all[0]!.welcome("host", { commands: 0, ended: false, hasHeader: false });
    t.controller.onGameMessage(gameMessage("g1", "room00000001"));
    t.controller.onGameMessage({ kind: "command", gameKey: "g1", command: cmd(1), count: 1 });
    await flush();
    expect(store.records.get("g1")).toMatchObject({ roomId: "room00000001", code: "ABC234", name: "Hosty" });

    const again = setup({ store });
    again.controller.onGameMessage(gameMessage("g1", "room00000001"));
    again.controller.onGameMessage({ kind: "command", gameKey: "g1", command: cmd(1), count: 1 });
    await flush();
    expect(again.createRoom).not.toHaveBeenCalled();
    expect(FakeSocket.all[0]!.url).toContain("room00000001");
    FakeSocket.all[0]!.open();
    expect(FakeSocket.all[0]!.hello).toMatchObject({ name: "Hosty", token: "h".repeat(32) });
  });

  it("ends the room when the token is no longer honoured", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    FakeSocket.all[0]!.welcome("watcher");
    expect(t.last()).toMatchObject({ connection: "ended", problem: "gone" });
  });

  it("leaving ends the game's table and closes the room", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("host", { commands: 0, ended: false, hasHeader: false });
    t.controller.onGameMessage(gameMessage("g1", "room00000001"));
    t.controller.onGameMessage({ kind: "command", gameKey: "g1", command: cmd(1), count: 1 });
    await flush();
    t.controller.onRoomCommand({ kind: "room-leave" });
    expect(socket.sent.at(-1)).toMatchObject({ ch: "game", kind: "end" });
    expect(t.last().role).toBe("none");
  });
});

describe("joining a room", () => {
  it("resolves a code, says hello with name, build and stored seat tokens, and restores the seat", async () => {
    const seatStore = new MemorySeatTokenStore();
    await seatStore.save({ roomId: "room00000002", tokens: { s1: "T".repeat(32) }, savedAt: Date.now() });
    const t = setup({ seatStore });
    t.controller.onRoomCommand({ kind: "room-join", target: "abc-234", name: "Guesty" });
    await flush();
    expect(t.resolveRoomCode.mock.calls[0]![1]).toBe("ABC234");
    const socket = FakeSocket.all[0]!;
    socket.open();
    expect(socket.hello).toMatchObject({ name: "Guesty", build: BUILD, seatTokens: ["T".repeat(32)] });
    socket.welcome("watcher", { commands: 0, ended: false, hasHeader: false });
    socket.receive(lobbyMessage([{ id: "s1", label: "Spider-Man", holder: "me" }]));
    expect(t.last()).toMatchObject({ role: "guest", mySeats: ["s1"], code: "ABC234" });
    expect(t.last().seats[0]).toMatchObject({ mine: true });
  });

  it("takes a room id from a link without a lookup", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "abcdefghijkl", name: "G" });
    await flush();
    expect(t.resolveRoomCode).not.toHaveBeenCalled();
    expect(FakeSocket.all[0]!.url).toContain("abcdefghijkl");
  });

  it("reports an unknown code", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "nope", name: "G" });
    await flush();
    expect(t.last()).toMatchObject({ connection: "ended", problem: "not-found" });
  });

  it("stores a seat token the room gives and never shows it", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher");
    socket.receive(lobbyMessage([{ id: "s1", label: "Spider-Man", holder: "me" }]));
    socket.receive({ v: 1, ch: "room", kind: "seat-token", seat: "s1", token: "S".repeat(32) });
    await flush();
    expect((await t.seatStore.load("room00000002"))?.tokens).toEqual({ s1: "S".repeat(32) });
    expect(JSON.stringify(t.last())).not.toContain("S".repeat(32));
    // After a reconnect the new hello presents it.
    socket.closeWith(1006);
    t.timers.at(-1)!.run();
    FakeSocket.all[1]!.open();
    expect(FakeSocket.all[1]!.hello.seatTokens).toEqual(["S".repeat(32)]);
  });

  it("drops a token for a seat the lobby no longer gives me", async () => {
    const seatStore = new MemorySeatTokenStore();
    await seatStore.save({ roomId: "room00000002", tokens: { s1: "T".repeat(32) }, savedAt: Date.now() });
    const t = setup({ seatStore });
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher");
    socket.receive(lobbyMessage([{ id: "s1", label: "Spider-Man" }]));
    await flush();
    expect(await t.seatStore.load("room00000002")).toBeNull();
  });

  it("surfaces refusals, with the seat asked for", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher");
    socket.receive(lobbyMessage());
    t.controller.onRoomCommand({ kind: "room-seat", op: "request", seat: "s1" });
    expect(socket.sent.at(-1)).toMatchObject({ kind: "seat-request", seat: "s1" });
    socket.receive({ v: 1, ch: "room", kind: "refused", reason: "build-mismatch" });
    expect(t.last().refusal).toMatchObject({ reason: "build-mismatch", seat: "s1", seq: 1 });
    socket.receive({ v: 1, ch: "room", kind: "refused", reason: "build-mismatch" });
    expect(t.last().refusal?.seq).toBe(2);
  });

  it("sends a pending request again after the room woke and forgot it", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const first = FakeSocket.all[0]!;
    first.welcome("watcher");
    first.receive(lobbyMessage());
    t.controller.onRoomCommand({ kind: "room-seat", op: "request", seat: "s1" });
    first.closeWith(1006);
    t.timers.at(-1)!.run();
    const second = FakeSocket.all[1]!;
    second.welcome("watcher");
    second.receive(lobbyMessage());
    expect(second.kinds).toContain("room:seat-request");
  });

  it("keeps chat, with my own lines marked", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher");
    socket.receive({
      v: 1,
      ch: "chat",
      kind: "backlog",
      lines: [{ from: "host1", name: "Hosty", text: "hello", at: 1 }],
    });
    t.controller.onRoomCommand({ kind: "room-say", text: "hi" });
    expect(socket.sent.at(-1)).toMatchObject({ ch: "chat", kind: "say", text: "hi" });
    socket.receive({ v: 1, ch: "chat", kind: "said", from: "me", name: "Me", text: "hi", at: 2 });
    expect(t.last().chat.map((l) => [l.text, l.mine])).toEqual([
      ["hello", false],
      ["hi", true],
    ]);
  });

  it("closes on a refusal for a missing name", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.open();
    socket.receive({ v: 1, ch: "room", kind: "refused", reason: "name-required" });
    expect(t.last()).toMatchObject({ connection: "ended", problem: "no-name" });
  });
});

describe("a guest following the game", () => {
  const logMessage = (commands: unknown[]): ServerMessage => ({
    v: 1,
    ch: "game",
    kind: "log",
    table: "t1",
    header: { h: 1 },
    commands,
    checksums: { "0": "c0" },
  });

  function fakePort() {
    const posted: RoomFeedOut[] = [];
    const port: FeedPort & { posted: RoomFeedOut[]; closed: boolean } = {
      posted,
      closed: false,
      onmessage: null,
      postMessage: (m) => void posted.push(m),
      close() {
        this.closed = true;
      },
    };
    return port;
  }

  it("gives a later watcher the whole game so far, then what follows", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher", { commands: 2, ended: false, hasHeader: true });
    socket.receive(logMessage([cmd(1), cmd(2)]));
    socket.receive({ v: 1, ch: "game", kind: "commands", table: "t1", from: 2, commands: [cmd(3)] });
    expect(t.last().started).toBe(true);

    const port = fakePort();
    t.controller.onRoomCommand({ kind: "room-follow", port: port as unknown as MessagePort });
    const log = port.posted.find((m) => m.kind === "server" && m.message.ch === "game");
    expect(log).toMatchObject({ message: { kind: "log", commands: [cmd(1), cmd(2), cmd(3)] } });

    socket.receive({ v: 1, ch: "game", kind: "commands", table: "t1", from: 3, commands: [cmd(4)] });
    expect(port.posted.at(-1)).toMatchObject({ message: { kind: "commands", from: 3 } });
    // Chat and tokens never reach the watcher.
    socket.receive({ v: 1, ch: "chat", kind: "said", from: "x", text: "chatline-xyz", at: 1 });
    socket.receive({ v: 1, ch: "room", kind: "seat-token", seat: "s1", token: "S".repeat(32) });
    expect(JSON.stringify(port.posted)).not.toContain("chatline-xyz");
    expect(JSON.stringify(port.posted)).not.toContain("S".repeat(32));
  });

  it("answers a resync with the game again, and reports a drop", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher", { commands: 1, ended: false, hasHeader: true });
    socket.receive(logMessage([cmd(1)]));
    const port = fakePort();
    t.controller.onRoomCommand({ kind: "room-follow", port: port as unknown as MessagePort });
    const before = port.posted.length;
    port.onmessage?.({ data: { kind: "resync" } });
    expect(port.posted.length).toBeGreaterThan(before);
    socket.closeWith(1006);
    expect(port.posted.at(-1)).toEqual({ kind: "connection", connected: false });
  });

  it("refuses a follow port when this device is not a guest", async () => {
    const t = setup();
    const port = fakePort();
    t.controller.onRoomCommand({ kind: "room-follow", port: port as unknown as MessagePort });
    expect(port.closed).toBe(true);
  });
});

describe("review fixes (issue #880)", () => {
  async function guestWithRequest() {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher");
    socket.receive(lobbyMessage());
    t.controller.onRoomCommand({ kind: "room-seat", op: "request", seat: "s1" });
    return { t, socket };
  }
  const requests = (socket: FakeSocket) => socket.kinds.filter((k) => k === "room:seat-request").length;

  it("stops asking for a seat the host denied, even after a reconnect", async () => {
    const { t, socket } = await guestWithRequest();
    socket.receive({ v: 1, ch: "room", kind: "seat-denied", seat: "s1" });
    socket.closeWith(1006);
    t.timers.at(-1)!.run();
    const second = FakeSocket.all[1]!;
    second.welcome("watcher");
    second.receive(lobbyMessage());
    expect(second.kinds).not.toContain("room:seat-request");
  });

  it("sends a request again when a lobby arrives that no longer lists it, with no reconnect (a woken room)", async () => {
    const { socket } = await guestWithRequest();
    expect(requests(socket)).toBe(1);
    socket.receive(lobbyMessage());
    expect(requests(socket)).toBe(2);
  });

  it("does not send again a request the lobby lists, or one a refusal named", async () => {
    const { t, socket } = await guestWithRequest();
    socket.receive(lobbyMessage([{ id: "s1", label: "Spider-Man", requested: ["me"] }]));
    expect(requests(socket)).toBe(1);
    socket.receive({ v: 1, ch: "room", kind: "refused", reason: "seat-taken" });
    expect(t.last().refusal).toMatchObject({ reason: "seat-taken", seat: "s1" });
    socket.receive(lobbyMessage());
    expect(requests(socket)).toBe(1);
  });

  describe("the guest's watcher is told when the session ends", () => {
    const fake = () => {
      const posted: RoomFeedOut[] = [];
      const port: FeedPort = { onmessage: null, postMessage: (m) => void posted.push(m), close: () => undefined };
      return { posted, port: port as unknown as MessagePort };
    };

    it("when the room can no longer be reached", async () => {
      const t = setup();
      t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
      await flush();
      const { posted, port } = fake();
      t.controller.onRoomCommand({ kind: "room-follow", port });
      // Never welcomed, closed with "no such room": the session ends.
      FakeSocket.all[0]!.closeWith(1011);
      expect(posted.at(-1)).toEqual({ kind: "gone" });
      expect(t.last()).toMatchObject({ connection: "ended", problem: "not-found" });
    });

    it("when the room closes it arrives as its own message", async () => {
      const t = setup();
      t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
      await flush();
      FakeSocket.all[0]!.welcome("watcher");
      const { posted, port } = fake();
      t.controller.onRoomCommand({ kind: "room-follow", port });
      FakeSocket.all[0]!.receive({ v: 1, ch: "room", kind: "closed", reason: "idle" });
      expect(posted.some((m) => m.kind === "server" && m.message.kind === "closed")).toBe(true);
    });

    it("when the player leaves the room", async () => {
      const t = setup();
      t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
      await flush();
      FakeSocket.all[0]!.welcome("watcher");
      const { posted, port } = fake();
      t.controller.onRoomCommand({ kind: "room-follow", port });
      t.controller.onRoomCommand({ kind: "room-leave" });
      expect(posted.at(-1)).toEqual({ kind: "gone" });
    });

    it("and attaching sends a welcome with who is here and what the table holds", async () => {
      const t = setup();
      t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
      await flush();
      FakeSocket.all[0]!.welcome("watcher", { commands: 0, ended: false, hasHeader: false });
      const { posted, port } = fake();
      t.controller.onRoomCommand({ kind: "room-follow", port });
      const welcome = posted.find((m) => m.kind === "server" && m.message.kind === "welcome");
      expect(welcome).toMatchObject({
        message: { participants: [{ role: "host" }, { role: "watcher" }], tables: [{ id: "t1", hasHeader: false }] },
      });
    });
  });

  it("backs off between reconnects forced by a gap in the log", async () => {
    const clock = { now: 1_000 };
    const t = setup({ now: () => clock.now });
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const gap = { v: 1, ch: "game", kind: "commands", table: "t1", from: 9, commands: [cmd(1)] };
    const log = { v: 1, ch: "game", kind: "log", table: "t1", header: {}, commands: [], checksums: {} };
    const table = { commands: 0, ended: false, hasHeader: true };
    FakeSocket.all[0]!.welcome("watcher", table);
    FakeSocket.all[0]!.receive(log);
    FakeSocket.all[0]!.receive(gap);
    const first = t.timers.at(-1)!;
    first.run();
    // The new connection never gets a log before the next gap: the wait grows.
    FakeSocket.all[1]!.welcome("watcher", table);
    FakeSocket.all[1]!.receive(log);
    FakeSocket.all[1]!.receive(gap);
    expect(t.timers.at(-1)!.ms).toBeGreaterThan(first.ms);
    // A gap long after that starts again from the shortest wait.
    clock.now += 120_000;
    t.timers.at(-1)!.run();
    FakeSocket.all[2]!.welcome("watcher", table);
    FakeSocket.all[2]!.receive(log);
    FakeSocket.all[2]!.receive(gap);
    expect(t.timers.at(-1)!.ms).toBe(first.ms);
  });

  it("holds the game until a lobby room still being made exists, never making a plain room", async () => {
    let release!: (r: CreateRoomResult) => void;
    const t = setup({ createRoom: () => new Promise<CreateRoomResult>((resolve) => (release = resolve)) });
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    release({ ok: true, room: { roomId: "room00000001", hostToken: "h".repeat(32), table: "t1", code: "ABC234" } });
    await flush();
    t.controller.onGameMessage(gameMessage("g1", "room00000001"));
    await flush();
    expect(t.createRoom).toHaveBeenCalledTimes(1);
    FakeSocket.all[0]!.welcome("host", { commands: 0, ended: false, hasHeader: false });
    expect(FakeSocket.all[0]!.kinds).toContain("game:start");
    expect(t.last().started).toBe(true);
  });

  it("joins a hosted lobby on the game message, before any command", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    FakeSocket.all[0]!.welcome("host", { commands: 0, ended: false, hasHeader: false });
    t.controller.onGameMessage(gameMessage("g1", "room00000001"));
    await flush();
    expect(FakeSocket.all[0]!.kinds).toContain("game:start");
  });

  it("never attaches a game that was not started in the hosted room (a later single-player game)", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    FakeSocket.all[0]!.welcome("host", { commands: 0, ended: false, hasHeader: false });
    // No room tag, then another room's tag: neither joins this lobby.
    t.controller.onGameMessage(gameMessage("solo"));
    t.controller.onGameMessage({ kind: "command", gameKey: "solo", command: cmd(1), count: 1 });
    await flush();
    await flush();
    expect(FakeSocket.all[0]!.kinds).not.toContain("game:start");
    expect(t.last().started).toBe(false);
    t.controller.onGameMessage(gameMessage("other", "someotherroom"));
    await flush();
    expect(FakeSocket.all[0]!.kinds).not.toContain("game:start");
  });

  it("leaving the room ends the game's stream into it", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    FakeSocket.all[0]!.welcome("host", { commands: 0, ended: false, hasHeader: false });
    t.controller.onGameMessage(gameMessage("g1", "room00000001"));
    await flush();
    t.controller.onRoomCommand({ kind: "room-leave" });
    expect(t.last().role).toBe("none");
    t.controller.onGameMessage(gameMessage("solo"));
    t.controller.onGameMessage({ kind: "command", gameKey: "solo", command: cmd(1), count: 1 });
    await flush();
    expect(FakeSocket.all[0]!.kinds).not.toContain("game:start:solo");
  });

  it("resumes a lobby room on the game message with a name, and never with an empty one", async () => {
    const store = new MemoryRoomStore();
    const base = { roomId: "room00000001", hostToken: "h".repeat(32), createdAt: Date.now(), code: "ABC234" };
    await store.save({ ...base, gameKey: "g1", name: "" });
    const named = setup({ store, onlineName: "Saved" });
    named.controller.onGameMessage(gameMessage("g1"));
    await flush();
    expect(named.createRoom).not.toHaveBeenCalled();
    FakeSocket.all[0]!.open();
    expect(FakeSocket.all[0]!.hello).toMatchObject({ name: "Saved", token: "h".repeat(32) });

    await store.save({ ...base, gameKey: "g2" });
    const nameless = setup({ store });
    nameless.controller.onGameMessage(gameMessage("g2"));
    nameless.controller.onGameMessage({ kind: "command", gameKey: "g2", command: cmd(1), count: 1 });
    await flush();
    await flush();
    // No name to say hello with: the stale lobby record is dropped and the lobby room is not resumed.
    expect(FakeSocket.all).toHaveLength(0);
    expect(nameless.createRoom).not.toHaveBeenCalled();
    expect(store.records.has("g2")).toBe(false);
  });

  it("sweeps stale seat token records when a session starts", async () => {
    const seatStore = new MemorySeatTokenStore();
    await seatStore.save({ roomId: "old000000000", tokens: { s1: "x" }, savedAt: 1 });
    await seatStore.save({ roomId: "new000000000", tokens: { s1: "x" }, savedAt: Date.now() });
    const t = setup({ seatStore });
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    expect([...seatStore.records.keys()]).toEqual(["new000000000"]);
  });
});
