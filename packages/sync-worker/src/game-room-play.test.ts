import { describe, expect, it } from "vitest";
import { GameRoomLogic, sha256Hex, type RoomSocket } from "./game-room.js";
import {
  MAX_REQUEST_NOTE_CHARS,
  PROPOSAL_BURST,
  parseClientMessage,
  type Participant,
  type RoomBuild,
  type ServerMessage,
} from "./room-protocol.js";
import { MemoryStorage } from "./test-support.js";

const TOKEN = "T".repeat(32);
const BUILD: RoomBuild = { appVersion: "1.2.3", contentVersion: "c9" };
const OLD_BUILD: RoomBuild = { appVersion: "1.2.2", contentVersion: "c9" };

class FakeSocket implements RoomSocket {
  readonly sent: ServerMessage[] = [];
  attachment: Participant | null = null;
  send(text: string) {
    this.sent.push(JSON.parse(text) as ServerMessage);
  }
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

/** A lobby room with a started table, a host, and helpers; `playMode` is Host control unless a test says otherwise. */
async function setup(playMode: "strict" | "host" = "host") {
  const storage = new MemoryStorage();
  const clock = { now: 1_000 };
  const limits = { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 };
  const room = new GameRoomLogic(storage, limits, () => clock.now);
  await room.create(await sha256Hex(TOKEN), clock.now, { code: "K7M2PQ", roomId: "AAAAAAAAAAAA" });
  const send = (s: RoomSocket, m: unknown, r = room) => r.message(s, JSON.stringify({ v: 1, ...(m as object) }));
  const join = async (name: string, opts: { token?: string; build?: RoomBuild; seatTokens?: string[] } = {}) => {
    const s = new FakeSocket();
    await send(s, {
      ch: "room",
      kind: "hello",
      caps: ["watch", "chat", "seats", "play"],
      name,
      build: opts.build ?? BUILD,
      ...(opts.token ? { token: opts.token } : {}),
      ...(opts.seatTokens ? { seatTokens: opts.seatTokens } : {}),
    });
    return s;
  };
  const host = await join("Hosty", { token: TOKEN });
  await send(host, {
    ch: "room",
    kind: "lobby-set",
    settings: { playMode, multiSeat: true },
    seats: [
      { id: "s1", label: "Hero 1", player: "p1" },
      { id: "s2", label: "Hero 2", player: 1 },
    ],
  });
  await send(host, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
  /** A guest holding the seats given (the host assigns them). */
  const seated = async (name: string, ...seatIds: string[]) => {
    const g = await join(name);
    for (const seat of seatIds) await send(host, { ch: "room", kind: "seat-assign", seat, participant: g.id });
    return g;
  };
  const propose = (s: RoomSocket, extra: object = {}) =>
    send(s, { ch: "game", kind: "propose", table: "t1", command: { type: "pass" }, base: 3, ...extra });
  const request = (s: RoomSocket, extra: object = {}) =>
    send(s, { ch: "game", kind: "request", table: "t1", what: "undo", ...extra });
  return { storage, clock, room, send, join, host, seated, propose, request };
}

describe("play together: protocol parsing", () => {
  const parse = (m: object) => parseClientMessage(JSON.stringify({ v: 1, ...m }));
  it("reads propose (with a base), proposal-refused, request, request-answer, take-over and give-back", () => {
    expect(parse({ ch: "game", kind: "propose", table: "t1", command: {}, base: 0 })).not.toBeNull();
    expect(parse({ ch: "game", kind: "propose", table: "t1", command: {} })).toBeNull();
    expect(parse({ ch: "game", kind: "propose", table: "t1", command: {}, base: -1 })).toBeNull();
    const refused = { ch: "game", kind: "proposal-refused", table: "t1", to: "abc", base: 2 };
    for (const reason of ["stale", "not-your-turn", "illegal", "strict"]) {
      expect(parse({ ...refused, reason })).not.toBeNull();
    }
    expect(parse({ ...refused, reason: "because" })).toBeNull();
    expect(parse({ ch: "game", kind: "request", table: "t1", what: "adjust", note: "x" })).not.toBeNull();
    expect(parse({ ch: "game", kind: "request", table: "t1", what: "redo" })).toBeNull();
    expect(parse({ ch: "game", kind: "request-answer", table: "t1", to: "a", accepted: true })).not.toBeNull();
    expect(parse({ ch: "game", kind: "request-answer", table: "t1", to: "a", accepted: "yes" })).toBeNull();
    expect(parse({ ch: "room", kind: "take-over", seat: "s1" })).not.toBeNull();
    expect(parse({ ch: "room", kind: "give-back", seat: "bad seat" })).toBeNull();
    expect(parse({ ch: "room", kind: "lobby-set", seats: [{ id: "s1", label: "a", player: "p" }] })).not.toBeNull();
    expect(parse({ ch: "room", kind: "lobby-set", seats: [{ id: "s1", label: "a", player: {} }] })).toBeNull();
  });
});

describe("play together: who may propose", () => {
  it("relays a seat holder's proposal to the host alone, with its participant id, seats and base", async () => {
    const { host, seated, join, propose } = await setup();
    const ann = await seated("Ann", "s1", "s2");
    const bob = await seated("Bob", ...[]);
    const watcher = await join("Wes");
    await propose(ann);
    expect(host.of("proposal")).toEqual([
      {
        v: 1,
        ch: "game",
        kind: "proposal",
        table: "t1",
        from: ann.id,
        seats: ["s1", "s2"],
        command: { type: "pass" },
        base: 3,
      },
    ]);
    for (const s of [ann, bob, watcher]) expect(s.of("proposal")).toEqual([]);
    expect(ann.refusals).toEqual([]);
  });

  it("refuses softly a watcher, a guest without a seat and the host", async () => {
    const { host, join, propose } = await setup();
    const w = await join("Wes");
    await propose(w);
    await propose(host);
    expect(w.refusals).toEqual(["not-seated"]);
    expect(host.refusals).toEqual(["not-seated"]);
    expect(host.of("proposal")).toEqual([]);
  });

  it("refuses a seat whose holder runs another build (mismatch), and a seat the host took over", async () => {
    const { host, send, join, propose, clock } = await setup();
    const old = await join("Old", { build: OLD_BUILD });
    // The host cannot assign a mismatched build: the holder got the seat on the host's build and then updated.
    const ann = await join("Ann");
    await send(host, { ch: "room", kind: "seat-assign", seat: "s1", participant: ann.id });
    const token = ann.last("seat-token")!.token;
    await send(ann, { ch: "room", kind: "seat-release", seat: "s1" }); // free the seat to re-seat by token below
    await send(host, { ch: "room", kind: "seat-assign", seat: "s1", participant: ann.id });
    const token2 = ann.last("seat-token")!.token;
    expect(token2).not.toBe(token);
    // She drops and returns on an older build with her token.
    await send(host, { ch: "room", kind: "take-over", seat: "s1" }); // connected: not away
    expect(host.refusals).toEqual(["not-away"]);
    const annOld = await join("Ann", { build: OLD_BUILD, seatTokens: [token2] });
    expect(host.last("lobby")!.seats[0]).toMatchObject({ id: "s1", mismatch: true });
    await propose(annOld);
    expect(annOld.refusals).toEqual(["build-mismatch"]);
    expect(old.refusals).toEqual([]);
    expect(host.of("proposal")).toEqual([]);
    clock.now += 1;
  });

  it("refuses a proposal for a table that has no header, or one the room does not know", async () => {
    const { send, join, host, propose } = await setup();
    const ann = await join("Ann");
    await send(host, { ch: "room", kind: "seat-assign", seat: "s1", participant: ann.id });
    await send(ann, { ch: "game", kind: "propose", table: "t9", command: {}, base: 0 });
    expect(ann.refusals).toEqual(["not-allowed"]);
    await propose(ann);
    expect(host.of("proposal")).toHaveLength(1);
    await send(host, { ch: "game", kind: "end", table: "t1", outcome: {} });
    await propose(ann);
    expect(ann.refusals).toEqual(["not-allowed", "out-of-order"]);
  });

  it("refuses a proposal when the host is not connected", async () => {
    const { room, host, seated, propose } = await setup();
    const ann = await seated("Ann", "s1");
    await room.close(host);
    await propose(ann);
    expect(ann.refusals).toEqual(["no-such-participant"]);
  });
});

describe("play together: rate limits and size", () => {
  it("allows a burst of proposals, then refuses rate-limited, softly, and refills over time", async () => {
    const { clock, seated, host, propose } = await setup();
    const ann = await seated("Ann", "s1");
    for (let i = 0; i < PROPOSAL_BURST + 3; i++) await propose(ann);
    expect(host.of("proposal")).toHaveLength(PROPOSAL_BURST);
    expect(ann.refusals).toEqual(["rate-limited", "rate-limited", "rate-limited"]);
    clock.now += 1000; // 4 a second
    for (let i = 0; i < 6; i++) await propose(ann);
    expect(host.of("proposal")).toHaveLength(PROPOSAL_BURST + 4);
  });

  it("limits each participant on its own", async () => {
    const { seated, host, propose } = await setup();
    const ann = await seated("Ann", "s1");
    const bob = await seated("Bob", "s2");
    for (let i = 0; i < PROPOSAL_BURST; i++) await propose(ann);
    await propose(bob);
    expect(bob.refusals).toEqual([]);
    expect(host.of("proposal")).toHaveLength(PROPOSAL_BURST + 1);
  });

  it("caps a proposal at the ordinary message size", async () => {
    const { seated, host, propose } = await setup();
    const ann = await seated("Ann", "s1");
    await propose(ann, { command: { blob: "x".repeat(70 * 1024) } });
    expect(ann.refusals).toEqual(["too-large"]);
    expect(host.of("proposal")).toEqual([]);
  });
});

describe("play together: requests", () => {
  it("relays a request to the host with a cleaned note cut to 140 characters", async () => {
    const { host, seated, request } = await setup();
    const ann = await seated("Ann", "s1");
    await request(ann, { what: "adjust", note: `${"a\nb".repeat(100)}` });
    const got = host.of("request");
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ table: "t1", from: ann.id, what: "adjust" });
    expect(got[0]!.note).toHaveLength(MAX_REQUEST_NOTE_CHARS);
    expect(got[0]!.note).not.toContain("\n");
    await request(ann);
    expect(host.of("request")[1]!.note).toBe("");
  });

  it("refuses a request in a Strict room with strict, and from someone without a seat", async () => {
    const strict = await setup("strict");
    const ann = await strict.seated("Ann", "s1");
    await strict.request(ann);
    expect(ann.refusals).toEqual(["strict"]);
    expect(strict.host.of("request")).toEqual([]);
    const open = await setup("host");
    const wes = await open.join("Wes");
    await open.request(wes);
    expect(wes.refusals).toEqual(["not-seated"]);
  });

  it("still accepts a proposal in a Strict room", async () => {
    const { seated, host, propose } = await setup("strict");
    const ann = await seated("Ann", "s1");
    await propose(ann);
    expect(host.of("proposal")).toHaveLength(1);
  });
});

