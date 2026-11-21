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
  clearParticipant() {
    this.attachment = null;
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
    { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024, ...limits },
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
    expect(welcome.tables).toEqual([
      { id: "t1", hostConnected: true, commands: 0, ended: false, hasHeader: false, checkpoint: null },
    ]);
    const w = await hello(undefined, "Ann");
    expect(w.last("welcome")!.you).toMatchObject({ role: "watcher" });
    expect(w.last("welcome")!.you.name).toBeUndefined();
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
    const late = await hello();
    expect(late.kinds().slice(-2)).toEqual(["game:log", "game:end"]);
    expect(late.last("end")).toMatchObject({ outcome: { won: true } });
    expect(storage.alarm).toBe(clock.now + ROOM_END_GRACE_MS);
  });

  it("writes about one row per 20 commands: a frozen chunk when it fills, never rewritten", async () => {
    const { host, start, commands, storage } = await setup();
    const h = await host();
    await start(h);
    const before = storage.rowsWritten;
    for (let i = 0; i < 19; i++) await commands(h, i, [{ c: i }]);
    // The first batch of a table writes the tail row (one row); the rest of the first 19 write nothing more.
    expect(storage.rowsWritten).toBe(before + 1);
    for (let i = 19; i < 100; i++) await commands(h, i, [{ c: i }], i === 39 ? { "40": "sum" } : undefined);
    // 5 chunks, the first batch's tail row, and the delete that drops the tail when the first chunk supersedes it.
    expect(storage.rowsWritten - before).toBe(7);
    expect([...storage.map.keys()].sort()).toEqual([
      "meta",
      "t1:c:000000",
      "t1:c:000001",
      "t1:c:000002",
      "t1:c:000003",
      "t1:c:000004",
      "t1:header",
    ]);
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
      await send(s, { ch: "game", kind: "propose", table: "t1", command: {}, base: 0 });
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
    expect(h.sent.filter((m) => m.kind === "resend")).toHaveLength(0);
    await hello();
    await hello();
    expect(h.sent.filter((m) => m.kind === "resend")).toEqual([
      { v: 1, ch: "game", kind: "resend", table: "t1", from: 0 },
    ]);
  });

  it("does not send a host resend on its hello, and stops asking once the log arrives", async () => {
    const { host, hello, send } = await setup();
    const h = await host();
    expect(h.sent.find((m) => m.kind === "resend")).toBeUndefined();
    expect(h.last("welcome")!.tables[0]).toMatchObject({ hasHeader: false, commands: 0 });
    await send(h, { ch: "game", kind: "log", table: "t1", header: 1, commands: [] });
    const w = await hello();
    expect(h.sent.filter((m) => m.kind === "resend")).toHaveLength(0);
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
    expect((storage.map.get("meta") as { endedAt: number }).endedAt).toBe(clock.now);
    clock.now += ROOM_END_GRACE_MS;
    expect(await room.alarm(clock.now)).toBe("closed");
    expect(w.last("closed")).toMatchObject({ reason: "ended" });
    expect(w.closed).not.toBeNull();
  });

  it("after waking, goes by the stored host stamp, written at most once an hour", async () => {
    const { host, start, commands, storage, clock } = await setup();
    const h = await host();
    await start(h);
    for (let i = 0; i < 10; i++) {
      clock.now += 60_000;
      await commands(h, i, [i]);
    }
    expect((storage.map.get("meta") as { lastHostAt?: number }).lastHostAt).toBeUndefined();
    clock.now += 60 * 60 * 1000;
    await commands(h, 10, [10]);
    const stamp = (storage.map.get("meta") as { lastHostAt: number }).lastHostAt;
    expect(stamp).toBe(clock.now);
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    clock.now = stamp + ROOM_IDLE_MS - 1;
    expect(await woken.alarm(clock.now)).toBe("rescheduled");
    expect(storage.alarm).toBe(stamp + ROOM_IDLE_MS);
    clock.now = stamp + ROOM_IDLE_MS;
    expect(await woken.alarm(clock.now)).toBe("closed");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Review fixes: ended once, replaced sockets, host admission, stored chunks, caps, parts.

const raw = (s: RoomSocket, room: GameRoomLogic, m: unknown) =>
  room.message(s, JSON.stringify({ v: 1, ...(m as object) }));

describe("ending", () => {
  it("writes the end once: a repeated end changes no row and leaves the alarm", async () => {
    const { host, start, send, storage, clock } = await setup();
    const h = await host();
    await start(h);
    await send(h, { ch: "game", kind: "end", table: "t1", outcome: 1 });
    const rows = storage.rowsWritten;
    const alarms = storage.alarmsSet;
    const alarm = storage.alarm;
    clock.now += 60_000;
    for (let i = 0; i < 3; i++) await send(h, { ch: "game", kind: "end", table: "t1", outcome: 2 });
    expect(storage.rowsWritten).toBe(rows);
    expect(storage.alarmsSet).toBe(alarms);
    expect(storage.alarm).toBe(alarm);
    expect((storage.map.get("meta") as { outcome: unknown }).outcome).toBe(1);
  });

  it("refuses a start on an ended table", async () => {
    const { host, start, send } = await setup();
    const h = await host();
    await start(h);
    await send(h, { ch: "game", kind: "end", table: "t1", outcome: 1 });
    await start(h, { again: true });
    expect(h.last("refused")!.reason).toBe("not-allowed");
  });

  it("a rewind that cuts the log reopens an ended table: ended cleared, end alarm replaced by the idle one", async () => {
    const { host, hello, start, commands, send, storage, clock } = await setup();
    const h = await host();
    await start(h);
    await commands(h, 0, [1, 2, 3]);
    const w = await hello();
    await send(h, { ch: "game", kind: "end", table: "t1", outcome: 1 });
    expect(storage.alarm).toBe(clock.now + ROOM_END_GRACE_MS);
    await send(h, { ch: "game", kind: "rewind", table: "t1", to: 2 });
    expect(w.last("table")!.table.ended).toBe(false);
    const meta = storage.map.get("meta") as { ended: boolean; endedAt?: number };
    expect(meta.ended).toBe(false);
    expect(meta.endedAt).toBeUndefined();
    expect(storage.alarm).toBeGreaterThan(clock.now + ROOM_END_GRACE_MS);
    const late = await hello();
    expect(late.kinds()).not.toContain("game:end");
  });

  it("a rewind to the current count reopens an ended table (a resumed host), clearing ended and the end alarm", async () => {
    const { host, hello, start, commands, send, storage, clock } = await setup();
    const h = await host();
    await start(h);
    await commands(h, 0, [1, 2, 3]);
    const w = await hello();
    await send(h, { ch: "game", kind: "end", table: "t1", outcome: null });
    expect(w.last("table")!.table.ended).toBe(true);
    await send(h, { ch: "game", kind: "rewind", table: "t1", to: 3 });
    expect(w.last("table")!.table.ended).toBe(false);
    const meta = storage.map.get("meta") as { ended: boolean; endedAt?: number };
    expect(meta.ended).toBe(false);
    expect(meta.endedAt).toBeUndefined();
    expect(storage.alarm).toBeGreaterThan(clock.now + ROOM_END_GRACE_MS);
    await commands(h, 3, [4]);
    expect(w.last("commands")).toMatchObject({ from: 3 });
    expect((await hello()).last("welcome")!.tables[0]).toMatchObject({ ended: false, commands: 4 });
  });

  it("reports hasHeader in welcome and table updates", async () => {
    const { host, hello, start } = await setup();
    const h = await host();
    expect(h.last("welcome")!.tables[0]!.hasHeader).toBe(false);
    const w = await hello();
    await start(h);
    expect(w.last("table")!.table.hasHeader).toBe(true);
    expect((await hello()).last("welcome")!.tables[0]!.hasHeader).toBe(true);
  });
});

describe("sockets and admission", () => {
  it("refuses and closes a socket whose participant the room does not know (a replaced host still closing)", async () => {
    const { host, room } = await setup();
    const first = await host();
    const stale = new FakeSocket();
    stale.attachment = first.attachment;
    await host();
    await raw(stale, room, { ch: "game", kind: "start", table: "t1", header: 1 });
    expect(stale.last("refused")!.reason).toBe("not-allowed");
    expect(stale.closed).not.toBeNull();
    expect(room.logLength()).toBe(0);
    // The replaced socket's attachment was cleared, so a wake would not restore it as a second host.
    expect(first.attachment).toBeNull();
  });

  it("always admits a valid host token even when the room is full of watchers", async () => {
    const { hello, host } = await setup({ maxParticipants: 3 });
    await hello();
    await hello();
    await hello();
    const h = await host();
    expect(h.last("welcome")!.you.role).toBe("host");
  });

  it("holds non-hosts to the ordinary size cap before parsing, and closes after a few refusals", async () => {
    const { hello, room } = await setup({ maxMessageBytes: 100 });
    const w = await hello();
    for (let i = 0; i < 5; i++) await room.message(w, "{" + "x".repeat(500));
    expect(w.sent.filter((m) => m.kind === "refused" && m.reason === "too-large")).toHaveLength(5);
    expect(w.closed).toEqual({ code: 1008, reason: "too many refusals" });
  });

  it("does not count out-of-order against a host", async () => {
    const { host, start, commands } = await setup();
    const h = await host();
    await start(h);
    for (let i = 0; i < 8; i++) await commands(h, 50, [1]);
    expect(h.closed).toBeNull();
  });

  it("rejects checksums whose keys are not command counts", async () => {
    const { host, start, room } = await setup();
    const h = await host();
    await start(h);
    await room.message(
      h,
      '{"v":1,"ch":"game","kind":"commands","table":"t1","from":0,"commands":[1],"checksums":{"__proto__":"x"}}',
    );
    expect(h.last("refused")!.reason).toBe("bad-message");
    expect(room.logLength()).toBe(0);
  });
});

describe("stored log and waking", () => {
  it("a woken room loads header and chunks, asks for the tail from the stored count, and takes it", async () => {
    const { storage, clock, host, hello, start, commands } = await setup();
    const h = await host();
    await start(h, { h: 1 });
    for (let i = 0; i < 45; i++) await commands(h, i, [{ c: i }], i === 29 ? { "30": "s30" } : undefined);
    const w = await hello();
    // Evicted: a new object over the same storage, its live sockets restored from their attachments.
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    woken.restore(h);
    woken.restore(w);
    h.sent.length = 0;
    const w2 = new FakeSocket();
    await woken.message(w2, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [] }));
    expect(w2.last("welcome")!.tables[0]).toMatchObject({ commands: 40, hasHeader: true });
    expect(w2.last("log")).toMatchObject({ header: { h: 1 }, checksums: { "30": "s30" } });
    expect((w2.last("log") as unknown as { commands: unknown[] }).commands).toHaveLength(40);
    expect(h.sent.filter((m) => m.kind === "resend")).toEqual([
      { v: 1, ch: "game", kind: "resend", table: "t1", from: 40 },
    ]);
    // The host answers with the tail as an ordinary batch.
    await woken.message(
      h,
      JSON.stringify({ v: 1, ch: "game", kind: "commands", table: "t1", from: 40, commands: [40, 41, 42, 43, 44] }),
    );
    expect(woken.logLength()).toBe(45);
    expect(h.last("refused")).toBeUndefined();
    expect(w2.last("commands")).toMatchObject({ from: 40 });
  });

  it("a woken room whose host sends the next batch out of line refuses and asks from the stored count", async () => {
    const { storage, clock, host, start, commands } = await setup();
    const h = await host();
    await start(h);
    for (let i = 0; i < 25; i++) await commands(h, i, [i]);
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    woken.restore(h);
    h.sent.length = 0;
    await woken.message(
      h,
      JSON.stringify({ v: 1, ch: "game", kind: "commands", table: "t1", from: 25, commands: [25] }),
    );
    expect(h.kinds()).toEqual(["room:refused", "game:resend"]);
    expect(h.last("resend")).toMatchObject({ from: 20 });
  });

  it("a rewind deletes the chunks past the cut", async () => {
    const { host, start, commands, send, storage, room } = await setup();
    const h = await host();
    await start(h);
    for (let i = 0; i < 70; i++) await commands(h, i, [i], i === 59 ? { "60": "s" } : undefined);
    expect([...storage.map.keys()].filter((k) => k.includes(":c:"))).toHaveLength(3);
    await send(h, { ch: "game", kind: "rewind", table: "t1", to: 45 });
    expect([...storage.map.keys()].filter((k) => k.includes(":c:")).sort()).toEqual(["t1:c:000000", "t1:c:000001"]);
    expect(room.logLength()).toBe(45);
    expect(room.checksums()).toEqual({});
    await commands(
      h,
      45,
      Array.from({ length: 15 }, (_, i) => i),
    );
    expect([...storage.map.keys()].filter((k) => k.includes(":c:"))).toHaveLength(3);
  });

  it("a log replaces the stored chunks", async () => {
    const { host, start, commands, send, storage } = await setup();
    const h = await host();
    await start(h);
    for (let i = 0; i < 60; i++) await commands(h, i, [i]);
    await send(h, {
      ch: "game",
      kind: "log",
      table: "t1",
      header: 2,
      commands: Array.from({ length: 21 }, (_, i) => i),
    });
    expect([...storage.map.keys()].filter((k) => k.includes(":c:"))).toEqual(["t1:c:000000"]);
    expect(storage.map.get("t1:header")).toEqual({ h: 2 });
  });

  it("keeps ended and the outcome across a wake", async () => {
    const { storage, clock, host, start, send } = await setup();
    const h = await host();
    await start(h);
    await send(h, { ch: "game", kind: "end", table: "t1", outcome: { won: true } });
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    const w = new FakeSocket();
    await woken.message(w, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [] }));
    expect(w.last("welcome")!.tables[0]).toMatchObject({ ended: true });
    expect(w.last("end")).toMatchObject({ outcome: { won: true } });
  });
});

