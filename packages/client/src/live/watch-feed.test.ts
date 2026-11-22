import { describe, expect, test } from "vitest";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import { WatchFeed } from "./watch-feed.js";

const T = "t1";
const log = (commands: unknown[], extra: object = {}): ServerMessage =>
  ({ v: 1, ch: "game", kind: "log", table: T, header: { h: 1 }, commands, checksums: {}, ...extra }) as ServerMessage;
const commands = (from: number, list: unknown[], checksums?: Record<string, string>): ServerMessage =>
  ({
    v: 1,
    ch: "game",
    kind: "commands",
    table: T,
    from,
    commands: list,
    ...(checksums ? { checksums } : {}),
  }) as ServerMessage;
const rewind = (to: number): ServerMessage => ({ v: 1, ch: "game", kind: "rewind", table: T, to });

describe("WatchFeed", () => {
  test("opens on the first log, then appends commands that continue it (the log may arrive in parts)", () => {
    const feed = new WatchFeed();
    expect(feed.onMessage(log([1, 2, 3]))).toMatchObject([{ kind: "open", commands: [1, 2, 3] }]);
    expect(feed.onMessage(commands(3, [4, 5], { "5": "x" }))).toEqual([
      { kind: "append", commands: [4, 5], checksums: { "5": "x" } },
    ]);
    expect(feed.count).toBe(5);
  });

  test("ignores commands before there is a log", () => {
    expect(new WatchFeed().onMessage(commands(0, [1]))).toEqual([]);
  });

  test("a batch that starts inside what is held is authoritative: cut back to its start, then append it all", () => {
    const feed = new WatchFeed();
    feed.onMessage(log([1, 2, 3]));
    expect(feed.onMessage(commands(2, [9, 4]))).toMatchObject([
      { kind: "rewind", to: 2 },
      { kind: "append", commands: [9, 4] },
    ]);
    expect(feed.count).toBe(4);
    expect(feed.onMessage(commands(0, [1, 2]))).toMatchObject([{ kind: "rewind", to: 0 }, { kind: "append" }]);
    expect(feed.count).toBe(2);
  });

  test("after a wake the room rewinds, then sends from there; a rewind above what is held is ignored", () => {
    const feed = new WatchFeed();
    feed.onMessage(log([1, 2, 3, 4, 5]));
    expect(feed.onMessage(rewind(3))).toEqual([{ kind: "rewind", to: 3 }]);
    expect(feed.onMessage(commands(3, [7]))).toMatchObject([{ kind: "append", commands: [7] }]);
    expect(feed.count).toBe(4);
    expect(feed.onMessage(rewind(9))).toEqual([]);
    expect(feed.count).toBe(4);
  });

  test("asks to resync when a batch starts past the end (out of order)", () => {
    const feed = new WatchFeed();
    feed.onMessage(log([1, 2]));
    expect(feed.onMessage(commands(5, [6]))).toEqual([{ kind: "resync" }]);
    expect(feed.count).toBe(2);
  });

  test("asks to resync once while the fresh log is awaited, and again only after it came", () => {
    const feed = new WatchFeed();
    feed.onMessage(log([1, 2]));
    expect(feed.onMessage(commands(5, [6]))).toEqual([{ kind: "resync" }]);
    expect(feed.onMessage(commands(6, [7]))).toEqual([]);
    feed.onMessage(log([1, 2, 3]));
    expect(feed.onMessage(commands(9, [10]))).toEqual([{ kind: "resync" }]);
  });

  test("waits on a table the host has not started, and reports a full room", () => {
    const feed = new WatchFeed();
    const you = { id: "w", role: "watcher" as const };
    const welcome = (hasHeader: boolean): ServerMessage => ({
      v: 1,
      ch: "room",
      kind: "welcome",
      you,
      caps: ["watch"],
      participants: [you],
      tables: [{ id: T, hostConnected: false, commands: 0, ended: false, hasHeader }],
    });
    expect(feed.onMessage(welcome(false))[0]).toEqual({ kind: "waiting" });
    expect(feed.onMessage(welcome(true))[0]).toMatchObject({ kind: "presence" });
    expect(feed.onMessage({ v: 1, ch: "room", kind: "refused", reason: "full" })).toEqual([{ kind: "refused" }]);
    expect(feed.onMessage({ v: 1, ch: "room", kind: "refused", reason: "too-large" })).toEqual([]);
  });

  test("a rewind cuts the count; one at or past the end is ignored", () => {
    const feed = new WatchFeed();
    feed.onMessage(log([1, 2, 3, 4]));
    expect(feed.onMessage(rewind(2))).toEqual([{ kind: "rewind", to: 2 }]);
    expect(feed.onMessage(rewind(2))).toEqual([]);
    expect(feed.onMessage(commands(2, [9]))).toMatchObject([{ kind: "append", commands: [9] }]);
  });

  test("end, then a same-count rewind reopens the table and is forwarded; the next append follows", () => {
    const feed = new WatchFeed();
    feed.onMessage(log([1, 2]));
    expect(feed.onMessage({ v: 1, ch: "game", kind: "end", table: T, outcome: "won" } as ServerMessage)).toEqual([
      { kind: "end", outcome: "won" },
    ]);
    expect(feed.onMessage(rewind(2))).toEqual([{ kind: "rewind", to: 2 }]);
    expect(feed.onMessage(rewind(2))).toEqual([]);
    expect(feed.onMessage(commands(2, [3]))).toMatchObject([{ kind: "append", commands: [3] }]);
  });

  test("a log that arrives already ended also lets a same-count rewind through", () => {
    const feed = new WatchFeed();
    feed.onMessage(log([1], { outcome: "lost" }));
    expect(feed.onMessage(rewind(1))).toEqual([{ kind: "rewind", to: 1 }]);
  });

  test("a log after the first is a reset (a reconnect)", () => {
    const feed = new WatchFeed();
    feed.onMessage(log([1]));
    expect(feed.onMessage(log([1, 2, 3]))).toMatchObject([{ kind: "reset", commands: [1, 2, 3] }]);
    expect(feed.count).toBe(3);
  });

  test("passes the end's outcome, and a log that carries one", () => {
    const feed = new WatchFeed();
    expect(feed.onMessage(log([1], { outcome: { won: true } }))).toMatchObject([
      { kind: "open", outcome: { won: true } },
    ]);
    expect(feed.onMessage({ v: 1, ch: "game", kind: "end", table: T, outcome: { won: false } })).toEqual([
      { kind: "end", outcome: { won: false } },
    ]);
  });

  test("ignores another table's messages", () => {
    const feed = new WatchFeed();
    expect(feed.onMessage({ ...(log([1]) as object), table: "t2" } as ServerMessage)).toEqual([]);
  });

  test("reports the host's presence and the watcher count from welcome, table and roster", () => {
    const feed = new WatchFeed();
    const you = { id: "w", role: "watcher" as const };
    expect(
      feed.onMessage({
        v: 1,
        ch: "room",
        kind: "welcome",
        you,
        caps: ["watch"],
        participants: [you, { id: "h", role: "host", table: T }],
        tables: [{ id: T, hostConnected: true, commands: 3, ended: false, hasHeader: true }],
      }),
    ).toEqual([{ kind: "presence", hostConnected: true, watchers: 1 }]);
    expect(
      feed.onMessage({
        v: 1,
        ch: "room",
        kind: "table",
        table: { id: T, hostConnected: false, commands: 3, ended: false, hasHeader: true },
      }),
    ).toEqual([{ kind: "presence", hostConnected: false, watchers: 1 }]);
    expect(feed.onMessage({ v: 1, ch: "room", kind: "roster", participants: [], watchers: 4 })).toEqual([
      { kind: "presence", hostConnected: false, watchers: 4 },
    ]);
    expect(feed.onDisconnected()).toEqual([{ kind: "presence", hostConnected: false, watchers: 4 }]);
  });

  test("passes a closed room on", () => {
    expect(new WatchFeed().onMessage({ v: 1, ch: "room", kind: "closed", reason: "idle" })).toEqual([
      { kind: "closed", reason: "idle" },
    ]);
  });
});
