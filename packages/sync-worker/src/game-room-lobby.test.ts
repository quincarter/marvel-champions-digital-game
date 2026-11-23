import { describe, expect, it, vi } from "vitest";
import {
  GameRoomLogic,
  LOBBY_ROOM_CAPS,
  ROOM_CAPS,
  sha256Hex,
  type RoomCodeHooks,
  type RoomSocket,
} from "./game-room.js";
import {
  CHAT_BACKLOG_LINES,
  CHAT_BURST,
  LOBBY_MESSAGE_BURST,
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  ROOM_END_GRACE_MS,
  ROOM_CODE_MARGIN_MS,
  ROOM_IDLE_MS,
  parseClientMessage,
  type Participant,
  type RoomBuild,
  type ServerMessage,
} from "./room-protocol.js";
import { RoomCodeLogic } from "./room-code-store.js";
import { MemoryStorage } from "./test-support.js";

const TOKEN = "T".repeat(32);
const BUILD: RoomBuild = { appVersion: "1.2.3", contentVersion: "c9" };
const CODE = "K7M2PQ";
const ROOM_ID = "AAAAAAAAAAAA";

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
}

interface SetupOptions {
  lobby?: boolean;
  hooks?: RoomCodeHooks;
  /**
   * The host's "Ask the host to sit at the table" setting, sent with every `lobbySet` here. On by default in these tests,
   * which cover the request, approve and deny flow; the claim flow (the room's default) has its own tests.
   */
  askToSit?: boolean;
}

async function setup({ lobby = true, hooks, askToSit = true }: SetupOptions = {}) {
  const storage = new MemoryStorage();
  const clock = { now: 1_000 };
  const limits = { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 };
  const make = () => new GameRoomLogic(storage, limits, () => clock.now, hooks);
  const room = make();
  await room.create(await sha256Hex(TOKEN), clock.now, lobby ? { code: CODE, roomId: ROOM_ID } : undefined);
  const send = (r: GameRoomLogic, s: RoomSocket, m: unknown) =>
    r.message(s, JSON.stringify({ v: 1, ...(m as object) }));
  const join = async (
    r: GameRoomLogic,
    hello: { token?: string; name?: string | null; build?: RoomBuild | null; seatTokens?: string[] } = {},
  ) => {
    const s = new FakeSocket();
    await send(r, s, {
      ch: "room",
      kind: "hello",
      caps: ["watch", "chat", "seats"],
      ...(hello.token ? { token: hello.token } : {}),
      ...(hello.name === null ? {} : { name: hello.name ?? "Ann" }),
      ...(hello.build === null ? {} : { build: hello.build ?? BUILD }),
      ...(hello.seatTokens ? { seatTokens: hello.seatTokens } : {}),
    });
    return s;
  };
  const host = (r = room, name = "Hosty") => join(r, { token: TOKEN, name });
  const lobbySet = (s: RoomSocket, patch: { settings?: object; seats?: object[]; ifRev?: number }, r = room) =>
    send(r, s, {
      ch: "room",
      kind: "lobby-set",
      ...patch,
      ...(patch.settings || patch.seats ? { settings: { askToSit, ...patch.settings } } : {}),
    });
  const seats = (...ids: string[]) => ids.map((id) => ({ id, label: `Hero ${id}` }));
  return { storage, clock, room, make, send, join, host, lobbySet, seats };
}

describe("a lobby room: names, build and the lobby message", () => {
  it("advertises chat and seats, a plain room only watch, and sends the lobby with the host's build stamped", async () => {
    const { host } = await setup();
    const h = await host();
    expect(h.last("welcome")!.caps).toEqual(LOBBY_ROOM_CAPS);
    expect(LOBBY_ROOM_CAPS).toEqual(["watch", "chat", "seats", "play", "tables", "teams"]);
    expect(h.last("welcome")!.you).toMatchObject({ role: "host", name: "Hosty", build: BUILD });
    expect(h.last("lobby")).toMatchObject({
      code: CODE,
      seats: [],
      settings: { playMode: "strict", multiSeat: false, chat: true, ...BUILD },
    });
    const plain = await setup({ lobby: false });
    const p = await plain.join(plain.room, { name: "Ann" });
    expect(p.last("welcome")!.caps).toEqual(ROOM_CAPS);
    expect(p.last("welcome")!.you.name).toBeUndefined();
    expect(p.last("lobby")).toBeUndefined();
  });

  it("requires a name in a lobby room: trimmed, at most 24 characters, else refuses name-required and closes", async () => {
    const { room, join } = await setup();
    const none = await join(room, { name: null });
    expect(none.refusals).toEqual(["name-required"]);
    expect(none.closed).not.toBeNull();
    const blank = await join(room, { name: "   \n " });
    expect(blank.refusals).toEqual(["name-required"]);
    const trimmed = await join(room, { name: "  Bea  " });
    expect(trimmed.last("welcome")!.you.name).toBe("Bea");
    expect(room.participantCount).toBe(1);
    const edge = await join(room, { name: "x".repeat(MAX_NAME_LENGTH) });
    expect(edge.last("welcome")!.you.name).toHaveLength(24);
    // A watch room's hello may carry up to 32; a lobby room cuts a longer name to 24 code points.
    expect(
      parseClientMessage(JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [], name: "x".repeat(33) })),
    ).toBeNull();
    const cut = await join(room, { name: "y".repeat(30) });
    expect(cut.last("welcome")!.you.name).toBe("y".repeat(24));
    expect(
      parseClientMessage(JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [], name: ` ${"x".repeat(24)} ` })),
    ).not.toBeNull();
  });

  it("names every participant in the roster, with its build", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room, { name: "Ann", build: { appVersion: "0.9", contentVersion: "c1" } });
    const roster = h.last("roster")!.participants;
    expect(roster.map((p) => p.name)).toEqual(["Hosty", "Ann"]);
    expect(roster[1]!.build).toEqual({ appVersion: "0.9", contentVersion: "c1" });
    expect(a.last("welcome")!.participants).toHaveLength(2);
  });

  it("sends a joiner the current lobby after welcome", async () => {
    const { room, host, join, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { settings: { playMode: "host", mods: [{ id: "m", version: "1" }] }, seats: seats("s1", "s2") });
    const w = await join(room);
    expect(w.last("lobby")).toMatchObject({
      code: CODE,
      settings: { playMode: "host", mods: [{ id: "m", version: "1" }] },
      seats: [{ id: "s1" }, { id: "s2" }],
    });
    expect(w.sent.map((m) => m.kind).indexOf("welcome")).toBeLessThan(w.sent.map((m) => m.kind).indexOf("lobby"));
  });
});

