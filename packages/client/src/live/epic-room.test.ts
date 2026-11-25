/**
 * The connection side of Epic Multiplayer (issue #882) through the live-room controller, with fake sockets and a fake
 * engine port: the organizer's lobby calls and start, a table host's token and streaming of its own table, the pod
 * channel in both directions, a reconnect, a drop, the organizer's reload, and a seat holder's view of its own table.
 */
import { describe, expect, it, vi } from "vitest";
import type { Command, PodOutbound, SharedPodState } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { liveGameOf } from "./live-game.js";
import { MemoryEpicLogStore } from "./epic-coordinator.js";
import { LiveRoomController } from "./live-room-controller.js";
import type { LiveControlMessage, LiveGameMessage, LivePodGame, RoomFeedOut } from "./live-room-protocol.js";
import { MemorySeatTokenStore } from "./room-seat-store.js";
import type { FeedPort } from "./room-session.js";
import type { RoomState } from "./room-state.js";
import type { CreateRoomDeps, CreateRoomResult, RoomSocketDeps, WebSocketLike } from "./room-socket.js";

class FakeSocket implements WebSocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: { ch: string; kind: string; [k: string]: unknown }[] = [];
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {
    this.readyState = 3;
  }
  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  closeWith(code: number): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  of(ch: string, kind?: string): { [k: string]: unknown }[] {
    return this.sent.filter((m) => m.ch === ch && (kind === undefined || m.kind === kind));
  }
  get hello(): { tableTokens?: string[]; seatTokens?: string[]; token?: string; caps?: string[] } {
    return this.sent[0] as never;
  }
}

const BUILD = { appVersion: "1.0.0", contentVersion: "p1" };
const SHARED: SharedPodState = {
  villainHp: 120,
  villainDamage: 0,
  villainFlipAtRemaining: 60,
  villainFlipped: false,
  schemeThreat: 0,
  schemeTarget: 6,
  status: "playing",
};
const TABLES = [
  { id: "t1", name: "Avengers", pod: "a", host: "org" },
  { id: "t2", name: "X-Men", pod: "a", host: "me" },
  { id: "t3", name: "Guardians", pod: "b" },
];
const PODS = [
  { id: "a", name: "Pod A" },
  { id: "b", name: "Pod B" },
];
const SEATS = [
  { id: "s1", label: "Spider-Man", table: "t1", player: "p1" },
  { id: "s2", label: "Storm", table: "t2", player: "p1", holder: "me" },
  { id: "s3", label: "Cyclops", table: "t2", player: "p2" },
  { id: "s4", label: "Rocket", table: "t3", player: "p1" },
];

const lobbyEpic = (over: { tableRules?: object; tables?: object[]; seats?: object[] } = {}) => ({
  v: 1,
  ch: "room",
  kind: "lobby",
  code: "ABC234",
  settings: {
    playMode: "host",
    tableRules: over.tableRules ?? {},
    mods: [],
    multiSeat: false,
    chat: true,
    mode: "epic",
    ...BUILD,
  },
  seats: over.seats ?? SEATS,
  tables: over.tables ?? TABLES,
  pods: PODS,
});

const org = { id: "org", role: "host", organizer: true, table: "t1", name: "Olga", build: BUILD };
const me = { id: "me", role: "watcher", name: "Me", build: BUILD };
const meHost = { id: "me", role: "host", table: "t2", name: "Me", build: BUILD };
const info = (id: string, over: object = {}) => ({
  id,
  hostConnected: true,
  commands: 0,
  ended: false,
  hasHeader: false,
  ...over,
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const POD_GAME = (groupId: string, inboundSeq = 0): LivePodGame => ({
  groupId,
  inboundSeq,
  shared: SHARED,
  players: 1,
});
const gameMessage = (gameKey: string, room: string, pod?: LivePodGame): Extract<LiveGameMessage, { kind: "game" }> => ({
  kind: "game",
  gameKey,
  room,
  ...(pod ? { pod } : {}),
  game: liveGameOf({
    writer: { appVersion: "1", contentVersion: "1" },
    config: { scenarioId: "god-of-lies", seed: 1, watchable: true, players: [] } as unknown as SessionConfig,
    createdAt: 1,
    initialState: {} as unknown as StateWithoutPool,
    commands: [],
    outcome: null,
  }),
});
const cmd = (n: number): Command => ({ type: "test", n }) as unknown as Command;
const damaged = (group: string, amount: number): PodOutbound["event"] => ({
  type: "sharedVillainDamaged",
  groupId: group as never,
  amount,
});

function setup(options: { epicStore?: MemoryEpicLogStore; seatStore?: MemorySeatTokenStore } = {}) {
  FakeSocket.all = [];
  const states: RoomState[] = [];
  const toEngine: LiveControlMessage[] = [];
  const timers: { run: () => void; live: boolean; ms: number }[] = [];
  const socket: RoomSocketDeps = {
    WebSocket: FakeSocket,
    setTimer: (run, ms) => {
      const t = { run, live: true, ms };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { live: boolean }).live = false;
    },
    random: () => 0.5,
  };
  const createRoom = vi.fn(async (_deps: CreateRoomDeps): Promise<CreateRoomResult> => ({
    ok: true,
    room: { roomId: "room00000001", hostToken: "h".repeat(32), table: "t1", code: "ABC234" },
  }));
  const seatStore = options.seatStore ?? new MemorySeatTokenStore();
  const controller = new LiveRoomController({
    syncUrl: "https://sync.example",
    watchBase: "https://web.example/",
    onStatus: () => undefined,
    onProposal: (p) => toEngine.push(p),
    onPodInbound: (p) => toEngine.push(p),
    socket,
    room: {
      build: BUILD,
      seatStore,
      ...(options.epicStore ? { epicStore: options.epicStore } : {}),
      onState: (s) => states.push(s),
      createRoom,
      resolveRoomCode: async () => ({ ok: true as const, roomId: "room00000001" }),
    },
  });
  controller.setEnabled(true);
  return {
    controller,
    states,
    toEngine,
    timers,
    seatStore,
    last: () => states[states.length - 1]!,
    podInbound: () =>
      toEngine.filter((m) => m.kind === "pod-inbound") as Extract<LiveControlMessage, { kind: "pod-inbound" }>[],
  };
}

/** The organizer, hosting table t1, in an Epic lobby with t2's host (`me`) and t3's host already named. */
async function organizer(options: { epicStore?: MemoryEpicLogStore; game?: boolean } = {}) {
  const t = setup(options);
  t.controller.onRoomCommand({ kind: "room-host", name: "Olga" });
  await flush();
  const sock = FakeSocket.all[0]!;
  sock.open();
  sock.receive({
    v: 1,
    ch: "room",
    kind: "welcome",
    you: org,
    caps: ["watch", "chat", "seats", "play", "tables"],
    participants: [org, meHost],
    tables: TABLES.map((x) => info(x.id)),
  });
  sock.receive(lobbyEpic());
  if (options.game !== false) {
    t.controller.onGameMessage(gameMessage("g1", "room00000001", POD_GAME("t1")));
    await flush();
  }
  return { ...t, sock };
}

/** A participant who is a seat holder at t2 and has just been made its host. */
async function tableHost(options: { seatStore?: MemorySeatTokenStore; game?: boolean } = {}) {
  const t = setup(options);
  t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "Me" });
  await flush();
  const sock = FakeSocket.all[0]!;
  sock.open();
  sock.receive({
    v: 1,
    ch: "room",
    kind: "welcome",
    you: me,
    caps: ["watch", "chat", "seats", "play", "tables"],
    participants: [org, me],
    tables: TABLES.map((x) => info(x.id)),
  });
  sock.receive(lobbyEpic());
  sock.receive({ v: 1, ch: "room", kind: "table-host-token", table: "t2", token: "T".repeat(32) });
  sock.receive({ v: 1, ch: "room", kind: "roster", participants: [org, meHost], watchers: 0 });
  if (options.game !== false) {
    t.controller.onGameMessage(gameMessage("g2", "room00000001", POD_GAME("t2")));
    await flush();
  }
  return { ...t, sock };
}

