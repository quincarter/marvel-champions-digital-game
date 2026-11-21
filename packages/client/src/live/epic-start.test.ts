/**
 * The Epic start, a table's place in the game, the table's game config, the state's pure fold and the table renaming
 * (issue #882), without a socket.
 */
import type { LobbyState, Participant, TableInfo } from "@mc/sync-worker/room-protocol";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import { describe, expect, it } from "vitest";
import type { SessionConfig } from "../engine/host.js";
import { epicPlacementOf, epicTableConfig, readEpicStart, tableSeedOf, withEpicStart } from "./epic-start.js";
import { epicStateOf } from "./epic-view.js";
import type { PodGroupWire, PodStateWire } from "./pod-wire.js";
import type { EpicState } from "./room-state.js";
import { aliasTable } from "./table-alias.js";

const table = (id: string, pod: string, seats: string[]) =>
  ({ id, pod, seats }) as unknown as EpicState["tables"][number];
const EPIC: EpicState = {
  organizer: false,
  hostsTable: "t2",
  myTable: "t2",
  tables: [table("t1", "a", ["s1"]), table("t2", "a", ["s2", "s3"]), table("t3", "b", ["s4"])],
  pods: [
    { id: "a", name: "A", tables: ["t1", "t2"] },
    { id: "b", name: "B", tables: ["t3"] },
  ],
  start: { id: "go", seed: 12345 },
  timeLimitMinutes: null,
  pod: null,
  remoteTargets: [],
  following: [],
  podStuck: false,
};
const CONFIG = { scenarioId: "god-of-lies", players: [{}, {}], seed: 1 } as unknown as SessionConfig;
const withPlayers = (n: number): SessionConfig =>
  ({ ...CONFIG, players: Array.from({ length: n }, () => ({})) }) as never;

describe("the Epic start", () => {
  it("is read from the lobby's table rules, and only when it is well formed", () => {
    expect(readEpicStart({ epic: { start: { id: "x", seed: 5 } } })).toEqual({ id: "x", seed: 5 });
    expect(readEpicStart({})).toBeNull();
    expect(readEpicStart(undefined)).toBeNull();
    expect(readEpicStart({ epic: { start: { id: "", seed: 5 } } })).toBeNull();
    expect(readEpicStart({ epic: { start: { id: "x", seed: -1 } } })).toBeNull();
    expect(readEpicStart({ epic: { start: { id: "x", seed: 1.5 } } })).toBeNull();
    expect(readEpicStart({ epic: "no" })).toBeNull();
  });

  it("is set without losing the other table rules", () => {
    const rules = withEpicStart({ sameNameHeroAllyConflict: true }, { id: "x", seed: 5 });
    expect(rules).toEqual({ sameNameHeroAllyConflict: true, epic: { start: { id: "x", seed: 5 } } });
    expect(readEpicStart(rules)).toEqual({ id: "x", seed: 5 });
  });

  it("gives each table its own seed, the same one every time", () => {
    expect(tableSeedOf(99, "t1")).toBe(tableSeedOf(99, "t1"));
    expect(tableSeedOf(99, "t1")).not.toBe(tableSeedOf(99, "t2"));
    expect(tableSeedOf(99, "t1")).not.toBe(tableSeedOf(100, "t1"));
    expect(Number.isInteger(tableSeedOf(99, "t1"))).toBe(true);
    expect(tableSeedOf(99, "t1")).toBeGreaterThanOrEqual(0);
  });
});

describe("where a table sits in the game", () => {
  it("names its pod's tables in order, the groups and every player in the game", () => {
    expect(epicPlacementOf(EPIC, "t2")).toEqual({
      groupId: "t2",
      groupIdsInPod: ["t1", "t2"],
      groupsInGame: 3,
      playersInGame: 4,
    });
    expect(epicPlacementOf(EPIC, "t3")?.groupIdsInPod).toEqual(["t3"]);
    expect(epicPlacementOf(EPIC, "t9")).toBeNull();
  });
});