describe("play together: the host's answers go to their target only", () => {
  it("sends proposal-refused and request-answer to the named participant, no one else", async () => {
    const { host, send, seated } = await setup();
    const ann = await seated("Ann", "s1");
    const bob = await seated("Bob", "s2");
    await send(host, { ch: "game", kind: "proposal-refused", table: "t1", to: bob.id, reason: "stale", base: 5 });
    await send(host, { ch: "game", kind: "request-answer", table: "t1", to: ann.id, accepted: false });
    expect(bob.of("proposal-refused")).toEqual([
      { v: 1, ch: "game", kind: "proposal-refused", table: "t1", reason: "stale", base: 5 },
    ]);
    expect(ann.of("proposal-refused")).toEqual([]);
    expect(ann.of("request-answer")).toEqual([
      { v: 1, ch: "game", kind: "request-answer", table: "t1", accepted: false },
    ]);
    expect(bob.of("request-answer")).toEqual([]);
    expect(host.of("proposal-refused")).toEqual([]);
  });

  it("refuses the answers from a non-host, and to a participant who is gone", async () => {
    const { host, send, seated, room } = await setup();
    const ann = await seated("Ann", "s1");
    const bob = await seated("Bob", "s2");
    await send(ann, { ch: "game", kind: "proposal-refused", table: "t1", to: bob.id, reason: "illegal", base: 0 });
    await send(ann, { ch: "game", kind: "request-answer", table: "t1", to: bob.id, accepted: true });
    expect(ann.refusals).toEqual(["not-allowed", "not-allowed"]);
    expect(bob.of("proposal-refused")).toEqual([]);
    expect(bob.of("request-answer")).toEqual([]);
    await room.close(bob);
    await send(host, { ch: "game", kind: "request-answer", table: "t1", to: bob.id, accepted: true });
    expect(host.refusals).toEqual(["no-such-participant"]);
  });
});

