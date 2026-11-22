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
    const accepted = { ch: "game", kind: "proposal-accepted", table: "t1", to: "abc", base: 2 };
    expect(parse({ ...accepted, pid: 4 })).not.toBeNull();
    expect(parse(accepted)).not.toBeNull();
    expect(parse({ ...accepted, base: -1 })).toBeNull();
    expect(parse({ ...accepted, to: 5 })).toBeNull();
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

describe("play together: an adjusted game (#909)", () => {
  it("relays the host's adjusted flag on a rewind and on the end, and replays it to a later joiner", async () => {
    const { send, join, host, seated } = await setup();
    const ann = await seated("Ann", "s1");
    await send(host, { ch: "game", kind: "rewind", table: "t1", to: 0, adjusted: true });
    expect(ann.last("rewind")).toMatchObject({ kind: "rewind", adjusted: true });
    await send(host, { ch: "game", kind: "end", table: "t1", outcome: { result: "win" }, adjusted: true });
    expect(ann.last("end")).toMatchObject({ kind: "end", adjusted: true });
    const late = await join("Late");
    expect(late.last("end")).toMatchObject({ kind: "end", adjusted: true });
  });

  it("says nothing of adjusted on a game played by the rules", async () => {
    const { send, host, seated } = await setup();
    const ann = await seated("Ann", "s1");
    await send(host, { ch: "game", kind: "end", table: "t1", outcome: {} });
    expect(ann.last("end")).not.toHaveProperty("adjusted");
  });
});

describe("play together: the adjusted latch is the table's, not a frame's (#909)", () => {
  const wake = async (ctx: Awaited<ReturnType<typeof setup>>) => {
    const woken = new GameRoomLogic(ctx.storage, undefined, () => ctx.clock.now);
    const s = new FakeSocket();
    await ctx.send(s, { ch: "room", kind: "hello", caps: ["watch"], name: "Late", build: BUILD }, woken);
    return s;
  };

  for (const cut of [true, false]) {
    it(`a flagged rewind that ${cut ? "cuts the log" : "cuts nothing"} survives a wake: the log frame and the welcome carry adjusted`, async () => {
      const ctx = await setup();
      await ctx.send(ctx.host, { ch: "game", kind: "commands", table: "t1", from: 0, commands: [1, 2, 3] });
      await ctx.send(ctx.host, { ch: "game", kind: "rewind", table: "t1", to: cut ? 2 : 3, adjusted: true });
      const late = await wake(ctx);
      expect(late.last("log")).toMatchObject({ kind: "log", adjusted: true });
      expect(late.last("welcome")!.tables[0]).toMatchObject({ adjusted: true });
    });
  }

  it("an adjusted end survives a wake the same way, and a game played by the rules never carries the flag", async () => {
    const ended = await setup();
    await ended.send(ended.host, { ch: "game", kind: "end", table: "t1", outcome: {}, adjusted: true });
    expect((await wake(ended)).last("log")).toMatchObject({ adjusted: true });

    const plain = await setup();
    await plain.send(plain.host, { ch: "game", kind: "commands", table: "t1", from: 0, commands: [1, 2] });
    await plain.send(plain.host, { ch: "game", kind: "rewind", table: "t1", to: 1 });
    const late = await wake(plain);
    expect(late.last("log")).not.toHaveProperty("adjusted");
    expect(late.last("welcome")!.tables[0]).not.toHaveProperty("adjusted");
  });

  it("a new game replacing the table starts un-adjusted, in memory and after a wake", async () => {
    const ctx = await setup();
    await ctx.send(ctx.host, { ch: "game", kind: "rewind", table: "t1", to: 0, adjusted: true });
    await ctx.send(ctx.host, { ch: "game", kind: "end", table: "t1", outcome: {}, adjusted: true });
    await ctx.send(ctx.host, { ch: "game", kind: "start", table: "t1", header: { h: 2 }, gid: "B" });
    const late = await wake(ctx);
    expect(late.last("log")).not.toHaveProperty("adjusted");
  });
});