describe("the log cap and parts", () => {
  it("refuses commands past the cap with too-large and ends the table for watchers", async () => {
    const { host, hello, start, commands, room } = await setup({ maxLogBytes: 1000 });
    const h = await host();
    await start(h);
    const w = await hello();
    await commands(h, 0, ["a".repeat(600)]);
    await commands(h, 1, ["b".repeat(600)]);
    expect(h.last("refused")!.reason).toBe("too-large");
    expect(room.logLength()).toBe(1);
    expect(w.last("end")).toBeDefined();
    expect(w.last("table")!.table.ended).toBe(true);
    await commands(h, 1, ["c"]);
    expect(h.last("refused")!.reason).toBe("too-large");
  });

  it("sends a joining watcher a log of about 512 KiB, then commands batches, so no message nears 1 MiB", async () => {
    const { host, hello, start, commands } = await setup({ maxLogBytes: 100 * 1024 * 1024 });
    const h = await host();
    await start(h, { small: true });
    const big = "x".repeat(40 * 1024);
    for (let i = 0; i < 40; i++) await commands(h, i, [big]);
    const w = await hello();
    const parts = w.sent.filter((m) => m.ch === "game") as unknown as {
      kind: string;
      from?: number;
      commands: unknown[];
    }[];
    expect(parts[0]!.kind).toBe("log");
    expect(parts.slice(1).every((m) => m.kind === "commands")).toBe(true);
    expect(parts.length).toBeGreaterThan(2);
    let next = 0;
    for (const m of parts) {
      if (m.kind === "commands") expect(m.from).toBe(next);
      next += m.commands.length;
      expect(JSON.stringify(m).length).toBeLessThan(600 * 1024);
    }
    expect(next).toBe(40);
  });
});