describe("the organizer's lobby", () => {
  it("makes the lobby Epic: tables, pods and seats, each table's seats numbered from p1", async () => {
    const t = await organizer({ game: false });
    t.controller.onRoomCommand({
      kind: "room-epic",
      tables: TABLES.map(({ id, name, pod }) => ({ id, name, pod })),
      pods: PODS,
      seats: SEATS.map(({ id, label, table }) => ({ id, label, table })),
    });
    const set = t.sock.of("room", "lobby-set").at(-1)!;
    expect(set.settings).toEqual({ mode: "epic" });
    expect((set.seats as { id: string; player: string }[]).map((s) => [s.id, s.player])).toEqual([
      ["s1", "p1"],
      ["s2", "p1"],
      ["s3", "p2"],
      ["s4", "p1"],
    ]);
    expect(set.tables).toHaveLength(3);
  });

  it("assigns a table host without touching the other tables' hosts", async () => {
    const t = await organizer({ game: false });
    t.controller.onRoomCommand({ kind: "room-table-host", table: "t3", participant: "ben" });
    const set = t.sock.of("room", "lobby-set").at(-1)!;
    const tables = set.tables as { id: string; host?: string | null }[];
    expect(tables.map((x) => [x.id, x.host])).toEqual([
      ["t1", undefined],
      ["t2", undefined],
      ["t3", "ben"],
    ]);
    t.controller.onRoomCommand({ kind: "room-table-host", table: "t3", participant: null });
    expect((t.sock.of("room", "lobby-set").at(-1)!.tables as { host?: unknown }[])[2]!.host).toBeNull();
  });

  it("starts the game as a setting everyone sees, keeping the other table rules", async () => {
    const t = await organizer({ game: false });
    t.sock.receive(lobbyEpic({ tableRules: { sameNameHeroAllyConflict: true } }));
    t.controller.onRoomCommand({ kind: "room-epic-start" });
    const set = t.sock.of("room", "lobby-set").at(-1)!;
    const rules = (
      set.settings as {
        tableRules: { sameNameHeroAllyConflict: boolean; epic: { start: { id: string; seed: number } } };
      }
    ).tableRules;
    expect(rules.sameNameHeroAllyConflict).toBe(true);
    expect(rules.epic.start.id).not.toBe("");
    expect(Number.isInteger(rules.epic.start.seed)).toBe(true);
    // The start comes back in the lobby, and the state says so.
    t.sock.receive(lobbyEpic({ tableRules: { epic: { start: rules.epic.start } } }));
    expect(t.last().epic?.start).toEqual(rules.epic.start);
  });

  it("does nothing for a guest", async () => {
    const t = await tableHost({ game: false });
    t.controller.onRoomCommand({ kind: "room-epic-start" });
    t.controller.onRoomCommand({ kind: "room-table-host", table: "t3", participant: "ben" });
    t.controller.onRoomCommand({ kind: "room-epic-drop", table: "t3" });
    expect(t.sock.of("room", "lobby-set")).toHaveLength(0);
  });

  it("shows the Epic state: tables, who hosts them, my table and the organizer flag", async () => {
    const t = await organizer({ game: false });
    const epic = t.last().epic!;
    expect(t.last().mode).toBe("epic");
    expect(epic.organizer).toBe(true);
    expect(epic.hostsTable).toBe("t1");
    expect(epic.tables.map((x) => [x.id, x.pod, x.host, x.myRole, x.status])).toEqual([
      ["t1", "a", "org", "host", "lobby"],
      ["t2", "a", "me", "watcher", "lobby"],
      ["t3", "b", null, "watcher", "lobby"],
    ]);
    expect(epic.pods.map((p) => [p.id, p.tables])).toEqual([
      ["a", ["t1", "t2"]],
      ["b", ["t3"]],
    ]);
  });
});

describe("following tables", () => {
  it("says which tables to follow: the choice, and (once it hosts or holds a seat) only its own by default", async () => {
    const t = await tableHost({ game: false });
    // A host and seat holder gets its own table without asking: nothing extra.
    expect(t.sock.of("room", "follow").at(-1)).toMatchObject({ tables: [] });
    t.controller.onRoomCommand({ kind: "room-follow-tables", tables: ["t3"] });
    expect(t.sock.of("room", "follow").at(-1)).toMatchObject({ tables: ["t3"] });
    expect(t.last().epic?.following).toEqual(["t3"]);
    expect(t.last().epic?.tables.map((x) => [x.id, x.followed])).toEqual([
      ["t1", false],
      ["t2", true],
      ["t3", true],
    ]);
  });

  it("asks again after a reconnect, which is a new participant to the room", async () => {
    const t = await tableHost({ game: false });
    t.controller.onRoomCommand({ kind: "room-follow-tables", tables: ["t3"] });
    t.sock.closeWith(1006);
    for (const timer of t.timers.splice(0)) if (timer.live) timer.run();
    const second = FakeSocket.all[1]!;
    second.open();
    second.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: meHost,
      caps: ["watch"],
      participants: [org, meHost],
      tables: TABLES.map((x) => info(x.id)),
    });
    expect(second.of("room", "follow").at(-1)).toMatchObject({ tables: ["t3"] });
  });
});

