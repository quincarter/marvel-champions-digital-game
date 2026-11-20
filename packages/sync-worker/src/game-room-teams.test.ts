import { describe, expect, it } from "vitest";
import { GameRoomLogic, LOBBY_ROOM_CAPS, sha256Hex, type RoomSocket } from "./game-room.js";
import { type Participant, type RoomBuild, type ServerMessage } from "./room-protocol.js";
import { MemoryStorage } from "./test-support.js";

const TOKEN = "T".repeat(32);
const BUILD: RoomBuild = { appVersion: "1.2.3", contentVersion: "c9" };
/** A marker that must never reach anyone but the host's reveal. */
const SECRET_R = "SEALED-REGISTRATION-MODULAR-SET";
const SECRET_S = "SEALED-RESISTANCE-MODULAR-SET";

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
  /** Everything this socket was sent, as one string, for leak checks. */
  get everything() {
    return JSON.stringify(this.sent);
  }
}

/**
 * A Competitive lobby, 2v2: host (organizer) holds s1 and is on registration with guest a (s2); guests b (s3) and c (s4)
 * are on resistance. Scenarios are not submitted yet.
 */
async function setup(opts: { seats?: { id: string; team?: string }[]; settings?: object } = {}) {
  const storage = new MemoryStorage();
  const clock = { now: 1_000 };
  const limits = { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 };
  const room = new GameRoomLogic(storage, limits, () => clock.now);
  await room.create(await sha256Hex(TOKEN), clock.now, { code: "K7M2PQ", roomId: "AAAAAAAAAAAA" });
  const send = (s: RoomSocket, m: unknown, r = room) => r.message(s, JSON.stringify({ v: 1, ...(m as object) }));
  const join = async (name: string, o: Record<string, unknown> = {}, r = room) => {
    const s = new FakeSocket();
    await send(
      s,
      { ch: "room", kind: "hello", caps: ["watch", "chat", "seats", "play", "teams"], name, build: BUILD, ...o },
      r,
    );
    return s;
  };
  const host = await join("Hosty", { token: TOKEN });
  const a = await join("A");
  const b = await join("B");
  const c = await join("C");
  const watcher = await join("Watcher");
  const seats = opts.seats ?? [
    { id: "s1", team: "registration" },
    { id: "s2", team: "registration" },
    { id: "s3", team: "resistance" },
    { id: "s4", team: "resistance" },
  ];
  await send(host, {
    ch: "room",
    kind: "lobby-set",
    settings: { mode: "competitive", playMode: "host", multiSeat: false, ...opts.settings },
    seats: seats.map((s) => ({ id: s.id, label: `Hero ${s.id}`, player: s.id, ...(s.team ? { team: s.team } : {}) })),
  });
  const assign = async (seat: string, who: FakeSocket) =>
    send(host, { ch: "room", kind: "seat-assign", seat, participant: who.id });
  await send(host, { ch: "room", kind: "seat-request", seat: "s1" });
  const has = (id: string) => seats.some((x) => x.id === id);
  if (has("s2")) await assign("s2", a);
  if (has("s3")) await assign("s3", b);
  if (has("s4")) await assign("s4", c);
  const submit = (who: FakeSocket, team: string, scenario: unknown) =>
    send(who, { ch: "room", kind: "scenario-submit", team, scenario });
  const ready = (who: FakeSocket, team: string, value = true) =>
    send(who, { ch: "room", kind: "team-ready", team, ready: value });
  /** Both teams submit (host for registration, b for resistance) and get ready. */
  const readyBoth = async () => {
    await submit(host, "registration", { name: SECRET_R });
    await submit(b, "resistance", { name: SECRET_S });
    await ready(a, "registration");
    await ready(c, "resistance");
  };
  const reveal = (who: FakeSocket) => send(who, { ch: "room", kind: "sealed-reveal" });
  const start = () => send(host, { ch: "game", kind: "start", table: "t1", header: { h: 1 } });
  const all = [host, a, b, c, watcher];
  return {
    storage,
    clock,
    room,
    send,
    join,
    host,
    a,
    b,
    c,
    watcher,
    all,
    submit,
    ready,
    readyBoth,
    reveal,
    start,
    assign,
  };
}