describe("the tail row on host disconnect", () => {
  async function playedTo(count: number) {
    const ctx = await setup();
    const h = await ctx.host();
    await ctx.start(h, { h: 1 });
    for (let i = 0; i < count; i++) await ctx.commands(h, i, [{ c: i }], i === 41 ? { "42": "s42" } : undefined);
    return { ...ctx, h };
  }

  it("writes the unfinished tail with its checksums in one row per disconnect, overwritten each time", async () => {
    const { room, h, storage, host } = await playedTo(45);
    const rows = storage.rowsWritten;
    await room.close(h);
    expect(storage.rowsWritten - rows).toBe(1);
    const tail = storage.map.get("t1:tail") as { commands: unknown[]; checksums: Record<string, string> };
    expect(tail.commands).toHaveLength(5);
    expect(tail.checksums).toEqual({ "42": "s42" });
    // A replaced host writes it too, and a later disconnect overwrites the same row.
    const again = await host();
    const second = await host();
    expect(again.closed?.reason).toBe("replaced");
    expect(storage.map.get("t1:tail")).toEqual(tail);
    await room.close(second);
    expect([...storage.map.keys()].filter((k) => k.endsWith(":tail"))).toEqual(["t1:tail"]);
  });

  it("writes nothing when the log ends exactly on a chunk, and a stale tail row is dropped", async () => {
    const { room, h, storage } = await playedTo(40);
    const rows = storage.rowsWritten;
    await room.close(h);
    expect(storage.rowsWritten).toBe(rows);
    expect(storage.map.has("t1:tail")).toBe(false);
  });

  it("a woken room loads the tail with the chunks, so a watcher gets the whole log, and asks from the full count", async () => {
    const { room, h, storage, clock } = await playedTo(45);
    await room.close(h);
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    const w = new FakeSocket();
    await woken.message(w, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [] }));
    expect(w.last("welcome")!.tables[0]).toMatchObject({ commands: 45, hasHeader: true });
    expect(w.last("log")).toMatchObject({ checksums: { "42": "s42" } });
    expect((w.last("log") as unknown as { commands: unknown[] }).commands).toHaveLength(45);
    // The host comes back: its welcome says 45, so it needs no resend, and its next batch continues the log.
    const back = new FakeSocket();
    await woken.message(back, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [], token: TOKEN }));
    expect(back.last("welcome")!.tables[0]).toMatchObject({ commands: 45, hasHeader: true });
    expect(back.sent.find((m) => m.kind === "resend")).toBeUndefined();
    await woken.message(
      back,
      JSON.stringify({ v: 1, ch: "game", kind: "commands", table: "t1", from: 45, commands: [45] }),
    );
    expect(woken.logLength()).toBe(46);
  });

  it("is deleted when a frozen chunk supersedes it", async () => {
    const { room, h, storage, host, commands } = await playedTo(45);
    await room.close(h);
    expect(storage.map.has("t1:tail")).toBe(true);
    const back = await host();
    await commands(
      back,
      45,
      Array.from({ length: 15 }, (_, i) => i),
    );
    expect(storage.map.has("t1:tail")).toBe(false);
    expect(storage.map.has("t1:c:000002")).toBe(true);
  });

  it("is rewritten by a rewind that leaves some of it, deleted by one that leaves none, and by a log that replaces the table", async () => {
    const { room, h, storage, host, send } = await playedTo(45);
    await room.close(h);
    const back = await host();
    await send(back, { ch: "game", kind: "rewind", table: "t1", to: 43 });
    expect((storage.map.get("t1:tail") as { commands: unknown[] }).commands).toHaveLength(3);
    await send(back, { ch: "game", kind: "rewind", table: "t1", to: 40 });
    expect(storage.map.has("t1:tail")).toBe(false);
    await send(back, { ch: "game", kind: "commands", table: "t1", from: 40, commands: [1] });
    await room.close(back);
    expect(storage.map.has("t1:tail")).toBe(true);
    const again = await host();
    await send(again, { ch: "game", kind: "log", table: "t1", header: 2, commands: [1, 2] });
    expect(storage.map.has("t1:tail")).toBe(false);
  });
});

