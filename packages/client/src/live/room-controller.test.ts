import { describe, expect, it, vi } from "vitest";
import type { Command } from "@mc/engine";
import type { RoomDevice, ServerMessage } from "@mc/sync-worker/room-protocol";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { liveGameOf } from "./live-game.js";
import { MemoryRoomStore } from "./live-room-store.js";
import { LiveRoomController } from "./live-room-controller.js";
import type { LiveGameMessage, RoomFeedOut } from "./live-room-protocol.js";
import { MemorySeatTokenStore } from "./room-seat-store.js";
import type { RoomState, SeatDeckEntry } from "./room-state.js";
import { RoomSession, type FeedPort } from "./room-session.js";
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
    device?: RoomDevice;
  } = {},
) {
  FakeSocket.all = [];
  const states: RoomState[] = [];
  const answers: { id: number; decks: readonly SeatDeckEntry[] | null }[] = [];
  const salvaged: { header: unknown; commands: readonly unknown[] }[] = [];
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
      ...(options.device ? { device: options.device } : {}),
      seatStore,
      ...(options.onlineName !== undefined ? { onlineName: options.onlineName } : {}),
      onState: (s) => states.push(s),
      onDecks: (id, decks) => answers.push({ id, decks }),
      onSalvage: (game) => salvaged.push(game),
      createRoom,
      resolveRoomCode,
    },
  });
  controller.setEnabled(true);
  return {
    controller,
    states,
    answers,
    salvaged,
    createRoom,
    resolveRoomCode,
    seatStore,
    timers,
    last: () => states[states.length - 1]!,
  };
}

