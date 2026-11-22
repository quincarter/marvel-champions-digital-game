import { describe, expect, it } from "vitest";
import { GameRoomLogic, sha256Hex, type RoomSocket } from "./game-room.js";
import {
  MAX_POD_EVENT_BYTES,
  POD_BURST,
  ROOM_CHUNK_COMMANDS,
  ROOM_END_GRACE_MS,
  type Participant,
  type RoomBuild,
  type ServerMessage,
} from "./room-protocol.js";
import { MemoryStorage } from "./test-support.js";

const TOKEN = "T".repeat(32);
const BUILD: RoomBuild = { appVersion: "1.2.3", contentVersion: "c9" };

class FakeSocket implements RoomSocket {
  readonly sent: ServerMessage[] = [];
  attachment: Participant | null = null;
  closed: number | undefined;
  send(text: string) {
    this.sent.push(JSON.parse(text) as ServerMessage);
  }
  close(code?: number) {
    this.closed = code;
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
  of<K extends string>(kind: K) {
    return this.sent.filter((m) => m.kind === kind) as Extract<ServerMessage, { kind: K }>[];
  }
  last<K extends string>(kind: K) {
    return this.of(kind).at(-1);
  }
  get id() {
    return this.attachment!.id;
  }
  get refusals() {
    return this.of("refused").map((m) => m.reason);
  }
  /** Game messages of a kind that name a table. */
  games(kind: string, table: string) {
    return this.sent.filter((m) => m.ch === "game" && m.kind === kind && (m as { table?: string }).table === table);
  }
}

/** An Epic lobby: organizer "Org" (token), seats s1 s2 at t1 held by a1 a2, s3 at t2 held by b1; two tables, two pods. */
async function setup() {
  const storage = new MemoryStorage();
  const clock = { now: 1_000 };
  const limits = { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 };
  const room = new GameRoomLogic(storage, limits, () => clock.now);
  await room.create(await sha256Hex(TOKEN), clock.now, { code: "K7M2PQ", roomId: "AAAAAAAAAAAA" });
  const send = (s: RoomSocket, m: unknown, r = room) => r.message(s, JSON.stringify({ v: 1, ...(m as object) }));
  const join = async (name: string, opts: Record<string, unknown> = {}, r = room) => {
    const s = new FakeSocket();
    await send(
      s,
      { ch: "room", kind: "hello", caps: ["watch", "chat", "seats", "play", "tables"], name, build: BUILD, ...opts },
      r,
    );
    return s;
  };
  const org = await join("Org", { token: TOKEN });
  const a1 = await join("A1");
  const a2 = await join("A2");
  const b1 = await join("B1");
  const w = await join("Watcher");
  const tables = (hosts: Record<string, string | null> = {}) => [
    {
      id: "t1",
      name: "Table one",
      pod: "pa",
      difficulty: { level: 1 },
      ...(hosts.t1 !== undefined ? { host: hosts.t1 } : {}),
    },
    { id: "t2", name: "Table two", pod: "pb", ...(hosts.t2 !== undefined ? { host: hosts.t2 } : {}) },
  ];
  await send(org, {
    ch: "room",
    kind: "lobby-set",
    settings: { mode: "epic", playMode: "host", multiSeat: true },
    tables: tables(),
    seats: [
      { id: "s1", label: "H1", table: "t1", player: "p1" },
      { id: "s2", label: "H2", table: "t1", player: "p2" },
      { id: "s3", label: "H3", table: "t2", player: "p1" },
    ],
  });
  await send(org, { ch: "room", kind: "seat-assign", seat: "s1", participant: a1.id });
  await send(org, { ch: "room", kind: "seat-assign", seat: "s2", participant: a2.id });
  await send(org, { ch: "room", kind: "seat-assign", seat: "s3", participant: b1.id });
  /** The organizer hosts t1, b1 hosts t2. */
  const assignHosts = () => send(org, { ch: "room", kind: "lobby-set", tables: tables({ t1: org.id, t2: b1.id }) });
  return { storage, clock, room, send, join, org, a1, a2, b1, w, tables, assignHosts };
}

describe("Epic lobby: tables, pods and hosts", () => {
  it("advertises tables, and a standard lobby has no tables", async () => {
    const h = await setup();
    expect(h.org.last("welcome")!.caps).toContain("tables");
    // The lobby the organizer sent is Epic and carries the tables and pods.
    const lobby = h.org.last("lobby")!;
    expect(lobby.settings.mode).toBe("epic");
    expect(lobby.tables!.map((t) => [t.id, t.pod, t.host])).toEqual([
      ["t1", "pa", undefined],
      ["t2", "pb", undefined],
    ]);
    expect(lobby.pods).toEqual([
      { id: "pa", name: "pa" },
      { id: "pb", name: "pb" },
    ]);
    expect(lobby.seats.map((s) => s.table)).toEqual(["t1", "t1", "t2"]);
    expect(h.org.last("welcome")!.tables.map((t) => t.id)).toEqual(["t1"]); // as of its welcome
    // A plain one-table lobby refuses tables.
    const plain = await setup();
    const solo = new FakeSocket();
    const storage = new MemoryStorage();
    const room = new GameRoomLogic(storage, undefined, () => 1);
    await room.create(await sha256Hex(TOKEN), 1, { code: "ABCDEF", roomId: "BBBBBBBBBBBB" });
    await plain.send(solo, { ch: "room", kind: "hello", caps: [], name: "Solo", build: BUILD, token: TOKEN }, room);
    await plain.send(solo, { ch: "room", kind: "lobby-set", tables: plain.tables() }, room);
    expect(solo.refusals).toEqual(["bad-message"]);
    expect(solo.last("lobby")!.tables).toBeUndefined();
  });

  it("needs two tables including t1, known pods, and each seat at a known table", async () => {
    const h = await setup();
    const set = (m: object) => h.send(h.org, { ch: "room", kind: "lobby-set", ...m });
    await set({ tables: [{ id: "t1", name: "Only", pod: "pa" }] });
    await set({
      tables: [
        { id: "t2", name: "A", pod: "pa" },
        { id: "t3", name: "B", pod: "pa" },
      ],
    });
    await set({ tables: h.tables(), pods: [{ id: "pa", name: "A" }] }); // pod pb missing
    await set({ seats: [{ id: "s1", label: "x", table: "t9" }] });
    await set({
      tables: [
        { id: "t1", name: "​", pod: "pa" },
        { id: "t2", name: "B", pod: "pa" },
      ],
    });
    expect(h.org.refusals).toEqual(["bad-message", "bad-message", "bad-message", "no-such-table", "bad-message"]);
  });

  it("a participant holds seats at one table only", async () => {
    const h = await setup();
    await h.send(h.org, { ch: "room", kind: "seat-assign", seat: "s3", participant: h.a1.id });
    await h.send(h.a1, { ch: "room", kind: "seat-request", seat: "s3" });
    expect(h.org.refusals).toEqual(["seat-taken"]);
    expect(h.a1.refusals).toEqual(["seat-taken"]);
    // A free seat at the other table: b1 released s3, a1 asks for it.
    await h.send(h.b1, { ch: "room", kind: "seat-release", seat: "s3" });
    await h.send(h.a1, { ch: "room", kind: "seat-request", seat: "s3" });
    await h.send(h.org, { ch: "room", kind: "seat-assign", seat: "s3", participant: h.a1.id });
    expect(h.org.refusals).toEqual(["seat-taken", "other-table"]);
  });

  it("the organizer assigns table hosts; each gets a private token and only its hash is stored", async () => {
    const h = await setup();
    await h.assignHosts();
    const token = h.b1.last("table-host-token")!;
    expect(token).toMatchObject({ table: "t2" });
    expect(token.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    for (const s of [h.org, h.a1, h.a2, h.w]) expect(s.last("table-host-token")).toBeUndefined();
    expect(JSON.stringify(await h.storage.list({}).then((m) => [...m.entries()]))).not.toContain(token.token);
    expect(h.b1.attachment).toMatchObject({ role: "host", table: "t2" });
    expect(h.org.attachment).toMatchObject({ role: "host", table: "t1", organizer: true });
    const lobby = h.w.last("lobby")!;
    expect(lobby.tables!.map((t) => t.host)).toEqual([h.org.id, h.b1.id]);
    expect(JSON.stringify(lobby)).not.toContain(token.token);
    expect(JSON.stringify(lobby)).not.toContain("hostTokenHash");
  });

  it("a lobby-set promoting a table host whose save fails sends no token and leaves roles and tables as they were", async () => {
    const h = await setup();
    const rev = h.org.last("lobby")!.rev;
    const put = h.storage.put.bind(h.storage);
    let failing = true;
    h.storage.put = ((...args: Parameters<typeof put>) => {
      if (failing && (args[0] as unknown) === "lobby") return Promise.reject(new Error("put failed"));
      return put(...(args.map((x) => structuredClone(x)) as Parameters<typeof put>));
    }) as typeof h.storage.put;
    await h.assignHosts();
    expect(h.org.refusals).toEqual(["not-saved"]);
    for (const s of [h.org, h.a1, h.a2, h.b1, h.w]) expect(s.last("table-host-token")).toBeUndefined();
    expect(h.b1.attachment).toMatchObject({ role: "watcher" });
    expect(h.b1.attachment!.table).toBeUndefined();
    expect(h.org.attachment!.table).toBeUndefined();
    const lobby = h.org.last("lobby")!;
    expect(lobby.tables!.map((t) => t.host)).toEqual([undefined, undefined]);
    expect(lobby.rev).toBe(rev);
    // The same change saves once the put works, and then the token goes out.
    failing = false;
    await h.assignHosts();
    expect(h.b1.last("table-host-token")).toMatchObject({ table: "t2" });
    expect(h.b1.attachment).toMatchObject({ role: "host", table: "t2" });
  });

  it("a table host must hold a seat at its table; a participant hosts one table", async () => {
    const h = await setup();
    const set = (hosts: Record<string, string | null>) =>
      h.send(h.org, { ch: "room", kind: "lobby-set", tables: h.tables(hosts) });
    await set({ t2: h.a1.id }); // a1 sits at t1
    await set({ t1: h.a1.id, t2: h.a1.id }); // twice
    await set({ t1: h.w.id }); // holds no seat
    await set({ t1: "nobody" });
    await set({ t1: h.org.id, t2: h.org.id }); // the organizer twice
    expect(h.org.refusals).toEqual([
      "bad-table-host",
      "bad-table-host",
      "bad-table-host",
      "no-such-participant",
      "bad-table-host",
    ]);
    // A guest cannot set the lobby at all.
    await h.send(h.a1, { ch: "room", kind: "lobby-set", tables: h.tables({ t1: h.a1.id }) });
    expect(h.a1.refusals).toEqual(["not-allowed"]);
  });

  it("replacing a host demotes the old one and keeps the table; the organizer can move tables", async () => {
    const h = await setup();
    await h.assignHosts();
    const first = h.b1.last("table-host-token")!.token;
    await h.send(h.org, { ch: "room", kind: "seat-assign", seat: "s3", participant: h.w.id });
    await h.send(h.org, { ch: "room", kind: "seat-deny", seat: "s3", participant: h.b1.id });
    await h.send(h.org, { ch: "room", kind: "seat-assign", seat: "s3", participant: h.w.id });
    await h.send(h.org, { ch: "room", kind: "lobby-set", tables: h.tables({ t1: null, t2: h.w.id }) });
    expect(h.b1.attachment).toMatchObject({ role: "watcher" });
    expect(h.b1.attachment!.table).toBeUndefined();
    expect(h.w.attachment).toMatchObject({ role: "host", table: "t2" });
    const second = h.w.last("table-host-token")!.token;
    expect(second).not.toBe(first);
    // The old token no longer opens the table.
    const back = await h.join("B1again", { tableTokens: [first] });
    expect(back.attachment).toMatchObject({ role: "watcher" });
    expect(h.org.attachment).toMatchObject({ role: "host", organizer: true });
    expect(h.org.attachment!.table).toBeUndefined();
    await h.send(h.org, { ch: "room", kind: "lobby-set", tables: h.tables({ t2: h.w.id, t1: h.org.id }) });
    expect(h.org.attachment).toMatchObject({ table: "t1" });
  });
});

describe("a table host streams its own table only", () => {
  it("start, commands, rewind, log and end are limited to the host's table", async () => {
    const h = await setup();
    await h.assignHosts();
    for (const kind of ["start", "log"] as const) {
      await h.send(h.b1, { ch: "game", kind, table: "t1", header: { h: 1 }, commands: [] });
    }
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t1", from: 0, commands: [{ c: 1 }] });
    await h.send(h.b1, { ch: "game", kind: "end", table: "t1", outcome: "won" });
    expect(h.b1.refusals).toEqual(["not-allowed", "not-allowed", "not-allowed", "not-allowed"]);
    // A watcher, a seat holder and the organizer (it hosts t1) cannot stream t2 either.
    await h.send(h.a1, { ch: "game", kind: "start", table: "t2", header: {} });
    await h.send(h.org, { ch: "game", kind: "start", table: "t2", header: {} });
    expect(h.a1.refusals).toEqual(["not-allowed"]);
    expect(h.org.refusals).toEqual(["not-allowed"]);
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t2", from: 0, commands: [{ c: 1 }, { c: 2 }] });
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    expect(h.room.logLength("t1")).toBe(0);
    expect(h.room.logLength("t2")).toBe(2);
    expect(h.b1.refusals).toHaveLength(4);
  });

  it("each table has its own log, ordering and ended state", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    await h.send(h.org, { ch: "game", kind: "commands", table: "t1", from: 0, commands: ["a", "b", "c"] });
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t2", from: 0, commands: ["x"] });
    // t2's batch must continue t2's own log, whatever t1 holds; the room asks for a resend.
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t2", from: 3, commands: ["y"] });
    expect(h.b1.refusals).toEqual(["out-of-order"]);
    expect(h.b1.last("resend")).toMatchObject({ table: "t2", from: 1 });
    expect(h.room.logLength("t1")).toBe(3);
    expect(h.room.logLength("t2")).toBe(1);
    await h.send(h.b1, { ch: "game", kind: "end", table: "t2", outcome: "lost" });
    const tables = h.w.last("table")!;
    expect(tables.table.id).toBe("t2");
    expect(tables.table.ended).toBe(true);
    await h.send(h.org, { ch: "game", kind: "commands", table: "t1", from: 3, commands: ["d"] });
    expect(h.room.logLength("t1")).toBe(4);
  });

  it("stores chunk and tail rows per table, nothing per pod event", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    const commands = Array.from({ length: ROOM_CHUNK_COMMANDS + 5 }, (_, i) => ({ i }));
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t2", from: 0, commands });
    const keys = [...(await h.storage.list({})).keys()];
    expect(keys).toContain("t2:header");
    expect(keys).toContain("t2:c:000000");
    expect(keys.filter((k) => k.startsWith("t1:"))).toEqual([]);
    const before = keys.length;
    for (let seq = 0; seq < 5; seq++) {
      await h.send(h.b1, { ch: "pod", kind: "event", table: "t2", seq, event: { x: seq } });
    }
    await h.send(h.org, { ch: "pod", kind: "state", state: { loki: 40 } });
    expect([...(await h.storage.list({})).keys()]).toHaveLength(before);
  });

  it("a table host that returns with its token takes the table back", async () => {
    const h = await setup();
    await h.assignHosts();
    const token = h.b1.last("table-host-token")!.token;
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t2", from: 0, commands: ["x", "y"] });
    const again = await h.join("B1", { tableTokens: [token] });
    expect(again.attachment).toMatchObject({ role: "host", table: "t2" });
    expect(h.b1.attachment).toBeNull(); // replaced
    expect(h.b1.closed).toBe(4000);
    expect(again.last("welcome")!.tables.find((t) => t.id === "t2")).toMatchObject({
      hostConnected: true,
      commands: 2,
    });
    expect(again.last("lobby")!.tables!.find((t) => t.id === "t2")!.host).toBe(again.id);
    await h.send(again, { ch: "game", kind: "commands", table: "t2", from: 2, commands: ["z"] });
    expect(h.room.logLength("t2")).toBe(3);
    // The token opens only its own table, never the room's.
    expect(again.attachment!.organizer).toBeUndefined();
    await h.send(again, { ch: "room", kind: "lobby-set", settings: { chat: false } });
    expect(again.refusals).toEqual(["not-allowed"]);
  });

  it("the table's host drop shows in its table info and the table waits", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    await h.room.close(h.b1);
    expect(h.w.last("table")!.table).toMatchObject({ id: "t2", hostConnected: false });
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    expect(h.w.last("table")!.table).toMatchObject({ id: "t1", hostConnected: true });
  });
});

