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
const gameMessage = (gameKey: string): Extract<LiveGameMessage, { kind: "game" }> => ({
  kind: "game",
  gameKey,
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

function setup(options: { seatStore?: MemorySeatTokenStore; store?: MemoryRoomStore } = {}) {
  FakeSocket.all = [];
  const states: RoomState[] = [];
  const timers: { run: () => void; live: boolean }[] = [];
  const socket: RoomSocketDeps = {
    WebSocket: FakeSocket,
    setTimer: (run) => {
      const t = { run, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { live: boolean }).live = false;
    },
    random: () => 0.5,
  };
  const createRoom = vi.fn(async (_deps: CreateRoomDeps): Promise<CreateRoomResult> => ({
    ok: true,
    room: { roomId: "room00000001", hostToken: "h".repeat(32), table: "t1", code: "ABC234" },
  }));
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
    ...(options.store ? { store: options.store } : {}),
    room: { build: BUILD, seatStore, onState: (s) => states.push(s), createRoom, resolveRoomCode },
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
    t.controller.onGameMessage(gameMessage("g1"));
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
    t.controller.onGameMessage(gameMessage("g1"));
    t.controller.onGameMessage({ kind: "command", gameKey: "g1", command: cmd(1), count: 1 });
    await flush();
    expect(store.records.get("g1")).toMatchObject({ roomId: "room00000001", code: "ABC234", name: "Hosty" });

    const again = setup({ store });
    again.controller.onGameMessage(gameMessage("g1"));
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
    t.controller.onGameMessage(gameMessage("g1"));
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
    socket.receive({ v: 1, ch: "chat", kind: "said", from: "x", text: "yo", at: 1 });
    socket.receive({ v: 1, ch: "room", kind: "seat-token", seat: "s1", token: "S".repeat(32) });
    expect(JSON.stringify(port.posted)).not.toContain("yo");
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