describe("the device in a room", () => {
  const PHONE: RoomDevice = { platform: "android", form: "phone" };

  it("says it in the host's lobby hello, and omits it when this device could not be told", async () => {
    const t = setup({ device: PHONE });
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    FakeSocket.all[0]!.open();
    expect(FakeSocket.all[0]!.hello).toMatchObject({ device: PHONE });
    const none = setup();
    none.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    FakeSocket.all[0]!.open();
    expect(Object.keys(FakeSocket.all[0]!.hello)).not.toContain("device");
  });

  it("says it in a guest's hello", async () => {
    const t = setup({ device: { platform: "ios", form: "tablet" } });
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "Guesty" });
    await flush();
    FakeSocket.all[0]!.open();
    expect(FakeSocket.all[0]!.hello).toMatchObject({ device: { platform: "ios", form: "tablet" } });
  });

  it("puts each participant's device in the room state, and leaves it out for one that sent none", async () => {
    const t = setup({ device: PHONE });
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "Guesty" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.open();
    socket.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: { id: "me", role: "watcher", name: "Me", device: PHONE },
      caps: ["watch", "chat", "seats"],
      participants: [
        { id: "host1", role: "host", name: "Hosty", build: BUILD, device: { platform: "windows", form: "desktop" } },
        { id: "me", role: "watcher", name: "Me", build: BUILD, device: PHONE },
        { id: "old", role: "watcher", name: "Old", build: BUILD },
      ],
      tables: [],
    });
    expect(t.last().participants.map((p) => [p.name, p.device])).toEqual([
      ["Hosty", { platform: "windows", form: "desktop" }],
      ["Me", PHONE],
      ["Old", undefined],
    ]);
    expect("device" in t.last().participants[2]!).toBe(false);
  });
});

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

  it("keeps a token while its seat is held by a participant who is not connected, drops it when the holder is here", async () => {
    const run = async (seats: object[]) => {
      const seatStore = new MemorySeatTokenStore();
      await seatStore.save({ roomId: "room00000002", tokens: { s1: "T".repeat(32) }, savedAt: Date.now() });
      const t = setup({ seatStore });
      t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
      await flush();
      const socket = FakeSocket.all[0]!;
      socket.welcome("watcher");
      socket.receive(lobbyMessage(seats));
      await flush();
      return (await seatStore.load("room00000002"))?.tokens ?? null;
    };
    // The room could not save my rejoin: the seat still shows its old, disconnected holder, and my token may rule it.
    expect(await run([{ id: "s1", label: "A", holder: "ghost" }])).toEqual({ s1: "T".repeat(32) });
    // A connected other holder, a free seat or a missing seat: the token is stale.
    expect(await run([{ id: "s1", label: "A", holder: "host1" }])).toBeNull();
    expect(await run([{ id: "s1", label: "A" }])).toBeNull();
    expect(await run([{ id: "s9", label: "B" }])).toBeNull();
  });

  it("a guest reclaims its seat in a room active for more than 12 hours", async () => {
    const seatStore = new MemorySeatTokenStore();
    const savedAt = Date.now() - 13 * 60 * 60 * 1000;
    await seatStore.save({ roomId: "room00000002", tokens: { s1: "T".repeat(32) }, savedAt });
    const t = setup({ seatStore });
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.open();
    expect(socket.hello).toMatchObject({ seatTokens: ["T".repeat(32)] });
    socket.welcome("watcher");
    socket.receive(lobbyMessage([{ id: "s1", label: "Spider-Man", holder: "me" }]));
    expect(t.last()).toMatchObject({ mySeats: ["s1"] });
    expect((await seatStore.load("room00000002"))?.tokens).toEqual({ s1: "T".repeat(32) });
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

describe("seat decks in a room (each player brings their own deck)", () => {
  const SUMMARY = {
    hero: "01001a",
    heroName: "Spider-Man",
    aspects: ["justice"],
    name: "Spidey Justice",
    cards: 40,
    mods: [],
  };
  const DECK = {
    name: "Spidey Justice",
    hero: "01001a",
    heroName: "Spider-Man",
    aspects: ["justice"],
    cards: [{ cardId: "01010", quantity: 3 }],
    mods: [],
  };

  async function inLobby(role: "host" | "guest", seats: object[]) {
    const t = setup();
    if (role === "host") t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    else t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "Me" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome(role === "host" ? "host" : "watcher");
    socket.receive(lobbyMessage(seats));
    return { t, socket };
  }

  it("shows each seat's deck summary in the state, never a card list", async () => {
    const { t } = await inLobby("guest", [
      { id: "s1", holder: "me", deck: SUMMARY },
      { id: "s2", holder: "host1", deck: { ...SUMMARY, heroName: "She-Hulk", preset: true } },
      { id: "s3" },
    ]);
    expect(t.last().seats.map((s) => s.deck)).toEqual([
      SUMMARY,
      { ...SUMMARY, heroName: "She-Hulk", preset: true },
      null,
    ]);
    expect(t.last().seats.map((s) => s.mine)).toEqual([true, false, false]);
    expect(JSON.stringify(t.last())).not.toContain("01010");
  });

  it("sends my deck for a seat as seat-deck, and a host preset the same way", async () => {
    const { t, socket } = await inLobby("host", [{ id: "s1" }, { id: "s2" }]);
    t.controller.onRoomCommand({ kind: "room-deck", seat: "s1", deck: DECK });
    t.controller.onRoomCommand({ kind: "room-deck", seat: "s2", deck: DECK });
    expect(socket.sent.filter((m) => m.kind === "seat-deck")).toEqual([
      { v: 1, ch: "room", kind: "seat-deck", seat: "s1", deck: DECK },
      { v: 1, ch: "room", kind: "seat-deck", seat: "s2", deck: DECK },
    ]);
  });

  it("tells only the holder why their deck was refused, until they change it", async () => {
    const seats = [
      { id: "s1", holder: "me", deck: SUMMARY },
      { id: "s2", holder: "host1", deck: SUMMARY },
    ];
    const { t, socket } = await inLobby("guest", seats);
    socket.receive({ v: 1, ch: "room", kind: "deck-refused", seat: "s1", code: "illegal", reason: "28 of 40 cards." });
    expect(t.last().seats[0]!.deckProblem).toEqual({ code: "illegal", reason: "28 of 40 cards." });
    expect(t.last().seats[1]!.deckProblem).toBeNull();
    // The deck changed in the lobby: the old verdict no longer applies.
    socket.receive(lobbyMessage([{ ...seats[0]!, deck: { ...SUMMARY, cards: 41 } }, seats[1]!]));
    expect(t.last().seats[0]!.deckProblem).toBeNull();
    // Refused again, then I choose again (even the same list): the problem goes at once.
    socket.receive({ v: 1, ch: "room", kind: "deck-refused", seat: "s1", code: "mod-version", reason: "Version." });
    expect(t.last().seats[0]!.deckProblem).toMatchObject({ code: "mod-version" });
    t.controller.onRoomCommand({ kind: "room-deck", seat: "s1", deck: DECK });
    expect(t.last().seats[0]!.deckProblem).toBeNull();
  });

  it("gives the host the full lists for its Start, and keeps them out of the state", async () => {
    const { t, socket } = await inLobby("host", [{ id: "s1", holder: "g1", deck: SUMMARY }]);
    t.controller.onRoomCommand({ kind: "room-decks-request", id: 7 });
    expect(socket.kinds.at(-1)).toBe("room:seat-decks-request");
    const entries = [{ seat: "s1", holder: "g1", preset: false, deck: DECK }];
    socket.receive({ v: 1, ch: "room", kind: "seat-decks", decks: entries });
    await flush();
    expect(t.answers).toEqual([{ id: 7, decks: entries }]);
    expect(JSON.stringify(t.states)).not.toContain("01010");
  });

  it("answers null when the room never answers, and for a guest, and sends nothing for a guest", async () => {
    const host = await inLobby("host", [{ id: "s1" }]);
    host.t.controller.onRoomCommand({ kind: "room-decks-request", id: 1 });
    const timer = host.t.timers.filter((x) => x.live).at(-1)!;
    timer.run();
    await flush();
    expect(host.t.answers).toEqual([{ id: 1, decks: null }]);
    const guest = await inLobby("guest", [{ id: "s1" }]);
    guest.t.controller.onRoomCommand({ kind: "room-decks-request", id: 2 });
    await flush();
    expect(guest.t.answers).toEqual([{ id: 2, decks: null }]);
    expect(guest.socket.kinds).not.toContain("room:seat-decks-request");
    // A guest never acts on a decks message either (the room only ever sends it to the host).
    guest.socket.receive({ v: 1, ch: "room", kind: "seat-decks", decks: [] });
    expect(guest.t.answers).toHaveLength(1);
  });

  it("sends deck-refused only from the host", async () => {
    const host = await inLobby("host", [{ id: "s1" }]);
    host.t.controller.onRoomCommand({ kind: "room-deck-refuse", seat: "s1", code: "no-deck", reason: "None." });
    expect(host.socket.sent.at(-1)).toEqual({
      v: 1,
      ch: "room",
      kind: "deck-refused",
      seat: "s1",
      code: "no-deck",
      reason: "None.",
    });
    const guest = await inLobby("guest", [{ id: "s1" }]);
    guest.t.controller.onRoomCommand({ kind: "room-deck-refuse", seat: "s1", code: "no-deck", reason: "None." });
    expect(guest.socket.kinds).not.toContain("room:deck-refused");
  });
});

describe("closing and resuming a lobby room (#901 review)", () => {
  it("a host who confirms closing asks the room to close for everyone; a plain leave and a guest do not", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("host");
    t.controller.onRoomCommand({ kind: "room-leave", closeRoom: true });
    expect(socket.kinds).toContain("room:room-close");
    expect(t.last().role).toBe("none");

    const plain = setup();
    plain.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    const s2 = FakeSocket.all[0]!;
    s2.welcome("host");
    plain.controller.onRoomCommand({ kind: "room-leave" });
    expect(s2.kinds).not.toContain("room:room-close");

    const guest = setup();
    guest.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const s3 = FakeSocket.all[0]!;
    s3.welcome("watcher");
    guest.controller.onRoomCommand({ kind: "room-leave", closeRoom: true });
    expect(s3.kinds).not.toContain("room:room-close");
  });

  it("a host who closes mid-game has sent every command before the close, so guests hold the whole log (#904)", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("host", { commands: 0, ended: false, hasHeader: false });
    t.controller.onGameMessage(gameMessage("g1", "room00000001"));
    t.controller.onGameMessage({ kind: "command", gameKey: "g1", command: cmd(1), count: 1 });
    await flush();
    t.controller.onGameMessage({ kind: "command", gameKey: "g1", command: cmd(2), count: 2 });
    // Close room pressed right after a move: a streaming game sends each command as it lands, so the move is already on the
    // socket, ahead of the close.
    t.controller.onRoomCommand({ kind: "room-leave", closeRoom: true });
    const game = socket.kinds.filter((k) => k.startsWith("game:") || k === "room:room-close");
    expect(game[game.length - 1]).toBe("room:room-close");
    const sent = socket.sent.filter((m) => m.kind === "commands").flatMap((m) => m["commands"] as unknown[]);
    expect(sent).toEqual([cmd(1), cmd(2)]);
  });

  it("shows a room the host closed as closed-host", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher");
    socket.receive({ v: 1, ch: "room", kind: "closed", reason: "host" });
    expect(t.last()).toMatchObject({ connection: "ended", problem: "closed-host" });
  });

  describe("a guest's game when the room closes under it (#904)", () => {
    const game = (commands: unknown[] = [{ type: "a" }, { type: "b" }], extra: object = {}) => ({
      v: 1,
      ch: "game",
      kind: "log",
      table: "t1",
      header: { h: 1 },
      commands,
      checksums: {},
      ...extra,
    });
    const guest = async () => {
      const t = setup();
      t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
      await flush();
      const socket = FakeSocket.all[0]!;
      socket.welcome("watcher", { commands: 2, ended: false, hasHeader: true });
      return { t, socket };
    };

    it("hands over the header and every command it holds, ahead of the ended state", async () => {
      const { t, socket } = await guest();
      socket.receive(game());
      socket.receive({ v: 1, ch: "game", kind: "commands", table: "t1", from: 2, commands: [{ type: "c" }] });
      const before = t.states.length;
      socket.receive({ v: 1, ch: "room", kind: "closed", reason: "host" });
      expect(t.salvaged).toEqual([{ header: { h: 1 }, commands: [{ type: "a" }, { type: "b" }, { type: "c" }] }]);
      expect(t.states.length).toBeGreaterThan(before);
      expect(t.last()).toMatchObject({ connection: "ended", problem: "closed-host" });
    });

    it("hands over nothing when the game is over, still arriving, or there was none", async () => {
      const over = await guest();
      over.socket.receive(game());
      over.socket.receive({ v: 1, ch: "game", kind: "end", table: "t1", outcome: { won: true } });
      over.socket.receive({ v: 1, ch: "room", kind: "closed", reason: "host" });
      expect(over.t.salvaged).toEqual([]);

      const arriving = await guest();
      arriving.socket.receive(game([{ type: "a" }], { total: 3 }));
      arriving.socket.receive({ v: 1, ch: "room", kind: "closed", reason: "idle" });
      expect(arriving.t.salvaged).toEqual([]);

      const none = await guest();
      none.socket.receive({ v: 1, ch: "room", kind: "closed", reason: "host" });
      expect(none.t.salvaged).toEqual([]);
    });

    it("a guest leaving by itself keeps nothing, and a host is never handed one", async () => {
      const { t, socket } = await guest();
      socket.receive(game());
      t.controller.onRoomCommand({ kind: "room-leave" });
      expect(t.salvaged).toEqual([]);

      const host = setup();
      host.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
      await flush();
      FakeSocket.all[0]!.welcome("host");
      FakeSocket.all[0]!.receive({ v: 1, ch: "room", kind: "closed", reason: "host" });
      expect(host.salvaged).toEqual([]);
    });
  });

  it("a resumed host presents its own stored seat tokens in the hello", async () => {
    FakeSocket.all = [];
    const seatStore = new MemorySeatTokenStore();
    await seatStore.save({ roomId: "room00000001", tokens: { s1: "S".repeat(32) }, savedAt: Date.now() });
    const session = new RoomSession("host", "Hosty", {
      syncUrl: "https://sync.example",
      linkBase: "https://web.example/",
      build: BUILD,
      seatStore,
      onState: () => undefined,
      socket: {
        WebSocket: FakeSocket,
        setTimer: () => ({}),
        clearTimer: () => undefined,
        random: () => 0.5,
      },
    });
    session.resumeHost("room00000001", "h".repeat(32), "ABC234");
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.open();
    expect(socket.hello).toMatchObject({ token: "h".repeat(32), seatTokens: ["S".repeat(32)] });
  });

  it("a resumed host in a room active for more than 12 hours still presents its seat tokens", async () => {
    FakeSocket.all = [];
    const seatStore = new MemorySeatTokenStore();
    await seatStore.save({
      roomId: "room00000001",
      tokens: { s1: "S".repeat(32) },
      savedAt: Date.now() - 13 * 60 * 60 * 1000,
    });
    const session = new RoomSession("host", "Hosty", {
      syncUrl: "https://sync.example",
      linkBase: "https://web.example/",
      build: BUILD,
      seatStore,
      onState: () => undefined,
      socket: { WebSocket: FakeSocket, setTimer: () => ({}), clearTimer: () => undefined, random: () => 0.5 },
    });
    session.resumeHost("room00000001", "h".repeat(32), "ABC234");
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.open();
    expect(socket.hello).toMatchObject({ seatTokens: ["S".repeat(32)] });
  });
});