describe("play together: storage", () => {
  it("writes no rows for proposals, requests or the host's answers", async () => {
    const { storage, host, send, seated, propose, request } = await setup();
    const ann = await seated("Ann", "s1");
    const rows = storage.rowsWritten;
    const alarms = storage.alarmsSet;
    for (let i = 0; i < 5; i++) await propose(ann);
    await request(ann);
    await send(host, { ch: "game", kind: "proposal-refused", table: "t1", to: ann.id, reason: "stale", base: 0 });
    await send(host, { ch: "game", kind: "request-answer", table: "t1", to: ann.id, accepted: true });
    expect(storage.rowsWritten).toBe(rows);
    expect(storage.alarmsSet).toBe(alarms);
  });
});

describe("play together: take over and give back", () => {
  it("lets the host take over an away seat, shows takenOver, blocks the holder's proposals, and gives it back", async () => {
    const { room, host, send, seated, join, propose } = await setup();
    const ann = await seated("Ann", "s1");
    const token = ann.last("seat-token")!.token;
    await room.close(ann); // away
    await send(host, { ch: "room", kind: "take-over", seat: "s1" });
    expect(host.last("lobby")!.seats[0]).toMatchObject({ id: "s1", holderName: "Ann", takenOver: true });
    // She returns by token, but the seat stays the host's until it is given back.
    const back = await join("Ann", { seatTokens: [token] });
    expect(back.last("lobby")!.seats[0]).toMatchObject({ holder: back.id, takenOver: true });
    await propose(back);
    expect(back.refusals).toEqual(["not-seated"]);
    expect(host.of("proposal")).toEqual([]);
    await send(host, { ch: "room", kind: "give-back", seat: "s1" });
    expect(host.last("lobby")!.seats[0]!.takenOver).toBeUndefined();
    await propose(back);
    expect(host.of("proposal")).toHaveLength(1);
  });

  it("is the host's alone, for a seat whose holder is away or who left it, never a connected holder's", async () => {
    const { host, send, seated, join } = await setup();
    const ann = await seated("Ann", "s1");
    await send(ann, { ch: "room", kind: "take-over", seat: "s1" });
    expect(ann.refusals).toEqual(["not-allowed"]);
    await send(host, { ch: "room", kind: "take-over", seat: "s1" }); // holder connected
    await send(host, { ch: "room", kind: "take-over", seat: "zz" });
    expect(host.refusals).toEqual(["not-away", "no-such-seat"]);
    // A seat nobody holds (its player left it mid-game) can be taken over, and keeps its player; assigning it later hands it on.
    await send(host, { ch: "room", kind: "take-over", seat: "s2" });
    expect(host.last("lobby")!.seats[1]).toMatchObject({ id: "s2", takenOver: true });
    expect(host.last("lobby")!.seats[1]!.holder).toBeUndefined();
    const wes = await join("Wes");
    await send(wes, { ch: "room", kind: "give-back", seat: "s1" });
    expect(wes.refusals).toEqual(["not-allowed"]);
  });

  it("clears takenOver when the seat changes hands, and stores it with the seat", async () => {
    const { room, host, send, seated, storage } = await setup();
    const ann = await seated("Ann", "s1");
    await room.close(ann);
    await send(host, { ch: "room", kind: "take-over", seat: "s1" });
    expect((storage.map.get("lobby") as { seats: { takenOver?: boolean }[] }).seats[0]!.takenOver).toBe(true);
    const bob = await seated("Bob");
    await send(host, { ch: "room", kind: "seat-deny", seat: "s1", participant: ann.id });
    expect(host.last("lobby")!.seats[0]!.holder).toBeUndefined();
    await send(host, { ch: "room", kind: "seat-assign", seat: "s1", participant: bob.id });
    expect(host.last("lobby")!.seats[0]!.takenOver).toBeUndefined();
  });
});

