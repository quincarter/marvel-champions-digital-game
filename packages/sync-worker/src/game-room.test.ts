import { describe, expect, it } from "vitest";
import { GameRoomLogic, ROOM_CAPS, sha256Hex, type GameRoomLimits, type RoomSocket } from "./game-room.js";
import {
  MAX_LOG_BYTES,
  ROOM_END_GRACE_MS,
  ROOM_IDLE_MS,
  type Participant,
  type ServerMessage,
} from "./room-protocol.js";
import { MemoryStorage } from "./test-support.js";

const TOKEN = "T".repeat(32);

class FakeSocket implements RoomSocket {
  readonly sent: ServerMessage[] = [];
  closed: { code: number | undefined; reason: string | undefined } | null = null;
  attachment: Participant | null = null;
  send(text: string) {
    this.sent.push(JSON.parse(text) as ServerMessage);
  }
  close(code?: number, reason?: string) {
    this.closed = { code, reason };
  }
  getParticipant() {
    return this.attachment;
  }
  setParticipant(p: Participant) {
    this.attachment = p;
  }
  kinds() {
    return this.sent.map((m) => `${m.ch}:${m.kind}`);
  }
  last<K extends string>(kind: K) {
    return [...this.sent].reverse().find((m) => m.kind === kind) as Extract<ServerMessage, { kind: K }> | undefined;
  }
}

async function setup(limits?: Partial<GameRoomLimits>) {
  const storage = new MemoryStorage();
  const clock = { now: 1_000 };
  const room = new GameRoomLogic(
    storage,
    { maxParticipants: 25, maxMessageBytes: 64 * 1024, ...limits },
    () => clock.now,
  );
  await room.create(await sha256Hex(TOKEN), clock.now);
  const send = (s: RoomSocket, m: unknown) => room.message(s, JSON.stringify({ v: 1, ...(m as object) }));
  const hello = async (token?: string, name?: string) => {
    const s = new FakeSocket();
    await send(s, {
      ch: "room",
      kind: "hello",
      caps: ["watch"],
      ...(token ? { token } : {}),
      ...(name ? { name } : {}),
    });
    return s;
  };
  const host = () => hello(TOKEN);
  const start = (s: RoomSocket, header: unknown = { h: 1 }) =>
    send(s, { ch: "game", kind: "start", table: "t1", header });
  const commands = (s: RoomSocket, from: number, cmds: unknown[], checksums?: Record<string, string>) =>
    send(s, { ch: "game", kind: "commands", table: "t1", from, commands: cmds, ...(checksums ? { checksums } : {}) });
  return { storage, clock, room, send, hello, host, start, commands };
}

describe("creating and joining", () => {
  it("stores one row with only the token hash and createdAt, and an idle alarm", async () => {
    const { storage, clock } = await setup();
    expect([...storage.map.keys()]).toEqual(["meta"]);
    expect(storage.map.get("meta")).toEqual({ hostTokenHash: await sha256Hex(TOKEN), createdAt: clock.now });
    expect(JSON.stringify([...storage.map.values()])).not.toContain(TOKEN);
    expect(storage.alarm).toBe(clock.now + ROOM_IDLE_MS);
  });

  it("refuses a second create of the same room", async () => {
    const { room } = await setup();
    expect(await room.create("other", 5)).toBe(false);
  });

  it("answers hello with welcome: the caps, the roster and the table; the host token makes a host", async () => {
    const { host, hello } = await setup();
    const h = await host();
    const welcome = h.last("welcome")!;
    expect(welcome.caps).toEqual(ROOM_CAPS);
    expect(welcome.caps).toEqual(["watch"]);
    expect(welcome.you).toMatchObject({ role: "host", table: "t1" });
    expect(welcome.tables).toEqual([{ id: "t1", hostConnected: true, commands: 0, ended: false }]);
    const w = await hello(undefined, "Ann");
    expect(w.last("welcome")!.you).toMatchObject({ role: "watcher", name: "Ann" });
    expect(w.last("welcome")!.you.table).toBeUndefined();
  });

  it("makes a watcher of a wrong token", async () => {
    const { hello } = await setup();
    const w = await hello("X".repeat(32));
    expect(w.last("welcome")!.you.role).toBe("watcher");
  });

  it("refuses game messages before hello and a second hello", async () => {
    const { send, host } = await setup();
    const s = new FakeSocket();
    await send(s, { ch: "game", kind: "end", table: "t1", outcome: 1 });
    expect(s.last("refused")!.reason).toBe("bad-message");
    const h = await host();
    await send(h, { ch: "room", kind: "hello", caps: [] });
    expect(h.last("refused")!.reason).toBe("bad-message");
  });

  it("refuses text it cannot read", async () => {
    const { room } = await setup();
    const s = new FakeSocket();
    await room.message(s, "not json");
    await room.message(s, new ArrayBuffer(2));
    expect(s.sent.map((m) => (m as { reason: string }).reason)).toEqual(["bad-message", "bad-message"]);
  });
});

