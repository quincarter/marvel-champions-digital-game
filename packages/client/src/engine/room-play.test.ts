import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import type { Command, PlayerId } from "@mc/engine";
import { EngineSessionCore, finishedGuestRow } from "./session-core.js";
import type { SessionConfig } from "./host.js";
import { MemoryGameStorage, SAVE_SCHEMA, type GameStorage, type SaveMeta } from "./game-storage.js";
import { IdbGameStorage } from "./idb-game-storage.js";
import { LocalEngineHost } from "./local-host.js";
import { isRoomGuestSave, isRoomSave, mySeatsOf, type RoomPlayRecord } from "./room-play.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-black-panther-protection" }],
  seed: 43523,
};

const ROOM_CONFIG: SessionConfig = { ...CONFIG, room: "room-1" };

const BASELINE = (await new EngineSessionCore().start(CONFIG)).snapshot.state;

const ROOM_PLAY: RoomPlayRecord = {
  role: "guest",
  roomId: "room-1",
  gameKey: "room-1:7",
  mode: "standard",
  mySeats: ["p2" as PlayerId],
  friends: ["Ava"],
  tookOver: [{ player: "p1" as PlayerId, reason: "away" }],
  chatSent: 3,
  strict: false,
  cheats: false,
};

const meta = (id: string, updatedAt: number, overrides: Partial<SaveMeta> = {}): SaveMeta => ({
  id,
  schema: SAVE_SCHEMA,
  config: CONFIG,
  createdAt: updatedAt,
  updatedAt,
  status: "active",
  round: 1,
  commandCount: 0,
  outcome: null,
  campaignId: null,
  campaignNodeId: null,
  ...overrides,
});

const command = (n: number): Command => ({ type: "endTurn", playerId: `p${n}` }) as unknown as Command;

describe("room play helpers", () => {
  test("room rows narrow to my seats, every other game is every seat", () => {
    expect(mySeatsOf(meta("a", 1))).toEqual(["p1", "p2"]);
    expect(mySeatsOf(meta("b", 1, { roomPlay: ROOM_PLAY }))).toEqual(["p2"]);
    expect(isRoomSave(meta("a", 1))).toBe(false);
    expect(isRoomSave(meta("b", 1, { roomPlay: ROOM_PLAY }))).toBe(true);
    expect(isRoomGuestSave(meta("b", 1, { roomPlay: ROOM_PLAY }))).toBe(true);
    // A game started from a room whose room play never landed is a room row with no seat of mine, not offline play.
    const unconfirmed = meta("u", 1, { config: { ...CONFIG, room: "room-1" } });
    expect(isRoomSave(unconfirmed)).toBe(true);
    expect(mySeatsOf(unconfirmed)).toEqual([]);
    expect(isRoomGuestSave(meta("c", 1, { roomPlay: { ...ROOM_PLAY, role: "host" } }))).toBe(false);
  });
});

describe.each<[string, () => GameStorage]>([
  ["memory", () => new MemoryGameStorage()],
  ["indexeddb", () => new IdbGameStorage(new IDBFactory())],
])("room play on the %s storage", (_name, make) => {
  test("setRoomPlay round-trips and stamps the row newer, never older", async () => {
    const storage = make();
    await storage.create(meta("g", 10), BASELINE);
    await storage.setRoomPlay("g", { ...ROOM_PLAY, role: "host" }, 50);
    const stored = (await storage.load("g"))!.meta;
    expect(stored.roomPlay).toEqual({ ...ROOM_PLAY, role: "host" });
    expect(stored.updatedAt).toBe(50);
    await storage.setRoomPlay("g", ROOM_PLAY, 20);
    expect((await storage.load("g"))!.meta.updatedAt).toBe(50);
    await storage.setRoomPlay("missing", ROOM_PLAY, 60);
    expect(await storage.load("missing")).toBeNull();
  });

  test("createFinished writes the whole finished game, and refuses an active row or a repeat", async () => {
    const storage = make();
    const commands = [command(1), command(2)];
    const finished = meta("fin", 5, { status: "won", outcome: { result: "win" } as never, roomPlay: ROOM_PLAY });
    await storage.createFinished(finished, BASELINE, commands);
    const loaded = (await storage.load("fin"))!;
    expect(loaded.meta.status).toBe("won");
    expect(loaded.meta.commandCount).toBe(2);
    expect(loaded.meta.roomPlay).toEqual(ROOM_PLAY);
    expect(loaded.commands).toEqual(commands);
    await expect(storage.createFinished(finished, BASELINE, commands)).rejects.toThrow(/already saved/);
    await expect(storage.createFinished(meta("act", 6), BASELINE, commands)).rejects.toThrow(/active/);
    expect(await storage.load("act")).toBeNull();
  });

  test("a guest row is never offered as Continue or resumed, but a host room game is", async () => {
    const storage = make();
    await storage.createFinished(meta("guest", 99, { status: "won", roomPlay: ROOM_PLAY }), BASELINE, []);
    // An active-looking guest row (a defensive case) is skipped too.
    await storage.create(meta("odd-guest", 98, { roomPlay: ROOM_PLAY }), BASELINE);
    await storage.create(meta("host", 10, { roomPlay: { ...ROOM_PLAY, role: "host" } }), BASELINE);
    const core = new EngineSessionCore({ storage });
    expect((await core.latestSave())!.id).toBe("host");
    expect((await core.activeSaves()).map((save) => save.id)).toEqual(["host"]);
    await expect(core.resume("guest")).rejects.toThrow(/cannot be resumed/);
    await expect(core.resume("odd-guest")).rejects.toThrow(/cannot be resumed/);
    expect((await core.listSaves()).map((save) => save.id).sort()).toEqual(["guest", "host", "odd-guest"]);
  });
});