describe("who may set the lobby", () => {
  it("lets only the host set settings and seats, and refuses everyone else not-allowed", async () => {
    const { room, host, join, lobbySet, seats } = await setup();
    const h = await host();
    const w = await join(room);
    await lobbySet(w, { settings: { playMode: "host" }, seats: seats("s1") });
    expect(w.refusals).toEqual(["not-allowed"]);
    expect(h.last("lobby")!.settings.playMode).toBe("strict");
    await lobbySet(h, { settings: { playMode: "host", multiSeat: true, chat: false }, seats: seats("s1", "s2") });
    expect(h.refusals).toEqual([]);
    expect(w.last("lobby")).toMatchObject({ settings: { playMode: "host", multiSeat: true, chat: false } });
    expect(w.last("lobby")!.seats.map((s) => s.label)).toEqual(["Hero s1", "Hero s2"]);
  });

  it("holds Host sees every hand: off by default, host-only to set, shown to everyone (#887)", async () => {
    const { room, host, join, lobbySet } = await setup();
    const h = await host();
    const w = await join(room);
    expect(h.last("lobby")!.settings.hostSeesHands).toBe(false);
    await lobbySet(w, { settings: { hostSeesHands: true } });
    expect(w.refusals).toEqual(["not-allowed"]);
    await lobbySet(h, { settings: { hostSeesHands: true } });
    expect(h.refusals).toEqual([]);
    expect(w.last("lobby")!.settings.hostSeesHands).toBe(true);
    // Strict rules do not touch it, and an unrelated change keeps it.
    await lobbySet(h, { settings: { playMode: "host" } });
    await lobbySet(h, { settings: { chat: false } });
    expect(h.last("lobby")!.settings.hostSeesHands).toBe(true);
    await lobbySet(h, { settings: { hostSeesHands: false } });
    expect(w.last("lobby")!.settings.hostSeesHands).toBe(false);
  });

  it("holds the undo policy: Off in Strict, Ask when Host control starts, the host's choice after, host-only to set", async () => {
    const { room, host, join, lobbySet } = await setup();
    const h = await host();
    const w = await join(room);
    expect(h.last("lobby")!.settings).toMatchObject({ playMode: "strict", undo: "off" });
    await lobbySet(h, { settings: { undo: "host" } });
    expect(h.last("lobby")!.settings.undo).toBe("off");
    await lobbySet(h, { settings: { playMode: "host" } });
    expect(w.last("lobby")!.settings).toMatchObject({ playMode: "host", undo: "ask" });
    await lobbySet(h, { settings: { undo: "host" } });
    expect(w.last("lobby")!.settings.undo).toBe("host");
    await lobbySet(h, { settings: { chat: false } });
    expect(w.last("lobby")!.settings.undo).toBe("host");
    await lobbySet(w, { settings: { undo: "ask" } });
    expect(w.refusals).toEqual(["not-allowed"]);
    expect(h.last("lobby")!.settings.undo).toBe("host");
    await lobbySet(h, { settings: { playMode: "host", undo: "off" } });
    expect(w.last("lobby")!.settings.undo).toBe("off");
    await lobbySet(h, { settings: { playMode: "strict", undo: "ask" } });
    expect(w.last("lobby")!.settings).toMatchObject({ playMode: "strict", undo: "off" });
    await lobbySet(h, { settings: { undo: "maybe" } });
    expect(h.refusals).toEqual(["bad-message"]);
  });

  it("holds the cheats setting: off by default, host-only, fixed once the game has started", async () => {
    const { room, host, join, lobbySet, send } = await setup();
    const h = await host();
    const w = await join(room);
    expect(h.last("lobby")!.settings.cheats).toBe(false);
    await lobbySet(w, { settings: { cheats: true } });
    expect(w.refusals).toEqual(["not-allowed"]);
    await lobbySet(h, { settings: { cheats: true } });
    expect(w.last("lobby")!.settings.cheats).toBe(true);
    await lobbySet(h, { settings: { chat: false } });
    expect(w.last("lobby")!.settings.cheats).toBe(true);
    await lobbySet(h, { settings: { cheats: false } });
    expect(w.last("lobby")!.settings.cheats).toBe(false);
    await lobbySet(h, { settings: { cheats: true } });
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: {} });
    await lobbySet(h, { settings: { cheats: false } });
    expect(h.refusals).toEqual(["not-allowed"]);
    expect(w.last("lobby")!.settings.cheats).toBe(true);
    await lobbySet(h, { settings: { cheats: 1 } });
    expect(h.refusals).toEqual(["not-allowed", "bad-message"]);
  });

  it("refuses a start built from an older lobby revision and stores nothing; a matching one is taken", async () => {
    const { room, host, join, lobbySet, send } = await setup();
    const h = await host();
    const w = await join(room);
    await lobbySet(h, { settings: { chat: false } });
    const built = h.last("lobby")!.rev;
    const tables = h.of("table").length;
    // A change reaches the room after the host built its game from `built`.
    await lobbySet(h, { settings: { chat: true } });
    expect(h.last("lobby")!.rev).toBeGreaterThan(built);
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, lobbyRev: built });
    expect(h.refusals).toEqual(["lobby-changed"]);
    expect(h.of("table")).toHaveLength(tables);
    expect(w.of("log")).toHaveLength(0);
    // Nothing was stored, so the lobby is still open to the cheats setting (fixed only once a header exists).
    await lobbySet(h, { settings: { cheats: true } });
    expect(h.refusals).toEqual(["lobby-changed"]);
    // The revision the game is built from now is taken.
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 2 }, lobbyRev: h.last("lobby")!.rev });
    expect(h.refusals).toEqual(["lobby-changed"]);
    expect(h.last("table")!.table).toMatchObject({ hasHeader: true, commands: 0 });
    await lobbySet(h, { settings: { cheats: false } });
    expect(h.refusals).toEqual(["lobby-changed", "not-allowed"]);
  });

  it("applies a lobby-set with ifRev only to that lobby revision, else refuses lobby-changed and stores nothing", async () => {
    const { host, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("a", "b") });
    const at = h.last("lobby")!.rev;
    // A stale revision: refused, the lobby is untouched and no new lobby is sent.
    const sent = h.of("lobby").length;
    await lobbySet(h, { settings: { chat: false }, ifRev: at - 1 });
    expect(h.refusals).toEqual(["lobby-changed"]);
    expect(h.of("lobby")).toHaveLength(sent);
    expect(h.last("lobby")!.rev).toBe(at);
    expect(h.last("lobby")!.settings.chat).toBe(true);
    // The matching revision is taken and bumps it by exactly one.
    await lobbySet(h, { settings: { chat: false }, ifRev: at });
    expect(h.refusals).toEqual(["lobby-changed"]);
    expect(h.last("lobby")!.rev).toBe(at + 1);
    expect(h.last("lobby")!.settings.chat).toBe(false);
    // A malformed one is a bad message.
    await lobbySet(h, { settings: { chat: true }, ifRev: -1 });
    expect(h.refusals).toEqual(["lobby-changed", "bad-message"]);
  });

  it("applies a lobby-set only at the revision it names (ifRev): a match bumps by one, a mismatch stores nothing, a no-op does not bump (#881)", async () => {
    const { room, host, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1", "s2") });
    const rev = h.last("lobby")!.rev;
    const mapped = [
      { id: "s1", label: "Hero s1", player: "p1" },
      { id: "s2", label: "Hero s2", player: "p2" },
    ];
    // A stale revision is refused and nothing is stored.
    await lobbySet(h, { ifRev: rev - 1, seats: mapped });
    expect(h.refusals).toEqual(["lobby-changed"]);
    expect(h.last("lobby")!.rev).toBe(rev);
    expect(h.last("lobby")!.seats.map((s) => s.player)).toEqual([undefined, undefined]);
    // The matching revision applies, and the revision is exactly one higher.
    await lobbySet(h, { ifRev: rev, seats: mapped });
    expect(h.refusals).toEqual(["lobby-changed"]);
    expect(h.last("lobby")!.rev).toBe(rev + 1);
    expect(h.last("lobby")!.seats.map((s) => s.player)).toEqual(["p1", "p2"]);
    // Setting what is already set stores nothing, so the revision a start was judged at stays.
    await lobbySet(h, { ifRev: rev + 1, seats: mapped });
    await lobbySet(h, { seats: mapped });
    expect(h.last("lobby")!.rev).toBe(rev + 1);
    expect(room).toBeDefined();
  });

  it("tells the host its start was taken, and guards a log replacement with the revision too", async () => {
    const { room, host, join, lobbySet, send } = await setup();
    const h = await host();
    const w = await join(room);
    await lobbySet(h, { settings: { chat: false } });
    const built = h.last("lobby")!.rev;
    await lobbySet(h, { settings: { chat: true } });
    // A replacement built from the old revision on a headerless table installs nothing.
    await send(room, h, { ch: "game", kind: "log", table: "t1", header: { g: 1 }, commands: [], lobbyRev: built });
    expect(h.refusals).toEqual(["lobby-changed"]);
    expect(w.of("log")).toHaveLength(0);
    expect(h.of("started")).toHaveLength(0);
    // The current revision installs it, and a start is answered with `started` to the host only.
    const rev = h.last("lobby")!.rev;
    await send(room, h, { ch: "game", kind: "log", table: "t1", header: { g: 2 }, commands: [], lobbyRev: rev });
    expect(h.last("table")!.table).toMatchObject({ hasHeader: true });
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 3 }, lobbyRev: rev });
    expect(h.of("started")).toHaveLength(1);
    expect(w.of("started")).toHaveLength(0);
  });

  it("a log whose header write fails sends no started, and the host's retry redoes the writes instead of being acked", async () => {
    const { storage, room, host, send } = await setup();
    const h = await host();
    const put = storage.put.bind(storage);
    let failing = true;
    storage.put = ((...args: Parameters<typeof put>) => {
      if (failing && (args[0] as unknown) === "t1:header") return Promise.reject(new Error("put failed"));
      return put(...(args.map((x) => structuredClone(x)) as Parameters<typeof put>));
    }) as typeof storage.put;
    const rev = h.last("lobby")!.rev;
    const log = { ch: "game", kind: "log", table: "t1", header: { g: 1 }, commands: [], lobbyRev: rev, gid: "A" };
    await send(room, h, log).catch(() => undefined);
    expect(h.of("started")).toHaveLength(0);
    expect(storage.map.has("t1:header")).toBe(false);
    failing = false;
    await send(room, h, log);
    expect(h.of("started")).toHaveLength(1);
    expect(storage.map.get("t1:header")).toMatchObject({ g: "A" });
  });

  it("an unsaved log admission is not proof: a welcome before the retry, a duplicate start and a wake all show no admission", async () => {
    const { storage, room, make, host, send, join } = await setup();
    const h = await host();
    const put = storage.put.bind(storage);
    let failing = true;
    storage.put = ((...args: Parameters<typeof put>) => {
      if (failing && (args[0] as unknown) === "t1:header") return Promise.reject(new Error("put failed"));
      return put(...(args.map((x) => structuredClone(x)) as Parameters<typeof put>));
    }) as typeof storage.put;
    const rev = h.last("lobby")!.rev;
    const log = {
      ch: "game",
      kind: "log",
      table: "t1",
      header: { g: 1 },
      commands: [{ n: 1 }],
      checksums: { "1": "sum" },
      lobbyRev: rev,
      gid: "A",
    };
    await send(room, h, log).catch(() => undefined);
    // The host reconnects before its retry: the welcome carries neither the gid nor a checkpoint to match.
    const again = await host();
    const table = again.last("welcome")!.tables[0]!;
    expect(table.gid).toBeUndefined();
    expect(table.checkpoint).toBeNull();
    // A start with the same gid is not acked as the game already admitted.
    await send(room, again, {
      ch: "game",
      kind: "start",
      table: "t1",
      header: { g: 1 },
      lobbyRev: rev,
      gid: "A",
    }).catch(() => undefined);
    expect(again.of("started")).toHaveLength(0);
    // After a wake the room holds nothing for the table either.
    const woken = make();
    const back = await join(woken, { token: TOKEN, name: "Hosty" });
    const wokenTable = back.last("welcome")!.tables[0]!;
    expect(wokenTable.gid).toBeUndefined();
    expect(wokenTable.hasHeader).toBe(false);
    // The retry, once the write works, is the admission.
    failing = false;
    await send(room, again, log);
    expect(again.of("started")).toHaveLength(1);
    const proven = await host();
    expect(proven.last("welcome")!.tables[0]).toMatchObject({ gid: "A", checkpoint: { count: 1, sum: "sum" } });
  });

  it("a repair of an admitted game that fails shows its committed gid with dirty, and recovers; the room never claims a foreign gid", async () => {
    const { storage, room, host, send } = await setup();
    const h = await host();
    const rev = h.last("lobby")!.rev;
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, lobbyRev: rev, gid: "A" });
    await send(room, h, {
      ch: "game",
      kind: "commands",
      table: "t1",
      from: 0,
      commands: [{ n: 1 }],
      checksums: { "1": "s1" },
    });
    const put = storage.put.bind(storage);
    let failing = true;
    storage.put = ((...args: Parameters<typeof put>) => {
      if (failing && (args[0] as unknown) === "t1:b:tail") return Promise.reject(new Error("put failed"));
      return put(...(args.map((x) => structuredClone(x)) as Parameters<typeof put>));
    }) as typeof storage.put;
    // A full-log repair under the same gid (no admission revision) whose tail write fails.
    const repair = {
      ch: "game",
      kind: "log",
      table: "t1",
      header: { g: 1 },
      commands: [{ n: 1 }, { n: 2 }],
      checksums: { "2": "s2" },
      gid: "A",
    };
    await send(room, h, repair).catch(() => undefined);
    const again = await host();
    const table = again.last("welcome")!.tables[0]!;
    expect(table).toMatchObject({ hasHeader: true, gid: "A", checkpoint: null, dirty: true, commands: 0 });
    // Not acked as done while unsaved; once writes work the same repair lands and the welcome is clean.
    await send(room, again, repair).catch(() => undefined);
    expect(again.of("started")).toHaveLength(0);
    failing = false;
    await send(room, again, repair);
    expect(again.of("started")).toHaveLength(1);
    const clean = await host();
    const done = clean.last("welcome")!.tables[0]!;
    expect(done).toMatchObject({ hasHeader: true, gid: "A", commands: 2, checkpoint: { count: 2, sum: "s2" } });
    expect(done.dirty).toBeUndefined();
  });

  it("a seat grant that arrives while a start is installing its header waits for it, so the game is never built from a stale revision", async () => {
    const { storage, room, host, join, lobbySet, seats, send } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1") });
    const b = await join(room, { name: "Bo" });
    const rev = h.last("lobby")!.rev;
    // Hold the header write: the start has passed its revision check and is mid-install.
    const put = storage.put.bind(storage);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    storage.put = (async (...args: Parameters<typeof put>) => {
      if ((args[0] as unknown) === "t1:header") await held;
      return put(...(args.map((x) => structuredClone(x)) as Parameters<typeof put>));
    }) as typeof storage.put;
    const starting = send(room, h, {
      ch: "game",
      kind: "start",
      table: "t1",
      header: { g: 1 },
      lobbyRev: rev,
      gid: "A",
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const granting = send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: b.id });
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The grant has not run: no token, and the lobby is still at the revision the game was built from.
    expect(b.of("seat-token")).toHaveLength(0);
    expect(h.last("lobby")!.rev).toBe(rev);
    release();
    await Promise.all([starting, granting]);
    expect(h.of("started")).toHaveLength(1);
    expect(h.refusals).toEqual([]);
    // After the install the grant lands, at a later revision.
    expect(b.of("seat-token")).toHaveLength(1);
    expect(h.last("lobby")!.rev).toBeGreaterThan(rev);
  });

  describe("admission id", () => {
    it("answers a same-gid start after the lobby moved on with started, leaving the log untouched", async () => {
      const { room, host, join, lobbySet, send } = await setup();
      const h = await host();
      const w = await join(room);
      await lobbySet(h, { settings: { chat: false } });
      const rev = h.last("lobby")!.rev;
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, lobbyRev: rev, gid: "A" });
      expect(h.of("started").at(-1)).toMatchObject({ table: "t1", gid: "A" });
      await send(room, h, { ch: "game", kind: "commands", table: "t1", from: 0, commands: [{ n: 1 }] });
      const logs = w.of("log").length;
      // The lobby moves on (a side save), the ack was lost: the same game retry is confirmed, not refused.
      await lobbySet(h, { settings: { chat: true } });
      expect(h.last("lobby")!.rev).toBeGreaterThan(rev);
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, lobbyRev: rev, gid: "A" });
      await send(room, h, {
        ch: "game",
        kind: "log",
        table: "t1",
        header: { g: 1 },
        commands: [],
        lobbyRev: rev,
        gid: "A",
      });
      expect(h.refusals).toEqual([]);
      expect(h.of("started")).toHaveLength(3);
      expect(h.last("table")!.table).toMatchObject({ hasHeader: true, commands: 1, gid: "A" });
      expect(w.of("log")).toHaveLength(logs);
    });

    it("repairs the admitted game's log without a revision and keeps its gid, across a cold wake", async () => {
      const { room, make, host, lobbySet, send } = await setup();
      const h = await host();
      await lobbySet(h, { settings: { chat: false } });
      const rev = h.last("lobby")!.rev;
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, lobbyRev: rev, gid: "A" });
      await send(room, h, { ch: "game", kind: "commands", table: "t1", from: 0, commands: [{ n: 1 }, { n: 2 }] });
      // The lobby moves on; the host's log diverged, so it repairs with a start (no revision) and then a log.
      await lobbySet(h, { settings: { chat: true } });
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, gid: "A" });
      expect(h.refusals).toEqual([]);
      expect(h.last("table")!.table).toMatchObject({ gid: "A", commands: 0 });
      await send(room, h, {
        ch: "game",
        kind: "log",
        table: "t1",
        header: { g: 1 },
        commands: [{ n: 1 }, { n: 3 }],
        gid: "A",
      });
      expect(h.refusals).toEqual([]);
      expect(h.last("table")!.table).toMatchObject({ gid: "A", commands: 2 });
      // A message with no gid never erases it.
      await send(room, h, { ch: "game", kind: "log", table: "t1", header: { g: 1 }, commands: [{ n: 1 }] });
      expect(h.last("table")!.table).toMatchObject({ gid: "A", commands: 1 });
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 } });
      expect(h.last("table")!.table).toMatchObject({ gid: "A", commands: 0 });
      const woken = make();
      const h2 = await host(woken);
      expect(h2.last("welcome")!.tables[0]).toMatchObject({ hasHeader: true, gid: "A" });
    });

    it("a bare start retry on an empty admitted table changes nothing", async () => {
      const { room, host, lobbySet, send } = await setup();
      const h = await host();
      await lobbySet(h, { settings: { chat: false } });
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, gid: "A" });
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, gid: "A" });
      expect(h.of("started")).toHaveLength(2);
      expect(h.last("table")!.table).toMatchObject({ gid: "A", commands: 0 });
    });

    it("applies the revision check to a different gid", async () => {
      const { room, host, lobbySet, send } = await setup();
      const h = await host();
      await lobbySet(h, { settings: { chat: false } });
      const rev = h.last("lobby")!.rev;
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, lobbyRev: rev, gid: "A" });
      await lobbySet(h, { settings: { chat: true } });
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 2 }, lobbyRev: rev, gid: "B" });
      expect(h.refusals).toEqual(["lobby-changed"]);
      expect(h.last("table")!.table).toMatchObject({ gid: "A" });
      const now = h.last("lobby")!.rev;
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 2 }, lobbyRev: now, gid: "B" });
      expect(h.last("table")!.table).toMatchObject({ gid: "B" });
    });

    it("answers a guarded log installation with started, and keeps the gid across a cold wake", async () => {
      const { room, make, host, lobbySet, send } = await setup();
      const h = await host();
      await lobbySet(h, { settings: { chat: false } });
      const rev = h.last("lobby")!.rev;
      await send(room, h, {
        ch: "game",
        kind: "log",
        table: "t1",
        header: { g: 1 },
        commands: [],
        lobbyRev: rev,
        gid: "L",
      });
      expect(h.of("started").at(-1)).toMatchObject({ gid: "L" });
      const woken = make();
      const h2 = await host(woken);
      expect(h2.last("welcome")!.tables[0]).toMatchObject({ hasHeader: true, gid: "L" });
    });
  });

  it("never takes the build versions from a client", async () => {
    const { host, lobbySet } = await setup();
    const h = await host();
    await lobbySet(h, { settings: { appVersion: "evil", contentVersion: "evil", playMode: "host" } });
    expect(h.last("lobby")!.settings).toMatchObject({ appVersion: "1.2.3", contentVersion: "c9", playMode: "host" });
  });

  it("refuses a malformed lobby-set (bad mode, too many or duplicate seats, nothing to set)", async () => {
    const { host, lobbySet, seats, send, room } = await setup();
    const h = await host();
    await lobbySet(h, { settings: { playMode: "chaos" } });
    await lobbySet(h, { seats: seats("a", "b", "c", "d", "e") });
    await lobbySet(h, {
      seats: [
        { id: "a", label: "x" },
        { id: "a", label: "y" },
      ],
    });
    await send(room, h, { ch: "room", kind: "lobby-set" });
    expect(h.refusals).toEqual(["bad-message", "bad-message", "bad-message", "bad-message"]);
  });

  it("a plain (non-lobby) room refuses every lobby and chat message not-allowed", async () => {
    const plain = await setup({ lobby: false });
    const h = await plain.join(plain.room, { token: TOKEN });
    await plain.lobbySet(h, { settings: { chat: true } }, plain.room);
    await plain.send(plain.room, h, { ch: "room", kind: "seat-request", seat: "s1" });
    await plain.send(plain.room, h, { ch: "chat", kind: "say", text: "hi" });
    expect(h.refusals).toEqual(["not-allowed", "not-allowed", "not-allowed"]);
  });

  it("keeps a kept seat's holder when the seat list is replaced, and drops a removed seat", async () => {
    const { room, host, join, lobbySet, seats, send } = await setup();
    const h = await host();
    const a = await join(room);
    await lobbySet(h, { seats: seats("s1", "s2") });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await lobbySet(h, {
      seats: [
        { id: "s1", label: "Renamed" },
        { id: "s3", label: "New" },
      ],
    });
    expect(h.last("lobby")!.seats).toMatchObject([{ id: "s1", label: "Renamed", holder: a.id }, { id: "s3" }]);
  });
});