describe("the tail row while the host streams, at the end, and after a wake", () => {
  it("refreshes the tail row when a batch arrives more than 60 s after it was last written, not before", async () => {
    const { host, start, commands, storage, clock } = await setup();
    const h = await host();
    await start(h);
    await commands(h, 0, [0, 1, 2]);
    // The first batch of a table writes the tail at once.
    expect((storage.map.get("t1:tail") as { commands: unknown[] }).commands).toEqual([0, 1, 2]);
    clock.now += 59_000;
    await commands(h, 3, [3]);
    expect((storage.map.get("t1:tail") as { commands: unknown[] }).commands).toEqual([0, 1, 2]);
    clock.now += 2_000;
    await commands(h, 4, [4]);
    expect((storage.map.get("t1:tail") as { commands: unknown[] }).commands).toEqual([0, 1, 2, 3, 4]);
    const rows = storage.rowsWritten;
    clock.now += 30_000;
    await commands(h, 5, [5]);
    expect(storage.rowsWritten).toBe(rows);
    clock.now += 31_000;
    await commands(h, 6, [6]);
    expect((storage.map.get("t1:tail") as { commands: unknown[] }).commands).toHaveLength(7);
  });

  it("writes the tail with the end, so a game whose host never returns is whole", async () => {
    const { host, start, commands, send, storage, clock } = await setup();
    const h = await host();
    await start(h);
    await commands(h, 0, [0, 1, 2]);
    await send(h, { ch: "game", kind: "end", table: "t1", outcome: { won: true } });
    expect((storage.map.get("t1:tail") as { commands: unknown[] }).commands).toEqual([0, 1, 2]);
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    const w = new FakeSocket();
    await woken.message(w, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [] }));
    expect((w.last("log") as unknown as { commands: unknown[] }).commands).toHaveLength(3);
    expect(w.last("end")).toMatchObject({ outcome: { won: true } });
  });

  it("commands in the first minute, then hibernation, then a host close: watchers still get the first batch", async () => {
    const { host, start, commands, storage, clock } = await setup();
    const h = await host();
    await start(h);
    await commands(h, 0, [0, 1, 2]);
    clock.now += 5_000;
    // The room hibernates and is rebuilt; the host's close is the first thing it sees.
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    woken.restore(h);
    await woken.close(h);
    const w = new FakeSocket();
    await woken.message(w, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [] }));
    expect((w.last("log") as unknown as { commands: unknown[] }).commands).toHaveLength(3);
  });

  it("a host close as the first event of a woken room does not overwrite the stored tail", async () => {
    const { host, start, commands, storage, clock } = await setup();
    const h = await host();
    await start(h);
    for (let i = 0; i < 25; i++) await commands(h, i, [i]);
    clock.now += 61_000;
    await commands(h, 25, [25]);
    const stored = structuredClone(storage.map.get("t1:tail"));
    expect((stored as { commands: unknown[] }).commands).toHaveLength(6);
    // The room hibernates and is rebuilt; the host's close is the first thing it sees.
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    woken.restore(h);
    const rows = storage.rowsWritten;
    await woken.close(h);
    expect(storage.rowsWritten).toBe(rows);
    expect(storage.map.get("t1:tail")).toEqual(stored);
    const w = new FakeSocket();
    await woken.message(w, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [] }));
    expect(w.last("welcome")!.tables[0]).toMatchObject({ commands: 26, hostConnected: false });
    expect((w.last("log") as unknown as { commands: unknown[] }).commands).toHaveLength(26);
  });
});