describe("the table host's game", () => {
  it("is the table's own config with its seed, its place in the pod and the room fields", () => {
    const config = epicTableConfig(CONFIG, EPIC, { roomId: "room00000001", playMode: "strict" });
    expect(config).toMatchObject({
      scenarioId: "god-of-lies",
      seed: tableSeedOf(12345, "t2"),
      watchable: true,
      room: "room00000001",
      roomPlayMode: "strict",
      epic: { groupId: "t2", groupIdsInPod: ["t1", "t2"], groupsInGame: 3, playersInGame: 4 },
    });
    // The same start on the same table is the same game.
    expect(epicTableConfig(CONFIG, EPIC, { roomId: "room00000001" }).seed).toBe(config.seed);
  });

  it("says why it cannot start: not a host, not started, the wrong number of heroes", () => {
    const room = { roomId: "room00000001" };
    expect(() => epicTableConfig(CONFIG, { ...EPIC, hostsTable: null }, room)).toThrow(/hosts no table/);
    expect(() => epicTableConfig(CONFIG, { ...EPIC, start: null }, room)).toThrow(/not started/);
    expect(() => epicTableConfig(CONFIG, null, room)).toThrow(/hosts no table/);
    expect(() => epicTableConfig(CONFIG, EPIC, { roomId: null })).toThrow(/not in a room/);
    expect(() => epicTableConfig(withPlayers(1), EPIC, room)).toThrow(/2 seats but 1/);
  });
});

describe("the Epic state", () => {
  const participants: Participant[] = [
    { id: "org", role: "host", organizer: true, table: "t1", name: "Olga" },
    { id: "me", role: "host", table: "t2", name: "Me" },
    { id: "wat", role: "watcher", name: "Wat" },
  ];
  const info = (id: string, over: Partial<TableInfo> = {}): TableInfo => ({
    id,
    hostConnected: true,
    commands: 0,
    ended: false,
    hasHeader: true,
    ...over,
  });
  const lobby = (tableRules: Record<string, unknown> = {}): LobbyState =>
    ({
      code: "ABC234",
      settings: { mode: "epic", tableRules },
      seats: [
        { id: "s1", label: "A", table: "t1" },
        { id: "s2", label: "B", table: "t2", holder: "me" },
        { id: "s4", label: "D", table: "t3" },
      ],
      tables: [
        { id: "t1", name: "One", pod: "a", host: "org" },
        { id: "t2", name: "Two", pod: "a", host: "me" },
        { id: "t3", name: "Three", pod: "b" },
      ],
      pods: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
    }) as unknown as LobbyState;
  const group = (id: string, pod: string, over: Partial<PodGroupWire> = {}): PodGroupWire => ({
    ...groupBase(id, pod),
    ...over,
  });
  const groupBase = (id: string, pod: string): PodGroupWire => ({
    groupId: id as never,
    podId: pod,
    players: 1,
    received: 0,
    status: { phase: "player", round: 2, halted: false },
    reachable: [],
    dropped: false,
  });
  const base = {
    lobby: lobby(),
    participants,
    meId: "me",
    watching: { t1: 2 },
    podState: null,
    follow: [] as readonly string[],
    mySeats: ["s2"],
  };

  it("is null in a standard room and before there is a lobby", () => {
    expect(epicStateOf({ ...base, lobby: null, tableInfos: new Map() })).toBeNull();
    const standard = { ...lobby(), settings: { ...lobby().settings, mode: undefined } } as unknown as LobbyState;
    expect(epicStateOf({ ...base, lobby: standard, tableInfos: new Map() })).toBeNull();
  });

  it("words each table's status: lobby, phase, halted, waiting, dropped, over", () => {
    const podState: PodStateWire = {
      epoch: 1,
      outcome: "playing",
      shared: {} as never,
      groups: [
        group("t1", "a", { status: { phase: "villain", round: 3, halted: false } }),
        group("t2", "a", { status: { phase: "player", round: 3, halted: true } }),
        group("t3", "b", { dropped: true }),
      ],
    };
    const state = epicStateOf({
      ...base,
      podState,
      tableInfos: new Map([info("t1"), info("t2"), info("t3", { hasHeader: true })].map((i) => [i.id, i])),
    })!;
    expect(state.tables.map((t) => [t.id, t.status, t.round])).toEqual([
      ["t1", "villain", 3],
      ["t2", "halted", 3],
      ["t3", "dropped", 2],
    ]);
    const waiting = epicStateOf({
      ...base,
      podState,
      tableInfos: new Map([["t1", info("t1", { hostConnected: false })]]),
    })!;
    expect(waiting.tables[0]?.status).toBe("waiting");
    const over = epicStateOf({ ...base, tableInfos: new Map([["t1", info("t1", { ended: true })]]) })!;
    expect(over.tables[0]?.status).toBe("over");
    expect(over.tables[2]?.status).toBe("lobby");
  });

  it("shows my role, watcher counts, followed tables and the start", () => {
    const state = epicStateOf({
      ...base,
      lobby: lobby({ epic: { start: { id: "go", seed: 3 } } }),
      tableInfos: new Map(),
    })!;
    expect(state.tables.map((t) => [t.id, t.myRole, t.watching, t.followed])).toEqual([
      ["t1", "watcher", 2, false],
      ["t2", "host", 0, true],
      ["t3", "watcher", 0, false],
    ]);
    expect(state.start).toEqual({ id: "go", seed: 3 });
    expect(state.hostsTable).toBe("t2");
    expect(state.organizer).toBe(false);
  });

  it("lists the cards of my pod's other tables I may reach, never my own table's or another pod's", () => {
    const card = (id: string) => ({
      instanceId: id as never,
      cardId: "55041" as never,
      by: "attack" as const,
      remainingHitPoints: 9,
    });
    const podState: PodStateWire = {
      epoch: 1,
      outcome: "playing",
      shared: {} as never,
      groups: [
        group("t1", "a", { reachable: [card("a1")] }),
        group("t2", "a", { reachable: [card("mine")] }),
        group("t3", "b", { reachable: [card("far")] }),
      ],
    };
    const state = epicStateOf({ ...base, podState, tableInfos: new Map() })!;
    expect(state.remoteTargets.map((r) => [r.table, r.card.instanceId])).toEqual([["t1", "a1"]]);
    // A table that gave up reaches nothing.
    const dropped = epicStateOf({
      ...base,
      podState: {
        ...podState,
        groups: [group("t1", "a", { reachable: [card("a1")], dropped: true }), ...podState.groups.slice(1)],
      },
      tableInfos: new Map(),
    })!;
    expect(dropped.remoteTargets).toEqual([]);
  });
});