describe("seat requests and assignments", () => {
  async function withSeats() {
    const ctx = await setup();
    const h = await ctx.host();
    await ctx.lobbySet(h, { seats: ctx.seats("s1", "s2", "s3") });
    return { ...ctx, h };
  }

  it("a request is listed until the host assigns it; the assignment sends that participant alone a token", async () => {
    const { room, join, send, h } = await withSeats();
    const a = await join(room, { name: "Ann" });
    const b = await join(room, { name: "Bo" });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(b.last("lobby")!.seats[0]).toMatchObject({ id: "s1", requested: [a.id] });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    expect(b.last("lobby")!.seats[0]).toMatchObject({ id: "s1", holder: a.id, holderName: "Ann" });
    expect(b.last("lobby")!.seats[0]!.requested).toBeUndefined();
    expect(a.of("seat-token")).toHaveLength(1);
    expect(a.last("seat-token")).toMatchObject({ seat: "s1", token: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/) });
    expect(b.of("seat-token")).toHaveLength(0);
    expect(h.of("seat-token")).toHaveLength(0);
  });

  it("only the host assigns or denies", async () => {
    const { room, join, send } = await withSeats();
    const a = await join(room);
    const b = await join(room);
    await send(room, a, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, a, { ch: "room", kind: "seat-deny", seat: "s1", participant: b.id });
    expect(a.refusals).toEqual(["not-allowed", "not-allowed"]);
    expect(a.of("seat-token")).toHaveLength(0);
  });

  it("the host may seat a participant who never asked, and may take a seat for themselves", async () => {
    const { room, join, send, h } = await withSeats();
    const a = await join(room);
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: a.id });
    await send(room, h, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(h.last("lobby")!.seats).toMatchObject([
      { id: "s1", holder: h.id, holderName: "Hosty" },
      { id: "s2", holder: a.id },
      { id: "s3" },
    ]);
    expect(h.of("seat-token")).toHaveLength(1);
  });

  it("a deny removes a request, or takes the seat from its holder", async () => {
    const { room, join, send, h } = await withSeats();
    const a = await join(room);
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    await send(room, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    expect(a.of("seat-denied")).toEqual([{ v: 1, ch: "room", kind: "seat-denied", seat: "s1" }]);
    expect(h.last("lobby")!.seats[0]!.requested).toBeUndefined();
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
    await send(room, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    // Nothing left to deny: the host gets the current lobby, not a dead-end refusal.
    expect(h.refusals).toEqual([]);
  });

  it("takes a seat from its holder without a seat-denied notice (only a pending request gets one)", async () => {
    const { room, join, send, h } = await withSeats();
    const a = await join(room);
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    expect(a.of("seat-denied")).toHaveLength(0);
  });

  it("a lobby room reuses its room for a rematch: a start on an ended table begins a new game", async () => {
    const { room, host, send, clock, storage } = await setup();
    const h = await host();
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 } });
    await send(room, h, { ch: "game", kind: "commands", table: "t1", from: 0, commands: [1, 2] });
    await send(room, h, { ch: "game", kind: "end", table: "t1", outcome: 1 });
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 2 } });
    expect(h.refusals).toEqual([]);
    expect(h.last("table")!.table).toMatchObject({ ended: false, commands: 0, hasHeader: true });
    // The end alarm gave way to the idle one.
    expect(storage.alarm).toBe(clock.now + ROOM_IDLE_MS);
  });

  describe("a new start commits its header before the old game rows are deleted", () => {
    const completedGame = async () => {
      const ctx = await setup();
      const h = await ctx.host();
      await ctx.send(ctx.room, h, { ch: "game", kind: "start", table: "t1", header: { g: "A" }, gid: "A" });
      const commands = Array.from({ length: 45 }, (_, i) => ({ n: i }));
      await ctx.send(ctx.room, h, { ch: "game", kind: "commands", table: "t1", from: 0, commands });
      await ctx.send(ctx.room, h, { ch: "game", kind: "end", table: "t1", outcome: 1 });
      return { ...ctx, h };
    };

    it("a failed header put leaves the old game whole after a wake: header, commands and ended lifecycle", async () => {
      const { storage, room, send, h, make, join } = await completedGame();
      const put = storage.put.bind(storage);
      storage.put = ((...args: Parameters<typeof put>) => {
        if ((args[0] as unknown) === "t1:header" || "t1:header" in (args[0] as object))
          return Promise.reject(new Error("put failed"));
        return put(...(args.map((x) => structuredClone(x)) as Parameters<typeof put>));
      }) as typeof storage.put;
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: "B" }, gid: "B" }).catch(
        () => undefined,
      );
      expect(h.of("started")).toHaveLength(1);
      const back = await join(make(), { token: TOKEN, name: "Hosty" });
      expect(back.last("welcome")!.tables[0]).toMatchObject({ hasHeader: true, gid: "A", commands: 45, ended: true });
    });

    it("a failed delete after the new header landed serves the new game with none of the old commands after a wake", async () => {
      const { storage, room, send, h, make, join } = await completedGame();
      const del = storage.delete.bind(storage) as (k: unknown) => Promise<unknown>;
      storage.delete = ((key: unknown) => {
        const keys = typeof key === "string" ? [key] : (key as string[]);
        if (keys.some((k) => k.startsWith("t1:"))) return Promise.reject(new Error("delete failed"));
        return del(key);
      }) as typeof storage.delete;
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: "B" }, gid: "B" });
      expect(h.of("started")).toHaveLength(2);
      // The old rows are still there, but of another generation.
      expect([...storage.map.keys()].some((k) => k.startsWith("t1:c:"))).toBe(true);
      const back = await join(make(), { token: TOKEN, name: "Hosty" });
      const table = back.last("welcome")!.tables[0]!;
      expect(table).toMatchObject({ hasHeader: true, gid: "B", commands: 0 });
      expect(table.ended).toBeFalsy();
    });

    it("a same-gid repair whose header put fails leaves the committed game commands for a wake", async () => {
      const { storage, room, send, h, make, join } = await completedGame();
      const put = storage.put.bind(storage);
      storage.put = ((...args: Parameters<typeof put>) => {
        if ((args[0] as unknown) === "t1:header" || "t1:header" in (args[0] as object))
          return Promise.reject(new Error("put failed"));
        return put(...(args.map((x) => structuredClone(x)) as Parameters<typeof put>));
      }) as typeof storage.put;
      const commands = Array.from({ length: 50 }, (_, i) => ({ n: i }));
      await send(room, h, { ch: "game", kind: "log", table: "t1", header: { g: "A" }, commands, gid: "A" }).catch(
        () => undefined,
      );
      const back = await join(make(), { token: TOKEN, name: "Hosty" });
      expect(back.last("welcome")!.tables[0]).toMatchObject({ hasHeader: true, gid: "A", commands: 45 });
    });

    describe("a replacement log commits only once its rows are durable", () => {
      const failing = (storage: { put: unknown }, match: (key: string) => boolean) => {
        const real = (storage as { put: (...a: unknown[]) => Promise<unknown> }).put.bind(storage);
        let on = true;
        (storage as { put: unknown }).put = (...args: unknown[]) => {
          const keys = typeof args[0] === "string" ? [args[0]] : Object.keys(args[0] as object);
          if (on && keys.some(match)) return Promise.reject(new Error("put failed"));
          return real(...args.map((x) => structuredClone(x)));
        };
        return () => (on = false);
      };
      const replacement = Array.from({ length: 55 }, (_, i) => ({ n: i }));
      const repair = { ch: "game", kind: "log", table: "t1", header: { g: "A" }, commands: replacement, gid: "A" };

      for (const [name, match] of [
        ["first chunk put", (k: string) => k.startsWith("t1:b:c:")],
        ["tail put", (k: string) => k === "t1:b:tail"],
        ["header and reopened meta put", (k: string) => k === "meta"],
      ] as const) {
        it(`a failed ${name} after the replacement started leaves the 45 committed commands for a wake, and a retry commits all 55`, async () => {
          const { storage, room, send, h, make, join } = await completedGame();
          const heal = failing(storage, match);
          await send(room, h, repair).catch(() => undefined);
          expect(storage.map.get("t1:header")).toMatchObject({ g: "A", sg: 1 });
          const woken = await join(make(), { token: TOKEN, name: "Hosty" });
          // One committed game: its header, its 45 commands, and the ended lifecycle with its outcome, never a mix.
          expect(woken.last("welcome")!.tables[0]).toMatchObject({
            hasHeader: true,
            gid: "A",
            commands: 45,
            ended: true,
          });
          expect(storage.map.get("meta")).toMatchObject({ ended: true, outcome: 1 });
          heal();
          await send(room, h, repair);
          const done = await join(make(), { token: TOKEN, name: "Hosty" });
          expect(done.last("welcome")!.tables[0]).toMatchObject({ gid: "A", commands: 55 });
          expect(done.last("welcome")!.tables[0]!.ended).toBeFalsy();
          expect(storage.map.get("meta")).toMatchObject({ ended: false });
          expect(storage.map.get("t1:header")).toMatchObject({ sg: 2 });
          // The previous generation's rows are gone once the switch has committed.
          expect([...storage.map.keys()].filter((k) => k.startsWith("t1:c:") || k === "t1:tail")).toEqual([]);
        });
      }
    });

    it("a rematch whose reopened lifecycle cannot be stored is not acknowledged, and a wake finds the ended game", async () => {
      const { storage, room, send, h, make, join } = await completedGame();
      const real = storage.put.bind(storage);
      storage.put = ((...args: Parameters<typeof real>) => {
        if (typeof args[0] === "object" && "meta" in (args[0] as object))
          return Promise.reject(new Error("put failed"));
        return real(...(args.map((x) => structuredClone(x)) as Parameters<typeof real>));
      }) as typeof storage.put;
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: "B" }, gid: "B" }).catch(
        () => undefined,
      );
      expect(h.of("started")).toHaveLength(1);
      const back = await join(make(), { token: TOKEN, name: "Hosty" });
      expect(back.last("welcome")!.tables[0]).toMatchObject({ gid: "A", commands: 45, ended: true });
    });

    it("a rematch whose alarm swap fails is stored open: a wake does not find it ended", async () => {
      const { storage, room, send, h, make, join } = await completedGame();
      storage.setAlarm = () => Promise.reject(new Error("alarm failed"));
      await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: "B" }, gid: "B" });
      expect(h.of("started")).toHaveLength(2);
      const back = await join(make(), { token: TOKEN, name: "Hosty" });
      const table = back.last("welcome")!.tables[0]!;
      expect(table).toMatchObject({ gid: "B", commands: 0 });
      expect(table.ended).toBeFalsy();
      expect(storage.map.get("meta")).toMatchObject({ ended: false });
    });
  });

  it("a participant releases a held seat or withdraws a request; a stranger's release is refused", async () => {
    const { room, join, send, h } = await withSeats();
    const a = await join(room);
    const b = await join(room);
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    await send(room, a, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(h.last("lobby")!.seats[0]!.requested).toBeUndefined();
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, b, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(b.refusals).toEqual(["not-allowed"]);
    await send(room, a, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
  });

  it("refuses an unknown seat, a taken seat, and an assignment to someone not in the room", async () => {
    const { room, join, send, h } = await withSeats();
    const a = await join(room);
    const b = await join(room);
    await send(room, a, { ch: "room", kind: "seat-request", seat: "nope" });
    expect(a.refusals).toEqual(["no-such-seat"]);
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, b, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(b.refusals).toEqual(["seat-taken"]);
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: b.id });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: "ghost" });
    expect(h.refusals).toEqual(["seat-taken", "no-such-participant"]);
  });

  it("drops a participant's requests when it disconnects but keeps the seats it holds", async () => {
    const { room, join, send, h } = await withSeats();
    const a = await join(room);
    const b = await join(room);
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, b, { ch: "room", kind: "seat-request", seat: "s2" });
    await room.close(b);
    expect(h.last("lobby")!.seats[1]!.requested).toBeUndefined();
    await room.close(a);
    expect(h.last("lobby")!.seats[0]).toMatchObject({ holder: a.id, holderName: "Ann" });
  });
});