describe("watchers follow tables", () => {
  async function started() {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    await h.send(h.org, { ch: "game", kind: "commands", table: "t1", from: 0, commands: ["a"] });
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t2", from: 0, commands: ["x"] });
    return h;
  }

  it("a joiner follows all tables by default, or the ones it names", async () => {
    const h = await started();
    const all = await h.join("All");
    expect(
      all
        .of("log")
        .map((m) => m.table)
        .sort(),
    ).toEqual(["t1", "t2"]);
    const one = await h.join("One", { follow: ["t2"] });
    expect(one.of("log").map((m) => m.table)).toEqual(["t2"]);
    expect(one.attachment!.follow).toEqual(["t2"]);
    const bad = await h.join("Bad", { follow: ["t7"] });
    expect(bad.refusals).toEqual(["no-such-table"]);
    expect(bad.attachment!.follow).toBeUndefined();
    // Live traffic reaches only followers.
    await h.send(h.org, { ch: "game", kind: "commands", table: "t1", from: 1, commands: ["b"] });
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t2", from: 1, commands: ["y"] });
    expect(one.games("commands", "t1")).toHaveLength(0);
    expect(one.games("commands", "t2")).toHaveLength(1);
    expect(all.games("commands", "t1")).toHaveLength(1);
    expect(all.games("commands", "t2")).toHaveLength(1);
  });

  it("follow changes what is sent, and newly followed tables send their log", async () => {
    const h = await started();
    const one = await h.join("One", { follow: ["t1"] });
    await h.send(one, { ch: "room", kind: "follow", tables: ["t2"] });
    expect(one.of("log").map((m) => m.table)).toEqual(["t1", "t2"]);
    await h.send(h.org, { ch: "game", kind: "commands", table: "t1", from: 1, commands: ["b"] });
    expect(one.games("commands", "t1")).toHaveLength(0);
    await h.send(one, { ch: "room", kind: "follow", tables: "all" });
    expect(one.attachment!.follow).toBeUndefined();
    await h.send(one, { ch: "room", kind: "follow", tables: ["t9"] });
    expect(one.refusals).toEqual(["no-such-table"]);
  });

  it("the roster counts watchers per table and leaves out seat holders", async () => {
    const h = await started();
    await h.join("One", { follow: ["t1"] });
    await h.join("Two", { follow: ["t2"] });
    const roster = h.org.last("roster")!;
    // The unseated watcher "Watcher" follows everything; seat holders are players.
    expect(roster.watchers).toBe(3);
    expect(roster.watching).toEqual({ t1: 2, t2: 2 });
  });

  it("each host also gets the other tables' logs when it follows them", async () => {
    const h = await started();
    const org2 = await h.join("Org", { token: TOKEN });
    expect(org2.attachment).toMatchObject({ role: "host", table: "t1", organizer: true });
    expect(org2.of("log").map((m) => m.table)).toEqual(["t2"]);
  });
});