describe("Competitive lobby: teams", () => {
  it("advertises teams and sends the mode, the teams, tie-breaks (default on) and the readiness flags", async () => {
    const h = await setup();
    expect(LOBBY_ROOM_CAPS).toContain("teams");
    const lobby = h.a.last("lobby")!;
    expect(lobby.settings.mode).toBe("competitive");
    expect(lobby.settings.tieBreaks).toBe(true);
    expect(lobby.seats.map((s) => [s.id, s.team, s.holderName])).toEqual([
      ["s1", "registration", "Hosty"],
      ["s2", "registration", "A"],
      ["s3", "resistance", "B"],
      ["s4", "resistance", "C"],
    ]);
    expect(lobby.competitive).toEqual({
      teams: { registration: { submitted: false, ready: false }, resistance: { submitted: false, ready: false } },
    });
  });

  it("stores the tie-break option, and a standard lobby has neither it nor a competitive block", async () => {
    const h = await setup({ settings: { tieBreaks: false } });
    expect(h.b.last("lobby")!.settings.tieBreaks).toBe(false);
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { tieBreaks: true } });
    expect(h.b.last("lobby")!.settings.tieBreaks).toBe(true);
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { mode: "standard" } });
    const lobby = h.b.last("lobby")!;
    expect(lobby.competitive).toBeUndefined();
    expect(lobby.settings.tieBreaks).toBeUndefined();
    expect(lobby.seats.every((s) => s.team === undefined)).toBe(true);
  });

  it("refuses more than two seats on a team", async () => {
    const h = await setup({ seats: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] });
    await h.send(h.host, {
      ch: "room",
      kind: "lobby-set",
      seats: ["s1", "s2", "s3"].map((id) => ({ id, label: id, team: "registration" })),
    });
    expect(h.host.refusals).toEqual(["team-size"]);
  });

  it("lets the host or the seat's holder move a seat, and nobody else", async () => {
    const h = await setup({ seats: [{ id: "s1", team: "registration" }, { id: "s2" }, { id: "s3" }] });
    await h.send(h.host, { ch: "room", kind: "seat-assign", seat: "s2", participant: h.a.id });
    await h.send(h.b, { ch: "room", kind: "team-set", seat: "s2", team: "resistance" });
    expect(h.b.refusals).toEqual(["not-allowed"]);
    await h.send(h.a, { ch: "room", kind: "team-set", seat: "s2", team: "resistance" });
    expect(h.a.last("lobby")!.seats.find((s) => s.id === "s2")!.team).toBe("resistance");
    await h.send(h.host, { ch: "room", kind: "team-set", seat: "s3", team: "resistance" });
    expect(h.a.last("lobby")!.seats.find((s) => s.id === "s3")!.team).toBe("resistance");
    // A team takes two seats at most.
    await h.send(h.host, { ch: "room", kind: "team-set", seat: "s1", team: "resistance" });
    expect(h.host.refusals).toEqual(["team-size"]);
  });

  it("keeps a seat's team across a lobby-set that omits it, and refuses a player on both teams", async () => {
    const h = await setup({ settings: { multiSeat: true } });
    await h.send(h.host, {
      ch: "room",
      kind: "lobby-set",
      seats: ["s1", "s2", "s3", "s4"].map((id) => ({ id, label: `New ${id}` })),
    });
    expect(h.a.last("lobby")!.seats.map((s) => s.team)).toEqual([
      "registration",
      "registration",
      "resistance",
      "resistance",
    ]);
    // The host (s1, registration) may not also take a resistance seat; a seat holder neither.
    await h.send(h.b, { ch: "room", kind: "seat-release", seat: "s3" });
    await h.send(h.a, { ch: "room", kind: "seat-request", seat: "s3" });
    expect(h.a.refusals).toContain("other-team");
    await h.send(h.host, { ch: "room", kind: "seat-assign", seat: "s3", participant: h.a.id });
    expect(h.host.refusals).toContain("other-team");
  });

  it("locks the mode and the teams while a game runs", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { mode: "standard" } });
    await h.send(h.host, { ch: "room", kind: "team-set", seat: "s1", team: "resistance" });
    await h.submit(h.host, "registration", { x: 1 });
    await h.ready(h.a, "registration", false);
    expect(h.host.refusals).toEqual(["out-of-order", "out-of-order", "out-of-order"]);
    expect(h.a.refusals).toEqual(["out-of-order"]);
    expect(h.a.last("lobby")!.settings.mode).toBe("competitive");
  });
});

