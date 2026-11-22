import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameRoomLogic, sha256Hex, type RoomDirectoryHooks, type RoomSocket } from "./game-room.js";
import { LIVE_PUBLISH_MIN_MS, parseClientMessage, type Participant } from "./room-protocol.js";
import { MemoryStorage } from "./test-support.js";

const TOKEN = "T".repeat(32);
const BUILD = { appVersion: "1.2.3", contentVersion: "c9" };
const CODE = "K7M2PQ";

class FakeSocket implements RoomSocket {
  attachment: Participant | null = null;
  send() {}
  close() {}
  getParticipant() {
    return this.attachment;
  }
  setParticipant(p: Participant) {
    this.attachment = p;
  }
  clearParticipant() {
    this.attachment = null;
  }
}

async function setup() {
  const storage = new MemoryStorage();
  const clock = { now: 1_000 };
  const calls: string[] = [];
  const hooks: RoomDirectoryHooks = {
    upsert: async (entry) => void calls.push(`upsert ${JSON.stringify(entry)}`),
    remove: async (code) => void calls.push(`remove ${code}`),
  };
  const limits = { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 };
  const room = new GameRoomLogic(storage, limits, () => clock.now, undefined, hooks);
  await room.create(await sha256Hex(TOKEN), clock.now, { code: CODE, roomId: "AAAAAAAAAAAA" });
  const send = (s: RoomSocket, m: unknown) => room.message(s, JSON.stringify({ v: 1, ...(m as object) }));
  const join = async (hello: { token?: string; name: string }) => {
    const s = new FakeSocket();
    await send(s, { ch: "room", kind: "hello", caps: ["watch", "chat", "seats"], build: BUILD, ...hello });
    return s;
  };
  const host = () => join({ token: TOKEN, name: "Hosty" });
  const lobbySet = (s: RoomSocket, patch: object) => send(s, { ch: "room", kind: "lobby-set", ...patch });
  /** Lets the room's coalescing timer fire and its flush finish. */
  const settle = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
    await vi.advanceTimersByTimeAsync(0);
  };
  return { room, calls, clock, host, join, send, lobbySet, settle, storage };
}

const upserts = (calls: string[]) => calls.filter((c) => c.startsWith("upsert"));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the Live now listing", () => {
  it("is off by default: a room whose host never opted in publishes and removes nothing", async () => {
    const { host, lobbySet, settle, calls, clock } = await setup();
    const h = await host();
    await lobbySet(h, { seats: [{ id: "s1" }], settings: { chat: false } });
    clock.now += 60_000;
    await settle(60_000);
    await lobbySet(h, { settings: { chat: true } });
    await settle(60_000);
    expect(calls).toEqual([]);
  });

  it("the setting is a boolean the host alone may set", async () => {
    expect(
      parseClientMessage(JSON.stringify({ v: 1, ch: "room", kind: "lobby-set", settings: { listed: true } })),
    ).not.toBeNull();
    expect(
      parseClientMessage(JSON.stringify({ v: 1, ch: "room", kind: "lobby-set", settings: { listed: "yes" } })),
    ).toBeNull();
    const { host, join, lobbySet, settle, calls } = await setup();
    await host();
    const guest = await join({ name: "Ann" });
    await lobbySet(guest, { settings: { listed: true } });
    await settle();
    expect(calls).toEqual([]);
  });

  it("listing on publishes the entry with the host's name, mode and seats; unlisting removes it", async () => {
    const { host, lobbySet, settle, calls, clock } = await setup();
    const h = await host();
    await lobbySet(h, { seats: [{ id: "s1" }, { id: "s2" }], settings: { listed: true } });
    await settle();
    expect(calls).toEqual([
      `upsert ${JSON.stringify({ code: CODE, host: "Hosty", mode: "strict", seatsTaken: 0, seatsTotal: 2, started: false })}`,
    ]);
    clock.now += LIVE_PUBLISH_MIN_MS;
    await lobbySet(h, { settings: { listed: false } });
    await settle(LIVE_PUBLISH_MIN_MS);
    expect(calls.at(-1)).toBe(`remove ${CODE}`);
  });

  it("coalesces a burst of changes into one publish, and spaces publishes by the minimum interval", async () => {
    const { host, lobbySet, settle, calls, clock } = await setup();
    const h = await host();
    await lobbySet(h, { settings: { listed: true } });
    await settle();
    expect(upserts(calls)).toHaveLength(1);
    // Four changes inside the window: nothing yet, then exactly one more write when the window is over.
    for (let i = 1; i <= 4; i++) {
      clock.now += 100;
      await lobbySet(h, { seats: Array.from({ length: i }, (_, n) => ({ id: `s${n}` })) });
    }
    await settle(1_000);
    expect(upserts(calls)).toHaveLength(1);
    clock.now += LIVE_PUBLISH_MIN_MS;
    await settle(LIVE_PUBLISH_MIN_MS);
    expect(upserts(calls)).toHaveLength(2);
    expect(calls.at(-1)).toContain('"seatsTotal":4');
  });

  it("a change that shows nothing new (chat toggled) does not publish again", async () => {
    const { host, lobbySet, settle, calls, clock } = await setup();
    const h = await host();
    await lobbySet(h, { settings: { listed: true } });
    await settle();
    clock.now += LIVE_PUBLISH_MIN_MS;
    await lobbySet(h, { settings: { chat: false } });
    await settle(LIVE_PUBLISH_MIN_MS);
    expect(upserts(calls)).toHaveLength(1);
  });

  it("shows the scenario once the host picks one, and started once the game starts", async () => {
    const { host, send, lobbySet, settle, calls, clock } = await setup();
    const h = await host();
    await lobbySet(h, { settings: { listed: true } });
    await settle();
    clock.now += LIVE_PUBLISH_MIN_MS;
    await send(h, { ch: "room", kind: "host-activity", step: "scenario", scenario: "Rhino" });
    await settle(LIVE_PUBLISH_MIN_MS);
    expect(calls.at(-1)).toContain('"scenario":"Rhino"');
    clock.now += LIVE_PUBLISH_MIN_MS;
    await send(h, { ch: "game", kind: "start", table: "t1", header: {} });
    await settle(LIVE_PUBLISH_MIN_MS);
    expect(calls.at(-1)).toContain('"started":true');
  });

  it("removes the listing when the host leaves, and lists again when it returns", async () => {
    const { host, lobbySet, settle, calls, clock, room } = await setup();
    const h = await host();
    await lobbySet(h, { settings: { listed: true } });
    await settle();
    clock.now += LIVE_PUBLISH_MIN_MS;
    await room.close(h);
    await settle(LIVE_PUBLISH_MIN_MS);
    expect(calls.at(-1)).toBe(`remove ${CODE}`);
    clock.now += LIVE_PUBLISH_MIN_MS;
    await host();
    await settle(LIVE_PUBLISH_MIN_MS);
    expect(upserts(calls)).toHaveLength(2);
  });

  it("removes the listing when the room closes", async () => {
    const { host, lobbySet, settle, calls, room } = await setup();
    const h = await host();
    await lobbySet(h, { settings: { listed: true } });
    await settle();
    await room.shutdown("host");
    expect(calls.at(-1)).toBe(`remove ${CODE}`);
  });

  it("a failing directory never breaks the room; the next change tries again", async () => {
    const storage = new MemoryStorage();
    const clock = { now: 1_000 };
    let fail = true;
    const sent: string[] = [];
    const hooks: RoomDirectoryHooks = {
      upsert: async (entry) => {
        if (fail) throw new Error("down");
        sent.push(entry.code);
      },
      remove: async () => {},
    };
    const limits = { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 };
    const room = new GameRoomLogic(storage, limits, () => clock.now, undefined, hooks);
    await room.create(await sha256Hex(TOKEN), clock.now, { code: CODE, roomId: "AAAAAAAAAAAA" });
    const h = new FakeSocket();
    const msg = (s: RoomSocket, m: object) => room.message(s, JSON.stringify({ v: 1, ...m }));
    await msg(h, { ch: "room", kind: "hello", caps: [], token: TOKEN, name: "Hosty", build: BUILD });
    await msg(h, { ch: "room", kind: "lobby-set", settings: { listed: true } });
    await vi.advanceTimersByTimeAsync(10);
    expect(sent).toEqual([]);
    fail = false;
    clock.now += LIVE_PUBLISH_MIN_MS;
    await msg(h, { ch: "room", kind: "lobby-set", seats: [{ id: "s1" }] });
    await vi.advanceTimersByTimeAsync(LIVE_PUBLISH_MIN_MS);
    expect(sent).toEqual([CODE]);
  });
});