describe("proposals and requests go to the host of the seat's table", () => {
  it("routes by table: t1 seat holders reach the organizer, t2's reach b1", async () => {
    const h = await setup();
    await h.assignHosts();
    // t2 needs a seat holder who is not its host: a second seat there (set before the tables start: a started Epic
    // game's seats are frozen).
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s1", label: "H1", table: "t1", player: "p1" },
        { id: "s2", label: "H2", table: "t1", player: "p2" },
        { id: "s3", label: "H3", table: "t2", player: "p1" },
        { id: "s4", label: "H4", table: "t2", player: "p2" },
      ],
    });
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    const c1 = await h.join("C1");
    await h.send(h.org, { ch: "room", kind: "seat-assign", seat: "s4", participant: c1.id });
    await h.send(c1, { ch: "game", kind: "propose", table: "t2", command: { pass: 2 }, base: 0, stamp: "S" });
    await h.send(h.a1, { ch: "game", kind: "propose", table: "t1", command: { pass: 1 }, base: 0 });
    expect(h.b1.of("proposal")).toEqual([
      {
        v: 1,
        ch: "game",
        kind: "proposal",
        table: "t2",
        from: c1.id,
        seats: ["s4"],
        command: { pass: 2 },
        base: 0,
        stamp: "S",
      },
    ]);
    expect(h.org.of("proposal")).toEqual([
      { v: 1, ch: "game", kind: "proposal", table: "t1", from: h.a1.id, seats: ["s1"], command: { pass: 1 }, base: 0 },
    ]);
    // A seat holder cannot propose at a table where it holds no seat.
    await h.send(h.a1, { ch: "game", kind: "propose", table: "t2", command: {}, base: 0 });
    await h.send(c1, { ch: "game", kind: "propose", table: "t1", command: {}, base: 0 });
    expect(h.a1.refusals).toEqual(["not-seated"]);
    expect(c1.refusals).toEqual(["not-seated"]);
    expect(h.b1.of("proposal")).toHaveLength(1);
    // The host answers its own table's seats only.
    await h.send(h.b1, { ch: "game", kind: "proposal-refused", table: "t2", to: c1.id, reason: "stale", base: 0 });
    expect(c1.last("proposal-refused")).toMatchObject({ table: "t2", reason: "stale" });
    await h.send(h.b1, { ch: "game", kind: "proposal-refused", table: "t1", to: h.a1.id, reason: "stale", base: 0 });
    expect(h.b1.refusals).toEqual(["not-allowed"]);
    expect(h.a1.of("proposal-refused")).toHaveLength(0);
  });

  it("a table host takes over and gives back seats of its own table only", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.room.close(h.a1);
    await h.send(h.b1, { ch: "room", kind: "take-over", seat: "s1" }); // t1's seat: not b1's
    expect(h.b1.refusals).toEqual(["not-allowed"]);
    await h.send(h.org, { ch: "room", kind: "take-over", seat: "s1" });
    expect(h.org.last("lobby")!.seats.find((s) => s.id === "s1")!.takenOver).toBe(true);
    await h.send(h.org, { ch: "room", kind: "give-back", seat: "s1" });
    expect(h.org.last("lobby")!.seats.find((s) => s.id === "s1")!.takenOver).toBeUndefined();
  });
});