describe("Competitive lobby: sealed scenarios", () => {
  it("never sends a submission to anyone: the lobby shows only that it exists", async () => {
    const h = await setup();
    await h.submit(h.host, "registration", { name: SECRET_R });
    await h.submit(h.b, "resistance", { name: SECRET_S });
    await h.ready(h.a, "registration");
    await h.ready(h.c, "resistance");
    for (const s of h.all) {
      expect(s.everything).not.toContain(SECRET_R);
      expect(s.everything).not.toContain(SECRET_S);
    }
    expect(h.watcher.last("lobby")!.competitive!.teams).toEqual({
      registration: { submitted: true, ready: true },
      resistance: { submitted: true, ready: true },
    });
  });

  it("keeps a submission out of the stored lobby row too (it has its own row)", async () => {
    const h = await setup();
    await h.submit(h.host, "registration", { name: SECRET_R });
    expect(JSON.stringify(h.storage.map.get("lobby"))).not.toContain(SECRET_R);
    expect(JSON.stringify(h.storage.map.get("sealed"))).toContain(SECRET_R);
  });

  it("lets only the host or a holder of a seat on that team submit, and a new one clears that team's readiness", async () => {
    const h = await setup();
    await h.submit(h.watcher, "registration", { x: 1 });
    await h.submit(h.b, "registration", { x: 1 });
    expect(h.watcher.refusals).toEqual(["not-seated"]);
    expect(h.b.refusals).toEqual(["not-seated"]);
    await h.submit(h.a, "registration", { v: 1 });
    await h.ready(h.a, "registration");
    expect(h.b.last("lobby")!.competitive!.teams.registration).toEqual({ submitted: true, ready: true });
    await h.submit(h.host, "registration", { v: 2 });
    expect(h.b.last("lobby")!.competitive!.teams.registration).toEqual({ submitted: true, ready: false });
  });

  it("needs a submission to be ready, and a mismatched build may not submit", async () => {
    const h = await setup();
    await h.ready(h.b, "resistance");
    expect(h.b.refusals).toEqual(["not-ready"]);
    const old = await h.join("Old", { build: { appVersion: "0.0.1", contentVersion: "c9" } });
    await h.send(h.host, { ch: "room", kind: "seat-release", seat: "s4" });
    await h.send(h.c, { ch: "room", kind: "seat-release", seat: "s4" });
    await h.send(h.host, { ch: "room", kind: "seat-assign", seat: "s4", participant: old.id });
    expect(h.host.refusals).toContain("build-mismatch");
  });

  it("rate limits submissions, and an oversized one is not a message", async () => {
    const h = await setup();
    for (let i = 0; i < 4; i++) await h.submit(h.b, "resistance", { i });
    expect(h.b.refusals).toEqual(["rate-limited"]);
    await h.submit(h.b, "resistance", "x".repeat(41 * 1024));
    expect(h.b.refusals).toEqual(["rate-limited", "bad-message"]);
  });

  it("reveals both scenarios to the host alone, once both teams are ready", async () => {
    const h = await setup();
    await h.reveal(h.host);
    expect(h.host.refusals).toEqual(["not-ready"]);
    await h.readyBoth();
    await h.reveal(h.a);
    expect(h.a.refusals).toEqual(["not-allowed"]);
    await h.reveal(h.host);
    expect(h.host.last("sealed")).toMatchObject({
      registration: { name: SECRET_R },
      resistance: { name: SECRET_S },
    });
    for (const s of [h.a, h.b, h.c, h.watcher]) expect(s.everything).not.toContain("SEALED-");
  });

  it("validates the team sizes at the reveal (1v1 or 2v2, every seat on a team)", async () => {
    const lopsided = await setup({
      seats: [
        { id: "s1", team: "registration" },
        { id: "s2", team: "registration" },
        { id: "s3", team: "resistance" },
      ],
    });
    await lopsided.readyBoth();
    await lopsided.reveal(lopsided.host);
    expect(lopsided.host.refusals).toEqual(["team-size"]);
    const unassigned = await setup({
      seats: [{ id: "s1", team: "registration" }, { id: "s2" }],
    });
    await unassigned.readyBoth();
    await unassigned.reveal(unassigned.host);
    expect(unassigned.host.refusals).toEqual(["team-size"]);
    // 1v1 is fine.
    const duel = await setup({
      seats: [
        { id: "s1", team: "registration" },
        { id: "s2", team: "resistance" },
      ],
    });
    await duel.submit(duel.host, "registration", { a: 1 });
    await duel.submit(duel.a, "resistance", { b: 1 });
    await duel.ready(duel.host, "registration");
    await duel.ready(duel.a, "resistance");
    await duel.reveal(duel.host);
    expect(duel.host.last("sealed")).toBeDefined();
    expect(duel.host.refusals).toEqual([]);
  });

  it("refuses a start before the reveal, and a change after it takes the reveal back", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.start();
    expect(h.host.refusals).toEqual(["out-of-order"]);
    await h.reveal(h.host);
    await h.ready(h.c, "resistance", false);
    await h.start();
    expect(h.host.refusals).toEqual(["out-of-order", "out-of-order"]);
    await h.ready(h.c, "resistance");
    await h.reveal(h.host);
    await h.start();
    expect(h.host.refusals).toEqual(["out-of-order", "out-of-order"]);
    expect(h.watcher.last("log")).toBeDefined();
  });

  it("clears both teams' readiness when a seat changes team", async () => {
    const h = await setup({
      seats: [
        { id: "s1", team: "registration" },
        { id: "s2", team: "registration" },
        { id: "s3", team: "resistance" },
      ],
    });
    await h.submit(h.host, "registration", { name: SECRET_R });
    await h.submit(h.b, "resistance", { name: SECRET_S });
    await h.ready(h.a, "registration");
    await h.ready(h.b, "resistance");
    // The same team again changes nothing.
    await h.send(h.host, { ch: "room", kind: "team-set", seat: "s1", team: "registration" });
    expect(h.a.last("lobby")!.competitive!.teams.registration.ready).toBe(true);
    await h.send(h.a, { ch: "room", kind: "team-set", seat: "s2", team: "resistance" });
    expect(h.a.last("lobby")!.competitive!.teams).toEqual({
      registration: { submitted: true, ready: false },
      resistance: { submitted: true, ready: false },
    });
  });

  it("survives a hibernating room: the scenarios and readiness are stored", async () => {
    const h = await setup();
    await h.readyBoth();
    // A woken room: new logic over the same storage; the host comes back with its token.
    const woken = new GameRoomLogic(
      h.storage,
      { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 },
      () => h.clock.now,
    );
    const host2 = new FakeSocket();
    await woken.message(
      host2,
      JSON.stringify({
        v: 1,
        ch: "room",
        kind: "hello",
        token: TOKEN,
        caps: ["watch", "teams"],
        name: "Hosty",
        build: BUILD,
      }),
    );
    await woken.message(host2, JSON.stringify({ v: 1, ch: "room", kind: "sealed-reveal" }));
    expect(host2.last("sealed")).toMatchObject({ registration: { name: SECRET_R }, resistance: { name: SECRET_S } });
  });

  it("lets the host ask again while the game runs, and clears everything when it ends", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    await h.reveal(h.host);
    expect(h.host.of("sealed")).toHaveLength(2);
    expect(h.a.of("sealed")).toHaveLength(0);
    await h.send(h.host, { ch: "game", kind: "end", table: "t1", outcome: { winner: "registration" } });
    expect(h.b.last("lobby")!.competitive!.teams).toEqual({
      registration: { submitted: false, ready: false },
      resistance: { submitted: false, ready: false },
    });
    expect(h.storage.map.has("sealed")).toBe(false);
    // A rematch needs new scenarios and a new reveal.
    await h.start();
    expect(h.host.refusals).toEqual(["out-of-order"]);
    await h.reveal(h.host);
    expect(h.host.refusals).toEqual(["out-of-order", "not-ready"]);
  });

  it("drops the stored scenarios when the room leaves Competitive", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { mode: "standard" } });
    expect(h.storage.map.has("sealed")).toBe(false);
    await h.reveal(h.host);
    expect(h.host.refusals).toEqual(["out-of-order"]);
  });
});