describe("recordRoomPlay", () => {
  test("a running game's room play lands on its row, behind its own writes", async () => {
    const storage = new MemoryGameStorage();
    const host = new LocalEngineHost(storage);
    const update = await host.start(ROOM_CONFIG);
    expect(update.gameId).toBeDefined();
    await host.recordRoomPlay!(update.gameId!, { ...ROOM_PLAY, role: "host" });
    const row = (await storage.load(update.gameId!))!.meta;
    expect(row.roomPlay?.role).toBe("host");
    expect(row.roomPlay?.gameKey).toBe("room-1:7");
  });

  test("a failed write of the running game's room play rejects, so the caller can retry", async () => {
    const storage = new MemoryGameStorage();
    const host = new LocalEngineHost(storage);
    const update = await host.start(ROOM_CONFIG);
    const failing = new Proxy(storage, {
      get: (target, key) =>
        key === "setRoomPlay"
          ? () => Promise.reject(new Error("disk full"))
          : (target as never as Record<string | symbol, (...a: never[]) => unknown>)[key]!.bind(target),
    });
    const core = new EngineSessionCore({ storage: failing });
    await core.resume(update.gameId!);
    await expect(core.recordRoomPlay(update.gameId!, ROOM_PLAY)).rejects.toThrow(/disk full/);
  });

  test("a record of one room is refused by a save that belongs to another room", async () => {
    const storage = new MemoryGameStorage();
    await storage.create(meta("a", 1, { config: { ...CONFIG, room: "room-1" } }), BASELINE);
    await storage.create(meta("b", 2, { config: { ...CONFIG, room: "room-2" } }), BASELINE);
    const core = new EngineSessionCore({ storage });
    await expect(core.recordRoomPlay("b", ROOM_PLAY)).rejects.toThrow(/belongs to room room-2/);
    expect((await storage.load("b"))!.meta.roomPlay).toBeUndefined();
    await core.recordRoomPlay("a", ROOM_PLAY);
    expect((await storage.load("a"))!.meta.roomPlay).toEqual(ROOM_PLAY);
  });

  test("a stored room game that is not the running one is written too, and single player rows stay untouched", async () => {
    const storage = new MemoryGameStorage();
    await storage.create(meta("old", 1, { config: ROOM_CONFIG }), BASELINE);
    const core = new EngineSessionCore({ storage });
    await core.recordRoomPlay("old", ROOM_PLAY);
    expect((await storage.load("old"))!.meta.roomPlay).toEqual(ROOM_PLAY);
    const solo = new LocalEngineHost(new MemoryGameStorage());
    const started = await solo.start(CONFIG);
    expect((await solo.listSaves()).find((save) => save.id === started.gameId)!.roomPlay).toBeUndefined();
  });

  test("an offline save (no room) refuses a room play, stored or running", async () => {
    const storage = new MemoryGameStorage();
    await storage.create(meta("offline", 1), BASELINE);
    const core = new EngineSessionCore({ storage });
    await expect(core.recordRoomPlay("offline", ROOM_PLAY)).rejects.toThrow(/not a room game/);
    expect((await storage.load("offline"))!.meta.roomPlay).toBeUndefined();
    const host = new LocalEngineHost(storage);
    const running = await host.start(CONFIG);
    await expect(host.recordRoomPlay!(running.gameId!, ROOM_PLAY)).rejects.toThrow(/not a room game/);
    expect((await storage.load(running.gameId!))!.meta.roomPlay).toBeUndefined();
  });

  test("two games of the same room are told apart by the gid the save recorded", async () => {
    const storage = new MemoryGameStorage();
    await storage.create(meta("g", 1, { config: ROOM_CONFIG }), BASELINE);
    const core = new EngineSessionCore({ storage });
    const first = { ...ROOM_PLAY, gid: "g1", gameKey: "room-1:main:g1" };
    // A provisional record (no gid yet) lands, then the confirmed one records the gid.
    await core.recordRoomPlay("g", { ...ROOM_PLAY, gameKey: "room-1:4" });
    await core.recordRoomPlay("g", first);
    await core.recordRoomPlay("g", { ...first, chatSent: 4 });
    // A late update of the rematch (another gid) or a stale provisional one is refused.
    await expect(core.recordRoomPlay("g", { ...ROOM_PLAY, gid: "g2", gameKey: "room-1:main:g2" })).rejects.toThrow(
      /is room game room-1:main:g1/,
    );
    await expect(core.recordRoomPlay("g", { ...ROOM_PLAY, gameKey: "room-1:9" })).rejects.toThrow(/is room game/);
    expect((await storage.load("g"))!.meta.roomPlay).toEqual({ ...first, chatSent: 4 });
  });
});

describe("finishedGuestRow", () => {
  test("a log that is not over is not a row", () => {
    const base = { id: "g", config: CONFIG, createdAt: 1, updatedAt: 2, roomPlay: ROOM_PLAY };
    const { cardPool: _pool, ...stripped } = BASELINE as typeof BASELINE & { cardPool: unknown };
    expect(finishedGuestRow(base, stripped as never, [])).toBeNull();
  });
});