describe("renaming the followed table", () => {
  const log = (table: string): ServerMessage => ({
    v: 1,
    ch: "game",
    kind: "log",
    table,
    header: 1,
    commands: [],
    checksums: {},
  });
  it("renames its game messages and drops another table's", () => {
    expect(aliasTable(log("t2"), "t2", "t1")).toMatchObject({ table: "t1" });
    expect(aliasTable(log("t3"), "t2", "t1")).toBeNull();
    expect(aliasTable(log("t1"), "t1", "t1")).toEqual(log("t1"));
  });

  it("renames its table info, and a welcome keeps only that table", () => {
    const info = { id: "t2", hostConnected: true, commands: 4, ended: false, hasHeader: true };
    expect(aliasTable({ v: 1, ch: "room", kind: "table", table: info }, "t2", "t1")).toMatchObject({
      table: { id: "t1", commands: 4 },
    });
    expect(aliasTable({ v: 1, ch: "room", kind: "table", table: { ...info, id: "t3" } }, "t2", "t1")).toBeNull();
    const welcome = {
      v: 1,
      ch: "room",
      kind: "welcome",
      you: { id: "x", role: "watcher" },
      caps: [],
      participants: [],
      tables: [info, { ...info, id: "t3" }],
    } as ServerMessage;
    expect(aliasTable(welcome, "t2", "t1")).toMatchObject({ tables: [{ id: "t1", commands: 4 }] });
  });

  it("leaves a message that names no table alone", () => {
    const roster = { v: 1, ch: "room", kind: "roster", participants: [], watchers: 0 } as ServerMessage;
    expect(aliasTable(roster, "t2", "t1")).toBe(roster);
  });
});