describe("the pod channel", () => {
  it("relays a table host's event to the organizer only", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.b1, {
      ch: "pod",
      kind: "event",
      table: "t2",
      seq: 1,
      event: { type: "sharedVillainDamaged", n: 3 },
    });
    const got = h.org.of("event");
    expect(got).toEqual([
      { v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: { type: "sharedVillainDamaged", n: 3 } },
    ]);
    for (const s of [h.a1, h.a2, h.w, h.b1]) expect(s.of("event")).toHaveLength(0);
    // Only the host of the named table may send for it.
    await h.send(h.a1, { ch: "pod", kind: "event", table: "t1", seq: 1, event: {} });
    await h.send(h.b1, { ch: "pod", kind: "event", table: "t1", seq: 2, event: {} });
    await h.send(h.b1, { ch: "pod", kind: "event", table: "t9", seq: 3, event: {} });
    expect(h.a1.refusals).toEqual(["not-allowed"]);
    expect(h.b1.refusals).toEqual(["not-allowed", "no-such-table"]);
    expect(h.org.of("event")).toHaveLength(1);
  });

  it("relays the organizer's inbound to that table's host only", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "pod", kind: "inbound", table: "t2", seq: 4, event: { type: "lokiFlipped" } });
    expect(h.b1.of("inbound")).toEqual([
      { v: 1, ch: "pod", kind: "inbound", table: "t2", seq: 4, event: { type: "lokiFlipped" } },
    ]);
    for (const s of [h.a1, h.a2, h.w, h.org]) expect(s.of("inbound")).toHaveLength(0);
    // Nobody else may send inbound, a table host included.
    await h.send(h.b1, { ch: "pod", kind: "inbound", table: "t2", seq: 5, event: {} });
    await h.send(h.a1, { ch: "pod", kind: "inbound", table: "t2", seq: 6, event: {} });
    expect(h.b1.refusals).toEqual(["not-allowed"]);
    expect(h.a1.refusals).toEqual(["not-allowed"]);
    expect(h.b1.of("inbound")).toHaveLength(1);
    // A table with no connected host: refused, not queued.
    await h.room.close(h.b1);
    await h.send(h.org, { ch: "pod", kind: "inbound", table: "t2", seq: 7, event: {} });
    expect(h.org.refusals).toEqual(["no-such-participant"]);
  });

  it("an event from the organizer's own table has nowhere to go and is dropped", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "pod", kind: "event", table: "t1", seq: 1, event: {} });
    expect(h.org.refusals).toEqual([]);
    for (const s of [h.a1, h.b1, h.w]) expect(s.of("event")).toHaveLength(0);
  });

  it("broadcasts the organizer's state to everyone and hands the last one to a joiner", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "pod", kind: "state", state: { loki: 40, tables: { t1: "playing" } } });
    for (const s of [h.a1, h.a2, h.b1, h.w]) {
      expect(s.of("state")).toEqual([
        { v: 1, ch: "pod", kind: "state", state: { loki: 40, tables: { t1: "playing" } } },
      ]);
    }
    expect(h.org.of("state")).toHaveLength(0);
    const late = await h.join("Late");
    expect(late.of("state")).toHaveLength(1);
    // Only the organizer may broadcast.
    await h.send(h.b1, { ch: "pod", kind: "state", state: { loki: 1 } });
    await h.send(h.w, { ch: "pod", kind: "state", state: { loki: 1 } });
    expect(h.b1.refusals).toEqual(["not-allowed"]);
    expect(h.w.refusals).toEqual(["not-allowed"]);
    expect(h.a1.of("state")).toHaveLength(1);
  });

  it("caps sizes and rate limits, and a one-table room refuses the channel", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.b1, {
      ch: "pod",
      kind: "event",
      table: "t2",
      seq: 1,
      event: { pad: "x".repeat(MAX_POD_EVENT_BYTES) },
    });
    expect(h.b1.refusals).toEqual(["too-large"]);
    for (let seq = 0; seq < POD_BURST + 5; seq++) {
      await h.send(h.b1, { ch: "pod", kind: "event", table: "t2", seq, event: {} });
    }
    expect(h.b1.refusals.filter((r) => r === "rate-limited").length).toBeGreaterThanOrEqual(5);
    expect(h.org.of("event").length).toBeLessThanOrEqual(POD_BURST + 1);
    const storage = new MemoryStorage();
    const room = new GameRoomLogic(storage, undefined, () => 1);
    await room.create(await sha256Hex(TOKEN), 1, { code: "ABCDEF", roomId: "BBBBBBBBBBBB" });
    const solo = await h.join("Solo", { token: TOKEN }, room);
    await h.send(solo, { ch: "pod", kind: "state", state: {} }, room);
    expect(solo.refusals).toEqual(["not-allowed"]);
  });
});