describe("roster, host replacement and leaving", () => {
  it("broadcasts the roster with the watcher count on join and leave", async () => {
    const { host, hello, room } = await setup();
    const h = await host();
    const w1 = await hello();
    const w2 = await hello();
    expect(h.last("roster")!.watchers).toBe(2);
    expect(h.last("roster")!.participants).toHaveLength(3);
    room.close(w1);
    expect(h.last("roster")!.watchers).toBe(1);
    expect(w2.last("roster")!.watchers).toBe(1);
  });

  it("lets a second host socket replace the first, which is closed", async () => {
    const { host, hello, room } = await setup();
    const first = await host();
    const w = await hello();
    const second = await host();
    expect(first.closed).toEqual({ code: 4000, reason: "replaced" });
    expect(second.last("welcome")!.you.role).toBe("host");
    expect(w.last("roster")!.participants.filter((p) => p.role === "host")).toHaveLength(1);
    // The replaced socket's close event changes nothing: the table still has its host.
    const before = w.sent.length;
    room.close(first);
    expect(w.sent.length).toBe(before);
    expect(w.last("table")!.table.hostConnected).toBe(true);
  });

  it("reports hostConnected false when the host leaves", async () => {
    const { host, hello, room } = await setup();
    const h = await host();
    const w = await hello();
    room.close(h);
    expect(w.last("table")!.table.hostConnected).toBe(false);
    expect(w.last("roster")!.participants.map((p) => p.role)).toEqual(["watcher"]);
  });

  it("caps participants: refused full, then closed; a returning host still gets in when full", async () => {
    const { hello, host, room } = await setup({ maxParticipants: 2 });
    const h = await host();
    await hello();
    const third = await hello();
    expect(third.last("refused")!.reason).toBe("full");
    expect(third.closed).not.toBeNull();
    expect(room.participantCount).toBe(2);
    const again = await host();
    expect(again.last("welcome")!.you.role).toBe("host");
    expect(h.closed?.reason).toBe("replaced");
  });
});