describe("one person, several seats", () => {
  it("allows a second seat only when the host allows it", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1", "s2") });
    const a = await join(room);
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s2" });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: a.id });
    expect(a.refusals).toEqual(["multi-seat"]);
    expect(h.refusals).toEqual(["multi-seat"]);
    await lobbySet(h, { settings: { multiSeat: true } });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s2" });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: a.id });
    expect(h.last("lobby")!.seats.map((s) => s.holder)).toEqual([a.id, a.id]);
  });

  it("refuses to turn multi-seat off while someone holds two, and allows it once they hold one", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1", "s2"), settings: { multiSeat: true } });
    const a = await join(room);
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: a.id });
    await lobbySet(h, { settings: { multiSeat: false } });
    expect(h.refusals).toEqual(["multi-seat"]);
    expect(h.last("lobby")!.settings.multiSeat).toBe(true);
    await send(room, a, { ch: "room", kind: "seat-release", seat: "s2" });
    await lobbySet(h, { settings: { multiSeat: false } });
    expect(h.last("lobby")!.settings.multiSeat).toBe(false);
  });
});

describe("a seat requires the host's build", () => {
  it("refuses a request or an assignment when the app or content version differs, or the build is missing", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1") });
    const oldApp = await join(room, { build: { appVersion: "1.2.2", contentVersion: "c9" } });
    const oldContent = await join(room, { build: { appVersion: "1.2.3", contentVersion: "c8" } });
    const none = await join(room, { build: null });
    for (const s of [oldApp, oldContent, none]) {
      await send(room, s, { ch: "room", kind: "seat-request", seat: "s1" });
      expect(s.refusals).toEqual(["build-mismatch"]);
      await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: s.id });
    }
    expect(h.refusals).toEqual(["build-mismatch", "build-mismatch", "build-mismatch"]);
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
    const match = await join(room, { build: { ...BUILD } });
    await send(room, match, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(match.refusals).toEqual([]);
    expect(h.last("lobby")!.seats[0]!.requested).toEqual([match.id]);
  });

  it("requires equal rules fingerprints when both sides send one, and falls back to versions when one does not", async () => {
    const { room, join, send, lobbySet, seats } = await setup();
    const h = await join(room, { token: TOKEN, build: { ...BUILD, rules: "aaaaaaaaaaaaaaaa" } });
    await lobbySet(h, { seats: seats("s1", "s2", "s3") });
    expect(h.last("lobby")!.settings.rules).toBe("aaaaaaaaaaaaaaaa");
    const other = await join(room, { build: { ...BUILD, rules: "bbbbbbbbbbbbbbbb" } });
    await send(room, other, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(other.refusals).toEqual(["build-mismatch"]);
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: other.id });
    expect(h.refusals).toEqual(["build-mismatch"]);
    const same = await join(room, { build: { ...BUILD, rules: "aaaaaaaaaaaaaaaa" } });
    await send(room, same, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(same.refusals).toEqual([]);
    // An older client sends no fingerprint: the versions alone decide.
    const old = await join(room, { build: { ...BUILD } });
    await send(room, old, { ch: "room", kind: "seat-request", seat: "s2" });
    expect(old.refusals).toEqual([]);
  });

  it("falls back to versions when the host sent no fingerprint, and still refuses different versions", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1") });
    expect(h.last("lobby")!.settings.rules).toBeUndefined();
    const withRules = await join(room, { build: { ...BUILD, rules: "bbbbbbbbbbbbbbbb" } });
    await send(room, withRules, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(withRules.refusals).toEqual([]);
    const wrongVersion = await join(room, { build: { appVersion: "9.9.9", contentVersion: "c9", rules: "x" } });
    await send(room, wrongVersion, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(wrongVersion.refusals).toEqual(["build-mismatch"]);
  });

  it("a mismatched participant can still watch and chat", async () => {
    const { room, join, host } = await setup();
    await host();
    const w = await join(room, { build: { appVersion: "0.1", contentVersion: "x" } });
    expect(w.last("welcome")).toBeDefined();
    await room.message(w, JSON.stringify({ v: 1, ch: "chat", kind: "say", text: "hi" }));
    expect(w.last("said")).toMatchObject({ text: "hi" });
  });

  it("closes seats when the host sent no build, since nobody can match", async () => {
    const { room, join, send, lobbySet, seats } = await setup();
    const h = await join(room, { token: TOKEN, build: null });
    await lobbySet(h, { seats: seats("s1") });
    const a = await join(room);
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(a.refusals).toEqual(["build-mismatch"]);
  });

  it("follows the host's build when the host reconnects on another one", async () => {
    const { room, host, join, lobbySet, seats, send } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1") });
    const a = await join(room);
    const h2 = await join(room, { token: TOKEN, build: { appVersion: "1.2.4", contentVersion: "c9" } });
    expect(a.last("lobby")!.settings.appVersion).toBe("1.2.4");
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(a.refusals).toEqual(["build-mismatch"]);
    expect(h2.refusals).toEqual([]);
  });
});

describe("seat tokens", () => {
  async function seated() {
    const ctx = await setup();
    const h = await ctx.host();
    await ctx.lobbySet(h, { seats: ctx.seats("s1", "s2") });
    const a = await ctx.join(ctx.room, { name: "Ann" });
    await ctx.send(ctx.room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    return { ...ctx, h, a, token: a.last("seat-token")!.token };
  }

  it("stores only a hash of the token", async () => {
    const { storage, token } = await seated();
    expect(JSON.stringify([...storage.map.values()])).not.toContain(token);
    const lobby = storage.map.get("lobby") as { seats: { tokenHash?: string }[] };
    expect(lobby.seats[0]!.tokenHash).toBe(await sha256Hex(token));
    expect(lobby.seats[1]!.tokenHash).toBeUndefined();
  });

  it("never puts the token hash in the broadcast lobby", async () => {
    const { h } = await seated();
    expect(JSON.stringify(h.last("lobby"))).not.toContain("tokenHash");
  });

  it("a seated guest's reconnect stores and sends the new holder but keeps the lobby revision (a Start in flight survives it)", async () => {
    const { room, join, h, a, token } = await seated();
    const rev = h.last("lobby")!.rev;
    await room.close(a);
    const back = await join(room, { name: "Ann", seatTokens: [token] });
    expect(h.last("lobby")!.seats[0]!.holder).toBe(back.id);
    expect(h.last("lobby")!.rev).toBe(rev);
    expect(back.last("lobby")!.rev).toBe(rev);
  });

  it("a host's Start built at the lobby revision still lands after a seated guest's socket dropped and came back", async () => {
    const { room, join, send, h, a, token } = await seated();
    const built = h.last("lobby")!.rev;
    await room.close(a);
    await join(room, { name: "Ann", seatTokens: [token] });
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: { g: 1 }, lobbyRev: built });
    expect(h.of("refused").map((m) => m.reason)).not.toContain("lobby-changed");
    expect(h.last("table")!.table).toMatchObject({ hasHeader: true });
  });

  it("the host's reconnect (its own seat, the same build) keeps the lobby revision", async () => {
    const { room, join, send, h } = await seated();
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: h.id });
    const hostToken = h.last("seat-token")!.token;
    const rev = h.last("lobby")!.rev;
    await room.close(h);
    const back = await join(room, { token: TOKEN, name: "Hosty", seatTokens: [hostToken] });
    expect(back.last("lobby")!.seats[1]!.holder).toBe(back.id);
    expect(back.last("lobby")!.rev).toBe(rev);
  });

  it("a reclaim that is a real change still bumps the revision (another name, a build re-stamp)", async () => {
    const { room, join, h, a, token } = await seated();
    const rev = h.last("lobby")!.rev;
    await room.close(a);
    const renamed = await join(room, { name: "Anna", seatTokens: [token] });
    expect(renamed.last("lobby")!.rev).toBe(rev + 1);
    const host2 = await join(room, { token: TOKEN, build: { ...BUILD, contentVersion: "c10" } });
    expect(host2.last("lobby")!.rev).toBe(rev + 2);
  });

  it("restores the seat for a reconnecting participant (a new id), keeping the same token", async () => {
    const { room, join, h, a, token } = await seated();
    await room.close(a);
    expect(h.last("lobby")!.seats[0]!.holder).toBe(a.id);
    const back = await join(room, { name: "Ann", seatTokens: [token] });
    expect(back.id).not.toBe(a.id);
    expect(h.last("lobby")!.seats[0]).toMatchObject({ holder: back.id, holderName: "Ann" });
    expect(back.last("lobby")!.seats[0]!.holder).toBe(back.id);
    expect(back.of("seat-token")).toHaveLength(0);
    // The old token still opens the seat on the next reconnect.
    await room.close(back);
    const again = await join(room, { name: "Ann", seatTokens: [token] });
    expect(h.last("lobby")!.seats[0]!.holder).toBe(again.id);
  });

  it("restores after the room hibernates: a new object over the same storage, tokens from before", async () => {
    const { storage, make, join, h, a, token } = await seated();
    const woken = make();
    woken.restore(h);
    await woken.close(a);
    const back = await join(woken, { name: "Ann", seatTokens: [token] });
    expect(back.last("lobby")!.seats[0]).toMatchObject({ holder: back.id, label: "Hero s1" });
    expect(h.last("lobby")!.seats[0]!.holder).toBe(back.id);
    expect(storage.map.has("lobby")).toBe(true);
  });

  it("ignores a wrong or foreign token, and a token whose seat was taken back", async () => {
    const { room, join, send, h, a, token } = await seated();
    const stranger = await join(room, { name: "Eve", seatTokens: ["Z".repeat(32), "short"] });
    expect(h.last("lobby")!.seats[0]!.holder).toBe(a.id);
    expect(stranger.of("seat-token")).toHaveLength(0);
    await send(room, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    const late = await join(room, { name: "Ann", seatTokens: [token] });
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
    expect(late.last("lobby")!.seats[0]!.holder).toBeUndefined();
  });

  it("a new assignment makes a new token and the old one stops working", async () => {
    const { room, join, send, h, a, token } = await seated();
    await send(room, a, { ch: "room", kind: "seat-release", seat: "s1" });
    const b = await join(room, { name: "Bo" });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: b.id });
    expect(b.last("seat-token")!.token).not.toBe(token);
    await join(room, { name: "Ann", seatTokens: [token] });
    expect(h.last("lobby")!.seats[0]!.holder).toBe(b.id);
  });

  it("sends no token when the lobby put fails, leaves memory as it was, and a token still rejoins after a wake", async () => {
    const { storage, room, make, join, send, h, a, token } = await seated();
    const b = await join(room, { name: "Bo" });
    // The real storage copies a row as it writes it, and a failed put writes nothing.
    const put = storage.put.bind(storage);
    let failing = true;
    storage.put = ((...args: Parameters<typeof put>) => {
      if (failing && (args[0] as unknown) === "lobby") return Promise.reject(new Error("put failed"));
      return put(...(args.map((x) => structuredClone(x)) as Parameters<typeof put>));
    }) as typeof storage.put;
    // Grant: the host seats Bo at s2, but the row cannot be saved. No token, no holder, a refusal.
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: b.id });
    expect(h.refusals).toEqual(["not-saved"]);
    expect(b.of("seat-token")).toHaveLength(0);
    expect(h.last("lobby")!.seats[1]!.holder).toBeUndefined();
    // A take-back that cannot be saved changes nothing either: Ann keeps s1 and her token.
    await send(room, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    expect(h.last("lobby")!.seats[0]!.holder).toBe(a.id);
    // The room is evicted before any retry: a new object over what was stored. Ann's token still reclaims s1.
    failing = false;
    const woken = make();
    woken.restore(h);
    woken.restore(b);
    await woken.close(a);
    const back = await join(woken, { name: "Ann", seatTokens: [token] });
    expect(back.last("lobby")!.seats[0]!.holder).toBe(back.id);
    expect(back.last("lobby")!.seats[1]!.holder).toBeUndefined();
    // With storage back, the same grant now succeeds and the token that goes out matches the stored hash.
    await send(woken, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: b.id });
    const fresh = b.last("seat-token")!.token;
    const row = storage.map.get("lobby") as { seats: { tokenHash?: string }[] };
    expect(row.seats[1]!.tokenHash).toBe(await sha256Hex(fresh));
  });

  it("a rejoin by token that cannot be saved is refused with not-saved and gets the lobby as it is", async () => {
    const { storage, room, join, a, token } = await seated();
    await room.close(a);
    const put = storage.put.bind(storage);
    storage.put = ((...args: Parameters<typeof put>) => {
      if ((args[0] as unknown) === "lobby") return Promise.reject(new Error("put failed"));
      return put(...args);
    }) as typeof storage.put;
    const back = await join(room, { name: "Ann", seatTokens: [token] });
    expect(back.refusals).toEqual(["not-saved"]);
    // The seat still shows its old holder, so the guest keeps its token; nothing was stored.
    expect(back.last("lobby")!.seats[0]!.holder).toBe(a.id);
    storage.put = put;
    const again = await join(room, { name: "Ann", seatTokens: [token] });
    expect(again.last("lobby")!.seats[0]!.holder).toBe(again.id);
  });

  it("two overlapping grants: the failed one rolls back alone, the other stores its hash before its token goes out", async () => {
    const { storage, room, join, send, lobbySet, seats, h } = await seated();
    await lobbySet(h, { seats: seats("s1", "s2", "s3") });
    const b = await join(room, { name: "Bo" });
    const c = await join(room, { name: "Cy" });
    const startRev = (storage.map.get("lobby") as { rev: number }).rev;
    const put = storage.put.bind(storage);
    const revs: number[] = [];
    let failNext = true;
    storage.put = (async (...args: Parameters<typeof put>) => {
      if ((args[0] as unknown) !== "lobby") return put(...args);
      // The put is slow, so a second grant would run during it if the room allowed.
      await new Promise((r) => setTimeout(r, 5));
      if (failNext) {
        failNext = false;
        throw new Error("put failed");
      }
      const row = structuredClone((args as unknown[])[1]) as { rev: number };
      revs.push(row.rev);
      return put("lobby", row);
    }) as typeof storage.put;
    await Promise.all([
      send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: b.id }),
      send(room, h, { ch: "room", kind: "seat-assign", seat: "s3", participant: c.id }),
    ]);
    expect(b.of("seat-token")).toHaveLength(0);
    const row = storage.map.get("lobby") as {
      rev: number;
      seats: { id: string; holder?: string; tokenHash?: string }[];
    };
    expect(row.seats.find((s) => s.id === "s2")!.holder).toBeUndefined();
    expect(row.seats.find((s) => s.id === "s3")!.tokenHash).toBe(await sha256Hex(c.last("seat-token")!.token));
    expect(revs).toEqual([startRev + 1]);
    expect(row.rev).toBe(startRev + 1);
    expect(h.last("lobby")!.seats.find((s) => s.id === "s3")!.holder).toBe(c.id);
  });

  it("rejects a hello with too many seat tokens", () => {
    const hello = { v: 1, ch: "room", kind: "hello", caps: [], seatTokens: Array.from({ length: 9 }, () => "x") };
    expect(parseClientMessage(JSON.stringify(hello))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...hello, seatTokens: ["x"] }))).not.toBeNull();
  });
});

