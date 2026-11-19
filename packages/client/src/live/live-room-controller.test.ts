import { describe, expect, it, vi } from "vitest";
import type { Command } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { liveGameOf } from "./live-game.js";
import { LiveRoomController } from "./live-room-controller.js";
import type { LiveGameMessage } from "./live-room-protocol.js";
import type { CreateRoomResult, RoomSocketDeps, WebSocketLike } from "./room-socket.js";
import type { LiveStatus } from "./live-publisher.js";
import { MemoryRoomStore } from "./live-room-store.js";

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
  welcome(role: "host" | "watcher", table?: { commands: number; ended: boolean; hasHeader: boolean }): void {
    this.readyState = 1;
    this.onopen?.({});
    this.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: { id: "p", role },
      caps: [],
      participants: [],
      tables: table ? [{ id: "t1", hostConnected: true, ...table }] : [],
    });
  }
  closeWith(code: number): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  get gameKinds(): string[] {
    return this.sent.filter((m) => m.ch === "game").map((m) => m.kind);
  }
}

const cmd = (n: number): Command => ({ type: "test", n }) as unknown as Command;
const config = { scenarioId: "rhino", seed: 1, watchable: true, players: [] } as unknown as SessionConfig;
const gameMessage = (gameKey: string, commands: Command[] = []): Extract<LiveGameMessage, { kind: "game" }> => ({
  kind: "game",
  gameKey,
  game: liveGameOf({
    writer: { appVersion: "1", contentVersion: "1" },
    config,
    createdAt: 1,
    initialState: {} as unknown as StateWithoutPool,
    commands,
    outcome: null,
  }),
});
const command = (gameKey: string, count: number): LiveGameMessage => ({
  kind: "command",
  gameKey,
  command: cmd(count),
  count,
});

let roomNumber = 0;
const roomOf = (): CreateRoomResult => {
  roomNumber++;
  const id = `room${String(roomNumber).padStart(8, "0")}`;
  return { ok: true, room: { roomId: id, hostToken: "h".repeat(32), table: "t1" } };
};