describe("the table log", () => {
  it("start gives watchers the log, and a joining watcher gets it too", async () => {
    const { host, hello, start, commands } = await setup();
    const h = await host();
    const w = await hello();
    await start(h, { h: "x" });
    expect(w.last("log")).toMatchObject({ table: "t1", header: { h: "x" }, commands: [], checksums: {} });
    await commands(h, 0, [{ c: 1 }, { c: 2 }], { "2": "abc" });
    const late = await hello();
    expect(late.last("log")).toMatchObject({ commands: [{ c: 1 }, { c: 2 }], checksums: { "2": "abc" } });
    expect(late.kinds().indexOf("game:log")).toBeGreaterThan(late.kinds().indexOf("room:welcome"));
  });

  it("appends commands in order, merges checksums, broadcasts to watchers and a table update to all", async () => {
    const { host, hello, start, commands, room } = await setup();
    const h = await host();
    await start(h);
    const w = await hello();
    await commands(h, 0, [{ c: 1 }], { "1": "a" });
    await commands(h, 1, [{ c: 2 }], { "2": "b" });
    expect(room.logLength()).toBe(2);
    expect(room.checksums()).toEqual({ "1": "a", "2": "b" });
    const got = w.sent.filter((m) => m.kind === "commands");
    expect(got).toMatchObject([
      { from: 0, commands: [{ c: 1 }], checksums: { "1": "a" } },
      { from: 1, commands: [{ c: 2 }] },
    ]);
    expect(h.sent.some((m) => m.kind === "commands")).toBe(false);
    expect(w.last("table")!.table.commands).toBe(2);
    expect(h.last("table")!.table.commands).toBe(2);
  });

  it("refuses a batch that does not continue the log, and asks the host to resend", async () => {
    const { host, hello, start, commands, room } = await setup();
    const h = await host();
    await start(h);
    const w = await hello();
    await commands(h, 0, [{ c: 1 }]);
    h.sent.length = 0;
    await commands(h, 5, [{ c: 9 }]);
    expect(h.kinds()).toEqual(["room:refused", "game:resend"]);
    expect(h.last("refused")!.reason).toBe("out-of-order");
    expect(room.logLength()).toBe(1);
    expect(w.sent.filter((m) => m.kind === "commands")).toHaveLength(1);
    // Also a repeat of a batch already taken.
    await commands(h, 0, [{ c: 1 }]);
    expect(h.last("refused")!.reason).toBe("out-of-order");
  });

  it("refuses commands before any start", async () => {
    const { host, commands } = await setup();
    const h = await host();
    await commands(h, 0, [1]);
    expect(h.last("refused")!.reason).toBe("out-of-order");
  });

  it("rewind truncates, drops checksums past it and tells watchers", async () => {
    const { host, hello, start, commands, room, send } = await setup();
    const h = await host();
    await start(h);
    await commands(h, 0, [1, 2, 3, 4], { "2": "a", "4": "b" });
    const w = await hello();
    await send(h, { ch: "game", kind: "rewind", table: "t1", to: 3 });
    expect(room.logLength()).toBe(3);
    expect(room.checksums()).toEqual({ "2": "a" });
    expect(w.last("rewind")).toMatchObject({ table: "t1", to: 3 });
    await send(h, { ch: "game", kind: "rewind", table: "t1", to: 9 });
    expect(h.last("refused")!.reason).toBe("out-of-order");
    await commands(h, 3, [7]);
    expect(room.logLength()).toBe(4);
  });

  it("log from the host replaces the table's log and goes to watchers as log", async () => {
    const { host, hello, start, commands, room, send } = await setup();
    const h = await host();
    await start(h);
    await commands(h, 0, [1, 2], { "2": "a" });
    const w = await hello();
    await send(h, {
      ch: "game",
      kind: "log",
      table: "t1",
      header: { h: 2 },
      commands: [9, 8, 7],
      checksums: { "3": "z" },
    });
    expect(room.logLength()).toBe(3);
    expect(room.checksums()).toEqual({ "3": "z" });
    expect(w.last("log")).toMatchObject({ header: { h: 2 }, commands: [9, 8, 7], checksums: { "3": "z" } });
  });

  it("end broadcasts the outcome, marks the table ended and includes it in the log for later watchers", async () => {
    const { host, hello, start, send, storage, clock } = await setup();
    const h = await host();
    await start(h);
    const w = await hello();
    await send(h, { ch: "game", kind: "end", table: "t1", outcome: { won: true } });
    expect(w.last("end")).toMatchObject({ table: "t1", outcome: { won: true } });
    expect(w.last("table")!.table.ended).toBe(true);
    expect((await hello()).last("log")).toMatchObject({ outcome: { won: true } });
    expect(storage.alarm).toBe(clock.now + ROOM_END_GRACE_MS);
  });

  it("writes no storage row per command", async () => {
    const { host, start, commands, storage } = await setup();
    const h = await host();
    await start(h);
    const before = storage.rowsWritten;
    for (let i = 0; i < 20; i++) await commands(h, i, [{ c: i }]);
    expect(storage.rowsWritten).toBe(before);
  });
});

describe("who may send", () => {
  it("refuses game messages from watchers and the host's messages for another table", async () => {
    const { hello, host, room, send, start } = await setup();
    const h = await host();
    await start(h);
    const w = await hello();
    for (const m of [
      { ch: "game", kind: "start", table: "t1", header: 1 },
      { ch: "game", kind: "commands", table: "t1", from: 0, commands: [1] },
      { ch: "game", kind: "rewind", table: "t1", to: 0 },
      { ch: "game", kind: "log", table: "t1", header: 1, commands: [] },
      { ch: "game", kind: "end", table: "t1", outcome: 1 },
    ]) {
      await send(w, m);
      expect(w.last("refused")!.reason).toBe("not-allowed");
    }
    expect(room.logLength()).toBe(0);
    await send(h, { ch: "game", kind: "commands", table: "t2", from: 0, commands: [] });
    expect(h.last("refused")!.reason).toBe("not-allowed");
  });

  it("answers propose and say with not-allowed for now, even from the host", async () => {
    const { host, hello, send } = await setup();
    for (const s of [await host(), await hello()]) {
      await send(s, { ch: "game", kind: "propose", table: "t1", command: {} });
      expect(s.last("refused")!.reason).toBe("not-allowed");
      await send(s, { ch: "chat", kind: "say", text: "hi" });
      expect(s.last("refused")!.reason).toBe("not-allowed");
    }
  });
});