describe("storage", () => {
  it("writes the lobby row only when the lobby changes, never for a chat line or a roster change", async () => {
    const { storage, room, host, join, lobbySet, seats, send } = await setup();
    expect([...storage.map.keys()]).toEqual(["meta"]);
    const h = await host();
    // The host's first build stamp is the first write of the row.
    expect([...storage.map.keys()].sort()).toEqual(["lobby", "meta"]);
    await lobbySet(h, { seats: seats("s1") });
    const a = await join(room);
    const before = JSON.stringify([...storage.map.entries()]);
    let puts = 0;
    const put = storage.put.bind(storage);
    storage.put = ((...args: Parameters<typeof put>) => {
      puts += 1;
      return put(...args);
    }) as typeof storage.put;
    await room.close(a);
    const b = await join(room);
    expect(puts).toBe(0);
    expect(JSON.stringify([...storage.map.entries()])).toBe(before);
    // A chat line writes the small chat row and never the lobby row.
    const lobbyRow = JSON.stringify(storage.map.get("lobby"));
    for (let i = 0; i < 3; i++) await send(room, b, { ch: "chat", kind: "say", text: `line ${i}` });
    expect(puts).toBe(3);
    expect(JSON.stringify(storage.map.get("lobby"))).toBe(lobbyRow);
    await lobbySet(h, { settings: { playMode: "host" } });
    expect(puts).toBe(4);
  });

  it("stores the code and room id in meta, so the lobby survives a wake", async () => {
    const { storage } = await setup();
    expect(storage.map.get("meta")).toMatchObject({ code: CODE, roomId: ROOM_ID });
  });

  it("a plain room's storage is unchanged: meta only, no code", async () => {
    const { storage } = await setup({ lobby: false });
    expect(storage.map.get("meta")).toEqual({ hostTokenHash: await sha256Hex(TOKEN), createdAt: 1_000 });
  });
});

describe("chat", () => {
  const say = (r: GameRoomLogic, s: RoomSocket, text: string) =>
    r.message(s, JSON.stringify({ v: 1, ch: "chat", kind: "say", text }));

  it("broadcasts a line to everyone, with the sender's id and name and the room's clock", async () => {
    const { room, host, join, clock } = await setup();
    const h = await host();
    const a = await join(room, { name: "Ann" });
    clock.now = 5_000;
    await say(room, a, "  hello there ");
    for (const s of [h, a])
      expect(s.last("said")).toEqual({
        v: 1,
        ch: "chat",
        kind: "said",
        from: a.id,
        name: "Ann",
        text: "hello there",
        at: 5_000,
      });
  });

  it("cuts a line to 280 characters (a soft outcome, not a refusal) and refuses an empty one", async () => {
    const { room, join } = await setup();
    const a = await join(room);
    await say(room, a, "x".repeat(MAX_CHAT_LENGTH));
    expect(a.of("said")).toHaveLength(1);
    await say(room, a, "x".repeat(MAX_CHAT_LENGTH + 50));
    expect(a.last("said")!.text).toBe("x".repeat(MAX_CHAT_LENGTH));
    await say(room, a, "   ");
    expect(a.refusals).toEqual(["bad-message"]);
  });

  it("flattens control characters so a line cannot forge a second one", async () => {
    const { room, join } = await setup();
    const a = await join(room);
    await say(room, a, "one\ntwo\u0000three");
    expect(a.last("said")!.text).toBe("one two three");
  });

  it("allows a burst of 5, then 1 a second, per participant", async () => {
    const { room, join, clock } = await setup();
    const a = await join(room, { name: "Ann" });
    const b = await join(room, { name: "Bo" });
    for (let i = 0; i < CHAT_BURST; i++) await say(room, a, `a${i}`);
    expect(a.refusals).toEqual([]);
    await say(room, a, "too fast");
    expect(a.refusals).toEqual(["rate-limited"]);
    // Another participant has its own bucket.
    await say(room, b, "me too");
    expect(b.refusals).toEqual([]);
    clock.now += 999;
    await say(room, a, "still early");
    expect(a.refusals).toEqual(["rate-limited", "rate-limited"]);
    clock.now += 1;
    await say(room, a, "now");
    expect(a.refusals).toHaveLength(2);
    expect(a.last("said")!.text).toBe("now");
    await say(room, a, "again");
    expect(a.refusals).toHaveLength(3);
  });

  it("a rate-limited chat never closes the socket", async () => {
    const { room, join } = await setup();
    const a = await join(room);
    for (let i = 0; i < 40; i++) await say(room, a, "spam");
    expect(a.refusals.filter((r) => r === "rate-limited")).toHaveLength(35);
    expect(a.closed).toBeNull();
  });

  it("is refused not-allowed when the host turns chat off, and works again when it is on", async () => {
    const { room, host, join, lobbySet } = await setup();
    const h = await host();
    const a = await join(room);
    await lobbySet(h, { settings: { chat: false } });
    await say(room, a, "hi");
    expect(a.refusals).toEqual(["not-allowed"]);
    expect(h.of("said")).toHaveLength(0);
    await lobbySet(h, { settings: { chat: true } });
    await say(room, a, "hi");
    expect(h.last("said")!.text).toBe("hi");
  });

  it("keeps the last 50 lines in memory and sends them to a joiner, oldest first, in one backlog", async () => {
    const { room, join, clock } = await setup();
    const a = await join(room);
    for (let i = 0; i < 60; i++) {
      clock.now += 1_000;
      await say(room, a, `m${i}`);
    }
    const late = await join(room, { name: "Late" });
    const backlog = late.last("backlog")!;
    expect(backlog.lines).toHaveLength(CHAT_BACKLOG_LINES);
    expect(backlog.lines[0]!.text).toBe("m10");
    expect(backlog.lines.at(-1)!.text).toBe("m59");
    expect(late.sent.map((m) => m.kind).indexOf("welcome")).toBeLessThan(
      late.sent.map((m) => m.kind).indexOf("backlog"),
    );
  });

  it("sends no backlog when there is none or chat is off (and off clears it), and a woken room reloads it from storage", async () => {
    const { room, host, join, lobbySet, make, storage } = await setup();
    const h = await host();
    expect((await join(room)).last("backlog")).toBeUndefined();
    const a = await join(room);
    await say(room, a, "hello");
    await lobbySet(h, { settings: { chat: false } });
    expect((await join(room)).last("backlog")).toBeUndefined();
    // Turning chat off drops the stored lines, so turning it back on starts clean.
    expect(storage.map.has("chat")).toBe(false);
    await lobbySet(h, { settings: { chat: true } });
    expect((await join(room)).last("backlog")).toBeUndefined();
    await say(room, a, "again");
    const woken = make();
    expect((await join(woken)).last("backlog")!.lines.map((l) => l.text)).toEqual(["again"]);
  });

  it("is refused before hello", async () => {
    const { room } = await setup();
    const s = new FakeSocket();
    await say(room, s, "hi");
    expect(s.refusals).toEqual(["bad-message"]);
  });
});

describe("the room code's lifetime", () => {
  function recorder() {
    const calls: string[] = [];
    const hooks: RoomCodeHooks = {
      refresh: async (code, roomId, at) => void calls.push(`refresh ${code} ${roomId} ${at}`),
      release: async (code, roomId) => void calls.push(`release ${code} ${roomId}`),
    };
    return { calls, hooks };
  }

  it("moves the code's expiry out with the room's idle alarm", async () => {
    const { calls, hooks } = recorder();
    const { room, host, clock, storage, send } = await setup({ hooks });
    const h = await host();
    clock.now += ROOM_IDLE_MS - 1000;
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: {} });
    clock.now += 1000;
    expect(await room.alarm(clock.now)).toBe("rescheduled");
    expect(calls).toEqual([`refresh ${CODE} ${ROOM_ID} ${storage.alarm! + ROOM_CODE_MARGIN_MS}`]);
  });

  it("releases the code when the room closes, idle or after the game ended", async () => {
    const idle = recorder();
    const a = await setup({ hooks: idle.hooks });
    a.clock.now += ROOM_IDLE_MS;
    expect(await a.room.alarm(a.clock.now)).toBe("closed");
    expect(idle.calls).toEqual([`release ${CODE} ${ROOM_ID}`]);

    const ended = recorder();
    const b = await setup({ hooks: ended.hooks });
    const h = await b.host();
    await b.send(b.room, h, { ch: "game", kind: "start", table: "t1", header: {} });
    await b.send(b.room, h, { ch: "game", kind: "end", table: "t1", outcome: 1 });
    b.clock.now += ROOM_END_GRACE_MS;
    expect(await b.room.alarm(b.clock.now)).toBe("closed");
    expect(ended.calls).toEqual([`release ${CODE} ${ROOM_ID}`]);
    expect(await b.room.exists()).toBe(false);
  });

  it("closes even when the code directory fails, and a plain room never calls it", async () => {
    const hooks: RoomCodeHooks = {
      refresh: async () => Promise.reject(new Error("down")),
      release: async () => Promise.reject(new Error("down")),
    };
    const a = await setup({ hooks });
    a.clock.now += ROOM_IDLE_MS;
    expect(await a.room.alarm(a.clock.now)).toBe("closed");
    expect(await a.room.exists()).toBe(false);
    const { calls, hooks: ok } = recorder();
    const plain = await setup({ lobby: false, hooks: ok });
    plain.clock.now += ROOM_IDLE_MS;
    await plain.room.alarm(plain.clock.now);
    expect(calls).toEqual([]);
  });
});

describe("watching is unchanged for a room without a lobby", () => {
  it("keeps names ignored, refuses lobby kinds and chat, and sends no lobby or backlog", async () => {
    const { room, join, send } = await setup({ lobby: false });
    const w = await join(room, { name: null, build: null });
    expect(w.last("welcome")!.you).toEqual({ id: w.id, role: "watcher" });
    await send(room, w, { ch: "room", kind: "seat-request", seat: "s1" });
    await send(room, w, { ch: "chat", kind: "say", text: "hi" });
    expect(w.refusals).toEqual(["not-allowed", "not-allowed"]);
    expect(w.sent.map((m) => m.kind)).not.toContain("lobby");
  });
});