describe("the room ends when every table has", () => {
  it("closes five minutes after the last table ends, not after the first", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    await h.send(h.org, { ch: "game", kind: "end", table: "t1", outcome: "won" });
    h.clock.now += ROOM_END_GRACE_MS + 1;
    expect(await h.room.alarm(h.clock.now)).toBe("rescheduled");
    h.clock.now += 10_000;
    await h.send(h.b1, { ch: "game", kind: "end", table: "t2", outcome: "won" });
    expect(await h.storage.getAlarm()).toBe(h.clock.now + ROOM_END_GRACE_MS);
    expect(await h.room.alarm(h.clock.now + 1)).toBe("rescheduled");
    expect(await h.room.alarm(h.clock.now + ROOM_END_GRACE_MS)).toBe("closed");
  });

  it("an ended table's state survives a wake, and a rewind past its end reopens it", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t2", from: 0, commands: ["x", "y"] });
    await h.send(h.b1, { ch: "game", kind: "end", table: "t2", outcome: "lost" });
    const woken = new GameRoomLogic(h.storage, undefined, () => h.clock.now);
    const ws = new FakeSocket();
    await h.send(ws, { ch: "room", kind: "hello", caps: [], name: "W", build: BUILD, follow: ["t2"] }, woken);
    expect(ws.last("welcome")!.tables.map((t) => [t.id, t.ended, t.commands])).toEqual([
      ["t1", false, 0],
      ["t2", true, 2],
    ]);
    expect(ws.of("end")).toHaveLength(1);
    await h.send(h.b1, { ch: "game", kind: "rewind", table: "t2", to: 1 });
    expect(h.w.last("table")!.table).toMatchObject({ id: "t2", ended: false, commands: 1 });
  });
});