describe("play together: seat players and the watcher count", () => {
  it("keeps and relays the player the host assigns to a seat, and drops it when a later lobby-set omits it", async () => {
    const { host, send, seated } = await setup();
    expect(host.last("lobby")!.seats.map((s) => s.player)).toEqual(["p1", 1]);
    await seated("Ann", "s1");
    await send(host, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s1", label: "Renamed", player: 0 },
        { id: "s2", label: "Hero 2" },
      ],
    });
    const seats = host.last("lobby")!.seats;
    expect(seats[0]).toMatchObject({ label: "Renamed", player: 0, holderName: "Ann" });
    expect(seats[1]!.player).toBeUndefined();
  });

  it("leaves seat holders out of the roster's watcher count, and counts them back when they let go", async () => {
    const { host, join, send, seated, room } = await setup();
    const wes = await join("Wes");
    expect(host.last("roster")!.watchers).toBe(1);
    const ann = await seated("Ann", "s1");
    expect(host.last("roster")!.watchers).toBe(1);
    expect(host.last("roster")!.participants).toHaveLength(3);
    await send(ann, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(host.last("roster")!.watchers).toBe(2);
    await send(host, { ch: "room", kind: "seat-assign", seat: "s1", participant: wes.id });
    expect(host.last("roster")!.watchers).toBe(1);
    await room.close(wes);
    expect(host.last("roster")!.watchers).toBe(1);
  });

  it("counts a seat holder who restores by token as a player at once", async () => {
    const { host, room, join, seated } = await setup();
    const ann = await seated("Ann", "s1");
    const token = ann.last("seat-token")!.token;
    await room.close(ann);
    expect(host.last("roster")!.watchers).toBe(0);
    const back = await join("Ann", { seatTokens: [token] });
    expect(host.last("roster")!.watchers).toBe(0);
    expect(back.last("roster")!.watchers).toBe(0);
  });
});