describe("seat requests write nothing", () => {
  async function withSeat() {
    const ctx = await setup();
    const h = await ctx.host();
    await ctx.lobbySet(h, { seats: ctx.seats("s1", "s2") });
    const a = await ctx.join(ctx.room, { name: "Ann" });
    let puts = 0;
    const put = ctx.storage.put.bind(ctx.storage);
    ctx.storage.put = ((...args: Parameters<typeof put>) => {
      puts += 1;
      return put(...args);
    }) as typeof ctx.storage.put;
    return { ...ctx, h, a, puts: () => puts };
  }

  it("a loop of request and release rows nothing, however long it runs", async () => {
    const { room, send, a, h, clock, puts } = await withSeat();
    for (let i = 0; i < 200; i++) {
      clock.now += 500; // Slow enough for the lobby message rate limit, so every one is handled.
      await send(room, a, { ch: "room", kind: i % 2 === 0 ? "seat-request" : "seat-release", seat: "s1" });
    }
    expect(a.refusals).toEqual([]);
    expect(puts()).toBe(0);
    // The requests were still seen live.
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(h.last("lobby")!.seats[0]!.requested).toEqual([a.id]);
    expect(puts()).toBe(0);
  });

  it("rate limits a participant's lobby messages: a burst of 10, then 2 a second", async () => {
    const { room, send, a, h, clock, puts } = await withSeat();
    for (let i = 0; i < LOBBY_MESSAGE_BURST; i++) {
      await send(room, a, { ch: "room", kind: i % 2 === 0 ? "seat-request" : "seat-release", seat: "s1" });
    }
    expect(a.refusals).toEqual([]);
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(a.refusals).toEqual(["rate-limited"]);
    clock.now += 500;
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(a.refusals).toEqual(["rate-limited"]);
    expect(h.last("lobby")!.seats[0]!.requested).toEqual([a.id]);
    expect(puts()).toBe(0);
  });

  it("closes a socket that piles up soft refusals: 50 within 10 seconds", async () => {
    const { room, send, a } = await withSeat();
    for (let i = 0; i < 49; i++) await send(room, a, { ch: "room", kind: "seat-request", seat: "nope" });
    expect(a.closed).toBeNull();
    await send(room, a, { ch: "room", kind: "seat-request", seat: "nope" });
    expect(a.closed).not.toBeNull();
    // Spread over more than the window, the same refusals never add up.
    const b = await withSeat();
    for (let i = 0; i < 120; i++) {
      b.clock.now += 1_000;
      await b.send(b.room, b.a, { ch: "room", kind: "seat-request", seat: "nope" });
    }
    expect(b.a.closed).toBeNull();
  });

  it("writes the lobby row only when a seat's holder changes", async () => {
    const { room, send, a, h, puts } = await withSeat();
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    await send(room, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    await room.close(a);
    expect(puts()).toBe(0);
    const b = await withSeat();
    await b.send(b.room, b.h, { ch: "room", kind: "seat-assign", seat: "s1", participant: b.a.id });
    expect(b.puts()).toBe(1);
    await b.send(b.room, b.a, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(b.puts()).toBe(2);
    await b.send(b.room, b.h, { ch: "room", kind: "seat-assign", seat: "s1", participant: b.a.id });
    await b.send(b.room, b.h, { ch: "room", kind: "seat-deny", seat: "s1", participant: b.a.id });
    expect(b.puts()).toBe(4);
  });

  it("a woken room has no pending requests (they were never stored)", async () => {
    const { make, room, send, a, h } = await withSeat();
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(h.last("lobby")!.seats[0]!.requested).toEqual([a.id]);
    const woken = make();
    woken.restore(h);
    const late = await (async () => {
      const s = new FakeSocket();
      await woken.message(s, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [], name: "Late", build: BUILD }));
      return s;
    })();
    expect(late.last("lobby")!.seats[0]!.requested).toBeUndefined();
  });
});

describe("a woken room with its sockets still open (#901 review)", () => {
  it("sends everyone a fresh lobby on the first message, and a deny of a lost request answers with the lobby", async () => {
    const { make, room, send, join, host, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1") });
    const a = await join(room, { name: "Ann" });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(h.last("lobby")!.seats[0]!.requested).toEqual([a.id]);
    const woken = make();
    woken.restore(h);
    woken.restore(a);
    const hLobbies = h.of("lobby").length;
    const aLobbies = a.of("lobby").length;
    // The host denies the request the new object never heard of: no dead-end refusal, and the lobby is refreshed.
    await send(woken, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    expect(h.refusals).toEqual([]);
    expect(h.of("lobby").length).toBeGreaterThan(hLobbies);
    expect(a.of("lobby").length).toBe(aLobbies + 1);
    expect(h.last("lobby")!.seats[0]!.requested).toBeUndefined();
    // The requester asks again on the lobby it got, and the host's approval works.
    await send(woken, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(h.last("lobby")!.seats[0]!.requested).toEqual([a.id]);
    await send(woken, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    expect(a.of("seat-token")).toHaveLength(1);
    expect(h.last("lobby")!.seats[0]).toMatchObject({ holder: a.id });
  });
});

describe("the host closes the room for everyone", () => {
  it("tells every socket, closes them, releases the code and forgets the room; a guest cannot", async () => {
    const calls: string[] = [];
    const hooks: RoomCodeHooks = {
      refresh: async () => {},
      release: async (code, roomId) => void calls.push(`release ${code} ${roomId}`),
    };
    const { room, send, join, host, storage } = await setup({ hooks });
    const h = await host();
    const a = await join(room, { name: "Ann" });
    const b = await join(room, { name: "Bo" });
    await send(room, a, { ch: "room", kind: "room-close" });
    expect(a.refusals).toEqual(["not-allowed"]);
    expect(room.participantCount).toBe(3);
    expect(calls).toEqual([]);
    await send(room, h, { ch: "room", kind: "room-close" });
    for (const s of [h, a, b]) {
      expect(s.last("closed")).toMatchObject({ reason: "host" });
      expect(s.closed).not.toBeNull();
    }
    expect(calls).toEqual([`release ${CODE} ${ROOM_ID}`]);
    expect(room.participantCount).toBe(0);
    expect(await room.exists()).toBe(false);
    expect([...(await storage.list({})).keys()]).toEqual([]);
  });
});

describe("restoring a seat by token still obeys the build and multi-seat rules", () => {
  it("keeps a seat held but marks it mismatch when the holder returns on another build, and clears it on a match", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1") });
    const a = await join(room, { name: "Ann" });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    const token = a.last("seat-token")!.token;
    await room.close(a);
    const back = await join(room, {
      name: "Ann",
      build: { appVersion: "2.0.0", contentVersion: "c9" },
      seatTokens: [token],
    });
    expect(h.last("lobby")!.seats[0]).toMatchObject({ holder: back.id, mismatch: true });
    expect(back.last("lobby")!.seats[0]!.mismatch).toBe(true);
    // Back on the host's build, the mark goes.
    await room.close(back);
    const fixed = await join(room, { name: "Ann", seatTokens: [token] });
    expect(h.last("lobby")!.seats[0]!.holder).toBe(fixed.id);
    expect(h.last("lobby")!.seats[0]!.mismatch).toBeUndefined();
  });

  it("marks a held seat mismatch when the host reconnects on a new build, and unmarks it when the holder follows", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1") });
    const a = await join(room, { name: "Ann" });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    const h2 = await join(room, { token: TOKEN, name: "Hosty", build: { appVersion: "1.2.4", contentVersion: "c9" } });
    expect(h2.last("lobby")!.seats[0]).toMatchObject({ holder: a.id, mismatch: true });
    const token = a.last("seat-token")!.token;
    await room.close(a);
    const a2 = await join(room, {
      name: "Ann",
      build: { appVersion: "1.2.4", contentVersion: "c9" },
      seatTokens: [token],
    });
    expect(h2.last("lobby")!.seats[0]).toMatchObject({ holder: a2.id });
    expect(h2.last("lobby")!.seats[0]!.mismatch).toBeUndefined();
  });

  it("refuses a second seat restored by token while multi-seat is off, leaving it with its old holder", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1", "s2") });
    const a = await join(room, { name: "Ann" });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    const t1 = a.last("seat-token")!.token;
    await room.close(a);
    // The same person comes back without the token and is given the other seat (they hold none by this id).
    const a2 = await join(room, { name: "Ann" });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: a2.id });
    const t2 = a2.last("seat-token")!.token;
    await room.close(a2);
    const a3 = await join(room, { name: "Ann", seatTokens: [t1, t2] });
    expect(a3.refusals).toEqual(["multi-seat"]);
    const held = h.last("lobby")!.seats.filter((s) => s.holder === a3.id);
    expect(held).toHaveLength(1);
    expect(held[0]!.id).toBe("s1");
    expect(h.last("lobby")!.seats[1]!.holder).toBe(a2.id);
  });

  it("restores both seats when multi-seat is on", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup();
    const h = await host();
    await lobbySet(h, { seats: seats("s1", "s2"), settings: { multiSeat: true } });
    const a = await join(room, { name: "Ann" });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s2", participant: a.id });
    const tokens = a.of("seat-token").map((m) => m.token);
    await room.close(a);
    const back = await join(room, { name: "Ann", seatTokens: tokens });
    expect(back.refusals).toEqual([]);
    expect(h.last("lobby")!.seats.map((s) => s.holder)).toEqual([back.id, back.id]);
  });
});

describe("names and chat text are cleaned", () => {
  it("refuses names with nothing visible: zero-width, bidi marks, spaces, bare combining marks", async () => {
    const { room, join } = await setup();
    for (const name of ["​​", "‮⁦⁩", " ‍ ", "  ", "́", "­﻿"]) {
      const s = await join(room, { name });
      expect(s.refusals, JSON.stringify(name)).toEqual(["name-required"]);
    }
  });

  it("strips bidi overrides and zero-width characters, normalizes to NFC and turns line separators into spaces", async () => {
    const { room, join } = await setup();
    const evil = await join(room, { name: "‮evil​" });
    expect(evil.last("welcome")!.you.name).toBe("evil");
    const nfc = await join(room, { name: "Amélie" });
    expect(nfc.last("welcome")!.you.name).toBe("Amélie");
    const sep = await join(room, { name: "A B C\nD" });
    expect(sep.last("welcome")!.you.name).toBe("A B C D");
    const a = await join(room, { name: "Ann" });
    await room.message(a, JSON.stringify({ v: 1, ch: "chat", kind: "say", text: "hi‮ there​ now" }));
    expect(a.last("said")!.text).toBe("hi there now");
  });

  it("cuts a name by code points: an emoji is never split at 24", async () => {
    const { room, join } = await setup();
    // 23 letters and 2 emoji: 27 UTF-16 units (under the hello cap) but 25 code points, so the cut keeps one emoji whole.
    const emoji = String.fromCodePoint(0x1f600);
    const s = await join(room, { name: `${"a".repeat(23)}${emoji}${emoji}` });
    const name = s.last("welcome")!.you.name!;
    expect([...name]).toHaveLength(24);
    expect(name).toBe(`${"a".repeat(23)}${emoji}`);
    expect(name.isWellFormed()).toBe(true);
    // Chat is cut by code points too.
    const a = await join(room, { name: "Ann" });
    await room.message(
      a,
      JSON.stringify({ v: 1, ch: "chat", kind: "say", text: "\u{1F600}".repeat(MAX_CHAT_LENGTH + 10) }),
    );
    expect([...a.last("said")!.text]).toHaveLength(MAX_CHAT_LENGTH);
    expect(a.last("said")!.text.isWellFormed()).toBe(true);
  });

  it("a line of only invisible characters is refused", async () => {
    const { room, join } = await setup();
    const a = await join(room);
    await room.message(a, JSON.stringify({ v: 1, ch: "chat", kind: "say", text: "​‮" }));
    expect(a.refusals).toEqual(["bad-message"]);
  });
});