describe("play together: a latched adjusted whose header write failed is retried (#909)", () => {
  /** A running 3-command game whose header puts fail (the flagged same-count rewind's, and the retries) until `heal()`. */
  const failedLatch = async () => {
    const ctx = await setup();
    await ctx.send(ctx.host, { ch: "game", kind: "commands", table: "t1", from: 0, commands: [1, 2, 3] });
    const put = ctx.storage.put.bind(ctx.storage) as (...a: unknown[]) => Promise<unknown>;
    let fail = true;
    (ctx.storage as { put: unknown }).put = (...args: unknown[]) => {
      if (fail && args[0] === "t1:header") return Promise.reject(new Error("put failed"));
      return put(...args.map((x) => structuredClone(x)));
    };
    await ctx.send(ctx.host, { ch: "game", kind: "rewind", table: "t1", to: 3, adjusted: true });
    expect(ctx.storage.map.get("t1:header")).not.toHaveProperty("a");
    return { ...ctx, heal: () => (fail = false) };
  };
  const wake = async (ctx: Awaited<ReturnType<typeof setup>>) => {
    const woken = new GameRoomLogic(ctx.storage, undefined, () => ctx.clock.now);
    const s = new FakeSocket();
    await ctx.send(s, { ch: "room", kind: "hello", caps: ["watch"], name: "Late", build: BUILD }, woken);
    return s;
  };

  it("a joiner welcomed before any further host move triggers the retry: the header stores the latch and the joiner sees it", async () => {
    const ctx = await failedLatch();
    // Not stored yet, but the room never loses the latch: a joiner is told from memory even while the write fails.
    const early = await ctx.join("Early");
    expect(early.last("welcome")!.tables[0]).toMatchObject({ adjusted: true });
    expect(ctx.storage.map.get("t1:header")).not.toHaveProperty("a");
    ctx.heal();
    const late = await ctx.join("Late");
    expect(ctx.storage.map.get("t1:header")).toMatchObject({ a: true });
    expect(late.last("log")).toMatchObject({ adjusted: true });
    expect(late.last("welcome")!.tables[0]).toMatchObject({ adjusted: true });
    // Stored now: a cold wake still tells a later guest.
    const after = await wake(ctx);
    expect(after.last("log")).toMatchObject({ adjusted: true });
    expect(after.last("welcome")!.tables[0]).toMatchObject({ adjusted: true });
  });

  it("with no further host move, the alarm stores it", async () => {
    const ctx = await failedLatch();
    ctx.heal();
    await ctx.room.alarm(ctx.clock.now);
    expect(ctx.storage.map.get("t1:header")).toMatchObject({ a: true });
    expect((await wake(ctx)).last("log")).toMatchObject({ adjusted: true });
  });

  it("with no further host move, the host leaving stores it", async () => {
    const ctx = await failedLatch();
    ctx.heal();
    await ctx.room.close(ctx.host);
    expect(ctx.storage.map.get("t1:header")).toMatchObject({ a: true });
    expect((await wake(ctx)).last("log")).toMatchObject({ adjusted: true });
  });

  it("the next host batch stores it too", async () => {
    const ctx = await failedLatch();
    ctx.heal();
    await ctx.send(ctx.host, { ch: "game", kind: "commands", table: "t1", from: 3, commands: [4] });
    expect(ctx.storage.map.get("t1:header")).toMatchObject({ a: true });
  });
});

