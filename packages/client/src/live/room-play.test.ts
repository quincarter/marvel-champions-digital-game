/**
 * The host's side of playing together (issue #881): the seat to player mapping, seat holders' proposals reaching the
 * engine worker and its refusals reaching the room, requests, and taking a seat over. Fake sockets and a fake engine
 * port, as `room-controller.test.ts` does.
 */
import { describe, expect, it, vi } from "vitest";
import type { StateWithoutPool, SessionConfig } from "../engine/host.js";
import { liveGameOf } from "./live-game.js";
import { LiveRoomController } from "./live-room-controller.js";
import type { LiveControlMessage, LiveGameMessage } from "./live-room-protocol.js";
import { MemorySeatTokenStore } from "./room-seat-store.js";
import { seatOfPlayerIn, type RoomState } from "./room-state.js";
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
  /** What the host sent of one kind, newest last. */
  of(kind: string): { [k: string]: unknown }[] {
    return this.sent.filter((m) => m.kind === kind);
  }
}

const BUILD = { appVersion: "1.0.0", contentVersion: "p1" };
const SEATS = [
  { id: "s1", label: "Spider-Man" },
  { id: "s2", label: "She-Hulk" },
];
const lobby = (playMode: "strict" | "host", seats: object[]) => ({
  v: 1,
  ch: "room",
  kind: "lobby",
  code: "ABC234",
  settings: { playMode, tableRules: {}, mods: [], multiSeat: false, chat: true, ...BUILD },
  seats,
});
const welcome = (participants: object[] = []) => ({
  v: 1,
  ch: "room",
  kind: "welcome",
  you: { id: "host1", role: "host", name: "Hosty" },
  caps: ["watch", "chat", "seats", "play"],
  participants: [{ id: "host1", role: "host", name: "Hosty", build: BUILD }, ...participants],
  tables: [{ id: "t1", hostConnected: true, commands: 0, ended: false, hasHeader: false }],
});
const ava = { id: "ava", role: "watcher", name: "Ava", build: BUILD };
const proposal = (over: object = {}) => ({
  v: 1,
  ch: "game",
  kind: "proposal",
  table: "t1",
  from: "ava",
  seats: ["s1"],
  command: { type: "endTurn", playerId: "p1" },
  base: 0,
  ...over,
});
const request = (what: "undo" | "adjust", from = "ava", note = "") => ({
  v: 1,
  ch: "game",
  kind: "request",
  table: "t1",
  from,
  what,
  note,
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const gameMessage = (gameKey: string, room: string): Extract<LiveGameMessage, { kind: "game" }> => ({
  kind: "game",
  gameKey,
  room,
  game: liveGameOf({
    writer: { appVersion: "1", contentVersion: "1" },
    config: { scenarioId: "rhino", seed: 1, watchable: true, players: [] } as unknown as SessionConfig,
    createdAt: 1,
    initialState: {} as unknown as StateWithoutPool,
    commands: [],
    outcome: null,
  }),
});

/** A host in a lobby with seats `s1`, `s2`, a game started in it, and the engine port's messages captured. */
async function hosting(playMode: "strict" | "host" = "host", seats: object[] = SEATS, startGame = true) {
  FakeSocket.all = [];
  const states: RoomState[] = [];
  const toEngine: LiveControlMessage[] = [];
  const socket: RoomSocketDeps = {
    WebSocket: FakeSocket,
    setTimer: () => ({}),
    clearTimer: () => undefined,
    random: () => 0.5,
  };
  const createRoom = vi.fn(async (_deps: CreateRoomDeps): Promise<CreateRoomResult> => ({
    ok: true,
    room: { roomId: "room00000001", hostToken: "h".repeat(32), table: "t1", code: "ABC234" },
  }));
  const controller = new LiveRoomController({
    syncUrl: "https://sync.example",
    watchBase: "https://web.example/",
    onStatus: () => undefined,
    onProposal: (p) => toEngine.push(p),
    socket,
    room: {
      build: BUILD,
      seatStore: new MemorySeatTokenStore(),
      onState: (s) => states.push(s),
      createRoom,
    },
  });
  controller.setEnabled(true);
  controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
  await flush();
  const sock = FakeSocket.all[0]!;
  sock.open();
  sock.receive(welcome([ava]));
  sock.receive(lobby(playMode, seats));
  if (startGame) controller.onGameMessage(gameMessage("game-1", "room00000001"));
  await flush();
  return { controller, sock, states, toEngine, last: () => states[states.length - 1]! };
}

describe("the seat to player mapping", () => {
  it("sends each seat's player in every lobby-set that carries seats, whether or not the caller named it", async () => {
    const t = await hosting("host", SEATS, false);
    t.controller.onRoomCommand({ kind: "room-lobby", seats: SEATS });
    t.controller.onRoomCommand({ kind: "room-lobby", seats: [{ id: "s1", label: "Spider-Man", player: "p3" }] });
    const sets = t.sock.of("lobby-set");
    expect(sets[0]!.seats).toEqual([
      { id: "s1", label: "Spider-Man", player: "p1" },
      { id: "s2", label: "She-Hulk", player: "p2" },
    ]);
    // A player the caller gave is kept.
    expect(sets[1]!.seats).toEqual([{ id: "s1", label: "Spider-Man", player: "p3" }]);
  });

  it("shows a seat's player in the room state, and finds the seat that plays a hero", async () => {
    const t = await hosting("host", [
      { id: "s1", label: "Spider-Man", player: "p1", holder: "ava" },
      { id: "s2", label: "She-Hulk", player: 1, holder: "gone", holderName: "Cleo", takenOver: true },
    ]);
    const state = t.last();
    expect(state.seats.map((s) => s.player)).toEqual(["p1", "p2"]);
    expect(seatOfPlayerIn(state, "p1")).toMatchObject({ holderName: "Ava", mine: false, away: false });
    expect(seatOfPlayerIn(state, "p2")).toMatchObject({ holderName: "Cleo", mine: true, away: true, takenOver: true });
    expect(seatOfPlayerIn(state, "p9")).toBeNull();
  });
});

describe("a table whose game is running", () => {
  it("keeps its seats and who plays which hero: a seat list from the host is not sent, settings still are", async () => {
    const t = await hosting();
    t.controller.onRoomCommand({ kind: "room-lobby", seats: [{ id: "s1", label: "Other" }] });
    expect(t.sock.of("lobby-set")).toHaveLength(0);
    t.controller.onRoomCommand({ kind: "room-lobby", seats: [{ id: "s1", label: "Other" }], settings: { chat: false } });
    expect(t.sock.of("lobby-set")).toEqual([expect.objectContaining({ settings: { chat: false } })]);
    expect(t.sock.of("lobby-set")[0]).not.toHaveProperty("seats");
  });
});

describe("a seat its player left", () => {
  it("is away while the holder has left it (handover off), and not the holder's to act for", async () => {
    const t = await hosting("host", [
      { id: "s1", label: "Spider-Man", player: "p1", holder: "ava", left: true },
      { id: "s2", label: "She-Hulk", player: "p2" },
    ]);
    expect(t.last().seats.map((s) => [s.away, s.holder])).toEqual([
      [true, "ava"],
      [false, null],
    ]);
    expect(seatOfPlayerIn(t.last(), "p1")).toMatchObject({ away: true, mine: false });
  });

  it("is vacant when released with handover on: no holder, player kept, host may take it over", async () => {
    const t = await hosting("host", [{ id: "s1", label: "Spider-Man", player: "p1" }]);
    expect(t.last().seats[0]).toMatchObject({ holder: null, player: "p1", away: false });
    t.controller.onRoomCommand({ kind: "room-seat", op: "take-over", seat: "s1" });
    expect(t.sock.of("take-over")).toHaveLength(1);
  });

  it("shows the handover setting from the room", async () => {
    const t = await hosting();
    expect(t.last().settings?.handover).toBeUndefined();
    t.sock.receive({ ...lobby("host", SEATS), settings: { ...lobby("host", SEATS).settings, handover: false } });
    expect(t.last().settings?.handover).toBe(false);
  });
});

describe("a seat holder's proposal", () => {
  it("goes to the engine worker with the engine players behind the seats the room named, untouched", async () => {
    const t = await hosting("host", [
      { id: "s1", label: "Spider-Man", player: "p1" },
      { id: "s2", label: "She-Hulk", player: "p2" },
    ]);
    t.sock.receive(proposal({ seats: ["s1", "s2"], base: 4 }));
    expect(t.toEngine).toEqual([
      {
        kind: "proposal",
        gameKey: "game-1",
        from: "ava",
        players: ["p1", "p2"],
        command: { type: "endTurn", playerId: "p1" },
        base: 4,
      },
    ]);
  });

  it("carries the proposer's state stamp to the engine worker", async () => {
    const t = await hosting("host", [{ id: "s1", label: "Spider-Man", player: "p1" }]);
    t.sock.receive(proposal({ stamp: "9:ab:cd" }));
    expect(t.toEngine[0]).toMatchObject({ stamp: "9:ab:cd" });
  });

  it("is refused stale straight away when no game is attached to judge it", async () => {
    const t = await hosting();
    t.controller.onRoomCommand({ kind: "room-leave" });
    // A fresh host session without a game.
    FakeSocket.all = [];
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    const sock = FakeSocket.all[0]!;
    sock.open();
    sock.receive(welcome([ava]));
    sock.receive(proposal({ base: 7 }));
    expect(sock.of("proposal-refused")).toEqual([
      expect.objectContaining({ ch: "game", table: "t1", to: "ava", reason: "stale", base: 7 }),
    ]);
  });

  it("is refused to its proposer when the engine worker says so", async () => {
    const t = await hosting();
    t.controller.onGameMessage({ kind: "refuse", gameKey: "game-1", to: "ava", reason: "not-your-turn", base: 3 });
    expect(t.sock.of("proposal-refused")).toEqual([
      expect.objectContaining({ ch: "game", table: "t1", to: "ava", reason: "not-your-turn", base: 3 }),
    ]);
    // A refusal for a game that is no longer on the table goes nowhere.
    t.controller.onGameMessage({ kind: "refuse", gameKey: "old-game", to: "ava", reason: "illegal", base: 3 });
    expect(t.sock.of("proposal-refused")).toHaveLength(1);
  });

  it("an accepted command streams like the host's own: it arrives from the engine as an ordinary command", async () => {
    const t = await hosting();
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "game-1",
      command: { type: "endTurn", playerId: "p1" } as never,
      count: 1,
    });
    await flush();
    expect(t.sock.of("start").length + t.sock.of("log").length + t.sock.of("commands").length).toBeGreaterThan(0);
  });
});

