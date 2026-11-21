/**
 * Civil War Competitive on the client's room connection (issue #883, docs/live-game-rooms.md section 11): the teams, the
 * readiness and the tie-break option in `RoomState`, the sealed scenario that goes to the room and never into a state, the
 * host's reveal, and the seat of a team's first player. Fake sockets, as `room-play.test.ts` does.
 */
import { describe, expect, it, vi } from "vitest";
import { roomTeamsOf } from "./competitive-start.js";
import { LiveRoomController } from "./live-room-controller.js";
import { MemorySeatTokenStore } from "./room-seat-store.js";
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
  of(kind: string): { [k: string]: unknown }[] {
    return this.sent.filter((m) => m.kind === kind);
  }
}

const BUILD = { appVersion: "1.0.0", contentVersion: "p1" };
const SECRET = "SEALED-MODULAR-SET-NAME";
const status = (submitted: boolean, ready: boolean) => ({ submitted, ready });
const lobby = (over: { seats?: object[]; competitive?: object; settings?: object } = {}) => ({
  v: 1,
  ch: "room",
  kind: "lobby",
  code: "ABC234",
  settings: {
    playMode: "host",
    tableRules: {},
    mods: [],
    multiSeat: false,
    chat: true,
    mode: "competitive",
    tieBreaks: true,
    ...BUILD,
    ...over.settings,
  },
  seats: over.seats ?? [
    { id: "s1", label: "Iron Man", player: "p1", team: "registration", holder: "host1" },
    { id: "s2", label: "Captain America", player: "p2", team: "resistance", holder: "ava" },
  ],
  competitive: over.competitive ?? {
    teams: { registration: status(false, false), resistance: status(false, false) },
  },
});
const welcome = () => ({
  v: 1,
  ch: "room",
  kind: "welcome",
  you: { id: "host1", role: "host", name: "Hosty" },
  caps: ["watch", "chat", "seats", "play", "teams"],
  participants: [
    { id: "host1", role: "host", name: "Hosty", build: BUILD },
    { id: "ava", role: "watcher", name: "Ava", build: BUILD },
  ],
  tables: [{ id: "t1", hostConnected: true, commands: 0, ended: false, hasHeader: false }],
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

async function hosting(opts: { open?: boolean } = {}) {
  FakeSocket.all = [];
  const states: RoomState[] = [];
  const sealed: { registration: unknown; resistance: unknown }[] = [];
  const socket: RoomSocketDeps = {
    WebSocket: FakeSocket,
    setTimer: () => ({}),
    clearTimer: () => undefined,
    random: () => 0.5,
  };
  const createRoom = vi.fn(async (_deps: CreateRoomDeps): Promise<CreateRoomResult> => ({
    ok: true,
    room: { roomId: "room00000001", hostToken: "h".repeat(32), table: "t1", code: "ABC234" },
  }));
  const controller = new LiveRoomController({
    syncUrl: "https://sync.example",
    watchBase: "https://web.example/",
    onStatus: () => undefined,
    socket,
    room: {
      build: BUILD,
      seatStore: new MemorySeatTokenStore(),
      onState: (s) => states.push(s),
      onSealed: (s) => sealed.push(s),
      createRoom,
    },
  });
  controller.setEnabled(true);
  controller.onRoomCommand({ kind: "room-host", name: "Hosty" });
  await flush();
  const sock = FakeSocket.all[0]!;
  if (opts.open !== false) {
    sock.open();
    sock.receive(welcome());
    sock.receive(lobby());
  }
  await flush();
  return { controller, sock, states, sealed, last: () => states[states.length - 1]! };
}

describe("a Competitive room's state", () => {
  it("shows the mode, my team, the rosters, readiness and the tie-break option", async () => {
    const t = await hosting();
    t.sock.receive(
      lobby({
        competitive: { teams: { registration: status(true, true), resistance: status(true, false) } },
        settings: { tieBreaks: false },
      }),
    );
    const state = t.last();
    expect(state.mode).toBe("competitive");
    expect(state.seats.map((s) => s.team)).toEqual(["registration", "resistance"]);
    expect(state.competitive).toEqual({
      myTeam: "registration",
      teams: {
        registration: { team: "registration", seats: ["s1"], submitted: true, ready: true },
        resistance: { team: "resistance", seats: ["s2"], submitted: true, ready: false },
      },
      tieBreaks: false,
      sized: true,
      canStart: false,
    });
  });

  it("turns canStart on when both teams have sealed a scenario and are ready, and not for lopsided teams", async () => {
    const t = await hosting();
    const ready = { teams: { registration: status(true, true), resistance: status(true, true) } };
    t.sock.receive(lobby({ competitive: ready }));
    expect(t.last().competitive).toMatchObject({ sized: true, canStart: true, tieBreaks: true });
    t.sock.receive(
      lobby({
        competitive: ready,
        seats: [
          { id: "s1", label: "A", team: "registration" },
          { id: "s2", label: "B", team: "registration" },
          { id: "s3", label: "C", team: "resistance" },
        ],
      }),
    );
    expect(t.last().competitive).toMatchObject({ sized: false, canStart: false });
  });

  it("is null in a standard room, and a seat there has no team", async () => {
    const t = await hosting();
    t.sock.receive({
      ...lobby({ seats: [{ id: "s1", label: "A", player: "p1" }] }),
      settings: { ...lobby().settings, mode: "standard" },
      competitive: undefined,
    });
    expect(t.last().competitive).toBeNull();
    expect(t.last().seats[0]!.team).toBeNull();
  });

  it("maps each engine player to its team for the proposal gate", async () => {
    const t = await hosting();
    expect(roomTeamsOf(t.last())).toEqual({ p1: "registration", p2: "resistance" });
    // Seat n plays p<n>, the mapping startCompetitive sends, whatever the seat's own player says.
    expect(
      roomTeamsOf({
        seats: [
          { team: "resistance", player: null },
          { team: null, player: null },
        ] as never,
      }),
    ).toEqual({
      p1: "resistance",
    });
  });
});

describe("the Competitive calls", () => {
  it("sends team-set, team-ready and the tie-break option as the protocol says", async () => {
    const t = await hosting();
    t.controller.onRoomCommand({ kind: "room-team", seat: "s2", team: "registration" });
    t.controller.onRoomCommand({ kind: "room-team-ready", team: "registration", ready: true });
    t.controller.onRoomCommand({ kind: "room-tiebreaks", on: false });
    expect(t.sock.of("team-set")).toEqual([expect.objectContaining({ seat: "s2", team: "registration" })]);
    expect(t.sock.of("team-ready")).toEqual([expect.objectContaining({ team: "registration", ready: true })]);
    expect(t.sock.of("lobby-set")).toEqual([expect.objectContaining({ settings: { tieBreaks: false } })]);
  });

  it("puts the room into Competitive mode with the seats' teams and each seat's player", async () => {
    const t = await hosting();
    t.controller.onRoomCommand({
      kind: "room-competitive",
      seats: [
        { id: "s1", label: "Iron Man", team: "registration" },
        { id: "s2", label: "Captain America", team: "resistance" },
      ],
      tieBreaks: false,
    });
    expect(t.sock.of("lobby-set")).toEqual([
      expect.objectContaining({
        settings: { mode: "competitive", tieBreaks: false },
        seats: [
          { id: "s1", label: "Iron Man", team: "registration", player: "p1" },
          { id: "s2", label: "Captain America", team: "resistance", player: "p2" },
        ],
      }),
    ]);
  });

  it("seals a scenario: sent to the room, never in any state, never echoed", async () => {
    const t = await hosting();
    t.controller.onRoomCommand({ kind: "room-scenario", team: "registration", scenario: { name: SECRET } });
    expect(t.sock.of("scenario-submit")).toEqual([
      expect.objectContaining({ team: "registration", scenario: { name: SECRET } }),
    ]);
    // The lobby that follows says only that it exists.
    t.sock.receive(
      lobby({ competitive: { teams: { registration: status(true, false), resistance: status(false, false) } } }),
    );
    expect(t.last().competitive!.teams.registration).toMatchObject({ submitted: true, ready: false });
    expect(JSON.stringify(t.states)).not.toContain(SECRET);
    expect(t.sealed).toEqual([]);
  });

  it("keeps a scenario submitted while the socket is down and sends it once at the next welcome", async () => {
    const t = await hosting({ open: false });
    t.controller.onRoomCommand({ kind: "room-scenario", team: "resistance", scenario: { name: SECRET } });
    expect(t.sock.of("scenario-submit")).toHaveLength(0);
    t.sock.open();
    t.sock.receive(welcome());
    expect(t.sock.of("scenario-submit")).toEqual([expect.objectContaining({ team: "resistance" })]);
    t.sock.receive(welcome());
    expect(t.sock.of("scenario-submit")).toHaveLength(1);
    expect(JSON.stringify(t.states)).not.toContain(SECRET);
  });

  it("asks for the reveal and hands the room's answer to the host's onSealed, not to the state", async () => {
    const t = await hosting();
    t.controller.onRoomCommand({ kind: "room-reveal" });
    expect(t.sock.of("sealed-reveal")).toHaveLength(1);
    t.sock.receive({ v: 1, ch: "room", kind: "sealed", registration: { r: SECRET }, resistance: { s: 2 } });
    expect(t.sealed).toEqual([{ registration: { r: SECRET }, resistance: { s: 2 } }]);
    expect(JSON.stringify(t.states)).not.toContain(SECRET);
  });
});

describe("a guest in a Competitive room", () => {
  it("ignores a stray sealed message: only a host's reveal answer is handed on", async () => {
    FakeSocket.all = [];
    const sealed: unknown[] = [];
    const states: RoomState[] = [];
    const controller = new LiveRoomController({
      syncUrl: "https://sync.example",
      watchBase: "https://web.example/",
      onStatus: () => undefined,
      socket: { WebSocket: FakeSocket, setTimer: () => ({}), clearTimer: () => undefined, random: () => 0.5 },
      room: {
        build: BUILD,
        seatStore: new MemorySeatTokenStore(),
        onState: (s) => states.push(s),
        onSealed: (s) => sealed.push(s),
      },
    });
    controller.setEnabled(true);
    controller.onRoomCommand({ kind: "room-join", target: "room00000001", name: "Ava" });
    await flush();
    const sock = FakeSocket.all[0]!;
    sock.open();
    sock.receive({
      ...welcome(),
      you: { id: "ava", role: "watcher", name: "Ava", build: BUILD },
    });
    sock.receive(lobby());
    sock.receive({ v: 1, ch: "room", kind: "sealed", registration: { r: SECRET }, resistance: {} });
    expect(sealed).toEqual([]);
    expect(JSON.stringify(states)).not.toContain(SECRET);
  });
});
