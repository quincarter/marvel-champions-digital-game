import { describe, expect, it } from "vitest";
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
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  ROOM_END_GRACE_MS,
  ROOM_IDLE_MS,
  parseClientMessage,
  type Participant,
  type RoomBuild,
  type ServerMessage,
} from "./room-protocol.js";
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
}

async function setup({ lobby = true, hooks }: SetupOptions = {}) {
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
  const lobbySet = (s: RoomSocket, patch: { settings?: object; seats?: object[] }, r = room) =>
    send(r, s, { ch: "room", kind: "lobby-set", ...patch });
  const seats = (...ids: string[]) => ids.map((id) => ({ id, label: `Hero ${id}` }));
  return { storage, clock, room, make, send, join, host, lobbySet, seats };
}

describe("a lobby room: names, build and the lobby message", () => {
  it("advertises chat and seats, a plain room only watch, and sends the lobby with the host's build stamped", async () => {
    const { host } = await setup();
    const h = await host();
    expect(h.last("welcome")!.caps).toEqual(LOBBY_ROOM_CAPS);
    expect(LOBBY_ROOM_CAPS).toEqual(["watch", "chat", "seats"]);
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
    expect(
      parseClientMessage(JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [], name: "x".repeat(25) })),
    ).toBeNull();
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
    expect(h.last("lobby")!.seats[0]!.requested).toBeUndefined();
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
    await send(room, h, { ch: "room", kind: "seat-assign", seat: "s1", participant: a.id });
    await send(room, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    expect(h.last("lobby")!.seats[0]!.holder).toBeUndefined();
    await send(room, h, { ch: "room", kind: "seat-deny", seat: "s1", participant: a.id });
    expect(h.refusals).toEqual(["no-such-participant"]);
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
    for (let i = 0; i < 3; i++) await send(room, a, { ch: "chat", kind: "say", text: `line ${i}` });
    await room.close(a);
    await join(room);
    expect(puts).toBe(0);
    expect(JSON.stringify([...storage.map.entries()])).toBe(before);
    await lobbySet(h, { settings: { playMode: "host" } });
    expect(puts).toBe(1);
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

  it("limits a line to 280 characters and refuses an empty one", async () => {
    const { room, join } = await setup();
    const a = await join(room);
    await say(room, a, "x".repeat(MAX_CHAT_LENGTH));
    expect(a.of("said")).toHaveLength(1);
    await say(room, a, "x".repeat(MAX_CHAT_LENGTH + 1));
    await say(room, a, "   ");
    expect(a.refusals).toEqual(["bad-message", "bad-message"]);
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

  it("sends no backlog when there is none or chat is off, and a woken room starts empty", async () => {
    const { room, host, join, lobbySet, make, storage } = await setup();
    const h = await host();
    expect((await join(room)).last("backlog")).toBeUndefined();
    const a = await join(room);
    await say(room, a, "hello");
    await lobbySet(h, { settings: { chat: false } });
    expect((await join(room)).last("backlog")).toBeUndefined();
    await lobbySet(h, { settings: { chat: true } });
    expect((await join(room)).last("backlog")!.lines).toHaveLength(1);
    expect(JSON.stringify([...storage.map.values()])).not.toContain("hello");
    const woken = make();
    expect((await join(woken)).last("backlog")).toBeUndefined();
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
    expect(calls).toEqual([`refresh ${CODE} ${ROOM_ID} ${storage.alarm}`]);
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