describe("review fixes", () => {
  it("a message-driven wake loads every table, so the room still ends when all have", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    await h.send(h.org, { ch: "game", kind: "end", table: "t1", outcome: "won" });
    // The room is evicted; both hosts' sockets survive hibernation and speak first to the new object.
    const woken = new GameRoomLogic(h.storage, undefined, () => h.clock.now);
    woken.restore(h.org);
    woken.restore(h.b1);
    await h.send(h.b1, { ch: "game", kind: "end", table: "t2", outcome: "won" }, woken);
    expect(await h.storage.getAlarm()).toBe(h.clock.now + ROOM_END_GRACE_MS);
    expect(await woken.alarm(h.clock.now + ROOM_END_GRACE_MS)).toBe("closed");
  });

  it("removing a table demotes its host", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      tables: [
        { id: "t1", name: "One", pod: "pa" },
        { id: "t3", name: "Three", pod: "pb" },
      ],
      seats: [{ id: "s1", label: "H1", table: "t1" }],
    });
    expect(h.b1.attachment).toMatchObject({ role: "watcher" });
    expect(h.b1.attachment!.table).toBeUndefined();
    expect(h.room.logLength("t2")).toBe(0);
  });

  it("a seat holder keeps receiving its own table whatever it follows", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    await h.send(h.a1, { ch: "room", kind: "follow", tables: ["t2"] });
    await h.send(h.org, { ch: "game", kind: "commands", table: "t1", from: 0, commands: ["a"] });
    expect(h.a1.games("commands", "t1")).toHaveLength(1);
  });

  it("a seat token gets a player into a full room; others are turned away", async () => {
    const h = await setup();
    const token = h.a1.last("seat-token")!.token;
    for (let i = 0; i < 25; i++) await h.join(`W${i}`);
    const late = await h.join("Late");
    expect(late.refusals).toContain("full");
    const back = await h.join("A1", { seatTokens: [token] });
    expect(back.attachment).not.toBeNull();
    expect(back.refusals).toEqual([]);
  });

  it("refuses going back to standard once a table has a log, and clears the pod state on leaving Epic", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "pod", kind: "state", state: { loki: 1 } });
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    const standard = {
      ch: "room",
      kind: "lobby-set",
      settings: { mode: "standard" },
      seats: [{ id: "s1", label: "H1" }],
    };
    await h.send(h.org, standard);
    expect(h.org.refusals).toEqual(["out-of-order"]);
    const fresh = await setup();
    await fresh.send(fresh.org, { ch: "pod", kind: "state", state: { loki: 1 } });
    await fresh.send(fresh.org, standard);
    expect(fresh.org.last("lobby")!.settings.mode).toBe("standard");
    const late = await fresh.join("Late");
    expect(late.of("state")).toHaveLength(0);
  });

  it("measures pod sizes in bytes", async () => {
    const h = await setup();
    await h.assignHosts();
    // Multi-byte text: few characters, many bytes.
    await h.send(h.b1, {
      ch: "pod",
      kind: "event",
      table: "t2",
      seq: 1,
      event: { t: "é".repeat(MAX_POD_EVENT_BYTES / 2) },
    });
    expect(h.b1.refusals).toEqual(["too-large"]);
  });
});