describe("a table host", () => {
  it("keeps the token the room sent it privately, never in the state, and presents it in its next hello", async () => {
    const t = await tableHost({ game: false });
    const record = t.seatStore.records.get("room00000001");
    expect(record?.tokens["table:t2"]).toBe("T".repeat(32));
    expect(JSON.stringify(t.states)).not.toContain("T".repeat(32));
    t.sock.closeWith(1006);
    for (const timer of t.timers.splice(0)) if (timer.live) timer.run();
    const second = FakeSocket.all[1]!;
    second.open();
    expect(second.hello.tableTokens).toEqual(["T".repeat(32)]);
    // It is not a seat token.
    expect(second.hello.seatTokens ?? []).not.toContain("T".repeat(32));
  });

  it("drops a token whose table now has another host", async () => {
    const t = await tableHost({ game: false });
    t.sock.receive(lobbyEpic({ tables: TABLES.map((x) => (x.id === "t2" ? { ...x, host: "someone" } : x)) }));
    await flush();
    expect(t.seatStore.records.get("room00000001")?.tokens["table:t2"]).toBeUndefined();
  });

  it("streams its own table, not the first", async () => {
    const t = await tableHost();
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "g2",
      command: cmd(1),
      count: 1,
    });
    const game = t.sock.of("game");
    expect(game.map((m) => [m.kind, m.table])).toEqual([
      ["start", "t2"],
      ["commands", "t2"],
    ]);
    expect(t.last().epic?.hostsTable).toBe("t2");
  });

  it("judges its seats' proposals for its own table and refuses on that table", async () => {
    const t = await tableHost();
    t.sock.receive({
      v: 1,
      ch: "game",
      kind: "proposal",
      table: "t2",
      from: "ava",
      seats: ["s3"],
      command: { type: "endTurn", playerId: "p2" },
      base: 0,
    });
    expect(t.toEngine.find((m) => m.kind === "proposal")).toMatchObject({ players: ["p2"] });
    t.controller.onGameMessage({ kind: "refuse", gameKey: "g2", to: "ava", reason: "stale", base: 0 });
    expect(t.sock.of("game", "proposal-refused").at(-1)).toMatchObject({ table: "t2", to: "ava" });
  });

  it("tells its seats' proposers their proposal was applied on that table, not on t1", async () => {
    const t = await tableHost();
    t.controller.onGameMessage({ kind: "accept", gameKey: "g2", to: "ava", base: 0, pid: 3 });
    expect(t.sock.of("game", "proposal-accepted").at(-1)).toMatchObject({ table: "t2", to: "ava", base: 0, pid: 3 });
  });

  it("tells the pod where it stands on welcome, then sends its events, and applies the answers in order", async () => {
    const t = await tableHost();
    const sync = t.sock.of("pod", "event").at(-1)!;
    expect(sync).toMatchObject({ table: "t2", seq: 0, event: { type: "podSync", inboundSeq: 0 } });
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "g2",
      command: cmd(1),
      count: 1,
      pod: { outbound: [{ seq: 1, event: damaged("t2", 10) }], inboundSeq: 0 },
    });
    // Held until the organizer answers the sync.
    expect(t.sock.of("pod", "event")).toHaveLength(1);
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: "t2",
      seq: 0,
      event: { kind: "podSyncAck", received: 0 },
    });
    expect(t.sock.of("pod", "event").at(-1)).toMatchObject({
      table: "t2",
      seq: 1,
      event: { type: "sharedVillainDamaged" },
    });
    // The coordinator's answers reach the engine as commands, once and in order, whatever order they arrive in.
    const changed = { kind: "sharedStateChanged", shared: SHARED };
    t.sock.receive({ v: 1, ch: "pod", kind: "inbound", table: "t2", seq: 2, event: { kind: "sharedAck", seq: 1 } });
    t.sock.receive({ v: 1, ch: "pod", kind: "inbound", table: "t2", seq: 1, event: changed });
    t.sock.receive({ v: 1, ch: "pod", kind: "inbound", table: "t2", seq: 1, event: changed });
    expect(t.podInbound().map((m) => [m.sequence, m.event.kind])).toEqual([
      [1, "sharedStateChanged"],
      [2, "sharedAck"],
    ]);
    expect(t.podInbound().every((m) => m.gameKey === "g2")).toBe(true);
  });

  it("re-sends what the organizer lacks after a reconnect, and tells it how far its engine got", async () => {
    const t = await tableHost();
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: "t2",
      seq: 0,
      event: { kind: "podSyncAck", received: 0 },
    });
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "g2",
      command: cmd(1),
      count: 1,
      pod: { outbound: [{ seq: 1, event: damaged("t2", 10) }], inboundSeq: 0 },
    });
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: "t2",
      seq: 1,
      event: { kind: "sharedStateChanged", shared: SHARED },
    });
    expect(t.podInbound()).toHaveLength(1);
    // The socket drops; the engine goes on and emits another event meanwhile.
    t.sock.closeWith(1006);
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "g2",
      command: cmd(2),
      count: 2,
      pod: { outbound: [{ seq: 2, event: damaged("t2", 1) }], inboundSeq: 1 },
    });
    for (const timer of t.timers.splice(0)) if (timer.live) timer.run();
    const second = FakeSocket.all[1]!;
    second.open();
    second.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: meHost,
      caps: [],
      participants: [org, meHost],
      tables: [info("t2", { commands: 2, hasHeader: true })],
    });
    expect(second.of("pod", "event")[0]).toMatchObject({ seq: 0, event: { type: "podSync", inboundSeq: 1 } });
    // The organizer has event 1 only: event 2 goes out again, event 1 does not.
    second.receive({
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: "t2",
      seq: 0,
      event: { kind: "podSyncAck", received: 1 },
    });
    expect(second.of("pod", "event").map((m) => m.seq)).toEqual([0, 2]);
  });
});