describe("sizes", () => {
  it("refuses an oversized ordinary message but accepts a big start or log", async () => {
    const { host, send, start, commands, room } = await setup({ maxMessageBytes: 200 });
    const h = await host();
    await start(h, "x".repeat(5000));
    expect(h.last("refused")).toBeUndefined();
    await commands(h, 0, ["y".repeat(500)]);
    expect(h.last("refused")!.reason).toBe("too-large");
    expect(room.logLength()).toBe(0);
    await send(h, { ch: "game", kind: "log", table: "t1", header: 1, commands: ["z".repeat(5000)] });
    expect(room.logLength()).toBe(1);
  });

  it("refuses anything past the log cap without reading it", async () => {
    const { host, room } = await setup();
    const h = await host();
    await room.message(h, "x".repeat(MAX_LOG_BYTES + 1));
    expect(h.last("refused")!.reason).toBe("too-large");
  });
});

describe("resend after waking empty", () => {
  it("asks a host once per gap, not again for each watcher who joins an empty table", async () => {
    const { host, hello } = await setup();
    const h = await host();
    h.sent.length = 0;
    await hello();
    await hello();
    expect(h.sent.filter((m) => m.kind === "resend")).toHaveLength(0);
  });

  it("asks a host that joins a room with no log, and stops once the log arrives", async () => {
    const { host, hello, send } = await setup();
    const h = await host();
    expect(h.kinds()).toContain("game:resend");
    await send(h, { ch: "game", kind: "log", table: "t1", header: 1, commands: [] });
    const w = await hello();
    expect(h.sent.filter((m) => m.kind === "resend")).toHaveLength(1);
    expect(w.last("log")).toBeDefined();
  });

  it("rebuilds participants from socket attachments after hibernation and then resends", async () => {
    const { storage, clock, host, hello } = await setup();
    const h = await host();
    const w = await hello();
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    woken.restore(h);
    woken.restore(w);
    expect(woken.participantCount).toBe(2);
    h.sent.length = 0;
    const w2 = new FakeSocket();
    await woken.message(w2, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [] }));
    expect(h.sent.filter((m) => m.kind === "resend")).toHaveLength(1);
    // The restored host can send; the restored watcher cannot.
    await woken.message(h, JSON.stringify({ v: 1, ch: "game", kind: "start", table: "t1", header: 1 }));
    expect(w.last("log")).toBeDefined();
    await woken.message(w, JSON.stringify({ v: 1, ch: "game", kind: "end", table: "t1", outcome: 1 }));
    expect(w.last("refused")!.reason).toBe("not-allowed");
  });
});

describe("closing", () => {
  it("closes 12 hours after the last host message, sending closed first and forgetting the room", async () => {
    const { host, hello, room, storage, clock, start } = await setup();
    const h = await host();
    const w = await hello();
    clock.now += ROOM_IDLE_MS - 1000;
    await start(h);
    clock.now += 1000;
    expect(await room.alarm(clock.now)).toBe("rescheduled");
    expect(storage.alarm).toBe(clock.now - 1000 + ROOM_IDLE_MS);
    clock.now = storage.alarm!;
    expect(await room.alarm(clock.now)).toBe("closed");
    expect(w.last("closed")).toMatchObject({ reason: "idle" });
    expect(w.kinds().at(-1)).toBe("room:closed");
    expect(w.closed).not.toBeNull();
    expect(h.closed).not.toBeNull();
    expect(storage.map.size).toBe(0);
    expect(await room.exists()).toBe(false);
  });

  it("closes 5 minutes after every table ended", async () => {
    const { host, hello, room, storage, clock, start, send } = await setup();
    const h = await host();
    const w = await hello();
    await start(h);
    await send(h, { ch: "game", kind: "end", table: "t1", outcome: 1 });
    expect(storage.map.get("endedAt")).toBe(clock.now);
    clock.now += ROOM_END_GRACE_MS;
    expect(await room.alarm(clock.now)).toBe("closed");
    expect(w.last("closed")).toMatchObject({ reason: "ended" });
    expect(w.closed).not.toBeNull();
  });

  it("after waking, counts a connected host as active and lets a hostless room expire", async () => {
    const { host, storage, clock } = await setup();
    const h = await host();
    clock.now += ROOM_IDLE_MS;
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    woken.restore(h);
    expect(await woken.alarm(clock.now)).toBe("rescheduled");
    const empty = new GameRoomLogic(storage, undefined, () => clock.now);
    expect(await empty.alarm(clock.now)).toBe("closed");
  });
});