describe("Competitive play: routing", () => {
  it("relays every seat's proposal to the host, whichever team it is on, and writes no row for one", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    const rows = h.storage.rowsWritten;
    const propose = (s: FakeSocket) =>
      h.send(s, { ch: "game", kind: "propose", table: "t1", command: { type: "pass" }, base: 0 });
    await propose(h.a);
    await propose(h.b);
    await propose(h.c);
    const proposals = h.host.of("proposal");
    expect(proposals.map((p) => p.seats)).toEqual([["s2"], ["s3"], ["s4"]]);
    expect(proposals.map((p) => p.from)).toEqual([h.a.id, h.b.id, h.c.id]);
    expect(h.storage.rowsWritten).toBe(rows);
    // The watcher holds no seat; its proposal is refused, and nothing reaches the guests of the other team.
    await propose(h.watcher);
    expect(h.watcher.refusals).toEqual(["not-seated"]);
    expect(h.a.of("proposal")).toHaveLength(0);
    expect(h.b.of("proposal")).toHaveLength(0);
  });

  it("answers a refusal to the proposer only", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    await h.send(h.host, {
      ch: "game",
      kind: "proposal-refused",
      table: "t1",
      to: h.c.id,
      reason: "not-your-turn",
      base: 0,
    });
    expect(h.c.last("proposal-refused")).toMatchObject({ reason: "not-your-turn" });
    expect(h.a.of("proposal-refused")).toHaveLength(0);
    expect(h.b.of("proposal-refused")).toHaveLength(0);
  });
});