describe("the organizer's coordinator", () => {
  const remoteSync = (table: string) => ({
    v: 1,
    ch: "pod",
    kind: "event",
    table,
    seq: 0,
    event: { type: "podSync", inboundSeq: 0, shared: SHARED },
  });

  it("answers a table host's sync with an ack and the shared state, and its events with inbound events", async () => {
    const t = await organizer();
    t.sock.receive(remoteSync("t2"));
    await flush();
    expect(t.sock.of("pod", "inbound").at(-1)).toMatchObject({
      table: "t2",
      seq: 0,
      event: { kind: "podSyncAck", received: 0 },
    });
    expect(t.sock.of("pod", "state").at(-1)).toMatchObject({ state: { shared: { villainDamage: 0 } } });
    t.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 10) });
    await flush();
    // t2's answers: the shared state, then the ack that ends its pause.
    const inbound = t.sock.of("pod", "inbound").filter((m) => m.table === "t2" && (m.seq as number) > 0);
    expect(inbound.map((m) => [m.seq, (m.event as { kind: string }).kind])).toEqual([
      [1, "sharedStateChanged"],
      [2, "sharedAck"],
    ]);
    // t3 has not spoken, but it is told too (it is in the game); the organizer's own table t1 is reached directly.
    expect(
      t.sock
        .of("pod", "inbound")
        .some((m) => m.table === "t3" && (m.event as { kind: string }).kind === "sharedStateChanged"),
    ).toBe(true);
    expect(t.podInbound().map((m) => m.event.kind)).toContain("sharedStateChanged");
    expect(t.podInbound().every((m) => m.gameKey === "g1")).toBe(true);
    expect(t.last().epic?.pod?.shared.villainDamage).toBe(10);
  });

  it("applies its own table's events locally and never sends them to the room as inbound for itself", async () => {
    const t = await organizer();
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "g1",
      command: cmd(1),
      count: 1,
      pod: { outbound: [{ seq: 1, event: damaged("t1", 4) }], inboundSeq: 0 },
    });
    await flush();
    expect(t.last().epic?.pod?.shared.villainDamage).toBe(4);
    expect(t.podInbound().map((m) => m.event.kind)).toEqual(["sharedStateChanged", "sharedAck"]);
    expect(t.sock.of("pod", "inbound").filter((m) => m.table === "t1")).toHaveLength(0);
    // The organizer's own events are not relayed through the room either (it is the coordinator).
    expect(t.sock.of("pod", "event")).toHaveLength(0);
  });

  it("hands its own table's sync ack to the table's link when the coordinator started before the room named it a table host", async () => {
    const t = setup({});
    t.controller.onRoomCommand({ kind: "room-host", name: "Olga" });
    await flush();
    const sock = FakeSocket.all[0]!;
    sock.open();
    const { table: _table, ...bare } = org;
    sock.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: bare,
      caps: ["watch", "chat", "seats", "play", "tables"],
      participants: [bare, meHost],
      tables: TABLES.map((x) => info(x.id)),
    });
    // The lobby makes the coordinator, while the organizer still has no table of its own.
    sock.receive(lobbyEpic());
    await flush();
    // Then the room names the organizer its table's host and its game starts: the link syncs and waits for the ack.
    sock.receive({ v: 1, ch: "room", kind: "roster", participants: [org, meHost], watchers: 0 });
    t.controller.onGameMessage(gameMessage("g1", "room00000001", POD_GAME("t1")));
    await flush();
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "g1",
      command: cmd(1),
      count: 1,
      pod: { outbound: [{ seq: 1, event: damaged("t1", 4) }], inboundSeq: 0 },
    });
    await flush();
    expect(t.last().epic?.pod?.shared.villainDamage).toBe(4);
    expect(sock.of("pod", "inbound").filter((m) => m.table === "t1")).toHaveLength(0);
  });

  it("marks a table dropped after the organizer confirms, and the state says so", async () => {
    const t = await organizer();
    t.sock.receive(remoteSync("t2"));
    await flush();
    t.sock.receive({ v: 1, ch: "room", kind: "table", table: info("t3", { hasHeader: true, hostConnected: false }) });
    expect(t.last().epic?.tables.find((x) => x.id === "t3")?.status).toBe("waiting");
    t.controller.onRoomCommand({ kind: "room-epic-drop", table: "t3" });
    await flush();
    expect(t.last().epic?.tables.find((x) => x.id === "t3")?.status).toBe("dropped");
    expect(t.sock.of("pod", "state").at(-1)).toMatchObject({
      state: { groups: [{}, {}, { groupId: "t3", dropped: true }] },
    });
  });

  it("rebuilds the coordinator from its saved log after a reload, with a new epoch the tables sync on", async () => {
    const store = new MemoryEpicLogStore();
    const first = await organizer({ epicStore: store });
    first.sock.receive(remoteSync("t2"));
    await flush();
    first.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 9) });
    await flush();
    const epoch = (first.sock.of("pod", "state").at(-1)!.state as { epoch: number }).epoch;
    expect(store.records.get("room00000001")?.log).toHaveLength(1);

    // A new worker with the same store: the state is back before anything new is heard.
    const second = await organizer({ epicStore: store, game: false });
    second.sock.receive(remoteSync("t2"));
    await flush();
    const state = second.sock.of("pod", "state").at(-1)!.state as { epoch: number; shared: { villainDamage: number } };
    expect(state.shared.villainDamage).toBe(9);
    expect(state.epoch).not.toBe(epoch);
    // t2 is re-sent what it missed: its two answers, from the log.
    const again = second.sock.of("pod", "inbound").filter((m) => m.table === "t2" && (m.seq as number) > 0);
    expect(again.map((m) => m.seq)).toEqual([1, 2]);
  });

  it("saves the setup at the first sync, so a reload before any event still has the state for a connected table", async () => {
    const store = new MemoryEpicLogStore();
    const first = await organizer({ epicStore: store });
    first.sock.receive(remoteSync("t2"));
    await flush();
    expect(first.sock.of("pod", "inbound").at(-1)).toMatchObject({
      table: "t2",
      event: { kind: "podSyncAck", received: 0 },
    });
    expect(store.records.get("room00000001")?.log).toHaveLength(0);

    // The organizer reloads; t2's socket stays up and sends its first event without syncing.
    const second = await organizer({ epicStore: store, game: false });
    await flush();
    expect(second.sock.of("pod", "state").length).toBeGreaterThan(0);
    second.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 4) });
    await flush();
    const state = second.sock.of("pod", "state").at(-1)!.state as { shared: { villainDamage: number } };
    expect(state.shared.villainDamage).toBe(4);
  });

  it("publishes only the log prefix a save committed: a later event does not ride an earlier save's release", async () => {
    const gates: { record: { log: readonly unknown[] }; ok: () => void; fail: () => void }[] = [];
    class GatedStore extends MemoryEpicLogStore {
      override save(record: Parameters<MemoryEpicLogStore["save"]>[0]): Promise<void> {
        return new Promise((resolve, reject) => {
          gates.push({
            record,
            ok: () => {
              this.records.set(record.roomId, record);
              resolve();
            },
            fail: () => reject(new Error("blocked")),
          });
        });
      }
    }
    const store = new GatedStore();
    const t = await organizer({ epicStore: store });
    // The empty-log save is in flight when an event arrives and updates the state.
    t.sock.receive(remoteSync("t2"));
    await flush();
    t.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 3) });
    await flush();
    expect(gates).toHaveLength(1);
    gates[0]!.ok();
    await flush();
    // The next save (log of 1) is pending and then fails: nothing sent may show its damage.
    expect(gates).toHaveLength(2);
    gates[1]!.fail();
    await flush();
    const damages = () =>
      t.sock.of("pod", "state").map((m) => (m.state as { shared: { villainDamage: number } }).shared.villainDamage);
    expect(damages().length).toBeGreaterThan(0);
    expect(Math.max(...damages())).toBe(0);
    expect(
      t.sock.of("pod", "inbound").some((m) => (m.event as { kind: string; received?: number }).received === 1),
    ).toBe(false);
  });

  it("asks a table to sync when it sends an event and there is no state to apply it to", async () => {
    const t = await organizer({ epicStore: new MemoryEpicLogStore(), game: false });
    t.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 4) });
    await flush();
    expect(t.sock.of("pod", "inbound").at(-1)).toMatchObject({ table: "t2", seq: 0, event: { kind: "podResync" } });
  });

  it("starts a new coordinator for the next game in the same room, with the same tables, pods and seats", async () => {
    const store = new MemoryEpicLogStore();
    const t = await organizer({ epicStore: store });
    t.sock.receive(remoteSync("t2"));
    await flush();
    t.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 9) });
    await flush();
    expect(store.records.get("room00000001")?.log).toHaveLength(1);
    for (const id of ["t1", "t2", "t3"]) t.sock.receive({ v: 1, ch: "game", kind: "end", table: id, outcome: null });
    await flush();
    // Start again: every table has a fresh game (the room announces each table anew).
    for (const id of ["t1", "t2", "t3"]) t.sock.receive({ v: 1, ch: "room", kind: "table", table: info(id) });
    await flush();
    t.sock.receive(remoteSync("t2"));
    await flush();
    expect(t.sock.of("pod", "inbound").at(-1)).toMatchObject({
      table: "t2",
      seq: 0,
      event: { kind: "podSyncAck", received: 0 },
    });
    t.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 3) });
    await flush();
    const state = t.sock.of("pod", "state").at(-1)!.state as { shared: { villainDamage: number } };
    expect(state.shared.villainDamage).toBe(3);
    expect(store.records.get("room00000001")?.log).toHaveLength(1);
  });

  it("does not restore a finished game's log for the rematch after the organizer reloaded", async () => {
    const store = new MemoryEpicLogStore();
    const first = await organizer({ epicStore: store });
    first.sock.receive(remoteSync("t2"));
    await flush();
    first.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 9) });
    await flush();
    for (const id of ["t1", "t2", "t3"])
      first.sock.receive({ v: 1, ch: "game", kind: "end", table: id, outcome: null });
    await flush();
    expect(store.records.get("room00000001")?.ended).toBe(true);

    // Reloaded into the ended lobby: no table has spoken, then the rematch's t2 starts at seq 1.
    const second = await organizer({ epicStore: store, game: false });
    second.sock.receive(remoteSync("t2"));
    await flush();
    expect(second.sock.of("pod", "inbound").at(-1)).toMatchObject({
      table: "t2",
      event: { kind: "podSyncAck", received: 0 },
    });
    second.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 3) });
    await flush();
    const state = second.sock.of("pod", "state").at(-1)!.state as { shared: { villainDamage: number } };
    expect(state.shared.villainDamage).toBe(3);
  });

  it("makes no coordinator for the rematch while the old game's record will not delete, then recovers", async () => {
    let failClear = true;
    class FlakyStore extends MemoryEpicLogStore {
      override async clear(roomId: string): Promise<void> {
        if (failClear) throw new Error("blocked");
        return super.clear(roomId);
      }
    }
    const store = new FlakyStore();
    const t = await organizer({ epicStore: store });
    t.sock.receive(remoteSync("t2"));
    await flush();
    t.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 9) });
    await flush();
    for (const id of ["t1", "t2", "t3"]) t.sock.receive({ v: 1, ch: "game", kind: "end", table: id, outcome: null });
    await flush();
    for (const id of ["t1", "t2", "t3"]) t.sock.receive({ v: 1, ch: "room", kind: "table", table: info(id) });
    await flush();
    const before = t.sock.of("pod", "state").length;
    t.sock.receive(remoteSync("t2"));
    await flush();
    // The old log still loads, but the new game was not given it.
    expect(t.sock.of("pod", "state").length).toBe(before);
    failClear = false;
    t.sock.receive(remoteSync("t2"));
    await flush();
    expect(t.sock.of("pod", "inbound").at(-1)).toMatchObject({
      table: "t2",
      event: { kind: "podSyncAck", received: 0 },
    });
  });

  it("retries a failed clear by itself, with backoff, and answers the kept sync once storage recovers", async () => {
    let failClear = true;
    class FlakyStore extends MemoryEpicLogStore {
      override async clear(roomId: string): Promise<void> {
        if (failClear) throw new Error("blocked");
        return super.clear(roomId);
      }
    }
    const store = new FlakyStore();
    const t = await organizer({ epicStore: store });
    t.sock.receive(remoteSync("t2"));
    await flush();
    t.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 9) });
    await flush();
    for (const id of ["t1", "t2", "t3"]) t.sock.receive({ v: 1, ch: "game", kind: "end", table: id, outcome: null });
    await flush();
    for (const id of ["t1", "t2", "t3"]) t.sock.receive({ v: 1, ch: "room", kind: "table", table: info(id) });
    await flush();
    const acks = () =>
      t.sock.of("pod", "inbound").filter((m) => m.table === "t2" && (m.event as { kind: string }).kind === "podSyncAck")
        .length;
    const before = acks();
    // One sync, and nothing after it.
    t.sock.receive(remoteSync("t2"));
    await flush();
    expect(acks()).toBe(before);
    expect(t.last().epic?.podStuck).toBe(true);
    const retry = () => t.timers.filter((x) => x.live && x.ms >= 1000).at(-1)!;
    expect(retry().ms).toBe(1000);
    // Still failing: the next retry waits twice as long.
    retry().run();
    await flush();
    expect(retry().ms).toBe(2000);
    expect(acks()).toBe(before);
    failClear = false;
    retry().run();
    await flush();
    expect(t.sock.of("pod", "inbound").at(-1)).toMatchObject({
      table: "t2",
      event: { kind: "podSyncAck", received: 0 },
    });
    expect(t.last().epic?.podStuck).toBe(false);
  });

  it("fails closed when the saved log will not read: never acks zero, retries, then restores the durable log", async () => {
    const store = new MemoryEpicLogStore();
    const first = await organizer({ epicStore: store });
    first.sock.receive(remoteSync("t2"));
    await flush();
    first.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 9) });
    await flush();
    const saved = store.records.get("room00000001")!;
    let failLoad = true;
    class FlakyRead extends MemoryEpicLogStore {
      override async load(roomId: string) {
        if (failLoad) throw new Error("readonly transaction");
        return super.load(roomId);
      }
    }
    const flaky = new FlakyRead();
    flaky.records.set("room00000001", saved);
    const second = await organizer({ epicStore: flaky, game: false });
    second.sock.receive(remoteSync("t2"));
    await flush();
    expect(second.sock.of("pod", "inbound").some((m) => m.table === "t2")).toBe(false);
    expect(flaky.records.get("room00000001")).toBe(saved);
    failLoad = false;
    second.timers
      .filter((x) => x.live && x.ms >= 1000)
      .at(-1)!
      .run();
    await flush();
    const state = second.sock.of("pod", "state").at(-1)!.state as { shared: { villainDamage: number } };
    expect(state.shared.villainDamage).toBe(9);
    expect(second.sock.of("pod", "inbound").filter((m) => m.table === "t2" && (m.seq as number) > 0)).not.toHaveLength(
      0,
    );
    expect(second.sock.of("pod", "inbound").some((m) => (m.event as { received?: number }).received === 0)).toBe(false);
  });

  it("fails closed when the stored log cannot be replayed and its clear fails: no ack, no save, until the clear commits", async () => {
    const store = new MemoryEpicLogStore();
    const first = await organizer({ epicStore: store });
    first.sock.receive(remoteSync("t2"));
    await flush();
    first.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 9) });
    await flush();
    const saved = store.records.get("room00000001")!;
    // The same record with a log the reducer refuses.
    const corrupt = { ...saved, log: [{ not: "an entry" }] } as unknown as typeof saved;
    let failClear = true;
    let saves = 0;
    class FlakyClear extends MemoryEpicLogStore {
      override async clear(roomId: string) {
        if (failClear) throw new Error("clear blocked");
        return super.clear(roomId);
      }
      override async save(record: Parameters<MemoryEpicLogStore["save"]>[0]) {
        saves += 1;
        return super.save(record);
      }
    }
    const flaky = new FlakyClear();
    flaky.records.set("room00000001", corrupt);
    const second = await organizer({ epicStore: flaky, game: false });
    second.sock.receive(remoteSync("t2"));
    await flush();
    expect(second.sock.of("pod", "inbound").some((m) => m.table === "t2")).toBe(false);
    expect(second.sock.of("pod", "state")).toHaveLength(0);
    expect(saves).toBe(0);
    expect(flaky.records.get("room00000001")).toBe(corrupt);
    failClear = false;
    second.timers
      .filter((x) => x.live && x.ms >= 1000)
      .at(-1)!
      .run();
    await flush();
    second.sock.receive(remoteSync("t2"));
    await flush();
    expect(second.sock.of("pod", "inbound").at(-1)).toMatchObject({
      table: "t2",
      event: { kind: "podSyncAck", received: 0 },
    });
  });

  it("announces the new epoch when the restore recovers by retry, though no table sync arrived", async () => {
    const store = new MemoryEpicLogStore();
    const first = await organizer({ epicStore: store });
    first.sock.receive(remoteSync("t2"));
    await flush();
    first.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 9) });
    await flush();
    const epoch = (first.sock.of("pod", "state").at(-1)!.state as { epoch: number }).epoch;
    let failLoad = true;
    class FlakyRead extends MemoryEpicLogStore {
      override async load(roomId: string) {
        if (failLoad) throw new Error("readonly transaction");
        return super.load(roomId);
      }
    }
    const flaky = new FlakyRead();
    flaky.records.set("room00000001", store.records.get("room00000001")!);
    // The organizer reloads; its welcome's epoch announcement hits the failing load, and no table says anything.
    const second = await organizer({ epicStore: flaky, game: false });
    await flush();
    expect(second.sock.of("pod", "state")).toHaveLength(0);
    failLoad = false;
    second.timers
      .filter((x) => x.live && x.ms >= 1000)
      .at(-1)!
      .run();
    await flush();
    const state = second.sock.of("pod", "state").at(-1)!.state as { epoch: number; shared: { villainDamage: number } };
    expect(state.shared.villainDamage).toBe(9);
    expect(state.epoch).not.toBe(epoch);
  });

  it("forgets the saved log when the room is closed", async () => {
    const store = new MemoryEpicLogStore();
    const t = await organizer({ epicStore: store });
    t.sock.receive(remoteSync("t2"));
    await flush();
    t.sock.receive({ v: 1, ch: "pod", kind: "event", table: "t2", seq: 1, event: damaged("t2", 9) });
    await flush();
    expect(store.records.has("room00000001")).toBe(true);
    t.sock.receive({ v: 1, ch: "room", kind: "closed", reason: "ended" } as never);
    await flush();
    expect(store.records.has("room00000001")).toBe(false);
  });

  it("is a new epoch when the organizer's own socket comes back, so table hosts re-send what the room dropped", async () => {
    const t = await organizer();
    t.sock.receive(remoteSync("t2"));
    await flush();
    const before = (t.sock.of("pod", "state").at(-1)!.state as { epoch: number }).epoch;
    t.sock.closeWith(1006);
    for (const timer of t.timers.splice(0)) if (timer.live) timer.run();
    const second = FakeSocket.all[1]!;
    second.open();
    second.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: org,
      caps: [],
      participants: [org, meHost],
      tables: TABLES.map((x) => info(x.id)),
    });
    await flush();
    expect((second.of("pod", "state").at(-1)!.state as { epoch: number }).epoch).toBeGreaterThan(before);
  });

  it("ignores an event from a table that is not in the game, and a pod event from a watcher-role session", async () => {
    const t = await organizer();
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "event",
      table: "t9",
      seq: 0,
      event: { type: "podSync", inboundSeq: 0, shared: SHARED },
    });
    expect(t.sock.of("pod", "inbound")).toHaveLength(0);
    const guest = await tableHost({ game: false });
    guest.sock.receive({
      v: 1,
      ch: "pod",
      kind: "event",
      table: "t2",
      seq: 0,
      event: { type: "podSync", inboundSeq: 0, shared: SHARED },
    });
    expect(guest.sock.of("pod")).toHaveLength(0);
  });
});