describe("an Undo after a wake", () => {
  type Msg = { kind: string; from?: number; to?: number; commands?: unknown[] };

  /** What a watcher ends up holding: it follows log, rewind and commands the way the viewer does. */
  function view(sent: ServerMessage[]): unknown[] {
    let held: unknown[] = [];
    for (const m of sent as unknown as Msg[]) {
      if (m.kind === "log") held = [...(m.commands ?? [])];
      else if (m.kind === "rewind") held.length = Math.min(held.length, m.to!);
      else if (m.kind === "commands") {
        if (m.from! !== held.length) throw new Error("gap or overlap: " + m.from + " vs " + held.length);
        held.push(...m.commands!);
      }
    }
    return held;
  }

  it("a woken room that missed the undone commands rewinds its watchers before the host's batch re-appends", async () => {
    const { storage, clock, host, hello, start, commands } = await setup();
    const h = await host();
    await start(h);
    for (let i = 0; i < 25; i++) await commands(h, i, [`c${i}`]);
    const w = await hello();
    expect(view(w.sent)).toHaveLength(25);
    // The room hibernates with chunk 0 only stored (the tail of 5 was in memory); the sockets survive.
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    woken.restore(h);
    woken.restore(w);
    h.sent.length = 0;
    const msg = (m: unknown) => JSON.stringify({ v: 1, ...(m as object) });
    // Undo to 24: the room holds only 20, so the rewind is refused and the host is asked from 20.
    await woken.message(h, msg({ ch: "game", kind: "rewind", table: "t1", to: 24 }));
    expect(h.kinds()).toEqual(["room:refused", "game:resend"]);
    expect(h.last("resend")).toMatchObject({ from: 20 });
    // The host answers from 20 with c20..c23 and the new 25th command.
    await woken.message(
      h,
      msg({ ch: "game", kind: "commands", table: "t1", from: 20, commands: ["c20", "c21", "c22", "c23", "c25b"] }),
    );
    expect(view(w.sent)).toEqual([...Array.from({ length: 24 }, (_, i) => `c${i}`), "c25b"]);
    expect(woken.logLength()).toBe(25);
    // Only the first batch after a load is preceded by a rewind.
    const before = w.sent.length;
    await woken.message(h, msg({ ch: "game", kind: "commands", table: "t1", from: 25, commands: ["c26"] }));
    expect(w.sent.slice(before).map((m) => m.kind)).toEqual(["commands", "table"]);
  });
});