describe("the handover setting", () => {
  it("is on by default, host-only like the other settings, and a patch must carry a boolean", async () => {
    const { host, send, seated } = await setup();
    expect(host.last("lobby")!.settings.handover).toBe(true);
    expect(
      parseClientMessage(JSON.stringify({ v: 1, ch: "room", kind: "lobby-set", settings: { handover: "no" } })),
    ).toBeNull();
    const ann = await seated("Ann", "s1");
    await send(ann, { ch: "room", kind: "lobby-set", settings: { handover: false } });
    expect(ann.refusals).toEqual(["not-allowed"]);
    await send(host, { ch: "room", kind: "lobby-set", settings: { handover: false } });
    expect(ann.last("lobby")!.settings.handover).toBe(false);
  });

  it("with it off, refuses taking a seat over, even an away one", async () => {
    const { host, send, seated, room } = await setup();
    const ann = await seated("Ann", "s1");
    await send(host, { ch: "room", kind: "lobby-set", settings: { handover: false } });
    await room.close(ann);
    await send(host, { ch: "room", kind: "take-over", seat: "s1" });
    expect(host.refusals).toEqual(["handover-off"]);
    expect(host.last("lobby")!.seats[0]!.takenOver).toBeUndefined();
  });

  it("with it off, keeps a seat its player leaves mid-game reserved, refuses handing it on, and gives it back on their token", async () => {
    const { host, send, seated, join, room } = await setup();
    const ann = await seated("Ann", "s1");
    const wes = await join("Wes");
    const token = ann.last("seat-token")!.token;
    await send(host, { ch: "room", kind: "lobby-set", settings: { handover: false } });
    await send(ann, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(host.last("lobby")!.seats[0]).toMatchObject({ holder: ann.id, left: true, player: "p1" });
    await send(host, { ch: "room", kind: "seat-assign", seat: "s1", participant: wes.id });
    expect(host.refusals).toEqual(["handover-off"]);
    // Nobody acts for the seat while it is left.
    await send(ann, { ch: "game", kind: "propose", table: "t1", command: { type: "pass" }, base: 3 });
    expect(ann.refusals).toEqual(["not-seated"]);
    // Asking for it again, or coming back with the token, takes it up.
    await send(ann, { ch: "room", kind: "seat-request", seat: "s1" });
    expect(host.last("lobby")!.seats[0]!.left).toBeUndefined();
    await send(ann, { ch: "room", kind: "seat-release", seat: "s1" });
    await room.close(ann);
    const back = await join("Ann", { seatTokens: [token] });
    expect(back.last("lobby")!.seats[0]).toMatchObject({ holder: back.id });
    expect(back.last("lobby")!.seats[0]!.left).toBeUndefined();
  });

  it("with it on, a seat its player leaves is vacant: the host may take it over and keep its player, or hand it on", async () => {
    const { host, send, seated, join } = await setup();
    const ann = await seated("Ann", "s1");
    const wes = await join("Wes");
    await send(ann, { ch: "room", kind: "seat-release", seat: "s1" });
    expect(host.last("lobby")!.seats[0]).toMatchObject({ id: "s1", player: "p1" });
    expect(host.last("lobby")!.seats[0]!.holder).toBeUndefined();
    await send(host, { ch: "room", kind: "take-over", seat: "s1" });
    expect(host.last("lobby")!.seats[0]).toMatchObject({ takenOver: true, player: "p1" });
    await send(host, { ch: "room", kind: "seat-assign", seat: "s1", participant: wes.id });
    expect(host.last("lobby")!.seats[0]).toMatchObject({ holder: wes.id, player: "p1" });
    expect(host.last("lobby")!.seats[0]!.takenOver).toBeUndefined();
  });
});