describe("the code directory and the room's alarm never race", () => {
  function hooksTo(logicFor: () => { refresh(r: string, at: number): Promise<boolean> }) {
    const calls: number[] = [];
    const hooks: RoomCodeHooks = {
      refresh: async (_c, roomId, at) => {
        calls.push(at);
        await logicFor().refresh(roomId, at);
      },
      release: async () => undefined,
    };
    return { calls, hooks };
  }

  it("the room's alarm first: the entry is moved out and outlives the room's own expiry by the margin", async () => {
    const dirStorage = new MemoryStorage();
    const dir = new RoomCodeLogic(dirStorage);
    const { hooks } = hooksTo(() => dir);
    const ctx = await setup({ hooks });
    await dir.claim(ROOM_ID, 1_000 + ROOM_IDLE_MS + ROOM_CODE_MARGIN_MS, 1_000);
    ctx.clock.now = 1_000 + ROOM_IDLE_MS;
    const h = await ctx.host();
    await ctx.send(ctx.room, h, { ch: "game", kind: "start", table: "t1", header: {} });
    ctx.clock.now += 1;
    expect(await ctx.room.alarm(ctx.clock.now)).toBe("rescheduled");
    const due = ctx.storage.alarm!;
    expect(await dir.resolve(due + ROOM_CODE_MARGIN_MS - 1)).toBe(ROOM_ID);
    expect(await dir.resolve(due + ROOM_CODE_MARGIN_MS)).toBeNull();
  });

  it("the directory's alarm first: the room's next refresh writes the missing entry back", async () => {
    const dirStorage = new MemoryStorage();
    const dir = new RoomCodeLogic(dirStorage);
    const { hooks } = hooksTo(() => dir);
    const ctx = await setup({ hooks });
    await dir.claim(ROOM_ID, 5_000, 1_000);
    await dir.expire(5_000); // The directory's alarm runs before the room's.
    expect(await dir.resolve(5_001)).toBeNull();
    const h = await ctx.host();
    await ctx.send(ctx.room, h, { ch: "game", kind: "start", table: "t1", header: {} });
    ctx.clock.now += ROOM_IDLE_MS - 1;
    await ctx.send(ctx.room, h, { ch: "game", kind: "commands", table: "t1", from: 0, commands: [1] });
    ctx.clock.now += 1;
    expect(await ctx.room.alarm(ctx.clock.now)).toBe("rescheduled");
    expect(await dir.resolve(ctx.clock.now)).toBe(ROOM_ID);
    expect(dirStorage.alarm).toBe(ctx.storage.alarm! + ROOM_CODE_MARGIN_MS);
  });

  it("a refresh for a code another room now holds is refused and changes nothing", async () => {
    const dir = new RoomCodeLogic(new MemoryStorage());
    await dir.claim("other", 9_000, 1_000);
    expect(await dir.refresh(ROOM_ID, 99_000)).toBe(false);
    expect(await dir.resolve(2_000)).toBe("other");
  });

  it("the Durable Object tries a failing directory call twice, then gives up quietly so the room still closes", async () => {
    const { GameRoom } = await import("./durable-objects.js");
    let fetches = 0;
    const env = {
      ROOM_CODE: {
        idFromName: (n: string) => ({ n }),
        get: () => ({
          fetch: async () => {
            fetches += 1;
            return new Response(null, { status: 500 });
          },
        }),
      },
    };
    const storage = new MemoryStorage();
    const room = new GameRoom({ storage, acceptWebSocket() {}, getWebSockets: () => [] }, env as never);
    await room.fetch(
      new Request("https://room/create", {
        method: "POST",
        headers: { "X-Now": "1000", "X-Host-Hash": "h", "X-Code": CODE, "X-Room-Id": ROOM_ID },
      }),
    );
    const meta = storage.map.get("meta") as { createdAt: number };
    // Shut down through the alarm path: the release call fails twice and is swallowed.
    const logic = (room as unknown as { room: GameRoomLogic }).room;
    await logic.alarm(meta.createdAt + ROOM_IDLE_MS);
    expect(fetches).toBe(2);
    expect(await logic.exists()).toBe(false);
  });
});

describe("device in the roster", () => {
  const hello = (r: GameRoomLogic, device: unknown, extra: object = {}) => {
    const s = new FakeSocket();
    return r.message(s, JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [], device, ...extra })).then(() => s);
  };

  it("keeps a valid device on the participant, in the roster and the welcome, in a lobby room", async () => {
    const { room, host } = await setup();
    const h = await host();
    const a = await hello(room, { platform: "android", form: "phone" }, { name: "Ann", build: BUILD });
    expect(a.last("welcome")!.you.device).toEqual({ platform: "android", form: "phone" });
    expect(h.last("roster")!.participants.map((p) => p.device)).toEqual([
      undefined,
      { platform: "android", form: "phone" },
    ]);
    expect(a.attachment!.device).toEqual({ platform: "android", form: "phone" });
  });

  it("keeps it in a watch room too, where names stay ignored", async () => {
    const { room } = await setup({ lobby: false });
    const w = await hello(room, { platform: "web", form: "tablet" }, { name: "Ann" });
    expect(w.last("welcome")!.you).toEqual({ id: w.id, role: "watcher", device: { platform: "web", form: "tablet" } });
  });

  it("ignores anything else without refusing the hello: unknown values, extra fields, wrong types", async () => {
    const { room } = await setup({ lobby: false });
    for (const device of [
      { platform: "beos", form: "phone" },
      { platform: "web", form: "watch" },
      { platform: "web" },
      "web",
      7,
      null,
      [],
    ]) {
      const w = await hello(room, device);
      expect(w.last("welcome")!.you.device, JSON.stringify(device)).toBeUndefined();
    }
    const extra = await hello(room, { platform: "ios", form: "phone", model: "iPhone 15", ua: "x" });
    expect(extra.last("welcome")!.you.device).toEqual({ platform: "ios", form: "phone" });
  });

  it("survives hibernation in the socket attachment", async () => {
    const { room, make, host } = await setup();
    const h = await host();
    const a = await hello(room, { platform: "linux", form: "desktop" }, { name: "Ann", build: BUILD });
    const woken = make();
    woken.restore(h);
    woken.restore(a);
    const late = await hello(woken, undefined, { name: "Late", build: BUILD });
    expect(late.last("welcome")!.participants.find((p) => p.id === a.id)!.device).toEqual({
      platform: "linux",
      form: "desktop",
    });
  });
});

describe("chat history survives a hibernation", () => {
  const say = (r: GameRoomLogic, s: RoomSocket, text: string) =>
    r.message(s, JSON.stringify({ v: 1, ch: "chat", kind: "say", text }));

  it("a cold-woken room over the same storage sends a new joiner the stored backlog, oldest first", async () => {
    const { room, make, join, clock } = await setup();
    const a = await join(room, { name: "Ann" });
    for (let i = 0; i < 3; i++) {
      clock.now += 1_000;
      await say(room, a, `before ${i}`);
    }
    const woken = make();
    const late = await join(woken, { name: "Late" });
    expect(late.last("backlog")!.lines.map((l) => l.text)).toEqual(["before 0", "before 1", "before 2"]);
    // A line said after the wake follows the stored ones, and the next joiner gets all four.
    clock.now += 1_000;
    await say(woken, late, "after");
    const later = await join(woken, { name: "Later" });
    expect(later.last("backlog")!.lines.map((l) => l.text)).toEqual(["before 0", "before 1", "before 2", "after"]);
  });

  it("a line said first in a woken room keeps the stored lines before it, and the row stays bounded", async () => {
    const { room, make, join, clock, storage } = await setup();
    const a = await join(room);
    for (let i = 0; i < CHAT_BACKLOG_LINES + 5; i++) {
      clock.now += 1_000;
      await say(room, a, `m${i}`);
    }
    expect((storage.map.get("chat") as unknown[]).length).toBe(CHAT_BACKLOG_LINES);
    const woken = make();
    const b = await join(woken, { name: "Bo" });
    clock.now += 1_000;
    await say(woken, b, "fresh");
    const stored = storage.map.get("chat") as { text: string }[];
    expect(stored).toHaveLength(CHAT_BACKLOG_LINES);
    expect(stored.at(-1)!.text).toBe("fresh");
    expect(stored[0]!.text).toBe("m6");
  });

  it("closing the room deletes the stored backlog", async () => {
    const { room, host, join, storage } = await setup();
    const h = await host();
    const a = await join(room);
    await say(room, a, "hi");
    expect(storage.map.has("chat")).toBe(true);
    await room.message(h, JSON.stringify({ v: 1, ch: "room", kind: "room-close" }));
    expect(storage.map.has("chat")).toBe(false);
  });
});

describe("chat backlog loading and chat off", () => {
  const say = (r: GameRoomLogic, s: RoomSocket, text: string) =>
    r.message(s, JSON.stringify({ v: 1, ch: "chat", kind: "say", text }));

  it("overlapping joins on a woken room all get the stored backlog, and a say does not clobber it", async () => {
    const { room, make, join, clock, storage } = await setup();
    const a = await join(room, { name: "Ann" });
    for (let i = 0; i < 3; i++) {
      clock.now += 1_000;
      await say(room, a, `old ${i}`);
    }
    const realGet = storage.get.bind(storage);
    (storage as { get: unknown }).get = async (key: string) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return realGet(key);
    };
    const woken = make();
    clock.now += 1_000;
    const [x, y] = await Promise.all([join(woken, { name: "X" }), join(woken, { name: "Y" })]);
    const old = ["old 0", "old 1", "old 2"];
    expect(x.last("backlog")!.lines.map((l) => l.text)).toEqual(old);
    expect(y.last("backlog")!.lines.map((l) => l.text)).toEqual(old);
    await say(woken, x, "new");
    expect((storage.map.get("chat") as { text: string }[]).map((l) => l.text)).toEqual([...old, "new"]);
  });

  it("turning chat off deletes the stored backlog, and turning it on starts clean", async () => {
    const { room, host, join, lobbySet, storage } = await setup();
    const h = await host();
    const a = await join(room);
    await say(room, a, "hi");
    expect(storage.map.has("chat")).toBe(true);
    await lobbySet(h, { settings: { chat: false } });
    expect(storage.map.has("chat")).toBe(false);
    await lobbySet(h, { settings: { chat: true } });
    const late = await join(room, { name: "Late" });
    expect(late.of("backlog")).toHaveLength(0);
  });
});

describe("host activity", () => {
  const activity = (r: GameRoomLogic, s: RoomSocket, step: string, scenario?: string) =>
    r.message(s, JSON.stringify({ v: 1, ch: "room", kind: "host-activity", step, ...(scenario ? { scenario } : {}) }));

  it("relays the host's step to everyone, and to a joiner afterwards", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    await activity(room, h, "table", "Rhino");
    for (const s of [h, a]) {
      expect(s.last("host-activity")).toEqual({
        v: 1,
        ch: "room",
        kind: "host-activity",
        step: "table",
        scenario: "Rhino",
      });
    }
    const late = await join(room, { name: "Late" });
    expect(late.last("host-activity")).toMatchObject({ step: "table", scenario: "Rhino" });
  });

  it("relays the newest over-limit step once a token frees, so guests do not end stale", async () => {
    vi.useFakeTimers();
    try {
      const { room, host, join, clock } = await setup();
      const h = await host();
      const a = await join(room);
      for (const step of ["scenario", "table", "scenario", "table", "scenario", "table", "scenario"]) {
        await activity(room, h, step);
      }
      expect(a.last("host-activity")!.step).not.toBe("scenario");
      expect(h.refusals).toEqual([]);
      clock.now += 1_500;
      await vi.advanceTimersByTimeAsync(1_000);
      expect(a.last("host-activity")!.step).toBe("scenario");
      // An idle replaces a pending step.
      await activity(room, h, "table");
      await activity(room, h, "idle");
      clock.now += 1_500;
      await vi.advanceTimersByTimeAsync(1_000);
      expect(a.last("host-activity")!.step).toBe("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not spend the limit on an unchanged step", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    for (let i = 0; i < 20; i++) await activity(room, h, "scenario");
    await activity(room, h, "table");
    expect(a.last("host-activity")!.step).toBe("table");
    expect(h.refusals).toEqual([]);
  });

  it("does not touch the lobby revision, any row, or repeat an unchanged step", async () => {
    const { room, host, join, storage } = await setup();
    const h = await host();
    const a = await join(room);
    const rev = a.last("lobby")!.rev;
    const before = JSON.stringify([...storage.map.entries()]);
    await activity(room, h, "scenario");
    await activity(room, h, "scenario");
    expect(a.of("host-activity")).toHaveLength(1);
    await activity(room, h, "modular");
    expect(JSON.stringify([...storage.map.entries()])).toBe(before);
    expect(a.of("lobby").every((l) => l.rev === rev)).toBe(true);
  });

  it("is host only, refused for a watcher and in a plain room", async () => {
    const { room, join } = await setup();
    const a = await join(room);
    await activity(room, a, "scenario");
    expect(a.refusals).toEqual(["not-allowed"]);
    const plain = await setup({ lobby: false });
    const h = await plain.host();
    await activity(plain.room, h, "scenario");
    expect(h.refusals).toEqual(["not-allowed"]);
  });

  it("clears on idle, when the game starts, and when the host leaves", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    await activity(room, h, "decks");
    await activity(room, h, "idle");
    expect(a.last("host-activity")!.step).toBe("idle");
    await activity(room, h, "starting");
    await room.message(h, JSON.stringify({ v: 1, ch: "game", kind: "start", table: "t1", header: {} }));
    expect(a.last("host-activity")!.step).toBe("idle");
    await activity(room, h, "scenario");
    await room.close(h);
    expect(a.last("host-activity")!.step).toBe("idle");
    const late = await join(room, { name: "Late" });
    expect(late.of("host-activity")).toHaveLength(0);
  });

  it("drops over-limit steps quietly, lets idle through, and its parser accepts only known steps", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    const steps = ["scenario", "table", "modular", "decks"];
    for (let i = 0; i < 8; i++) await activity(room, h, steps[i % 4]!);
    expect(h.refusals).toEqual([]);
    expect(h.closed).toBeNull();
    // Over the limit: the guests are behind, but the host going back to the lobby still reaches them.
    await activity(room, h, "idle");
    expect(a.last("host-activity")!.step).toBe("idle");
    expect(h.refusals).toEqual([]);
    const msg = { v: 1, ch: "room", kind: "host-activity" };
    expect(parseClientMessage(JSON.stringify({ ...msg, step: "starting", scenario: "Rhino" }))).not.toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...msg, step: "dancing" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ ...msg, step: "table", scenario: 4 }))).toBeNull();
  });
});