describe("live chat count and the host's setup step (issue #880)", () => {
  it("counts only chat lines that arrive live, never the backlog", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher");
    socket.receive({ v: 1, ch: "chat", kind: "backlog", lines: [{ from: "host1", text: "old", at: 1 }] });
    expect(t.last().chatLive).toBe(0);
    socket.receive({ v: 1, ch: "chat", kind: "said", from: "host1", name: "Hosty", text: "new", at: 2 });
    expect(t.last().chatLive).toBe(1);
    expect(t.last().chat).toHaveLength(2);
  });

  it("a host sends its setup step to the room, a guest never does", async () => {
    const host = setup();
    host.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    const hostSocket = FakeSocket.all[0]!;
    hostSocket.welcome("host");
    host.controller.onRoomCommand({ kind: "room-activity", step: "table", scenario: "Rhino" });
    expect(hostSocket.sent.at(-1)).toMatchObject({
      ch: "room",
      kind: "host-activity",
      step: "table",
      scenario: "Rhino",
    });
    const guest = setup();
    guest.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const guestSocket = FakeSocket.all.at(-1)!;
    guestSocket.welcome("watcher");
    const before = guestSocket.sent.length;
    guest.controller.onRoomCommand({ kind: "room-activity", step: "scenario" });
    expect(guestSocket.sent).toHaveLength(before);
  });

  it("shows the host's step to a guest, clears it on idle, and forgets it when the socket drops", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "G" });
    await flush();
    const socket = FakeSocket.all[0]!;
    socket.welcome("watcher");
    expect(t.last().hostActivity).toBeNull();
    socket.receive({ v: 1, ch: "room", kind: "host-activity", step: "table", scenario: "Rhino" });
    expect(t.last().hostActivity).toEqual({ step: "table", scenario: "Rhino" });
    socket.receive({ v: 1, ch: "room", kind: "host-activity", step: "idle" });
    expect(t.last().hostActivity).toBeNull();
    socket.receive({ v: 1, ch: "room", kind: "host-activity", step: "decks" });
    socket.closeWith(1006);
    expect(t.last().hostActivity).toBeNull();
  });
});