describe("a coordinator made before the lobby was final", () => {
  it("is made from the lobby as it stands when the first table speaks, not as it was when it was first made", async () => {
    const t = await organizer({ game: false });
    // The lobby made a coordinator (its state broadcast) from 1 + 2 + 1 players; then the organizer moved a seat.
    t.sock.receive(lobbyEpic());
    await flush();
    t.sock.receive(lobbyEpic({ seats: SEATS.map((seat) => (seat.id === "s3" ? { ...seat, table: "t1" } : seat)) }));
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "event",
      table: "t2",
      seq: 0,
      event: { type: "podSync", inboundSeq: 0, shared: SHARED },
    });
    await flush();
    const state = t.sock.of("pod", "state").at(-1)!.state as { groups: { groupId: string; players: number }[] };
    expect(state.groups.map((g) => [g.groupId, g.players])).toEqual([
      ["t1", 2],
      ["t2", 1],
      ["t3", 1],
    ]);
  });

  it("keeps the groups it began the game with once a table has spoken (the room locks the lobby then)", async () => {
    const t = await organizer({ game: false });
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "event",
      table: "t2",
      seq: 0,
      event: { type: "podSync", inboundSeq: 0, shared: SHARED },
    });
    await flush();
    t.sock.receive(lobbyEpic({ seats: SEATS.map((seat) => (seat.id === "s3" ? { ...seat, table: "t1" } : seat)) }));
    await flush();
    const state = t.sock.of("pod", "state").at(-1)!.state as { groups: { players: number }[] };
    expect(state.groups.map((g) => g.players)).toEqual([1, 2, 1]);
  });
});