describe("a started Epic game's topology is frozen", () => {
  async function live() {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    h.org.sent.length = 0;
    return h;
  }
  const seatsOf = (h: Awaited<ReturnType<typeof live>>) => h.org.last("lobby")?.seats;

  it("refuses moving a live table to another pod, moving a seat between tables or changing a seat's player", async () => {
    const h = await live();
    const before = JSON.stringify(h.org.last("lobby") ?? null);
    const tables = h.tables({ t1: h.org.id, t2: h.b1.id });
    await h.send(h.org, { ch: "room", kind: "lobby-set", tables: tables.map((t) => ({ ...t, pod: "pa" })) });
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s1", label: "H1", table: "t1", player: "p1" },
        { id: "s2", label: "H2", table: "t2", player: "p2" },
        { id: "s3", label: "H3", table: "t2", player: "p1" },
      ],
    });
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s1", label: "H1", table: "t1", player: "p2" },
        { id: "s2", label: "H2", table: "t1", player: "p1" },
        { id: "s3", label: "H3", table: "t2", player: "p1" },
      ],
    });
    expect(h.org.refusals).toEqual(["out-of-order", "out-of-order", "out-of-order"]);
    expect(JSON.stringify(h.org.last("lobby") ?? null)).toBe(before);
  });

  it("refuses adding or removing a seat, and taking a table's host away", async () => {
    const h = await live();
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s1", label: "H1", table: "t1", player: "p1" },
        { id: "s2", label: "H2", table: "t1", player: "p2" },
        { id: "s3", label: "H3", table: "t2", player: "p1" },
        { id: "s4", label: "H4", table: "t2", player: "p2" },
      ],
    });
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s1", label: "H1", table: "t1", player: "p1" },
        { id: "s2", label: "H2", table: "t1", player: "p2" },
      ],
    });
    await h.send(h.org, { ch: "room", kind: "lobby-set", tables: h.tables({ t1: null, t2: h.b1.id }) });
    expect(h.org.refusals).toEqual(Array(3).fill("out-of-order"));
    expect(seatsOf(h)).toBeUndefined();
  });

  it("refuses leaving Epic and changing the mods or table rules", async () => {
    const h = await live();
    await h.send(h.org, { ch: "room", kind: "lobby-set", settings: { mode: "standard" } });
    await h.send(h.org, { ch: "room", kind: "lobby-set", settings: { tableRules: { house: true } } });
    await h.send(h.org, { ch: "room", kind: "lobby-set", settings: { mods: [{ id: "x", version: "1" }] } });
    expect(h.org.refusals).toEqual(Array(3).fill("out-of-order"));
  });

  it("still allows names, labels and the play settings, and repeating what is already set", async () => {
    const h = await live();
    const tables = h.tables({ t1: h.org.id, t2: h.b1.id }).map((t) => ({ ...t, name: `${t.name}!` }));
    await h.send(h.org, { ch: "room", kind: "lobby-set", tables });
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      settings: { chat: false, playMode: "strict" },
      seats: [
        { id: "s1", label: "Renamed", table: "t1", player: "p1" },
        { id: "s2", label: "H2", table: "t1" },
        { id: "s3", label: "H3", table: "t2", player: "p1" },
      ],
    });
    expect(h.org.refusals).toEqual([]);
    const lobby = h.org.last("lobby")!;
    expect(lobby.tables!.map((t) => t.name)).toEqual(["Table one!", "Table two!"]);
    expect(lobby.seats.map((x) => [x.id, x.label, x.player])).toEqual([
      ["s1", "Renamed", "p1"],
      ["s2", "H2", "p2"],
      ["s3", "H3", "p1"],
    ]);
  });
});

describe("Epic seats' players", () => {
  it("are derived per table, in seat order within the table, when the lobby sets seats without them", async () => {
    const h = await setup();
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "n1", label: "H1", table: "t1" },
        { id: "n2", label: "H2", table: "t2" },
        { id: "n3", label: "H3", table: "t2" },
        { id: "n4", label: "H4", table: "t1" },
      ],
    });
    expect(h.org.refusals).toEqual([]);
    const players = Object.fromEntries(h.org.last("lobby")!.seats.map((x) => [x.id, x.player]));
    expect(players).toEqual({ n1: "p1", n2: "p1", n3: "p2", n4: "p2" });
  });

  it("stay the same when a later lobby-set leaves them out, and a new seat takes the next free one", async () => {
    const h = await setup();
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s1", label: "H1", table: "t1" },
        { id: "s2", label: "H2", table: "t1" },
        { id: "s3", label: "H3", table: "t2" },
      ],
    });
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s3", label: "H3", table: "t2" },
        { id: "s5", label: "H5", table: "t2" },
        { id: "s1", label: "H1", table: "t1" },
        { id: "s2", label: "H2", table: "t1" },
      ],
    });
    const players = Object.fromEntries(h.org.last("lobby")!.seats.map((x) => [x.id, x.player]));
    expect(players).toEqual({ s1: "p1", s2: "p2", s3: "p1", s5: "p2" });
  });
});

/** Makes puts whose key matches fail while `state.failing` is true (a real failed put writes nothing). */
function failPuts(storage: MemoryStorage, matches: (key: string) => boolean) {
  const state = { failing: false };
  const put = storage.put.bind(storage);
  storage.put = ((...args: Parameters<typeof put>) => {
    const key = args[0] as unknown;
    if (state.failing && typeof key === "string" && matches(key)) return Promise.reject(new Error("put failed"));
    return put(...(args.map((x) => structuredClone(x)) as Parameters<typeof put>));
  }) as typeof storage.put;
  return state;
}

