import { describe, expect, test, vi } from "vitest";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import type { ReplayInfo } from "../replay/replay-session.js";
import type { ReplayOpened, ReplayOpenSource } from "../replay/replay-core.js";
import type { WebSocketLike } from "./room-socket.js";
import { LiveWatcher, WATCH_OPEN_TIMEOUT_MS, WATCH_WAIT_TIMEOUT_MS, type LiveWatchCore } from "./watch-controller.js";
import type { LiveWatchEvent } from "./watch-events.js";

class FakeSocket implements WebSocketLike {
  static all: FakeSocket[] = [];
  readyState = 1;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: unknown[] = [];
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(): void {}
  /** The room says something. */
  say(message: object): void {
    this.onmessage?.({ data: JSON.stringify({ v: 1, ...message }) });
  }
}

const info = (length: number, extra: Partial<ReplayInfo> = {}): ReplayInfo =>
  ({ length, total: length, ...extra }) as ReplayInfo;

function fakeCore() {
  let length = 0;
  const calls: string[] = [];
  const core: LiveWatchCore = {
    open: async (source: ReplayOpenSource) => {
      if (source.kind !== "live") throw new Error("not live");
      length = source.commands.length;
      calls.push(`open ${length}`);
      return { cardPool: {}, info: info(length) } as unknown as ReplayOpened;
    },
    liveAppend: (commands) => {
      length += commands.length;
      calls.push(`append ${commands.length}`);
      return info(length);
    },
    liveRewind: (to, adjusted) => {
      length = to;
      calls.push(`rewind ${to}${adjusted ? " adjusted" : ""}`);
      return info(length);
    },
    liveEnd: (_outcome, adjusted) => {
      calls.push(adjusted ? "end adjusted" : "end");
      return info(length, { outcome: {} as never });
    },
  };
  return { core, calls };
}

const welcome = {
  ch: "room",
  kind: "welcome",
  you: { id: "w", role: "watcher" },
  caps: ["watch"],
  participants: [{ id: "w", role: "watcher" }],
  tables: [{ id: "t1", hostConnected: true, commands: 2, ended: false, hasHeader: true }],
};
const log = (commands: unknown[]) => ({
  ch: "game",
  kind: "log",
  table: "t1",
  header: { h: 1 },
  commands,
  checksums: {},
});

