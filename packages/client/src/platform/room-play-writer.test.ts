import { describe, expect, test, vi } from "vitest";
import type { RoomPlayRecord } from "../engine/room-play.js";
import { MAX_TIMED_RETRIES, RoomPlayWriter } from "./room-play-writer.js";

const record = (over: Partial<RoomPlayRecord> = {}): RoomPlayRecord => ({
  role: "host",
  roomId: "room-1",
  gameKey: "room-1:main:g-1",
  mode: "standard",
  mySeats: ["p1" as never],
  friends: [],
  tookOver: [],
  chatSent: 0,
  strict: false,
  cheats: false,
  ...over,
});

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function make(over: { fail?: () => boolean; base?: RoomPlayRecord | null } = {}) {
  const written: RoomPlayRecord[] = [];
  const timers: { run: () => void; ms: number }[] = [];
  const writer = new RoomPlayWriter({
    write: async (_id, r) => {
      if (over.fail?.()) throw new Error("storage");
      written.push(r);
    },
    load: async () => over.base ?? null,
    setTimer: (run, ms) => {
      const t = { run, ms };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      const i = timers.indexOf(h as never);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  return { writer, written, timers };
}

describe("RoomPlayWriter", () => {
  test("a failed initial write stays dirty, an identical state retries it, and it lands once", async () => {
    let failing = true;
    const { writer, written } = make({ fail: () => failing });
    writer.submit("g", record());
    await flush();
    expect(written).toEqual([]);
    expect(writer.dirty).toBe(true);
    failing = false;
    writer.submit("g", record());
    await flush();
    expect(written).toHaveLength(1);
    expect(writer.dirty).toBe(false);
    writer.submit("g", record());
    await flush();
    expect(written).toHaveLength(1);
  });

  test("a failed final write is retried on a backoff after the game ends, bounded", async () => {
    let failing = true;
    const { writer, written, timers } = make({ fail: () => failing });
    writer.submit("g", record({ chatSent: 4 }));
    await flush();
    expect(timers).toHaveLength(1);
    failing = false;
    timers[0]!.run();
    await flush();
    expect(written.map((r) => r.chatSent)).toEqual([4]);
    expect(writer.dirty).toBe(false);

    const always = make({ fail: () => true });
    always.writer.submit("g", record());
    await flush();
    for (let i = 0; i < MAX_TIMED_RETRIES + 3; i++) {
      always.timers.shift()?.run();
      await flush();
    }
    expect(always.timers).toHaveLength(0);
    expect(always.writer.dirty).toBe(true);
  });

  test("a failed final write of game A is still retried after game B starts and writes", async () => {
    const failing = new Set(["a"]);
    const written: string[] = [];
    const timers: { run: () => void }[] = [];
    const writer = new RoomPlayWriter({
      write: async (id) => {
        if (failing.has(id)) throw new Error("storage");
        written.push(id);
      },
      load: async () => null,
      setTimer: (run) => {
        const t = { run };
        timers.push(t);
        return t;
      },
      clearTimer: (h) => {
        const i = timers.indexOf(h as never);
        if (i >= 0) timers.splice(i, 1);
      },
    });
    writer.submit("a", record({ gameKey: "room-1:main:a" }));
    await flush();
    expect(timers).toHaveLength(1);
    writer.submit("b", record({ gameKey: "room-1:main:b" }));
    await flush();
    expect(written).toEqual(["b"]);
    expect(writer.dirty).toBe(true);
    failing.clear();
    timers.shift()!.run();
    await flush();
    expect(written).toEqual(["b", "a"]);
    expect(writer.dirty).toBe(false);
  });

  test("a retry writes to the host captured at submit, and a target that cannot write rejects", async () => {
    const good = { ok: true, wrote: [] as string[] };
    const bad = { ok: false, wrote: [] as string[] };
    const timers: { run: () => void }[] = [];
    let current = good;
    const writer = new RoomPlayWriter<typeof good>({
      write: async (id, _r, target) => {
        if (!target.ok) throw new Error("no recordRoomPlay");
        target.wrote.push(id);
      },
      load: async () => null,
      setTimer: (run) => {
        const t = { run };
        timers.push(t);
        return t;
      },
      clearTimer: () => {},
    });
    // The first attempt fails on the original host; the app swaps to a host that cannot write; the retry still goes to
    // the original one.
    good.ok = false;
    writer.submit("a", record(), good);
    await flush();
    current = bad;
    good.ok = true;
    timers.shift()!.run();
    await flush();
    expect(current).toBe(bad);
    expect(good.wrote).toEqual(["a"]);
    expect(bad.wrote).toEqual([]);
    expect(writer.dirty).toBe(false);
    // A write against a host that cannot write never reads as confirmed.
    writer.submit("c", record({ gameKey: "room-1:main:c" }), bad);
    await flush();
    expect(writer.dirty).toBe(true);
  });

  test("a later submit naming another host does not migrate the dirty record: the original owner gets it", async () => {
    const h1 = { ok: false, wrote: [] as string[] };
    const h2 = { ok: true, wrote: [] as string[] };
    const timers: { run: () => void }[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const writer = new RoomPlayWriter<typeof h1>({
      write: async (id, _r, target) => {
        if (!target.ok) throw new Error("storage");
        target.wrote.push(id);
      },
      load: async () => null,
      setTimer: (run) => {
        const t = { run };
        timers.push(t);
        return t;
      },
      clearTimer: () => {},
    });
    expect(writer.submit("a", record(), h1)).toBe(true);
    await flush();
    expect(writer.dirty).toBe(true);
    // The app swapped to another host that can write; a later state names it for the same game: refused.
    expect(writer.submit("a", record({ chatSent: 2 }), h2)).toBe(false);
    await flush();
    expect(h2.wrote).toEqual([]);
    expect(warn).toHaveBeenCalled();
    h1.ok = true;
    timers.at(-1)!.run();
    await flush();
    expect(h1.wrote).toEqual(["a"]);
    expect(h2.wrote).toEqual([]);
    expect(writer.dirty).toBe(false);
    warn.mockRestore();
  });

  test("a persisted takeover of the same game is merged in; another game's is not", async () => {
    const base = record({ mySeats: ["p1", "p2"] as never, tookOver: [{ player: "p2" as never, reason: "away" }] });
    const same = make({ base });
    same.writer.submit("g", record());
    await flush();
    expect(same.written[0]!.tookOver).toEqual([{ player: "p2", reason: "away" }]);
    expect(same.written[0]!.mySeats).toEqual(["p1", "p2"]);
    const other = make({ base: { ...base, gameKey: "room-1:main:g-0" } });
    other.writer.submit("g", record());
    await flush();
    expect(other.written[0]!.tookOver).toEqual([]);
  });
});
