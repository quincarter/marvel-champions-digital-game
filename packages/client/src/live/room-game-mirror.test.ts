import { describe, expect, it, test } from "vitest";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import { GameMirror } from "./room-game-mirror.js";
import { WatchFeed } from "./watch-feed.js";

const msg = (m: object): ServerMessage => ({ v: 1, ch: "game", table: "t1", ...m }) as ServerMessage;
const kinds = (mirror: GameMirror) => mirror.snapshot().map((m) => (m as { kind: string }).kind);

const endedMirror = () => {
  const mirror = new GameMirror();
  mirror.apply(msg({ kind: "log", header: { h: 1 }, commands: [1, 2, 3], checksums: {} }));
  mirror.apply(msg({ kind: "end", outcome: { won: true } }));
  return mirror;
};

describe("GameMirror and a finished game that is reopened", () => {
  it("a finished game snapshots as a log with its outcome and an end", () => {
    expect(kinds(endedMirror())).toEqual(["log", "end"]);
  });

  it("a rewind to the current count reopens it: a guest attaching afterwards gets no outcome and no end", () => {
    const mirror = endedMirror();
    expect(mirror.apply(msg({ kind: "rewind", to: 3 }))).toBe("applied");
    const snapshot = mirror.snapshot();
    expect(kinds(mirror)).toEqual(["log"]);
    expect(snapshot[0]).not.toHaveProperty("outcome");
    expect(mirror.count).toBe(3);
  });

  it("a rewind to the current count of an open game changes nothing, and one past the end is ignored", () => {
    const mirror = new GameMirror();
    mirror.apply(msg({ kind: "log", header: 1, commands: [1, 2], checksums: {} }));
    expect(mirror.apply(msg({ kind: "rewind", to: 2 }))).toBe("ignored");
    expect(mirror.apply(msg({ kind: "rewind", to: 5 }))).toBe("ignored");
  });

  it("a batch after the end clears it too", () => {
    const mirror = endedMirror();
    mirror.apply(msg({ kind: "commands", from: 3, commands: [4] }));
    expect(kinds(mirror)).toEqual(["log"]);
    expect(mirror.count).toBe(4);
    mirror.apply(msg({ kind: "end", outcome: { won: false } }));
    expect(kinds(mirror)).toEqual(["log", "end"]);
  });
});

const T = "t1";
const log = (commands: unknown[], extra: object = {}): ServerMessage =>
  ({ v: 1, ch: "game", kind: "log", table: T, header: { h: 1 }, commands, checksums: {}, ...extra }) as ServerMessage;
const commands = (from: number, list: unknown[]): ServerMessage =>
  ({ v: 1, ch: "game", kind: "commands", table: T, from, commands: list }) as ServerMessage;

describe("GameMirror salvage for a guest whose room closed (#904)", () => {
  test("a held game gives its header and every command, after rewinds and batches", () => {
    const mirror = new GameMirror(T);
    expect(mirror.salvage()).toBeNull();
    mirror.apply(log([1, 2, 3]));
    mirror.apply(commands(3, [4, 5]));
    mirror.apply({ v: 1, ch: "game", kind: "rewind", table: T, to: 4 } as ServerMessage);
    expect(mirror.salvage()).toEqual({ header: { h: 1 }, commands: [1, 2, 3, 4] });
  });

  test("a finished game, a log still arriving and a cleared mirror give nothing to continue from", () => {
    const over = new GameMirror(T);
    over.apply(log([1]));
    over.apply({ v: 1, ch: "game", kind: "end", table: T, outcome: { won: true } } as ServerMessage);
    expect(over.salvage()).toBeNull();
    const arriving = new GameMirror(T);
    arriving.apply(log([1], { total: 4 }));
    expect(arriving.salvage()).toBeNull();
    const cleared = new GameMirror(T);
    cleared.apply(log([1]));
    cleared.clear();
    expect(cleared.salvage()).toBeNull();
  });
});

describe("GameMirror during a multi-part catch-up", () => {
  test("a snapshot taken mid-assembly carries the server's total; once the parts land it does not", () => {
    const mirror = new GameMirror(T);
    mirror.apply(log([1, 2], { total: 5 }));
    expect(mirror.snapshot()).toMatchObject([{ kind: "log", commands: [1, 2], total: 5 }]);
    mirror.apply(commands(2, [3, 4, 5]));
    const [done] = mirror.snapshot();
    expect(done).toMatchObject({ kind: "log", commands: [1, 2, 3, 4, 5] });
    expect(done).not.toHaveProperty("total");
  });

  test("a seat attaching mid-catch-up never sees a partial open: one complete open after the rest arrives", () => {
    const mirror = new GameMirror(T);
    const sent: ServerMessage[] = [];
    mirror.apply(log([1, 2], { total: 5 }));
    sent.push(...mirror.snapshot()); // the seat attaches here
    for (const m of [commands(2, [3]), commands(3, [4, 5])]) {
      mirror.apply(m);
      sent.push(m);
    }
    const feed = new WatchFeed(T);
    const actions = sent.flatMap((m) => feed.onMessage(m));
    expect(actions).toMatchObject([{ kind: "open", commands: [1, 2, 3, 4, 5] }]);
  });
});