function setup(createResults: CreateRoomResult[] = [], store?: MemoryRoomStore, now = () => 1_000) {
  FakeSocket.all = [];
  const statuses: LiveStatus[] = [];
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
  const queue = [...createResults];
  const createRoom = vi.fn(async () => queue.shift() ?? roomOf());
  const onEnabledChange = vi.fn();
  const onResync = vi.fn();
  const controller = new LiveRoomController({
    syncUrl: "https://sync.example",
    watchBase: "https://web.example/",
    onStatus: (s) => statuses.push(s),
    onEnabledChange,
    onResync,
    createRoom,
    socket,
    ...(store ? { store, now } : {}),
  });
  controller.setEnabled(true);
  return { controller, statuses, timers, createRoom, onEnabledChange, onResync };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("live room controller", () => {
  it("holds the game and opens a room on the first command", async () => {
    const { controller, createRoom, statuses } = setup();
    controller.onGameMessage(gameMessage("g1"));
    await settle();
    expect(createRoom).not.toHaveBeenCalled();
    controller.onGameMessage(command("g1", 1));
    await settle();
    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(FakeSocket.all).toHaveLength(1);
    FakeSocket.all[0]!.welcome("host");
    expect(FakeSocket.all[0]!.gameKinds).toEqual(["start", "commands"]);
    expect(statuses.at(-1)?.watchUrl).toContain("#watch=room");
  });

  it("applies a rewind before the room exists to the held game", async () => {
    const { controller } = setup();
    controller.onGameMessage(gameMessage("g1", [cmd(1), cmd(2), cmd(3)]));
    controller.onGameMessage({ kind: "rewind", gameKey: "g1", to: 1 });
    controller.onGameMessage(command("g1", 2));
    await settle();
    FakeSocket.all[0]!.welcome("host");
    const commands = FakeSocket.all[0]!.sent.find((m) => m.kind === "commands")!;
    expect(commands.commands).toEqual([cmd(1), cmd(2)]);
  });

  it("makes exactly one new room when the token turns out to be a watcher's", async () => {
    const { controller, createRoom } = setup();
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    await settle();
    FakeSocket.all[0]!.welcome("watcher");
    await settle();
    expect(createRoom).toHaveBeenCalledTimes(2);
    FakeSocket.all[1]!.welcome("watcher");
    await settle();
    expect(createRoom).toHaveBeenCalledTimes(2);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("a room that is gone (1011) is replaced once, fed the same log", async () => {
    const { controller, createRoom } = setup();
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    await settle();
    FakeSocket.all[0]!.closeWith(1011);
    await settle();
    expect(createRoom).toHaveBeenCalledTimes(2);
    FakeSocket.all[1]!.welcome("host");
    expect(FakeSocket.all[1]!.gameKinds).toEqual(["start", "commands"]);
  });

  it("stops when replaced as host, and later commands open nothing", async () => {
    const { controller, createRoom, statuses } = setup();
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    await settle();
    FakeSocket.all[0]!.welcome("host");
    FakeSocket.all[0]!.closeWith(4000);
    controller.onGameMessage(command("g1", 2));
    await settle();
    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(FakeSocket.all).toHaveLength(1);
    expect(statuses.at(-1)).toEqual({ watchUrl: null, watchers: 0, connected: false });
  });

  it("stops when the room closes, with no stale reopen on the next command", async () => {
    const { controller, createRoom } = setup();
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    await settle();
    FakeSocket.all[0]!.welcome("host");
    FakeSocket.all[0]!.receive({ v: 1, ch: "room", kind: "closed", reason: "idle" });
    controller.onGameMessage(command("g1", 2));
    await settle();
    expect(createRoom).toHaveBeenCalledTimes(1);
  });

  it("switching off tells the room the table is over and drops everything", async () => {
    const { controller, onEnabledChange, statuses } = setup();
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    await settle();
    FakeSocket.all[0]!.welcome("host");
    controller.setEnabled(false);
    expect(FakeSocket.all[0]!.sent.at(-1)).toMatchObject({ kind: "end", outcome: null });
    expect(onEnabledChange).toHaveBeenLastCalledWith(false);
    expect(statuses.at(-1)?.watchUrl).toBeNull();
    controller.onGameMessage(command("g1", 2));
    await settle();
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("a non-watchable game on the table ends the old room and clears the status", async () => {
    const { controller, statuses } = setup();
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    await settle();
    FakeSocket.all[0]!.welcome("host");
    controller.onGameMessage({ kind: "none" });
    expect(FakeSocket.all[0]!.sent.at(-1)).toMatchObject({ kind: "end", outcome: null });
    expect(statuses.at(-1)).toEqual({ watchUrl: null, watchers: 0, connected: false });
    controller.onGameMessage(command("g1", 2));
    await settle();
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("a different game key ends the old room and gets its own", async () => {
    const { controller, createRoom } = setup();
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    await settle();
    FakeSocket.all[0]!.welcome("host");
    controller.onGameMessage(gameMessage("g2"));
    expect(FakeSocket.all[0]!.sent.at(-1)).toMatchObject({ kind: "end", outcome: null });
    controller.onGameMessage(command("g2", 1));
    await settle();
    expect(createRoom).toHaveBeenCalledTimes(2);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("the same game key again keeps the room and reconciles the log", async () => {
    const { controller, createRoom } = setup();
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    controller.onGameMessage(command("g1", 2));
    await settle();
    const socket = FakeSocket.all[0]!;
    socket.welcome("host");
    socket.sent.length = 0;
    controller.onGameMessage(gameMessage("g1", [cmd(1), cmd(2), cmd(3)]));
    await settle();
    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(FakeSocket.all).toHaveLength(1);
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toMatchObject({ kind: "commands", from: 2, commands: [{ n: 3 }] });
  });

  it("asks the engine worker to resync on a gap", async () => {
    const { controller, onResync } = setup();
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    controller.onGameMessage(command("g1", 4));
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it("retries a failed room creation with backoff, but not a rate limit", async () => {
    const { controller, createRoom, timers } = setup([{ ok: false, failure: "unavailable" }]);
    controller.onGameMessage(gameMessage("g1"));
    controller.onGameMessage(command("g1", 1));
    await settle();
    expect(timers).toHaveLength(1);
    timers[0]!.run();
    await settle();
    expect(createRoom).toHaveBeenCalledTimes(2);
    expect(FakeSocket.all).toHaveLength(1);

    const rejected = setup([{ ok: false, failure: "rejected" }]);
    rejected.controller.onGameMessage(gameMessage("g1"));
    rejected.controller.onGameMessage(command("g1", 1));
    await settle();
    expect(rejected.timers).toHaveLength(0);
    expect(rejected.createRoom).toHaveBeenCalledTimes(1);

    const limited = setup([{ ok: false, failure: "rate-limited" }]);
    limited.controller.onGameMessage(gameMessage("g1"));
    limited.controller.onGameMessage(command("g1", 1));
    await settle();
    expect(limited.timers).toHaveLength(0);
    expect(limited.createRoom).toHaveBeenCalledTimes(1);
  });

  describe("after an app reload", () => {
    const record = { gameKey: "g1", roomId: "oldroom00001", hostToken: "k".repeat(32), createdAt: 1_000 };

    it("a fresh controller resuming the same game returns to its room as host, with watchers kept", async () => {
      const store = new MemoryRoomStore();
      await store.save(record);
      const { controller, createRoom, statuses } = setup([], store);
      controller.onGameMessage(gameMessage("g1", [cmd(1), cmd(2)]));
      controller.onGameMessage(command("g1", 3));
      await settle();
      expect(createRoom).not.toHaveBeenCalled();
      expect(FakeSocket.all[0]!.url).toContain("/room/oldroom00001/ws");
      FakeSocket.all[0]!.welcome("host", { commands: 2, ended: false, hasHeader: true });
      // The room already holds the first two commands: only the new one goes out.
      expect(FakeSocket.all[0]!.gameKinds).toEqual(["commands"]);
      expect(FakeSocket.all[0]!.sent.find((m) => m.kind === "commands")).toMatchObject({
        from: 2,
        commands: [{ n: 3 }],
      });
      FakeSocket.all[0]!.receive({ v: 1, ch: "room", kind: "roster", participants: [], watchers: 2 });
      expect(statuses.at(-1)).toMatchObject({ watchUrl: expect.stringContaining("#watch=oldroom00001"), watchers: 2 });
    });

    it("falls back to a new room, overwriting the record, when the old room no longer honours the token", async () => {
      const store = new MemoryRoomStore();
      await store.save(record);
      const { controller, createRoom } = setup([], store);
      controller.onGameMessage(gameMessage("g1"));
      controller.onGameMessage(command("g1", 1));
      await settle();
      FakeSocket.all[0]!.welcome("watcher");
      await settle();
      expect(createRoom).toHaveBeenCalledTimes(1);
      expect((await store.load("g1"))?.roomId).not.toBe("oldroom00001");
    });

    it("falls back to a new room when the old room is gone (1011)", async () => {
      const store = new MemoryRoomStore();
      await store.save(record);
      const { controller, createRoom } = setup([], store);
      controller.onGameMessage(gameMessage("g1"));
      controller.onGameMessage(command("g1", 1));
      await settle();
      FakeSocket.all[0]!.closeWith(1011);
      await settle();
      expect(createRoom).toHaveBeenCalledTimes(1);
    });

    it("ignores and clears a record older than the room's idle limit", async () => {
      const store = new MemoryRoomStore();
      await store.save(record);
      const { controller, createRoom } = setup([], store, () => 1_000 + 13 * 60 * 60 * 1000);
      controller.onGameMessage(gameMessage("g1"));
      controller.onGameMessage(command("g1", 1));
      await settle();
      expect(createRoom).toHaveBeenCalledTimes(1);
      expect((await store.load("g1"))?.roomId).not.toBe("oldroom00001");
    });

    it("saves a new room's record, and clears it when the game is left or the room closes", async () => {
      const store = new MemoryRoomStore();
      const { controller } = setup([], store);
      controller.onGameMessage(gameMessage("g1"));
      controller.onGameMessage(command("g1", 1));
      await settle();
      expect((await store.load("g1"))?.hostToken).toHaveLength(32);
      FakeSocket.all[0]!.welcome("host");
      controller.onGameMessage({ kind: "none" });
      await settle();
      expect(await store.load("g1")).toBeNull();

      controller.onGameMessage(gameMessage("g2"));
      controller.onGameMessage(command("g2", 1));
      await settle();
      expect(await store.load("g2")).not.toBeNull();
      FakeSocket.all.at(-1)!.welcome("host");
      FakeSocket.all.at(-1)!.receive({ v: 1, ch: "room", kind: "closed", reason: "ended" });
      await settle();
      expect(await store.load("g2")).toBeNull();
    });
  });
});