describe("villain pacing and the host's villain cursor", () => {
  const cursor = (r: GameRoomLogic, s: RoomSocket, at: number, state = "playing", key = "2", table = "t1") =>
    r.message(s, JSON.stringify({ v: 1, ch: "room", kind: "villain-cursor", table, key, at, state }));

  it("holds Villain phase pacing: the host leads by default, host-only to set, shown to everyone", async () => {
    const { room, host, join, lobbySet } = await setup();
    const h = await host();
    const w = await join(room);
    expect(h.last("lobby")!.settings.villainPacing).toBe("host");
    await lobbySet(w, { settings: { villainPacing: "each" } });
    expect(w.refusals).toEqual(["not-allowed"]);
    await lobbySet(h, { settings: { villainPacing: "each" } });
    expect(h.refusals).toEqual([]);
    expect(w.last("lobby")!.settings.villainPacing).toBe("each");
    await lobbySet(h, { settings: { chat: false } });
    expect(w.last("lobby")!.settings.villainPacing).toBe("each");
    await lobbySet(h, { settings: { villainPacing: "host" } });
    expect(w.last("lobby")!.settings.villainPacing).toBe("host");
  });

  it("refuses a pacing that is not one of the two", () => {
    const send = (villainPacing: unknown) =>
      parseClientMessage(JSON.stringify({ v: 1, ch: "room", kind: "lobby-set", settings: { villainPacing } }));
    expect(send("host")).not.toBeNull();
    expect(send("each")).not.toBeNull();
    expect(send("fast")).toBeNull();
    expect(send(1)).toBeNull();
  });

  it("validates a cursor message's shape", () => {
    const parse = (extra: object) =>
      parseClientMessage(
        JSON.stringify({
          v: 1,
          ch: "room",
          kind: "villain-cursor",
          table: "t1",
          key: "2",
          at: 3,
          state: "playing",
          ...extra,
        }),
      );
    expect(parse({})).not.toBeNull();
    expect(parse({ state: "none" })).toBeNull();
    expect(parse({ at: -1 })).toBeNull();
    expect(parse({ at: 1.5 })).toBeNull();
    expect(parse({ at: 100_000 })).toBeNull();
    expect(parse({ key: "" })).toBeNull();
    expect(parse({ key: "k".repeat(25) })).toBeNull();
    expect(parse({ table: "bad table" })).toBeNull();
  });

  it("relays the host's cursor to guests (not back to the host), and to a joiner afterwards", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    await cursor(room, h, 3);
    expect(a.last("villain-cursor")).toEqual({
      v: 1,
      ch: "room",
      kind: "villain-cursor",
      table: "t1",
      key: "2",
      at: 3,
      state: "playing",
    });
    expect(h.of("villain-cursor")).toHaveLength(0);
    const late = await join(room, { name: "Late" });
    expect(late.last("villain-cursor")).toMatchObject({ key: "2", at: 3, state: "playing" });
  });

  it("is the table host's alone: refused for a guest, and for a host naming another table", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    const b = await join(room, { name: "B" });
    await cursor(room, a, 1);
    expect(a.refusals).toEqual(["not-allowed"]);
    await cursor(room, h, 1, "playing", "2", "t2");
    expect(h.refusals).toEqual(["not-allowed"]);
    expect(b.of("villain-cursor")).toHaveLength(0);
  });

  it("stores nothing and leaves the lobby revision alone; an unchanged cursor is not relayed again", async () => {
    const { room, host, join, storage } = await setup();
    const h = await host();
    const a = await join(room);
    const rev = a.last("lobby")!.rev;
    const before = JSON.stringify([...storage.map.entries()]);
    await cursor(room, h, 1);
    await cursor(room, h, 1);
    await cursor(room, h, 2);
    expect(a.of("villain-cursor").map((m) => m.at)).toEqual([1, 2]);
    expect(JSON.stringify([...storage.map.entries()])).toBe(before);
    expect(a.of("lobby").every((l) => l.rev === rev)).toBe(true);
  });

  it("relays the newest over-limit cursor once a token frees, and never refuses the host for it", async () => {
    vi.useFakeTimers();
    try {
      const { room, host, join, clock } = await setup();
      const h = await host();
      const a = await join(room);
      for (let at = 1; at <= 20; at++) await cursor(room, h, at);
      expect(a.of("villain-cursor").length).toBeLessThan(20);
      expect(a.last("villain-cursor")!.at).toBeLessThan(20);
      expect(h.refusals).toEqual([]);
      clock.now += 2_000;
      await vi.advanceTimersByTimeAsync(600);
      expect(a.last("villain-cursor")!.at).toBe(20);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the cursor when the game is started over or rewound", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    await cursor(room, h, 4);
    await room.message(h, JSON.stringify({ v: 1, ch: "game", kind: "start", table: "t1", header: {} }));
    expect(a.last("villain-cursor")).toMatchObject({ state: "none" });
    const late = await join(room, { name: "Late" });
    expect(late.of("villain-cursor")).toHaveLength(0);
    await cursor(room, h, 5, "closed");
    await room.message(h, JSON.stringify({ v: 1, ch: "game", kind: "rewind", table: "t1", to: 0 }));
    expect(a.last("villain-cursor")).toMatchObject({ state: "none" });
  });
});

describe("table plan", () => {
  const plan = { scenarioId: "rhino", modularSetIds: ["bomb_scare"], difficulty: "standard" };
  const send = (r: GameRoomLogic, s: RoomSocket, value: unknown) =>
    r.message(s, JSON.stringify({ v: 1, ch: "room", kind: "table-plan", plan: value }));

  it("relays the host's plan to everyone, and to a joiner afterwards", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    await send(room, h, { ...plan, heroicLevel: 2, skirmish: true });
    for (const s of [h, a]) {
      expect(s.last("table-plan")).toEqual({
        v: 1,
        ch: "room",
        kind: "table-plan",
        plan: { ...plan, heroicLevel: 2, skirmish: true },
      });
    }
    const late = await join(room, { name: "Late" });
    expect(late.last("table-plan")).toMatchObject({ plan: { scenarioId: "rhino" } });
  });

  it("clears with null, and a later joiner gets nothing", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    await send(room, h, plan);
    await send(room, h, null);
    expect(a.last("table-plan")!.plan).toBeNull();
    const late = await join(room, { name: "Late" });
    expect(late.of("table-plan")).toHaveLength(0);
  });

  it("does not touch the lobby row or revision, and does not repeat an unchanged plan", async () => {
    const { room, host, join, storage } = await setup();
    const h = await host();
    const a = await join(room);
    const rev = a.last("lobby")!.rev;
    const rows = () => JSON.stringify([...storage.map.entries()].filter(([key]) => key !== "plan"));
    const before = rows();
    await send(room, h, plan);
    await send(room, h, plan);
    await send(room, h, { ...plan, difficulty: "expert" });
    expect(a.of("table-plan")).toHaveLength(2);
    expect(rows()).toBe(before);
    expect(a.of("lobby").every((l) => l.rev === rev)).toBe(true);
  });

  it("survives a hibernation: a joiner of a cold-woken room gets the plan, and a clear removes the row", async () => {
    const { room, make, host, join, storage } = await setup();
    const h = await host();
    await send(room, h, plan);
    expect(storage.map.has("plan")).toBe(true);
    const woken = make();
    const late = await join(woken, { name: "Late" });
    expect(late.last("table-plan")).toMatchObject({ plan });
    // The woken room knows it: the same plan is not relayed again, and a clear reaches the guest and the row.
    const h2 = await host(woken);
    await send(woken, h2, plan);
    expect(late.of("table-plan")).toHaveLength(1);
    await send(woken, h2, null);
    expect(late.last("table-plan")!.plan).toBeNull();
    expect(storage.map.has("plan")).toBe(false);
  });

  it("is host only, and refused in a plain room", async () => {
    const { room, join } = await setup();
    const a = await join(room);
    await send(room, a, plan);
    expect(a.refusals).toEqual(["not-allowed"]);
    const plain = await setup({ lobby: false });
    const h = await plain.host();
    await send(plain.room, h, plan);
    expect(h.refusals).toEqual(["not-allowed"]);
  });

  it("clears when the game starts and when the host leaves", async () => {
    const { room, host, join } = await setup();
    const h = await host();
    const a = await join(room);
    await send(room, h, plan);
    await room.message(h, JSON.stringify({ v: 1, ch: "game", kind: "start", table: "t1", header: {} }));
    expect(a.last("table-plan")!.plan).toBeNull();
    await send(room, h, plan);
    await room.close(h);
    expect(a.last("table-plan")!.plan).toBeNull();
  });

  it("refuses over the limit, and its parser accepts only well formed plans", async () => {
    const { room, host } = await setup();
    const h = await host();
    for (let i = 0; i < 6; i++) await send(room, h, { ...plan, heroicLevel: i + 1 });
    expect(h.refusals).toContain("rate-limited");
    const ok = (p: unknown) => parseClientMessage(JSON.stringify({ v: 1, ch: "room", kind: "table-plan", plan: p }));
    expect(ok(plan)).not.toBeNull();
    expect(ok(null)).not.toBeNull();
    expect(ok({ ...plan, difficulty: "easy" })).toBeNull();
    expect(ok({ ...plan, scenarioId: "" })).toBeNull();
    expect(ok({ ...plan, scenarioId: "x".repeat(65) })).toBeNull();
    expect(ok({ ...plan, modularSetIds: null })).toBeNull();
    expect(ok({ ...plan, modularSetIds: Array.from({ length: 9 }, (_, i) => `m${i}`) })).toBeNull();
    expect(ok({ ...plan, modularSetIds: [4] })).toBeNull();
    expect(ok({ ...plan, heroicLevel: 1.5 })).toBeNull();
    expect(ok({ ...plan, skirmish: "yes" })).toBeNull();
    expect(ok(undefined)).toBeNull();
  });
});

describe("guests claim an open seat unless the host has them ask (Quin, 2026-11-22)", () => {
  it("by default a guest's request seats them at once, with a token, and nothing waits for the host", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup({ askToSit: false });
    const h = await host();
    await lobbySet(h, { seats: seats("s1", "s2") });
    expect(h.last("lobby")!.settings.askToSit).toBe(false);
    const a = await join(room, { name: "Ann" });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(a.refusals).toEqual([]);
    expect(h.last("lobby")!.seats[0]).toMatchObject({ id: "s1", holder: a.id, holderName: "Ann" });
    expect(h.last("lobby")!.seats[0]!.requested).toBeUndefined();
    expect(a.last("seat-token")).toMatchObject({ seat: "s1" });
  });

  it("a claim still obeys a taken seat, one seat each and the host's build", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup({ askToSit: false });
    const h = await host();
    await lobbySet(h, { seats: seats("s1", "s2") });
    const a = await join(room, { name: "Ann" });
    const b = await join(room, { name: "Bo" });
    const old = await join(room, { name: "Cy", build: { appVersion: "1.2.2", contentVersion: "c9" } });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    await send(room, b, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(b.refusals).toEqual(["seat-taken"]);
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s2" });
    expect(a.refusals).toEqual(["multi-seat"]);
    await send(room, old, { ch: "room", kind: "seat-request", seat: "s2" });
    expect(old.refusals).toEqual(["build-mismatch"]);
    expect(h.last("lobby")!.seats[1]!.holder).toBeUndefined();
  });

  it("with Ask the host to sit on, a request waits; turning it off drops pending requests and the seat is claimable", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup({ askToSit: false });
    const h = await host();
    await lobbySet(h, { seats: seats("s1", "s2"), settings: { askToSit: true } });
    const a = await join(room, { name: "Ann" });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(h.last("lobby")!.seats[0]).toMatchObject({ id: "s1", requested: [a.id] });
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
    await lobbySet(h, { settings: { askToSit: false } });
    // Nobody is left waiting for an approval that no longer comes.
    expect(a.last("lobby")!.seats[0]!.requested).toBeUndefined();
    const b = await join(room, { name: "Bo" });
    await send(room, b, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(h.last("lobby")!.seats[0]).toMatchObject({ id: "s1", holder: b.id });
    expect(h.last("lobby")!.seats[0]!.requested).toBeUndefined();
  });

  it("while a game is running, a guest's request for an open seat waits for the host", async () => {
    const { room, host, join, send, lobbySet, seats } = await setup({ askToSit: false });
    const h = await host();
    await lobbySet(h, { seats: seats("s1", "s2") });
    await send(room, h, { ch: "game", kind: "start", table: "t1", header: {} });
    const a = await join(room, { name: "Ann" });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s2" });
    expect(a.refusals).toEqual([]);
    expect(h.last("lobby")!.seats[1]).toMatchObject({ id: "s2", requested: [a.id] });
    expect(h.last("lobby")!.seats[1]!.holder).toBeUndefined();
    // Once the game is over, claiming works again.
    await send(room, h, { ch: "game", kind: "end", table: "t1", outcome: 1 });
    const b = await join(room, { name: "Bo" });
    await send(room, b, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(h.last("lobby")!.seats[0]).toMatchObject({ id: "s1", holder: b.id });
  });

  it("a guest claims at most once every few seconds, so a take and leave loop writes little", async () => {
    const { room, host, join, send, lobbySet, seats, clock } = await setup({ askToSit: false });
    const h = await host();
    await lobbySet(h, { seats: seats("s1") });
    const a = await join(room, { name: "Ann" });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    await send(room, a, { ch: "room", kind: "seat-release", seat: "s1" });
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(a.refusals).toEqual(["rate-limited"]);
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
    clock.now += 3_000;
    await send(room, a, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(h.last("lobby")!.seats[0]).toMatchObject({ id: "s1", holder: a.id });
  });

  it("refuses a lobby-set whose askToSit is not a boolean", async () => {
    const { host, lobbySet } = await setup({ askToSit: false });
    const h = await host();
    await lobbySet(h, { settings: { askToSit: "yes" } });
    expect(h.refusals).toEqual(["bad-message"]);
  });
});