describe("a table host waiting too long for the coordinator", () => {
  it("shows podStuck, sends the engine a release when asked, and clears once the coordinator has the event", async () => {
    const t = await tableHost();
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "g2",
      command: cmd(1),
      count: 1,
      pod: { outbound: [{ seq: 1, event: damaged("t2", 10) }], inboundSeq: 0, awaiting: true },
    });
    expect(t.last().epic?.podStuck).toBe(false);
    for (const timer of t.timers.splice(0)) if (timer.live) timer.run();
    expect(t.last().epic?.podStuck).toBe(true);
    t.controller.onRoomCommand({ kind: "room-pod-release" });
    expect(t.toEngine.at(-1)).toEqual({ kind: "pod-release", gameKey: "g2" });
    // The engine released its wait and the coordinator answered: no longer stuck.
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "g2",
      command: cmd(2),
      count: 2,
      pod: { outbound: [], inboundSeq: 0, awaiting: false },
    });
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "state",
      state: {
        epoch: 1,
        shared: SHARED,
        outcome: "playing",
        groups: [
          {
            groupId: "t2",
            podId: "a",
            players: 2,
            received: 1,
            status: { phase: "player", round: 1, halted: false },
            reachable: [],
            dropped: false,
          },
        ],
      },
    });
    expect(t.last().epic?.podStuck).toBe(false);
  });

  it("asks for nothing when no game is running", async () => {
    const t = await tableHost({ game: false });
    t.controller.onRoomCommand({ kind: "room-pod-release" });
    expect(t.toEngine).toEqual([]);
  });
});

