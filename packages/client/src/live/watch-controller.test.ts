import { describe, expect, test, vi } from "vitest";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import type { ReplayInfo } from "../replay/replay-session.js";
import type { ReplayOpened, ReplayOpenSource } from "../replay/replay-core.js";
import type { WebSocketLike } from "./room-socket.js";
import { LiveWatcher, type LiveWatchCore } from "./watch-controller.js";
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
    liveRewind: (to) => {
      length = to;
      calls.push(`rewind ${to}`);
      return info(length);
    },
    liveEnd: () => {
      calls.push("end");
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