describe("play together: proposal and request ids", () => {
  it("echoes the proposal id in the room's refusal of it and in what it relays to the host and back", async () => {
    const { host, send, join, seated, propose, request } = await setup();
    const wes = await join("Wes");
    await propose(wes, { pid: 7 });
    await request(wes, { rid: 3 });
    expect(wes.of("refused")).toEqual([
      { v: 1, ch: "room", kind: "refused", reason: "not-seated", pid: 7 },
      { v: 1, ch: "room", kind: "refused", reason: "not-seated", rid: 3 },
    ]);
    const ann = await seated("Ann", "s1");
    await propose(ann, { pid: 9 });
    await request(ann, { rid: 4 });
    expect(host.last("proposal")).toMatchObject({ from: ann.id, pid: 9 });
    expect(host.last("request")).toMatchObject({ from: ann.id, rid: 4 });
    await send(host, {
      ch: "game",
      kind: "proposal-refused",
      table: "t1",
      to: ann.id,
      reason: "stale",
      base: 3,
      pid: 9,
    });
    await send(host, { ch: "game", kind: "request-answer", table: "t1", to: ann.id, accepted: true, rid: 4 });
    expect(ann.last("proposal-refused")).toMatchObject({ pid: 9, base: 3 });
    expect(ann.last("request-answer")).toMatchObject({ rid: 4, accepted: true });
  });

  it("refuses a proposal id that is not a count", async () => {
    const { seated, propose } = await setup();
    const ann = await seated("Ann", "s1");
    await propose(ann, { pid: -1 });
    await propose(ann, { pid: "x" });
    expect(ann.refusals).toEqual(["bad-message", "bad-message"]);
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
    await send(host, { ch: "game", kind: "proposal-accepted", table: "t1", to: ann.id, base: 5, pid: 3 });
    expect(ann.of("proposal-accepted")).toEqual([
      { v: 1, ch: "game", kind: "proposal-accepted", table: "t1", base: 5, epoch: 1, pid: 3 },
    ]);
    expect(bob.of("proposal-accepted")).toEqual([]);
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
    await send(ann, { ch: "game", kind: "proposal-accepted", table: "t1", to: bob.id, base: 0, pid: 1 });
    expect(ann.refusals).toEqual(["not-allowed", "not-allowed", "not-allowed"]);
    expect(bob.of("proposal-accepted")).toEqual([]);
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
    await send(host, { ch: "game", kind: "end", table: "t1", outcome: {} }); // between games the host may remap
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

  it("refuses a live lobby-set that switches a seat's player, removes or reorders a seat, or adds one", async () => {
    const { host, send, seated, propose } = await setup();
    const ann = await seated("Ann", "s1");
    const edit = (seats: object[]) => send(host, { ch: "room", kind: "lobby-set", seats });
    await edit([
      { id: "s1", player: "p2" },
      { id: "s2", player: 1 },
    ]);
    await edit([{ id: "s1", player: "p1" }]);
    await edit([
      { id: "s2", player: 1 },
      { id: "s1", player: "p1" },
    ]);
    await edit([{ id: "s1", player: "p1" }, { id: "s2", player: 1 }, { id: "s3" }]);
    expect(host.refusals).toEqual(["not-allowed", "not-allowed", "not-allowed", "not-allowed"]);
    expect(host.last("lobby")!.seats.map((s) => [s.id, s.player])).toEqual([
      ["s1", "p1"],
      ["s2", 1],
    ]);
    // A guest proposal is still judged against the original mapping.
    await propose(ann);
    expect(host.last("proposal")).toMatchObject({ from: ann.id, seats: ["s1"] });
    expect(ann.refusals).toEqual([]);
  });

  it("still lets a live lobby-set relabel seats (an omitted player is kept) and hand a seat over", async () => {
    const { host, send, seated } = await setup();
    const ann = await seated("Ann", "s1");
    await send(host, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s1", label: "Cap" },
        { id: "s2", label: "Iron" },
      ],
    });
    expect(host.refusals).toEqual([]);
    expect(host.last("lobby")!.seats.map((s) => [s.label, s.player, s.holderName])).toEqual([
      ["Cap", "p1", "Ann"],
      ["Iron", 1, undefined],
    ]);
    const bob = await seated("Bob");
    await send(ann, { ch: "room", kind: "seat-release", seat: "s1" });
    await send(host, { ch: "room", kind: "seat-assign", seat: "s1", participant: bob.id });
    expect(host.last("lobby")!.seats[0]).toMatchObject({ holderName: "Bob", player: "p1" });
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

  it("with it off, a release as the first frame after a cold wake still reserves the seat", async () => {
    const { storage, clock, host, send, seated, join } = await setup();
    const ann = await seated("Ann", "s1");
    const wes = await join("Wes");
    await send(host, { ch: "room", kind: "lobby-set", settings: { handover: false } });
    // Evicted: a new object over the same storage, sockets restored from attachments, no hello, header not loaded.
    const woken = new GameRoomLogic(storage, undefined, () => clock.now);
    woken.restore(host);
    woken.restore(ann);
    woken.restore(wes);
    host.sent.length = 0;
    await send(ann, { ch: "room", kind: "seat-release", seat: "s1" }, woken);
    expect(host.last("lobby")!.seats[0]).toMatchObject({ holder: ann.id, left: true });
    // The stored holder and token survive, and the seat cannot be handed to another participant.
    await send(host, { ch: "room", kind: "seat-assign", seat: "s1", participant: wes.id }, woken);
    expect(host.refusals).toEqual(["handover-off"]);
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

describe("play together: proposal results across a seat's reconnect", () => {
  async function dropped() {
    const ctx = await setup();
    const ann = await ctx.seated("Ann", "s1");
    const token = ann.last("seat-token")!.token;
    await ctx.propose(ann, { pid: 7 });
    await ctx.room.close(ann);
    return { ...ctx, ann, token };
  }

  it("delivers a result for the old participant id to the seat's new socket, host staying connected", async () => {
    const { host, send, join, ann, token } = await dropped();
    const back = await join("Ann", { seatTokens: [token] });
    expect(back.id).not.toBe(ann.id);
    await send(host, { ch: "game", kind: "proposal-accepted", table: "t1", to: ann.id, base: 4, pid: 7 });
    expect(host.refusals).toEqual([]);
    expect(back.of("proposal-accepted").filter((m) => m.pid === 7)).toHaveLength(1);
  });

  it("keeps a result for an away seat and replays it on the reclaim", async () => {
    const { host, send, join, ann, token } = await dropped();
    await send(host, {
      ch: "game",
      kind: "proposal-refused",
      table: "t1",
      to: ann.id,
      reason: "stale",
      base: 4,
      pid: 7,
    });
    expect(host.refusals).toEqual([]);
    const back = await join("Ann", { seatTokens: [token] });
    expect(back.of("proposal-refused")).toEqual([
      { v: 1, ch: "game", kind: "proposal-refused", table: "t1", reason: "stale", base: 4, pid: 7 },
    ]);
  });

  it("drops the kept results for positions a rewind cut, so a seat that never saw the removed command or the rewind gets none of them", async () => {
    const { host, send, join, ann, token } = await dropped();
    // The host applied the guest's proposal at position 4 while it was away, then rewound past it.
    await send(host, { ch: "game", kind: "proposal-accepted", table: "t1", to: ann.id, base: 4, pid: 7 });
    await send(host, {
      ch: "game",
      kind: "proposal-refused",
      table: "t1",
      to: ann.id,
      reason: "stale",
      base: 5,
      pid: 8,
    });
    await send(host, { ch: "game", kind: "rewind", table: "t1", to: 0 });
    const back = await join("Ann", { seatTokens: [token] });
    expect(back.of("proposal-accepted")).toEqual([]);
    expect(back.of("proposal-refused")).toEqual([]);
  });

  it("drops the kept results when another game replaces the table's log", async () => {
    const { host, send, join, ann, token } = await dropped();
    await send(host, { ch: "game", kind: "proposal-accepted", table: "t1", to: ann.id, base: 4, pid: 7 });
    await send(host, { ch: "game", kind: "start", table: "t1", header: { h: 2 }, gid: "other-game" });
    const back = await join("Ann", { seatTokens: [token] });
    expect(back.of("proposal-accepted")).toEqual([]);
  });

  it("stamps the table's log epoch on acceptances and rewinds, bumping it only when a rewind cuts the log", async () => {
    const { host, send, seated } = await setup();
    const ann = await seated("Ann", "s1");
    await send(host, { ch: "game", kind: "commands", table: "t1", from: 0, commands: [{ n: 1 }, { n: 2 }] });
    await send(host, { ch: "game", kind: "proposal-accepted", table: "t1", to: ann.id, base: 1, pid: 1 });
    expect(ann.of("proposal-accepted").at(-1)!.epoch).toBe(1);
    // A rewind that cuts is a new epoch, told with the rewind and carried by later acceptances.
    await send(host, { ch: "game", kind: "rewind", table: "t1", to: 1 });
    expect(ann.of("rewind").at(-1)!.epoch).toBe(2);
    await send(host, { ch: "game", kind: "proposal-accepted", table: "t1", to: ann.id, base: 1, pid: 2 });
    expect(ann.of("proposal-accepted").at(-1)!.epoch).toBe(2);
    // A rewind to where the log already is (a resumed host) changes nothing.
    await send(host, { ch: "game", kind: "rewind", table: "t1", to: 1 });
    expect(ann.of("rewind").at(-1)!.epoch).toBe(2);
    // A guest that joins now is told the epoch with the log.
    const late = await seated("Bob", "s2");
    expect(late.of("log").at(-1)!.epoch).toBe(2);
  });

  it("does not replay a seat's results to someone who takes the seat over, and bounds the ledger", async () => {
    const { host, send, join, ann, token } = await dropped();
    for (let pid = 1; pid <= 40; pid++) {
      await send(host, { ch: "game", kind: "proposal-accepted", table: "t1", to: ann.id, base: pid, pid });
    }
    const back = await join("Ann", { seatTokens: [token] });
    const pids = back.of("proposal-accepted").map((m) => m.pid);
    expect(pids).toHaveLength(32);
    expect(pids[0]).toBe(9);
    expect(pids.at(-1)).toBe(40);
    const eve = await join("Eve");
    expect(eve.of("proposal-accepted")).toEqual([]);
  });
});