describe("the listing after the room hibernated", () => {
  it("a fresh instance over the same storage still removes the entry when the host leaves", async () => {
    const first = await setup();
    const h = await first.host();
    await first.lobbySet(h, { settings: { listed: true } });
    await first.settle();
    expect(upserts(first.calls)).toHaveLength(1);
    // The room is evicted and wakes with no memory of what it published; the host socket then closes.
    const calls: string[] = [];
    const hooks: RoomDirectoryHooks = {
      upsert: async (entry) => void calls.push(`upsert ${entry.code}`),
      remove: async (code) => void calls.push(`remove ${code}`),
    };
    const limits = { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 };
    const woken = new GameRoomLogic(first.storage, limits, () => first.clock.now + 60_000, undefined, hooks);
    woken.restore(h);
    await woken.close(h);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toEqual([`remove ${CODE}`]);
  });

  it("never overlaps two directory calls: a change during a call is sent after it settles", async () => {
    const storage = new MemoryStorage();
    const clock = { now: 1_000 };
    let running = 0;
    let maxRunning = 0;
    const sent: number[] = [];
    const hooks: RoomDirectoryHooks = {
      upsert: async (entry) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 100));
        sent.push(entry.seatsTotal);
        running--;
      },
      remove: async () => {},
    };
    const limits = { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 };
    const room = new GameRoomLogic(storage, limits, () => clock.now, undefined, hooks);
    await room.create(await sha256Hex(TOKEN), clock.now, { code: CODE, roomId: "AAAAAAAAAAAA" });
    const h = new FakeSocket();
    const msg = (m: object) => room.message(h, JSON.stringify({ v: 1, ...m }));
    await msg({ ch: "room", kind: "hello", caps: [], token: TOKEN, name: "Hosty", build: BUILD });
    await msg({ ch: "room", kind: "lobby-set", settings: { listed: true } });
    await vi.advanceTimersByTimeAsync(10);
    clock.now += 50;
    await msg({ ch: "room", kind: "lobby-set", seats: [{ id: "s1" }] });
    await vi.advanceTimersByTimeAsync(LIVE_PUBLISH_MIN_MS + 500);
    expect(maxRunning).toBe(1);
    expect(sent).toEqual([0, 1]);
  });
});