describe("requests to the host", () => {
  it("are listed with the asker's name, kind and note, oldest first", async () => {
    const t = await hosting();
    t.sock.receive(request("undo", "ava", "I misclicked"));
    t.sock.receive(request("adjust", "ava"));
    expect(t.last().requests).toEqual([
      { id: expect.any(String), from: "ava", name: "Ava", what: "undo", note: "I misclicked" },
      { id: expect.any(String), from: "ava", name: "Ava", what: "adjust", note: "" },
    ]);
  });

  it("keep one of a kind per asker, with the newest note", async () => {
    const t = await hosting();
    t.sock.receive(request("undo", "ava", "first"));
    t.sock.receive(request("undo", "ava", "second"));
    expect(t.last().requests.map((r) => r.note)).toEqual(["second"]);
  });

  it("are answered to the asker alone and leave the list", async () => {
    const t = await hosting();
    t.sock.receive(request("undo"));
    const id = t.last().requests[0]!.id;
    t.controller.onRoomCommand({ kind: "room-answer", id, accepted: true });
    expect(t.sock.of("request-answer")).toEqual([
      expect.objectContaining({ ch: "game", table: "t1", to: "ava", accepted: true }),
    ]);
    expect(t.last().requests).toEqual([]);
    // Answering twice says nothing more.
    t.controller.onRoomCommand({ kind: "room-answer", id, accepted: false });
    expect(t.sock.of("request-answer")).toHaveLength(1);
  });

  it("are dropped when their asker leaves the room", async () => {
    const t = await hosting();
    t.sock.receive(request("adjust"));
    t.sock.receive({ v: 1, ch: "room", kind: "roster", participants: [welcome().participants[0]], watchers: 0 });
    expect(t.last().requests).toEqual([]);
  });

  it("are declined, never listed, in a Strict room", async () => {
    const t = await hosting("strict");
    t.sock.receive(request("undo"));
    expect(t.last().requests).toEqual([]);
    expect(t.sock.of("request-answer")).toEqual([expect.objectContaining({ ch: "game", to: "ava", accepted: false })]);
  });

  it("are not a guest's to see", async () => {
    FakeSocket.all = [];
    const states: RoomState[] = [];
    const controller = new LiveRoomController({
      syncUrl: "https://sync.example",
      watchBase: "https://web.example/",
      onStatus: () => undefined,
      socket: { WebSocket: FakeSocket, setTimer: () => ({}), clearTimer: () => undefined, random: () => 0.5 },
      room: {
        build: BUILD,
        seatStore: new MemorySeatTokenStore(),
        onState: (s) => states.push(s),
        resolveRoomCode: async () => ({ ok: true as const, roomId: "room00000002" }),
      },
    });
    controller.setEnabled(true);
    controller.onRoomCommand({ kind: "room-join", target: "room00000002", name: "Guesty" });
    await flush();
    FakeSocket.all[0]!.open();
    FakeSocket.all[0]!.receive(request("undo"));
    expect(states[states.length - 1]!.requests).toEqual([]);
  });
});

