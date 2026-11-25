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
    expect(lobby.competitive).toMatchObject({
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

  it("refuses a host lobby-set that moves a seat to the other team while a game runs, and keeps the stored teams", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    const teamsOf = () => h.a.last("lobby")!.seats.map((x: { id: string; team?: string }) => [x.id, x.team]);
    const before = teamsOf();
    await h.send(h.host, {
      ch: "room",
      kind: "lobby-set",
      seats: [
        { id: "s1", label: "Hero s1", player: "s1", team: "resistance" },
        { id: "s2", label: "Hero s2", player: "s2", team: "registration" },
        { id: "s3", label: "Hero s3", player: "s3", team: "registration" },
        { id: "s4", label: "Hero s4", player: "s4", team: "resistance" },
      ],
    });
    expect(h.host.refusals).toEqual(["out-of-order"]);
    expect(teamsOf()).toEqual(before);
    expect(before).toEqual([
      ["s1", "registration"],
      ["s2", "registration"],
      ["s3", "resistance"],
      ["s4", "resistance"],
    ]);
  });
});

describe("Competitive lobby: villain phase pacing", () => {
  it("one table, one engine: the room host leads both teams' guests, and a guest may not send a cursor", async () => {
    const h = await setup();
    // The pacing setting is stored in a competitive lobby like in any other.
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { villainPacing: "each" } });
    expect(h.host.last("lobby")!.settings.villainPacing).toBe("each");
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    const cursor = { ch: "room", kind: "villain-cursor", table: "t1", key: "r3", at: 2, state: "playing" };
    await h.send(h.host, cursor);
    // Both teams' seat holders (a on registration, b and c on resistance) and a watcher follow the one host.
    for (const s of [h.a, h.b, h.c, h.watcher]) expect(s.of("villain-cursor")).toMatchObject([{ table: "t1", at: 2 }]);
    expect(h.host.of("villain-cursor")).toEqual([]);
    await h.send(h.a, cursor);
    expect(h.a.refusals).toContain("not-allowed");
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

  it("moves the competitive revision on every change a reveal depends on", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    const first = (h.host.last("sealed") as { rev?: number }).rev;
    expect(typeof first).toBe("number");
    // A reveal again changes nothing; a team re-sealing a scenario or taking its ready back does.
    await h.reveal(h.host);
    expect((h.host.last("sealed") as { rev?: number }).rev).toBe(first);
    await h.submit(h.b, "resistance", { name: SECRET_S });
    await h.ready(h.c, "resistance");
    await h.reveal(h.host);
    expect((h.host.last("sealed") as { rev?: number }).rev).toBeGreaterThan(first!);
    const second = (h.host.last("sealed") as { rev?: number }).rev!;
    await h.ready(h.c, "resistance", false);
    await h.ready(h.c, "resistance");
    await h.reveal(h.host);
    expect((h.host.last("sealed") as { rev?: number }).rev).toBeGreaterThan(second);
    const lobby = h.host.last("lobby") as { competitive?: { rev?: number } };
    expect(lobby.competitive?.rev).toBe((h.host.last("sealed") as { rev?: number }).rev);
  });

  describe("a new submission and the readiness it clears are written together", () => {
    const NEW_R = "SEALED-NEW-REGISTRATION";
    type Stored = { competitive?: { ready: Record<string, boolean>; revealed: boolean; rev?: number }; rev?: number };
    /**
     * Both teams ready on the first scenarios, and the host's reveal seen; then the next write of the lobby row fails
     * once: the failure a separate `sealed` put followed by a lobby put would leave half done.
     */
    const readyThenFailing = async () => {
      const h = await setup();
      await h.readyBoth();
      await h.reveal(h.host);
      const put = h.storage.put.bind(h.storage);
      let fail = true;
      h.storage.put = ((...args: Parameters<typeof put>) => {
        const [key] = args;
        const touchesLobby = typeof key === "string" ? key === "lobby" : "lobby" in key;
        if (fail && touchesLobby) {
          fail = false;
          return Promise.reject(new Error("storage unavailable"));
        }
        return put(...args);
      }) as typeof h.storage.put;
      return h;
    };
    const wake = async (h: Awaited<ReturnType<typeof setup>>) => {
      const woken = new GameRoomLogic(
        h.storage,
        { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 },
        () => h.clock.now,
      );
      // The room is evicted; the host's socket survives hibernation and speaks first to the new object.
      woken.restore(h.host);
      h.host.sent.length = 0;
      await h.send(h.host, { ch: "room", kind: "sealed-reveal" }, woken);
      return h.host;
    };

    it("a failed write leaves memory and storage on the old scenario and its readiness, and refuses", async () => {
      const h = await readyThenFailing();
      const before = JSON.stringify([...h.storage.map.entries()]);
      const lobbies = h.watcher.of("lobby").length;
      await h.submit(h.host, "registration", { name: NEW_R });
      expect(h.host.refusals).toEqual(["not-saved"]);
      expect(JSON.stringify([...h.storage.map.entries()])).toBe(before);
      expect(h.watcher.of("lobby").length).toBe(lobbies);
      // In memory: still both ready on the old scenario, and the same room reveals it.
      await h.reveal(h.host);
      expect(h.host.refusals).toEqual(["not-saved"]);
      expect(h.host.last("sealed")).toMatchObject({ registration: { name: SECRET_R } });
      // After a wake: the old scenario with the old readiness, both together.
      const host = await wake(h);
      expect(host.refusals).toEqual([]);
      expect(host.last("sealed")).toMatchObject({ registration: { name: SECRET_R }, resistance: { name: SECRET_S } });
    });

    it("a write that lands stores the new scenario with registration no longer ready, both together", async () => {
      const h = await readyThenFailing();
      await h.submit(h.host, "registration", { name: NEW_R }); // fails once
      const revBefore = (h.storage.map.get("lobby") as Stored).competitive!.rev!;
      await h.submit(h.host, "registration", { name: NEW_R });
      expect(h.host.refusals).toEqual(["not-saved"]);
      expect(h.watcher.last("lobby")!.competitive!.teams.registration).toEqual({ submitted: true, ready: false });
      const stored = h.storage.map.get("lobby") as Stored;
      expect(JSON.stringify(h.storage.map.get("sealed"))).toContain(NEW_R);
      expect(stored.competitive).toMatchObject({ ready: { registration: false, resistance: true }, revealed: false });
      expect(stored.competitive!.rev).toBe(revBefore + 1);
      const host = await wake(h);
      expect(host.refusals).toEqual(["not-ready"]);
      expect(host.everything).not.toContain(NEW_R);
    });
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

  it("keeps the teams, readiness and reveal across a cold wake between the reveal and Start", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    // The reveal is stored, and its lobby revision is the one the host's client holds when the reveal resolves.
    const stored = h.storage.map.get("lobby") as { rev: number; competitive: { revealed: boolean; ready: object } };
    expect(stored.competitive.revealed).toBe(true);
    expect(stored.competitive.ready).toEqual({ registration: true, resistance: true });
    expect(stored.rev).toBe(h.host.last("lobby")!.rev);
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
    expect(host2.last("lobby")!.competitive).toMatchObject({ teams: { registration: { ready: true } } });
    await woken.message(
      host2,
      JSON.stringify({ v: 1, ch: "game", kind: "start", table: "t1", header: { h: 1 }, lobbyRev: stored.rev }),
    );
    expect(host2.refusals).toEqual([]);
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

describe("Competitive lobby: who speaks for a team, and what takes readiness back", () => {
  it("lets the host speak only for its own team while it holds a seat, and for either when it holds none", async () => {
    const h = await setup();
    await h.submit(h.host, "resistance", { x: 1 });
    await h.ready(h.host, "resistance");
    expect(h.host.refusals).toEqual(["not-seated", "not-seated"]);
    expect(h.a.last("lobby")!.competitive!.teams.resistance.submitted).toBe(false);
    await h.submit(h.host, "registration", { x: 1 });
    expect(h.host.refusals).toHaveLength(2);
    // Without a seat the host only runs the table: either team's.
    h.clock.now += 10_000;
    await h.send(h.host, { ch: "room", kind: "seat-release", seat: "s1" });
    await h.submit(h.host, "resistance", { x: 2 });
    await h.ready(h.host, "resistance");
    expect(h.host.refusals).toHaveLength(2);
    expect(h.a.last("lobby")!.competitive!.teams.resistance).toEqual({ submitted: true, ready: true });
  });

  it("takes both teams' readiness and the reveal back when a team seat changes hands", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.send(h.host, { ch: "room", kind: "seat-deny", seat: "s4", participant: h.c.id });
    expect(h.a.last("lobby")!.competitive!.teams).toEqual({
      registration: { submitted: true, ready: false },
      resistance: { submitted: true, ready: false },
    });
    await h.start();
    expect(h.host.refusals).toEqual(["out-of-order"]);
  });

  it("takes readiness and the reveal back when the rules or the tie-break option change, before the game", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    h.clock.now += 10_000;
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { tieBreaks: false } });
    expect(h.a.last("lobby")!.competitive!.teams.registration.ready).toBe(false);
    await h.start();
    expect(h.host.refusals).toEqual(["out-of-order"]);
    await h.readyBoth();
    await h.reveal(h.host);
    h.clock.now += 10_000;
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { tableRules: { house: true } } });
    expect(h.a.last("lobby")!.competitive!.teams.resistance.ready).toBe(false);
    // A change that is not the rules (chat) leaves it.
    await h.readyBoth();
    h.clock.now += 10_000;
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { chat: false } });
    expect(h.a.last("lobby")!.competitive!.teams.resistance.ready).toBe(true);
  });

  it("fixes the play mode and the tie-break option while the game runs", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    h.clock.now += 10_000;
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { tieBreaks: false } });
    h.clock.now += 10_000;
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { playMode: "strict" } });
    expect(h.host.refusals).toEqual(["out-of-order", "out-of-order"]);
    expect(h.a.last("lobby")!.settings).toMatchObject({ tieBreaks: true, playMode: "host" });
    h.clock.now += 10_000;
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { chat: false } });
    expect(h.host.refusals).toHaveLength(2);
  });

  it("refuses a seat on the other team to someone who already played in this game (release, then request)", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    await h.send(h.a, { ch: "room", kind: "seat-release", seat: "s2" });
    await h.send(h.b, { ch: "room", kind: "seat-release", seat: "s3" });
    await h.send(h.b, { ch: "room", kind: "seat-request", seat: "s2" });
    expect(h.b.refusals).toEqual(["other-team"]);
    await h.send(h.host, { ch: "room", kind: "seat-assign", seat: "s2", participant: h.b.id });
    expect(h.host.refusals).toEqual(["other-team"]);
    // Their own side is still theirs to take again, and a newcomer may fill the other team's empty seat.
    await h.send(h.b, { ch: "room", kind: "seat-request", seat: "s3" });
    expect(h.b.refusals).toEqual(["other-team"]);
    const late = await h.join("Late");
    await h.send(h.host, { ch: "room", kind: "seat-assign", seat: "s2", participant: late.id });
    expect(h.host.refusals).toEqual(["other-team"]);
    expect(h.a.last("lobby")!.seats.find((s) => s.id === "s2")!.holder).toBe(late.id);
  });
});