describe("a failed write on one table reaches that table's followers only", () => {
  it("commands and rewind are broadcast to t2's followers before the write; a t1-only follower gets nothing", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.org, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 } });
    const only1 = await h.join("Only1", { follow: ["t1"] });
    const only2 = await h.join("Only2", { follow: ["t2"] });
    const fail = failPuts(h.storage, (k) => k.startsWith("t2:") && k !== "t2:header");
    const commands = Array.from({ length: ROOM_CHUNK_COMMANDS + 3 }, (_, i) => ({ i }));
    fail.failing = true;
    await h.send(h.b1, { ch: "game", kind: "commands", table: "t2", from: 0, commands }).catch(() => undefined);
    expect(only2.games("commands", "t2")).toHaveLength(1);
    expect(only1.games("commands", "t2")).toHaveLength(0);
    expect(h.room.logLength("t2")).toBe(ROOM_CHUNK_COMMANDS + 3);
    // A rewind whose tail write fails is still told to t2's followers, and to nobody following only t1.
    await h.send(h.b1, { ch: "game", kind: "rewind", table: "t2", to: 3 }).catch(() => undefined);
    expect(only2.games("rewind", "t2")).toHaveLength(1);
    expect(only1.games("rewind", "t2")).toHaveLength(0);
    expect(h.room.logLength("t1")).toBe(0);
  });

  it("a log whose write fails sends no started to its host", async () => {
    const h = await setup();
    await h.assignHosts();
    await h.send(h.b1, { ch: "game", kind: "start", table: "t2", header: { h: 2 }, gid: "G" });
    const fail = failPuts(h.storage, (k) => k.startsWith("t2:"));
    fail.failing = true;
    const startedBefore = h.b1.of("started").length;
    await h
      .send(h.b1, { ch: "game", kind: "log", table: "t2", header: { h: 3 }, commands: ["a"], gid: "G" })
      .catch(() => undefined);
    expect(h.b1.of("started")).toHaveLength(startedBefore);
  });
});

describe("a failed lobby-set save restores the Epic structure", () => {
  const ids = async (h: Awaited<ReturnType<typeof setup>>) => {
    const probe = await h.join("Probe");
    return probe.last("welcome")!.tables.map((t) => t.id);
  };

  it("adding and removing a table", async () => {
    const h = await setup();
    const fail = failPuts(h.storage, (k) => k === "lobby");
    const three = [...h.tables(), { id: "t3", name: "Three", pod: "pa" }];
    fail.failing = true;
    await h.send(h.org, { ch: "room", kind: "lobby-set", tables: three });
    expect(h.org.refusals).toEqual(["not-saved"]);
    expect(h.org.last("lobby")!.tables!.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(await ids(h)).toEqual(["t1", "t2"]);
    fail.failing = false;
    await h.send(h.org, { ch: "room", kind: "lobby-set", tables: three });
    expect(await ids(h)).toEqual(["t1", "t2", "t3"]);
    fail.failing = true;
    await h.send(h.org, { ch: "room", kind: "lobby-set", tables: h.tables() });
    expect(h.org.refusals).toEqual(["not-saved", "not-saved"]);
    expect(h.org.last("lobby")!.tables!.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(await ids(h)).toEqual(["t1", "t2", "t3"]);
  });

  it("switching Epic to standard", async () => {
    const h = await setup();
    await h.send(h.org, { ch: "pod", kind: "state", state: { loki: 1 } });
    const fail = failPuts(h.storage, (k) => k === "lobby");
    fail.failing = true;
    await h.send(h.org, {
      ch: "room",
      kind: "lobby-set",
      settings: { mode: "standard" },
      seats: [{ id: "s1", label: "H1" }],
    });
    expect(h.org.refusals).toEqual(["not-saved"]);
    const lobby = h.org.last("lobby")!;
    expect(lobby.settings.mode).toBe("epic");
    expect(lobby.tables!.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(lobby.pods!.map((p) => p.id)).toEqual(["pa", "pb"]);
    expect(lobby.seats).toHaveLength(3);
    expect(lobby.seats.map((s) => s.table)).toEqual(["t1", "t1", "t2"]);
    expect(await ids(h)).toEqual(["t1", "t2"]);
    expect(h.org.attachment).toMatchObject({ role: "host", organizer: true });
    // The pod state survives: a joiner still gets it.
    const late = await h.join("Late");
    expect(late.of("state")).toHaveLength(1);
  });
});

describe("a table host's hello save", () => {
  it("a failed save refuses the joiner and leaves one host; the old token then opens nothing", async () => {
    const h = await setup();
    await h.assignHosts();
    const token = h.b1.last("table-host-token")!.token;
    const b1Id = h.b1.id;
    const fail = failPuts(h.storage, (k) => k === "lobby");
    fail.failing = true;
    const back = await h.join("B1again", { tableTokens: [token] });
    expect(back.refusals).toEqual(["not-saved"]);
    expect(back.attachment).toBeNull();
    fail.failing = false;
    // The organizer re-hosts t2 to another seat holder: only one participant hosts t2.
    await h.send(h.org, { ch: "room", kind: "seat-deny", seat: "s3", participant: b1Id });
    await h.send(h.org, { ch: "room", kind: "seat-assign", seat: "s3", participant: h.w.id });
    await h.send(h.org, { ch: "room", kind: "lobby-set", tables: h.tables({ t1: h.org.id, t2: h.w.id }) });
    const hosts = [h.org, h.a1, h.a2, h.b1, h.w, back].filter((s) => s.attachment?.table === "t2");
    // (b1 itself was displaced by the joiner's replaceHost; the refused joiner holds nothing.)
    expect(hosts.map((s) => s.id)).toEqual([h.w.id]);
    const again = await h.join("Late", { tableTokens: [token] });
    expect(again.attachment).toMatchObject({ role: "watcher" });
  });
});