describe("a rewind across a chunk boundary, and the baseline checksum", () => {
  it("stores what remains of the cut chunk as the new tail, so an evicted room serves it", async () => {
    const { host, start, commands, send, storage, clock } = await setup();
    const h = await host();
    await start(h);
    for (let i = 0; i < 39; i++) await commands(h, i, [i], i === 21 ? { "22": "s22" } : undefined);
    await send(h, { ch: "game", kind: "rewind", table: "t1", to: 25 });
    expect([...storage.map.keys()].filter((k) => k.includes(":c:"))).toEqual(["t1:c:000000"]);
    const tail = storage.map.get("t1:tail") as { commands: unknown[]; checksums: Record<string, string> };
    expect(tail.commands).toEqual([20, 21, 22, 23, 24]);
    expect(tail.checksums).toEqual({ "22": "s22" });
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    const w = new FakeSocket();
    await woken.message(w, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [] }));
    expect(w.last("welcome")!.tables[0]).toMatchObject({ commands: 25 });
    const log = w.last("log") as unknown as { commands: unknown[]; checksums: Record<string, string> };
    expect(log.commands).toHaveLength(25);
    expect(log.checksums).toEqual({ "22": "s22" });
  });

  it("sends and stores the baseline checksum keyed 0 with the first commands", async () => {
    const { host, hello, start, commands, storage } = await setup();
    const h = await host();
    await start(h);
    await commands(
      h,
      0,
      Array.from({ length: 12 }, (_, i) => i),
      { "0": "base", "10": "s10" },
    );
    const w = await hello();
    expect(w.last("log")).toMatchObject({ checksums: { "0": "base", "10": "s10" } });
    await commands(
      h,
      12,
      Array.from({ length: 10 }, (_, i) => i),
    );
    expect((storage.map.get("t1:c:000000") as { checksums: Record<string, string> }).checksums).toEqual({
      "0": "base",
      "10": "s10",
    });
    const late = await hello();
    expect(late.last("log")).toMatchObject({ checksums: { "0": "base", "10": "s10" } });
  });
});