describe("Competitive lobby: failed saves and the start window", () => {
  type H = Awaited<ReturnType<typeof setup>>;
  type Stored = { competitive?: { revealed: boolean; sides?: Record<string, string> }; rev?: number };
  /** Fails the next `times` puts that touch the lobby row. */
  const failLobbyPut = (h: H, times: number) => {
    const put = h.storage.put.bind(h.storage);
    let left = times;
    h.storage.put = ((...args: Parameters<typeof put>) => {
      const [key] = args;
      const touchesLobby = typeof key === "string" ? key === "lobby" : "lobby" in key;
      if (left > 0 && touchesLobby) {
        left--;
        return Promise.reject(new Error("storage unavailable"));
      }
      return put(...args);
    }) as typeof h.storage.put;
  };
  const snapshot = (h: H) => JSON.stringify([...h.storage.map.entries()]);
  const end = (h: H) => h.send(h.host, { ch: "game", kind: "end", table: "t1", outcome: { winner: "registration" } });

  it("a first reveal whose save fails sends no scenarios and leaves the revision and reveal as they were", async () => {
    const h = await setup();
    await h.readyBoth();
    const before = snapshot(h);
    const rev = (h.storage.map.get("lobby") as Stored).rev;
    failLobbyPut(h, 1);
    await h.reveal(h.host);
    expect(h.host.refusals).toEqual(["not-saved"]);
    expect(h.host.of("sealed")).toHaveLength(0);
    expect(h.host.everything).not.toContain(SECRET_S);
    expect(snapshot(h)).toBe(before);
    // The retry saves and reveals, one revision up.
    await h.reveal(h.host);
    expect(h.host.last("sealed")).toMatchObject({ registration: { name: SECRET_R } });
    expect((h.storage.map.get("lobby") as Stored).rev).toBe((rev ?? 0) + 1);
    expect((h.storage.map.get("lobby") as Stored).competitive!.revealed).toBe(true);
  });

  it("a start whose side save fails is refused, stores no header and leaves the sides unrecorded", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    const before = snapshot(h);
    failLobbyPut(h, 1);
    await h.start();
    expect(h.host.refusals).toEqual(["not-saved"]);
    expect(snapshot(h)).toBe(before);
    expect(h.storage.map.has("t1:header")).toBe(false);
    // Not live: the teams can still change, and the retry starts.
    await h.send(h.host, { ch: "room", kind: "team-set", seat: "s1", team: "registration" });
    await h.start();
    expect(h.host.refusals).toEqual(["not-saved"]);
    expect(h.storage.map.has("t1:header")).toBe(true);
  });

  it("a team change queued behind a start is refused while the header is being stored", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    const put = h.storage.put.bind(h.storage);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    h.storage.put = (async (...args: Parameters<typeof put>) => {
      if (typeof args[0] === "string" && args[0] === "t1:header") await gate;
      return put(...args);
    }) as typeof h.storage.put;
    const starting = h.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await h.send(h.host, { ch: "room", kind: "team-set", seat: "s2", team: "resistance" });
    await h.ready(h.a, "registration", false);
    expect(h.host.refusals).toEqual(["out-of-order"]);
    expect(h.a.refusals).toEqual(["out-of-order"]);
    release();
    await starting;
    expect((h.storage.map.get("lobby") as Stored).competitive!.revealed).toBe(true);
    expect(h.storage.map.has("t1:header")).toBe(true);
  });

  it("a failed save at the end of the game keeps the sealed row, and a rematch start is refused until the reset is saved", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    const sealed = JSON.stringify(h.storage.map.get("sealed"));
    failLobbyPut(h, 2);
    await end(h);
    expect(JSON.stringify(h.storage.map.get("sealed"))).toBe(sealed);
    expect((h.storage.map.get("lobby") as Stored).competitive!.revealed).toBe(true);
    // Memory matches storage: the lobby the room shows is the stored one.
    expect(h.b.last("lobby")!.competitive!.teams.registration.submitted).toBe(true);
    await h.start();
    expect(h.host.refusals).toEqual(["not-saved"]);
    expect(h.storage.map.has("sealed")).toBe(true);
    // The reset saves on the next attempt; the start still needs a new reveal.
    await h.start();
    expect(h.host.refusals).toEqual(["not-saved", "out-of-order"]);
    expect(h.storage.map.has("sealed")).toBe(false);
    expect((h.storage.map.get("lobby") as Stored).competitive!.revealed).toBe(false);
    expect(h.b.last("lobby")!.competitive!.teams.registration.submitted).toBe(false);
  });

  it("a Competitive start carrying a lobbyRev completes inside the dispatcher's lobby turn (no nested lock)", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    const lobbyRev = (h.storage.map.get("lobby") as Stored).rev;
    await h.send(h.host, { ch: "game", kind: "start", table: "t1", header: { h: 1 }, gid: "g1", lobbyRev });
    expect(h.host.refusals).toEqual([]);
    expect(h.host.last("started")).toBeDefined();
    expect(h.storage.map.has("t1:header")).toBe(true);
    // A log with the room's new revision (the start's side save bumped it) completes too.
    const rev = (h.storage.map.get("lobby") as Stored).rev;
    await h.send(h.host, {
      ch: "game",
      kind: "log",
      table: "t1",
      header: { h: 2 },
      commands: [],
      checksums: {},
      gid: "g1",
      lobbyRev: rev,
    });
    expect(h.host.refusals).toEqual([]);
    expect(h.host.of("started")).toHaveLength(2);
  });

  it("a start whose header write fails after the sides were saved is resumed by the same retry, not refused lobby-changed", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    const lobbyRev = (h.storage.map.get("lobby") as Stored).rev;
    const put = h.storage.put.bind(h.storage);
    let fail = true;
    h.storage.put = (async (...args: Parameters<typeof put>) => {
      if (fail && typeof args[0] === "string" && args[0] === "t1:header") {
        fail = false;
        throw new Error("storage unavailable");
      }
      return put(...args);
    }) as typeof h.storage.put;
    const start = { ch: "game", kind: "start", table: "t1", header: { h: 1 }, gid: "g1", lobbyRev };
    await h.send(h.host, start).catch(() => undefined);
    expect(h.storage.map.has("t1:header")).toBe(false);
    expect((h.storage.map.get("lobby") as Stored).rev).toBe((lobbyRev ?? 0) + 1);
    await h.send(h.host, start);
    expect(h.host.refusals).toEqual([]);
    expect(h.host.of("started")).toHaveLength(1);
    expect(h.storage.map.has("t1:header")).toBe(true);
    // Resumed, not saved again: one revision above the one the host's game was built from.
    expect((h.storage.map.get("lobby") as Stored).rev).toBe((lobbyRev ?? 0) + 1);
  });

  it("a log carrying a lobbyRev needs the reveal like a start does", async () => {
    const h = await setup();
    await h.readyBoth();
    const lobbyRev = (h.storage.map.get("lobby") as Stored).rev;
    const log = {
      ch: "game",
      kind: "log",
      table: "t1",
      header: { h: 1 },
      commands: [],
      checksums: {},
      gid: "g1",
      lobbyRev,
    };
    await h.send(h.host, log);
    expect(h.host.refusals).toEqual(["out-of-order"]);
    expect(h.storage.map.has("t1:header")).toBe(false);
    // Revealed, no prior Start: admitted, and the sides are saved.
    await h.reveal(h.host);
    const revealed = (h.storage.map.get("lobby") as Stored).rev;
    await h.send(h.host, { ...log, lobbyRev: revealed });
    expect(h.host.refusals).toEqual(["out-of-order"]);
    expect(h.host.of("started")).toHaveLength(1);
    const stored = h.storage.map.get("lobby") as Stored;
    expect(Object.keys(stored.competitive!.sides ?? {}).length).toBe(4);
  });

  it("a reset that failed at the game's end is not forgotten by a wake: another game's start and log are refused until a fresh reveal", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.send(h.host, { ch: "game", kind: "start", table: "t1", header: { h: 1 }, gid: "g1" });
    failLobbyPut(h, 1);
    await end(h);
    expect((h.storage.map.get("lobby") as Stored).competitive!.revealed).toBe(true);
    const woken = new GameRoomLogic(
      h.storage,
      { maxParticipants: 25, maxMessageBytes: 64 * 1024, maxLogBytes: 8 * 1024 * 1024 },
      () => h.clock.now,
    );
    woken.restore(h.host);
    h.host.sent.length = 0;
    const log = { ch: "game", kind: "log", table: "t1", header: { h: 2 }, commands: [], checksums: {}, gid: "g2" };
    await h.send(h.host, { ch: "game", kind: "start", table: "t1", header: { h: 2 }, gid: "g2" }, woken);
    await h.send(h.host, { ...log, lobbyRev: (h.storage.map.get("lobby") as Stored).rev }, woken);
    expect(h.host.refusals).toEqual(["out-of-order", "out-of-order"]);
    expect(h.host.of("started")).toHaveLength(0);
    // The reveal was consumed, and the reset was finished on the way.
    expect((h.storage.map.get("lobby") as Stored).competitive!.revealed).toBe(false);
  });

  it("the reset at the end of the game is broadcast", async () => {
    const h = await setup();
    await h.readyBoth();
    await h.reveal(h.host);
    await h.start();
    const lobbies = h.watcher.of("lobby").length;
    await end(h);
    expect(h.watcher.of("lobby").length).toBeGreaterThan(lobbies);
    expect(h.watcher.last("lobby")!.competitive!.teams.resistance.submitted).toBe(false);
  });

  it("leaving Competitive deletes the sealed row only after the lobby is saved, and a failed delete blocks nothing", async () => {
    const h = await setup();
    await h.readyBoth();
    failLobbyPut(h, 1);
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { mode: "standard" } });
    expect(h.host.refusals).toEqual(["not-saved"]);
    expect(h.storage.map.has("sealed")).toBe(true);
    const del = h.storage.delete.bind(h.storage);
    h.storage.delete = (async (...args: Parameters<typeof del>) => {
      if (typeof args[0] === "string" && args[0] === "sealed") throw new Error("storage unavailable");
      return del(...args);
    }) as typeof h.storage.delete;
    await h.send(h.host, { ch: "room", kind: "lobby-set", settings: { mode: "standard" } });
    expect(h.host.refusals).toEqual(["not-saved"]);
    expect(h.watcher.last("lobby")!.settings.mode).toBe("standard");
    expect((h.storage.map.get("lobby") as Stored).competitive).toBeUndefined();
  });
});