describe("taking a seat over and giving it back", () => {
  it("sends the room take-over and give-back for the seat", async () => {
    const t = await hosting();
    t.controller.onRoomCommand({ kind: "room-seat", op: "take-over", seat: "s2" });
    t.controller.onRoomCommand({ kind: "room-seat", op: "give-back", seat: "s2" });
    expect(t.sock.of("take-over")).toEqual([expect.objectContaining({ ch: "room", seat: "s2" })]);
    expect(t.sock.of("give-back")).toEqual([expect.objectContaining({ ch: "room", seat: "s2" })]);
  });

  it("shows a seat as away when its holder is not connected, and as taken over once the room says so", async () => {
    const t = await hosting("host", [
      { id: "s1", label: "Spider-Man", player: "p1", holder: "gone", holderName: "Cleo" },
      { id: "s2", label: "She-Hulk", player: "p2", holder: "ava" },
    ]);
    expect(t.last().seats.map((s) => [s.away, s.takenOver])).toEqual([
      [true, false],
      [false, false],
    ]);
    t.sock.receive(
      lobby("host", [
        { id: "s1", label: "Spider-Man", player: "p1", holder: "gone", holderName: "Cleo", takenOver: true },
        { id: "s2", label: "She-Hulk", player: "p2", holder: "ava" },
      ]),
    );
    expect(seatOfPlayerIn(t.last(), "p1")).toMatchObject({ mine: true, away: true, takenOver: true });
    expect(seatOfPlayerIn(t.last(), "p2")).toMatchObject({ mine: false });
  });
});