function watcher(openTimeoutMs?: number) {
  FakeSocket.all = [];
  const { core, calls } = fakeCore();
  const events: LiveWatchEvent[] = [];
  const timers: (() => void)[] = [];
  const w = new LiveWatcher({
    core,
    baseUrl: "http://sync",
    roomId: "A".repeat(12),
    packs: [],
    emit: (event) => events.push(event),
    ...(openTimeoutMs ? { openTimeoutMs } : {}),
    deps: {
      WebSocket: FakeSocket as never,
      setTimer: (run) => timers.push(run),
      clearTimer: () => undefined,
      random: () => 0.5,
    },
  });
  const socket = () => FakeSocket.all.at(-1)!;
  return { w, calls, events, socket, timers };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("LiveWatcher", () => {
  test("joins as a watcher with no token, opens on the log, then follows appends, a rewind and the end", async () => {
    const { w, calls, events, socket } = watcher();
    const opening = w.open();
    const s = socket();
    expect(s.url).toBe(`ws://sync/room/${"A".repeat(12)}/ws`);
    s.onopen?.({});
    expect(s.sent[0]).toEqual({ v: 1, ch: "room", kind: "hello", caps: ["watch"] });
    s.say(welcome);
    s.say(log([1, 2]));
    const opened = await opening;
    expect(opened.info.length).toBe(2);
    // The presence the room reported while opening arrives once the game is open.
    expect(events).toEqual([{ type: "presence", hostConnected: true, watchers: 1 }]);

    s.say({ ch: "game", kind: "commands", table: "t1", from: 2, commands: [3] });
    s.say({ ch: "game", kind: "rewind", table: "t1", to: 1 });
    s.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
    await flush();
    expect(calls).toEqual(["open 2", "append 1", "rewind 1", "end"]);
    expect(events.slice(1).map((e) => (e.type === "info" ? e.change : e.type))).toEqual(["append", "rewind", "end"]);
    expect(events[1]).toMatchObject({ added: 1 });
    w.dispose();
  });

  test("hands the host's adjusted flag on a rewind and on the end to the replay (#909)", async () => {
    const { w, calls, socket } = watcher();
    const opening = w.open();
    const s = socket();
    s.onopen?.({});
    s.say(welcome);
    s.say(log([1, 2]));
    await opening;
    s.say({ ch: "game", kind: "rewind", table: "t1", to: 2, adjusted: true });
    s.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" }, adjusted: true });
    await flush();
    expect(calls).toEqual(["open 2", "rewind 2 adjusted", "end adjusted"]);
    w.dispose();
  });

  test("reads a log that arrives in parts: the first opens, the rest append", async () => {
    const { w, calls, socket } = watcher();
    const opening = w.open();
    const s = socket();
    s.onopen?.({});
    s.say(welcome);
    s.say(log([1, 2]));
    s.say({ ch: "game", kind: "commands", table: "t1", from: 2, commands: [3, 4] });
    await opening;
    await flush();
    expect(calls).toEqual(["open 2", "append 2"]);
    w.dispose();
  });

  test("a commands batch that skips ahead reconnects for a fresh log, which resets the replay", async () => {
    const { w, calls, events, socket } = watcher();
    const opening = w.open();
    const first = socket();
    first.onopen?.({});
    first.say(welcome);
    first.say(log([1, 2]));
    await opening;
    first.say({ ch: "game", kind: "commands", table: "t1", from: 9, commands: [10] });
    await flush();
    const second = socket();
    expect(second).not.toBe(first);
    second.onopen?.({});
    second.say(welcome);
    second.say(log([1, 2, 3, 4]));
    await flush();
    expect(calls).toEqual(["open 2", "open 4"]);
    expect(events.at(-1)).toMatchObject({ type: "info", change: "reset" });
    w.dispose();
  });

  test("a room that closes before it has a game, or never answers, is gone", async () => {
    const closed = watcher();
    const a = closed.w.open();
    closed.socket().onopen?.({});
    closed.socket().say(welcome);
    closed.socket().say({ ch: "room", kind: "closed", reason: "idle" });
    await expect(a).rejects.toMatchObject({ code: "missing" });

    const silent = watcher(50);
    const b = silent.w.open();
    silent.timers[0]!();
    await expect(b).rejects.toMatchObject({ code: "missing" });
  });

  test("a damaged header fails the open", async () => {
    const { w, socket } = watcher();
    const core: LiveWatchCore = {
      open: vi.fn().mockRejectedValue(Object.assign(new Error("damaged"), { code: "damaged" })),
    } as never;
    const bad = new LiveWatcher({
      core,
      baseUrl: "http://sync",
      roomId: "A".repeat(12),
      packs: [],
      emit: () => undefined,
      deps: { WebSocket: FakeSocket as never, setTimer: () => 0, clearTimer: () => undefined, random: () => 0.5 },
    });
    void w;
    void socket;
    const opening = bad.open();
    const s = FakeSocket.all.at(-1)!;
    s.onopen?.({});
    s.say(welcome);
    s.say(log([]));
    await expect(opening).rejects.toMatchObject({ code: "damaged" });
  });

  test("a reset that cannot be opened, or an append the core refuses, stops following and says so", async () => {
    for (const breakIt of ["open", "append"] as const) {
      const { w, events, socket } = watcher();
      const real = fakeCore().core;
      let opens = 0;
      const core: LiveWatchCore = {
        ...real,
        open: async (source) => {
          if (breakIt === "open" && ++opens === 2) throw new Error("damaged");
          return real.open(source);
        },
        liveAppend: (commands, checksums) => {
          if (breakIt === "append") throw new Error("too many commands");
          return real.liveAppend(commands, checksums);
        },
      };
      const wrapped = new LiveWatcher({
        core,
        baseUrl: "http://sync",
        roomId: "A".repeat(12),
        packs: [],
        emit: (event) => events.push(event),
        deps: { WebSocket: FakeSocket as never, setTimer: () => 0, clearTimer: () => undefined, random: () => 0.5 },
      });
      void w;
      void socket;
      const opening = wrapped.open();
      const s = FakeSocket.all.at(-1)!;
      s.onopen?.({});
      s.say(welcome);
      s.say(log([1, 2]));
      await opening;
      s.say(
        breakIt === "open" ? log([1, 2, 3]) : { ch: "game", kind: "commands", table: "t1", from: 2, commands: [3] },
      );
      await flush();
      expect(events.at(-1)).toEqual({ type: "failed" });
      // Stopped: nothing after it is applied.
      s.say({ ch: "game", kind: "commands", table: "t1", from: 3, commands: [4] });
      await flush();
      expect(events.filter((e) => e.type === "failed")).toHaveLength(1);
    }
  });

  test("a full room is its own failure, and a room with no game started is waited for longer", async () => {
    const full = watcher();
    const a = full.w.open();
    full.socket().onopen?.({});
    full.socket().say({ ch: "room", kind: "refused", reason: "full" });
    await expect(a).rejects.toMatchObject({ code: "full" });

    const waiting = watcher();
    const b = waiting.w.open();
    waiting.socket().onopen?.({});
    waiting.socket().say({ ...welcome, tables: [{ ...welcome.tables[0], hasHeader: false, commands: 0 }] });
    await flush();
    // The clock was restarted, so the first (short) timer's callback is no longer the live one.
    expect(waiting.timers.length).toBe(2);
    waiting.socket().say(log([1]));
    await expect(b).resolves.toBeDefined();
    waiting.w.dispose();
  });

  test("being turned away as full, or finding the room gone, after the game opened says the feed is lost", async () => {
    const full = watcher();
    const a = full.w.open();
    const s = full.socket();
    s.onopen?.({});
    s.say(welcome);
    s.say(log([1]));
    await a;
    s.say({ ch: "room", kind: "refused", reason: "full" });
    await flush();
    expect(full.events.at(-1)).toEqual({ type: "failed" });

    const gone = watcher();
    const b = gone.w.open();
    const first = gone.socket();
    first.onopen?.({});
    first.say(welcome);
    first.say(log([1]));
    await b;
    first.onclose?.({ code: 1006 });
    gone.timers.at(-1)!();
    gone.socket().onclose?.({ code: 1011 });
    await flush();
    expect(gone.events.at(-1)).toEqual({ type: "failed" });
  });

  test("disposing a watcher that is still opening settles its open", async () => {
    const { w } = watcher();
    const opening = w.open();
    w.dispose();
    await expect(opening).rejects.toMatchObject({ code: "missing" });
  });

  test("tells the host the room closed once the game is open", async () => {
    const { w, events, socket } = watcher();
    const opening = w.open();
    const s = socket();
    s.onopen?.({});
    s.say(welcome);
    s.say(log([1]));
    await opening;
    s.say({ ch: "room", kind: "closed", reason: "ended" } satisfies Partial<ServerMessage>);
    await flush();
    expect(events.at(-1)).toEqual({ type: "closed", reason: "ended" });
  });
});

describe("LiveWatcher on a room worker's feed (issue #880)", () => {
  function feedWatcher() {
    FakeSocket.all = [];
    const { core, calls } = fakeCore();
    const events: LiveWatchEvent[] = [];
    const posted: unknown[] = [];
    const feed = {
      onmessage: null as ((event: { readonly data: unknown }) => void) | null,
      postMessage: (m: unknown) => void posted.push(m),
      close: vi.fn(),
    };
    const w = new LiveWatcher({
      core,
      baseUrl: "http://sync",
      roomId: "A".repeat(12),
      packs: [],
      feed,
      emit: (event) => events.push(event),
    });
    const say = (message: unknown) =>
      feed.onmessage?.({ data: { kind: "server", message: { v: 1, ...(message as object) } } });
    return { w, calls, events, posted, feed, say };
  }

  test("opens and follows what the feed delivers, with no socket of its own", async () => {
    const { w, calls, say, feed } = feedWatcher();
    const opening = w.open();
    say(welcome);
    say(log([1, 2]));
    await opening;
    say({ ch: "game", kind: "commands", table: "t1", from: 2, commands: [3] });
    await flush();
    expect(calls).toEqual(["open 2", "append 1"]);
    expect(FakeSocket.all).toHaveLength(0);
    w.dispose();
    expect(feed.close).toHaveBeenCalled();
  });

  test("asks the worker for the game again on a gap", async () => {
    const { w, say, posted } = feedWatcher();
    const opening = w.open();
    say(log([1, 2]));
    await opening;
    say({ ch: "game", kind: "commands", table: "t1", from: 9, commands: [3] });
    await flush();
    expect(posted).toEqual([{ kind: "resync" }]);
    w.dispose();
  });
});

describe("LiveWatcher hello device", () => {
  test("a watcher's own hello carries the device it was given, and none otherwise", () => {
    for (const device of [{ platform: "web", form: "phone" } as const, undefined]) {
      FakeSocket.all = [];
      const { core } = fakeCore();
      const w = new LiveWatcher({
        core,
        baseUrl: "http://sync",
        roomId: "A".repeat(12),
        packs: [],
        emit: () => undefined,
        ...(device ? { device } : {}),
        deps: {
          WebSocket: FakeSocket as never,
          setTimer: () => undefined,
          clearTimer: () => undefined,
          random: () => 0.5,
        },
      });
      void w.open().catch(() => undefined);
      FakeSocket.all.at(-1)!.onopen?.({});
      expect(FakeSocket.all.at(-1)!.sent[0]).toEqual({
        v: 1,
        ch: "room",
        kind: "hello",
        caps: ["watch"],
        ...(device ? { device } : {}),
      });
      w.dispose();
    }
  });
});

describe("LiveWatcher hello name (#1021)", () => {
  test("a watch link's hello says the viewer's online name when given, so a room game's lobby lets it in", () => {
    for (const name of ["Gareth", undefined]) {
      FakeSocket.all = [];
      const { core } = fakeCore();
      const w = new LiveWatcher({
        core,
        baseUrl: "http://sync",
        roomId: "A".repeat(12),
        packs: [],
        emit: () => undefined,
        ...(name ? { name } : {}),
        deps: {
          WebSocket: FakeSocket as never,
          setTimer: () => undefined,
          clearTimer: () => undefined,
          random: () => 0.5,
        },
      });
      void w.open().catch(() => undefined);
      FakeSocket.all.at(-1)!.onopen?.({});
      expect(FakeSocket.all.at(-1)!.sent[0]).toEqual({
        v: 1,
        ch: "room",
        kind: "hello",
        caps: ["watch"],
        ...(name ? { name } : {}),
      });
      w.dispose();
    }
  });
});

describe("LiveWatcher table (#1021)", () => {
  test("a link to an Epic room's other table follows that table alone, and opens its log", async () => {
    FakeSocket.all = [];
    const { core, calls } = fakeCore();
    const w = new LiveWatcher({
      core,
      baseUrl: "http://sync",
      roomId: "A".repeat(12),
      packs: [],
      emit: () => undefined,
      table: "t2",
      deps: {
        WebSocket: FakeSocket as never,
        setTimer: () => undefined,
        clearTimer: () => undefined,
        random: () => 0.5,
      },
    });
    const opened = w.open();
    const socket = FakeSocket.all.at(-1)!;
    socket.onopen?.({});
    expect(socket.sent[0]).toMatchObject({ kind: "hello", caps: ["watch"], follow: ["t2"] });
    // The first table's log is not the one asked for; the second's opens the watch.
    socket.say({ ch: "game", kind: "log", table: "t1", header: {}, commands: [{ type: "pass" }] });
    socket.say({
      ch: "game",
      kind: "log",
      table: "t2",
      header: {},
      commands: [{ type: "pass" }, { type: "pass" }],
    });
    await opened;
    expect(calls).toEqual(["open 2"]);
    w.dispose();
  });

  const t2Watcher = () => {
    FakeSocket.all = [];
    const { core, calls } = fakeCore();
    const timers: number[] = [];
    const w = new LiveWatcher({
      core,
      baseUrl: "http://sync",
      roomId: "A".repeat(12),
      packs: [],
      emit: () => undefined,
      table: "t2",
      deps: {
        WebSocket: FakeSocket as never,
        setTimer: (_run, ms) => (timers.push(ms), timers.length),
        clearTimer: () => undefined,
        random: () => 0.5,
      },
    });
    const opening = w.open();
    const socket = FakeSocket.all.at(-1)!;
    socket.onopen?.({});
    return { w, opening, socket, calls, timers };
  };

  test("a link to a table the room does not have fails as gone at once, not after waiting for a host", async () => {
    const { opening, socket, calls, timers } = t2Watcher();
    // What the room sends a hello that follows an unknown table: the refusal, then a welcome without that table.
    socket.say({ ch: "room", kind: "refused", reason: "no-such-table" });
    socket.say(welcome);
    await expect(opening).rejects.toMatchObject({ code: "missing" });
    expect(calls).toEqual([]);
    // Only the first open clock was armed: the 45-second wait for a host never started.
    expect(timers).toEqual([WATCH_OPEN_TIMEOUT_MS]);
  });

  test("a welcome that does not list the linked table is gone too, even without the refusal", async () => {
    const { opening, socket } = t2Watcher();
    socket.say(welcome);
    await expect(opening).rejects.toMatchObject({ code: "missing" });
  });

  test("a listed table with no game yet still waits for its host", async () => {
    const { w, opening, socket, timers } = t2Watcher();
    opening.catch(() => undefined);
    socket.say({
      ...welcome,
      tables: [...welcome.tables, { id: "t2", hostConnected: false, commands: 0, ended: false, hasHeader: false }],
    });
    await Promise.resolve();
    expect(timers).toEqual([WATCH_OPEN_TIMEOUT_MS, WATCH_WAIT_TIMEOUT_MS]);
    w.dispose();
  });
});