describe("a remote power", () => {
  it("is a proposal to the attacker's own table's host, whose engine emits it to the pod", async () => {
    // The seat proposes the command to its own table's host like any other; the host judges and dispatches it, and the
    // engine's `remotePowerUsed` rides with the command to the coordinator, which routes it (`epic-pod.test.ts`).
    const t = await tableHost();
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: "t2",
      seq: 0,
      event: { kind: "podSyncAck", received: 0 },
    });
    const power = { type: "remotePower", playerId: "p2", toGroupId: "t1", power: "attack" };
    t.sock.receive({
      v: 1,
      ch: "game",
      kind: "proposal",
      table: "t2",
      from: "ava",
      seats: ["s3"],
      command: power,
      base: 0,
    });
    expect(t.toEngine.find((m) => m.kind === "proposal")).toMatchObject({ command: power, players: ["p2"] });
    t.controller.onGameMessage({
      kind: "command",
      gameKey: "g2",
      command: power as unknown as Command,
      count: 1,
      pod: {
        outbound: [{ seq: 1, event: { type: "remotePowerUsed", groupId: "t2", toGroupId: "t1" } as never }],
        inboundSeq: 0,
      },
    });
    expect(t.sock.of("pod", "event").at(-1)).toMatchObject({
      seq: 1,
      event: { type: "remotePowerUsed", toGroupId: "t1" },
    });
    // The owning group's answer comes back as an inbound event.
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: "t2",
      seq: 1,
      event: { kind: "remotePowerResolved", fromGroupId: "t1", targetInstanceId: "mangog-1", power: "attack" },
    });
    expect(t.podInbound().at(-1)?.event).toMatchObject({ kind: "remotePowerResolved", fromGroupId: "t1" });
  });

  it("lists what a seat may reach in its pod, from the shared state, and nothing in another pod", async () => {
    const t = await tableHost({ game: false });
    const reachable = (id: string) => ({
      groupId: id,
      podId: id === "t3" ? "b" : "a",
      players: 1,
      received: 0,
      status: { phase: "player", round: 1, halted: false },
      reachable: [{ instanceId: `${id}-card`, cardId: "55041", by: "attack", remainingHitPoints: 12 }],
      dropped: false,
    });
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "state",
      state: { epoch: 1, shared: SHARED, outcome: "playing", groups: ["t1", "t2", "t3"].map(reachable) },
    });
    expect(t.last().epic?.remoteTargets).toEqual([
      { table: "t1", tableName: "Avengers", card: expect.objectContaining({ instanceId: "t1-card" }) },
    ]);
  });
});

describe("a seat holder's view of its own table", () => {
  function feedPort() {
    const posted: RoomFeedOut[] = [];
    const port: FeedPort = {
      onmessage: null,
      postMessage: (m) => posted.push(m),
      start: () => undefined,
      close: () => undefined,
    };
    return { port, posted };
  }

  async function seatHolder() {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "Me" });
    await flush();
    const sock = FakeSocket.all[0]!;
    sock.open();
    sock.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: me,
      caps: [],
      participants: [org, me],
      tables: TABLES.map((x) => info(x.id)),
    });
    sock.receive(lobbyEpic({ tables: TABLES.map((x) => ({ ...x, host: x.id === "t1" ? "org" : undefined })) }));
    return { ...t, sock };
  }

  it("follows its own table as if it were the room's only one, and ignores the others", async () => {
    const t = await seatHolder();
    const { port, posted } = feedPort();
    t.controller.onRoomCommand({ kind: "room-follow", port: port as unknown as MessagePort });
    const log = (table: string) => ({
      v: 1,
      ch: "game",
      kind: "log",
      table,
      header: { table },
      commands: [],
      checksums: {},
    });
    t.sock.receive(log("t3"));
    t.sock.receive(log("t2"));
    const games = posted.filter((m) => m.kind === "server" && m.message.ch === "game");
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ message: { kind: "log", table: "t1", header: { table: "t2" } } });
    // Its own table's info reaches the watcher as the first table's.
    t.sock.receive({ v: 1, ch: "room", kind: "table", table: info("t2", { hasHeader: true }) });
    t.sock.receive({ v: 1, ch: "room", kind: "table", table: info("t3", { hasHeader: true }) });
    const tables = posted.filter((m) => m.kind === "server" && m.message.ch === "room" && m.message.kind === "table");
    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ message: { table: { id: "t1", hasHeader: true } } });
  });

  it("proposes to its own table's host, naming that table", async () => {
    const t = await seatHolder();
    const { port } = feedPort();
    t.controller.onRoomCommand({ kind: "room-follow", port: port as unknown as MessagePort });
    port.onmessage?.({
      data: { kind: "propose", command: { type: "endTurn", playerId: "p1" }, base: 3, stamp: "abc" },
    });
    expect(t.sock.of("game", "propose").at(-1)).toMatchObject({ table: "t2", base: 3, stamp: "abc" });
  });

  it("asks the host of its own table for an Undo", async () => {
    const t = await seatHolder();
    t.controller.onRoomCommand({ kind: "room-ask", what: "undo", note: "oops" });
    expect(t.sock.of("game", "request").at(-1)).toMatchObject({ table: "t2", what: "undo" });
  });

  it("follows only its own table by default, and everything for a watcher with no seat", async () => {
    const t = await seatHolder();
    expect(t.sock.of("room", "follow").at(-1)).toMatchObject({ tables: [] });
    const watcher = setup();
    watcher.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "Wat" });
    await flush();
    const sock = FakeSocket.all[0]!;
    sock.open();
    sock.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: { ...me, id: "w" },
      caps: [],
      participants: [org],
      tables: [],
    });
    sock.receive(lobbyEpic({ seats: SEATS.map(({ holder: _holder, ...seat }) => seat) }));
    expect(sock.of("room", "follow").at(-1)).toMatchObject({ tables: "all" });
  });
});

describe("a standard room", () => {
  it("is unchanged: no follow, no pod, the first table", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
    await flush();
    const sock = FakeSocket.all[0]!;
    sock.open();
    sock.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: { id: "h", role: "host", name: "Hosty", table: "t1" },
      caps: [],
      participants: [{ id: "h", role: "host", name: "Hosty", table: "t1" }],
      tables: [info("t1")],
    });
    sock.receive({
      ...lobbyEpic(),
      settings: { ...lobbyEpic().settings, mode: undefined },
      tables: undefined,
      pods: undefined,
    });
    t.controller.onGameMessage(gameMessage("solo", "room00000001"));
    await flush();
    t.controller.onGameMessage({ kind: "command", gameKey: "solo", command: cmd(1), count: 1 });
    expect(sock.of("room", "follow")).toHaveLength(0);
    expect(sock.of("pod")).toHaveLength(0);
    expect(sock.of("game").map((m) => [m.kind, m.table])).toEqual([
      ["start", "t1"],
      ["commands", "t1"],
    ]);
    expect(t.last().epic).toBeNull();
    expect(t.last().mode).toBe("standard");
  });
});

describe("a guest at any table, and watching another", () => {
  const log = (table: string, header: object = { table }) => ({
    v: 1,
    ch: "game",
    kind: "log",
    table,
    header,
    commands: [],
    checksums: {},
  });
  const lobbyWith = (holder: string | null, tables = TABLES) =>
    lobbyEpic({
      tables: tables.map((x) => ({ ...x, host: x.id === "t1" ? "org" : undefined })),
      seats: SEATS.map(({ holder: _h, ...seat }) => (holder && seat.id === "s4" ? { ...seat, holder } : seat)),
    });

  type Raw = { onmessage: ((e: { data: unknown }) => void) | null };
  function feed() {
    const posted: RoomFeedOut[] = [];
    const raw: Raw & { postMessage: (m: RoomFeedOut) => void; start: () => void; close: () => void } = {
      onmessage: null,
      postMessage: (m) => posted.push(m),
      start: () => undefined,
      close: () => undefined,
    };
    return { port: raw as unknown as MessagePort, posted, raw };
  }
  type GameMsg = { table: string; header?: { table: string; again?: boolean } };
  const games = (posted: RoomFeedOut[]): GameMsg[] =>
    posted
      .filter((m) => m.kind === "server" && m.message.ch === "game")
      .map((m) => (m as unknown as { message: GameMsg }).message);

  async function guestAt(holder: string | null) {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "Me" });
    await flush();
    const sock = FakeSocket.all[0]!;
    sock.open();
    sock.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: me,
      caps: [],
      participants: [org, me],
      tables: TABLES.map((x) => info(x.id)),
    });
    sock.receive(lobbyWith(holder));
    return { ...t, sock };
  }

  it("a seat at the third table gets that table's log as the only one, proposes and asks there", async () => {
    const t = await guestAt("me");
    expect(t.sock.of("room", "follow").at(-1)).toMatchObject({ tables: [] });
    const { port, posted, raw } = feed();
    t.controller.onRoomCommand({ kind: "room-follow", port });
    t.sock.receive(log("t2"));
    t.sock.receive(log("t3"));
    expect(games(posted)).toEqual([expect.objectContaining({ table: "t1", header: { table: "t3" } })]);
    raw.onmessage?.({ data: { kind: "propose", command: { type: "endTurn", playerId: "p1" }, base: 0, stamp: "s" } });
    expect(t.sock.of("game", "propose").at(-1)).toMatchObject({ table: "t3" });
    t.controller.onRoomCommand({ kind: "room-ask", what: "adjust", note: "" });
    expect(t.sock.of("game", "request").at(-1)).toMatchObject({ table: "t3" });
  });

  it("keeps its table across a reconnect, even when the log arrives before the lobby", async () => {
    const t = await guestAt("me");
    const { port, posted } = feed();
    t.controller.onRoomCommand({ kind: "room-follow", port });
    t.sock.receive(log("t3"));
    t.sock.closeWith(1006);
    for (const timer of t.timers.splice(0)) if (timer.live) timer.run();
    const second = FakeSocket.all[1]!;
    second.open();
    // A new participant id; the room sends the log right after the welcome and the lobby only then.
    const me2 = { ...me, id: "me2" };
    second.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: me2,
      caps: [],
      participants: [org, me2],
      tables: TABLES.map((x) => info(x.id)),
    });
    second.receive(log("t3", { table: "t3", again: true }));
    second.receive(lobbyWith("me2"));
    expect(games(posted).at(-1)).toMatchObject({ table: "t1", header: { table: "t3", again: true } });
    expect(second.of("room", "follow").at(-1)).toMatchObject({ tables: [] });
    // Another table's log is still not this seat's game.
    second.receive(log("t2"));
    expect(games(posted).at(-1)?.header?.table).toBe("t3");
  });

  it("a log that arrives before the lobby is not lost", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-join", target: "ABC234", name: "Me" });
    await flush();
    const sock = FakeSocket.all[0]!;
    sock.open();
    sock.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: me,
      caps: [],
      participants: [org, me],
      tables: TABLES.map((x) => info(x.id)),
    });
    sock.receive(log("t3"));
    sock.receive(lobbyWith("me"));
    const { port, posted } = feed();
    t.controller.onRoomCommand({ kind: "room-follow", port });
    expect(games(posted)).toEqual([expect.objectContaining({ table: "t1", header: { table: "t3" } })]);
  });

  it("a watcher switches tables in place: the old feed closes, the new table's game arrives as the first", async () => {
    const t = await guestAt(null);
    expect(t.sock.of("room", "follow").at(-1)).toMatchObject({ tables: "all" });
    const first = feed();
    t.controller.onRoomCommand({ kind: "room-follow", port: first.port, feedId: 1 });
    t.sock.receive(log("t1"));
    t.sock.receive(log("t3"));
    expect(games(first.posted).map((m) => m.header?.table)).toEqual(["t1"]);
    t.controller.onRoomCommand({ kind: "room-watch-table", table: "t3" });
    expect(first.posted.at(-1)).toEqual({ kind: "gone" });
    expect(t.sock.of("room", "follow").at(-1)).toMatchObject({ tables: ["t3"] });
    expect(t.last().epic?.following).toEqual(["t3"]);
    // The watch view opens a new feed: it starts from what arrived of t3.
    const second = feed();
    t.controller.onRoomCommand({ kind: "room-follow", port: second.port, feedId: 2 });
    expect(games(second.posted)).toEqual([expect.objectContaining({ table: "t1", header: { table: "t3" } })]);
    // Disposing the old watch afterwards does not close the new one.
    t.controller.onRoomCommand({ kind: "room-unfollow", feedId: 1 });
    expect(second.posted.at(-1)).not.toEqual({ kind: "gone" });
    t.sock.receive({ v: 1, ch: "game", kind: "commands", table: "t3", from: 0, commands: [{ type: "x" }] });
    expect(second.posted.at(-1)).toMatchObject({ message: { kind: "commands", table: "t1" } });
    // Back to the first table.
    t.controller.onRoomCommand({ kind: "room-watch-table", table: "t1" });
    expect(second.posted.at(-1)).toEqual({ kind: "gone" });
  });

  it("an organizer who runs no table may watch any table the same way", async () => {
    const t = setup();
    t.controller.onRoomCommand({ kind: "room-host", name: "Olga" });
    await flush();
    const sock = FakeSocket.all[0]!;
    sock.open();
    const orgNoTable = { id: "org", role: "host", organizer: true, name: "Olga", build: BUILD };
    sock.receive({
      v: 1,
      ch: "room",
      kind: "welcome",
      you: orgNoTable,
      caps: [],
      participants: [orgNoTable],
      tables: TABLES.map((x) => info(x.id)),
    });
    sock.receive(
      lobbyEpic({
        tables: TABLES.map((x) => ({ ...x, host: undefined })),
        seats: SEATS.map(({ holder: _h, ...seat }) => seat),
      }),
    );
    expect(t.last().epic?.hostsTable).toBeNull();
    t.controller.onRoomCommand({ kind: "room-watch-table", table: "t2" });
    expect(sock.of("room", "follow").at(-1)).toMatchObject({ tables: ["t2"] });
    sock.receive(log("t2"));
    const { port, posted } = feed();
    t.controller.onRoomCommand({ kind: "room-follow", port });
    expect(games(posted)).toEqual([expect.objectContaining({ table: "t1", header: { table: "t2" } })]);
  });

  it("a seat holder and a table host watch their own table: watchTable changes nothing for them", async () => {
    const seated = await guestAt("me");
    const before = seated.sock.of("room", "follow").length;
    seated.controller.onRoomCommand({ kind: "room-watch-table", table: "t1" });
    expect(seated.sock.of("room", "follow")).toHaveLength(before);
    const host = await tableHost({ game: false });
    const hostBefore = host.sock.of("room", "follow").length;
    host.controller.onRoomCommand({ kind: "room-watch-table", table: "t3" });
    expect(host.sock.of("room", "follow")).toHaveLength(hostBefore);
  });
});

describe("the dev command that damages Loki from a table", () => {
  it("sends a shared event numbered after the engine's, once the organizer has answered the sync", async () => {
    const t = await tableHost();
    t.sock.receive({
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: "t2",
      seq: 0,
      event: { kind: "podSyncAck", received: 0 },
    });
    t.controller.onRoomCommand({ kind: "room-dev-shared-damage", amount: 7 });
    expect(t.sock.of("pod", "event").at(-1)).toMatchObject({
      table: "t2",
      seq: 1,
      event: { type: "sharedVillainDamaged", groupId: "t2", amount: 7 },
    });
    t.controller.onRoomCommand({ kind: "room-dev-shared-damage", amount: 1 });
    expect(t.sock.of("pod", "event").at(-1)).toMatchObject({ seq: 2 });
  });
});
