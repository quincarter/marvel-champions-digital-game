/**
 * Fault-injection scenarios for the live room (harness: `test-support/fault-bus.ts`). The room, the publisher and the
 * watchers' feeds are the real ones; only the wire and the storage are faked. Each scenario asserts three things that
 * must not be confused: what was SENT, what was durably SAVED, and what each watcher APPLIED.
 */
import { describe, expect, it } from "vitest";
import type { ClientMessage } from "@mc/sync-worker/room-protocol";
import { FaultBus, cmds, liveGame } from "./test-support/fault-bus.js";

const isCommands = (m: ClientMessage) => m.ch === "game" && m.kind === "commands";
const isEnd = (m: ClientMessage) => m.ch === "game" && m.kind === "end";
/**
 * The room writes the unfinished tail on a table's first batch, once a minute, and when the host leaves, so what it
 * has saved is a gapless prefix of the host's log: never a hole, never more than the host sent.
 */
const savedPrefixOf = (bus: FaultBus, log: unknown[], atLeast = 0) => {
  const saved = bus.storage.savedLog("t1", true); // strict: a hole or an overlap throws
  expect(saved.length).toBeGreaterThanOrEqual(atLeast);
  expect(saved).toEqual(log.slice(0, saved.length));
};

describe("publisher reconnects mid-stream with unacked events", () => {
  it("loses nothing and applies nothing twice", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 5)) host.command(c);
    await bus.settle();
    expect(watcher.applied.commands).toEqual(cmds(0, 5));

    // Three more commands are in flight when the link dies; two more happen while it is down.
    for (const c of cmds(5, 8)) host.command(c);
    await host.disconnect();
    for (const c of cmds(8, 10)) host.command(c);
    host.connect();
    await bus.settle();

    // SENT: the publisher resumed from what the room said it held (5), not from its own optimistic cursor (8).
    const froms = host.up.sent.filter(isCommands).map((m) => (m as { from: number }).from);
    expect(froms).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 5]);
    expect(host.sentKinds().filter((k) => k === "start")).toHaveLength(1);
    // SAVED: the room's memory holds all ten, and what storage has is a prefix of them.
    expect(bus.roomLog()).toBe(10);
    savedPrefixOf(bus, cmds(0, 10), 1);
    // APPLIED: the watcher holds exactly the ten, in order.
    expect(watcher.applied.commands).toEqual(cmds(0, 10));
    expect(host.resyncs).toEqual([]);
  });
});

describe("interrupted persistence", () => {
  it("a chunk write that fails is not counted as saved: after recovery storage, watchers and the host agree", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();

    // The 20th command fills the first chunk; its write fails.
    bus.storage.failPut((k) => k.startsWith("t1:c:"));
    for (const c of cmds(0, 25)) host.command(c);
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    // The failed chunk was not counted as written, so the next batch wrote it (and the watcher, which missed the
    // failed frame, asked for a fresh log).
    expect(bus.storage.writes.filter((k) => k.startsWith("t1:c:"))).toHaveLength(1);

    // The host leaves: the room writes its tail. Nothing stored may claim the failed chunk was saved (a hole).
    await host.disconnect();
    expect(bus.storage.savedLog("t1", true)).toEqual(cmds(0, 25));

    // The room restarts (a wake) and the host reconnects.
    await bus.restartRoom();
    await host.disconnect();
    host.connect();
    await bus.settle();

    // SAVED: storage reads back as a whole log, with no hole where the failed chunk was.
    expect(bus.storage.savedLog("t1", true)).toEqual(cmds(0, 25));
    expect(bus.roomLog()).toBe(25);
    // APPLIED: a watcher that joins now, and the one that was there, see the host's log.
    const late = bus.watcher();
    late.connect();
    watcher.connect();
    await bus.settle();
    expect(late.applied.commands).toEqual(cmds(0, 25));
    expect(watcher.applied.commands).toEqual(cmds(0, 25));
    expect(host.publisher.commandCount).toBe(25);
  });

  it("a write held when the room is lost never landed: the restarted room serves what was stored and the host fills the rest", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    host.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) host.command(c);
    await bus.settle();

    bus.storage.deferPut((k) => k.startsWith("t1:c:"));
    for (const c of cmds(3, 23)) host.command(c);
    void bus.settle(); // never settles: the room is waiting on its storage
    await bus.storage.whenParked();
    expect(bus.storage.writes.some((k) => k.startsWith("t1:c:"))).toBe(false);
    bus.storage.loseDeferred();
    await bus.restartRoom();
    await host.disconnect();
    host.connect();
    await bus.settle();

    expect(bus.storage.savedLog()).toEqual(cmds(0, 23));
    const watcher = bus.watcher();
    watcher.connect();
    await bus.settle();
    expect(watcher.applied.commands).toEqual(cmds(0, 23));
  });
});

describe("storage and the room counts stay consistent under failed writes", () => {
  it("a chunk that lands while the old tail cannot be deleted is not served twice after a wake", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    host.connect();
    await bus.settle();
    for (const c of cmds(0, 19)) host.command(c); // the first batch wrote a tail row
    await bus.settle();
    expect(bus.storage.map.has("t1:tail")).toBe(true);

    bus.storage.failDelete((k) => k === "t1:tail");
    host.command(cmds(19, 20)[0]!); // fills chunk 0: the chunk lands, the tail delete fails
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    expect(bus.storage.map.has("t1:c:000000")).toBe(true);
    expect(bus.storage.map.has("t1:tail")).toBe(true);

    // A wake loads chunk 0 and the stale tail (which starts at 0): the overlap is skipped.
    await bus.restartRoom();
    const watcher = bus.watcher();
    watcher.connect();
    await bus.settle();
    expect(bus.roomLog()).toBe(20);
    expect(watcher.applied.commands).toEqual(cmds(0, 20));
  });

  it("a rewind whose chunk delete fails leaves no counted-but-deleted or stored-but-uncounted chunks behind", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    host.connect();
    await bus.settle();
    for (const c of cmds(0, 45)) host.command(c);
    await bus.settle();
    expect([...bus.storage.map.keys()].filter((k) => k.startsWith("t1:c:"))).toHaveLength(2);

    bus.storage.failDelete((k) => k.startsWith("t1:c:"));
    host.publisher.rewind(5);
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);

    // The host is heard again (a reconnect re-sends the cut): the room ends with the host five commands, and
    // nothing left in storage can bring the old chunks back.
    await host.disconnect();
    host.connect();
    await bus.settle();
    await host.disconnect();
    expect([...bus.storage.map.keys()].filter((k) => k.startsWith("t1:c:"))).toEqual([]);
    expect(bus.storage.savedLog()).toEqual(cmds(0, 5));
    await bus.restartRoom();
    const watcher = bus.watcher();
    watcher.connect();
    await bus.settle();
    expect(watcher.applied.commands).toEqual(cmds(0, 5));
  });

  it("the tail is refreshed once a minute while the host streams", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    host.connect();
    await bus.settle();
    for (const c of cmds(0, 5)) host.command(c);
    await bus.settle();
    expect(bus.storage.savedLog()).toEqual(cmds(0, 1)); // only the first batch so far
    bus.clock.now += 61_000;
    host.command(cmds(5, 6)[0]!);
    await bus.settle();
    expect(bus.storage.savedLog()).toEqual(cmds(0, 6));
  });
});

describe("a new game while a watcher still holds the old one", () => {
  it("a new game gets its own room: the old room only learns its table is over", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame([], "A"));
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 4)) host.command(c);
    host.up.held = true;
    host.command(cmds(4, 5)[0]!);
    host.publisher.abandon();
    host.up.held = false;
    await bus.settle();
    // SENT: the batch, then an end with no outcome. APPLIED: the watcher keeps game A, ended. SAVED: ended.
    expect(host.sentKinds().slice(-2)).toEqual(["commands", "end"]);
    expect(watcher.applied.commands).toEqual(cmds(0, 5));
    expect(watcher.applied.ended).toBe(true);
    expect(watcher.applied.outcome).toBeNull();
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true });

    // A frame the old publisher still answers (a resend) after the end changes nothing the watcher holds.
    host.publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 0 });
    await bus.settle();
    expect(watcher.applied.commands).toEqual(cmds(0, 5));
    expect(watcher.applied.header).toMatchObject({ initialState: { tag: "A" } });
  });

  it("when the new game does reuse the room, frames of the old game on its replaced socket are refused", async () => {
    const bus = await FaultBus.create();
    const hostA = bus.host(liveGame([], "A"));
    const watcher = bus.watcher();
    hostA.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) hostA.command(c);
    await bus.settle();
    expect(watcher.applied.commands).toEqual(cmds(0, 3));

    // Game A has two more commands in flight (held on its wire) when game B takes the room over with the host token.
    hostA.up.held = true;
    hostA.command(cmds(3, 4)[0]!);
    hostA.command(cmds(4, 5)[0]!);
    const late = [...hostA.up.queue];
    const oldSocket = hostA.socket!;
    const hostB = bus.host(liveGame([cmds(100, 101)[0]!], "B"));
    hostB.connect();
    await bus.settle();
    for (const c of cmds(101, 103)) hostB.command(c);
    await bus.settle();
    expect(watcher.applied.header).toMatchObject({ initialState: { tag: "B" } });
    expect(watcher.applied.commands).toEqual(cmds(100, 103));

    // The old frames reach the room after all (reordered past the takeover).
    for (const m of late) await bus.room.message(oldSocket, JSON.stringify(m));
    await bus.settle();
    // SENT: game A did send them. SAVED and APPLIED: neither the room nor the watcher took them.
    expect(late).toHaveLength(2);
    expect(bus.roomLog()).toBe(3);
    expect(watcher.applied.commands).toEqual(cmds(100, 103));
    savedPrefixOf(bus, cmds(100, 103));
  });
});

describe("a gap batch after the end with a failing tail write", () => {
  it("watchers still get the end after the batch; the next tail write saves the log", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) host.command(c);
    await bus.settle();

    let tailPuts = 0;
    bus.storage.failPut((k) => k === "t1:tail" && ++tailPuts === 2); // the end writes the first, the gap batch the second
    host.up.drop((m) => isCommands(m) && (m as { from: number }).from === 3);
    host.command(cmds(3, 4)[0]!);
    host.command(cmds(4, 5)[0]!, { result: "win" } as never);
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    // APPLIED: the batch cleared the watcher ended state, and the end followed it before the failed write.
    expect(watcher.applied.commands).toEqual(cmds(0, 5));
    expect(watcher.applied.ended).toBe(true);
    // SAVED: the failed write left the older tail; the host leaving writes the whole log.
    await host.disconnect();
    expect(bus.storage.savedLog("t1", true)).toEqual(cmds(0, 5));
  });
});

describe("the final ack is dropped", () => {
  it("the end is applied exactly once, and a watcher who reconnects after it sees the ended table", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) host.command(c);
    await bus.settle();

    // The game's last command carries the outcome; the first `end` is lost on the way to the room.
    host.up.drop(isEnd);
    host.command(cmds(3, 4)[0]!, { result: "win" } as never);
    await bus.settle();
    expect(host.sentKinds().filter((k) => k === "end")).toHaveLength(1);
    expect(bus.storage.map.get("meta")).not.toMatchObject({ ended: true });
    expect(watcher.applied.ended).toBe(false);

    // The link drops and returns: the welcome says the table is not ended, so the host sends `end` again.
    await host.disconnect();
    host.connect();
    await bus.settle();
    expect(host.sentKinds().filter((k) => k === "end")).toHaveLength(2);
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true });
    expect(watcher.applied.actions.end).toBe(1);
    expect(watcher.applied.ended).toBe(true);

    // Another reconnect, with the end already stored: nothing new is sent, and no second end is applied.
    const sentBefore = host.up.sent.length;
    await host.disconnect();
    host.connect();
    await bus.settle();
    expect(host.up.sent.slice(sentBefore).filter((m) => m.ch === "game")).toEqual([]);
    expect(watcher.applied.actions.end).toBe(1);

    // A watcher that arrives after the end, and one that reconnects, both see the ended table with every command.
    const late = bus.watcher();
    late.connect();
    await watcher.disconnect();
    watcher.connect();
    await bus.settle();
    for (const w of [late, watcher]) {
      expect(w.applied.commands).toEqual(cmds(0, 4));
      expect(w.applied.ended).toBe(true);
      expect(w.applied.outcome).toEqual({ result: "win" });
    }
    // And after the room is restarted from storage alone.
    expect(bus.storage.savedLog()).toEqual(cmds(0, 4));
    await bus.restartRoom();
    const afterWake = bus.watcher();
    afterWake.connect();
    await bus.settle();
    expect(afterWake.applied.commands).toEqual(cmds(0, 4));
    expect(afterWake.applied.ended).toBe(true);
  });
});

describe("duplicate and reordered delivery of log batches", () => {
  it("a duplicated batch is applied once; a reordered pair settles to the host's log", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();

    host.up.duplicate(isCommands);
    for (const c of cmds(0, 3)) host.command(c);
    await bus.settle();
    expect(bus.roomLog()).toBe(3);
    expect(watcher.applied.commands).toEqual(cmds(0, 3));
    savedPrefixOf(bus, cmds(0, 3));

    // Two batches overtake each other on the way to the room.
    host.up.held = true;
    host.command(cmds(3, 4)[0]!);
    host.command(cmds(4, 5)[0]!);
    host.up.reverse();
    host.up.held = false;
    await bus.settle();
    // The room refused the batch that came first and may not have asked again (it asks once per gap); the next
    // command shows the gap, and the room and the host agree again.
    host.command(cmds(5, 6)[0]!);
    await bus.settle();
    expect(bus.roomLog()).toBe(6);
    savedPrefixOf(bus, cmds(0, 6));
    expect(watcher.applied.commands).toEqual(cmds(0, 6));

    // The same pair reordered on the way to a watcher: it asks for a fresh log rather than apply a gap.
    watcher.down.held = true;
    host.command(cmds(6, 7)[0]!);
    host.command(cmds(7, 8)[0]!);
    await bus.settle();
    watcher.down.reverse();
    watcher.down.held = false;
    await bus.settle();
    expect(watcher.applied.commands).toEqual(cmds(0, 8));
  });

  it("a batch lost before the final command still leaves the room with the whole log once the host is heard again", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) host.command(c);
    await bus.settle();

    host.up.drop((m) => isCommands(m) && (m as { from: number }).from === 3);
    host.command(cmds(3, 4)[0]!);
    host.command(cmds(4, 5)[0]!, { result: "win" } as never);
    await bus.settle();
    expect(host.sentKinds().filter((k) => k === "end")).toHaveLength(1);
    expect(bus.roomLog()).toBe(5);
    expect(watcher.applied.commands).toEqual(cmds(0, 5));
    expect(watcher.applied.ended).toBe(true);
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true });
    // SAVED: the gap-filling batch was written too, so a wake serves all five, ended.
    expect(bus.storage.savedLog()).toEqual(cmds(0, 5));
    await bus.restartRoom();
    const afterWake = bus.watcher();
    afterWake.connect();
    await bus.settle();
    expect(afterWake.applied.commands).toEqual(cmds(0, 5));
    expect(afterWake.applied.ended).toBe(true);
  });
});

describe("accepted batches reach watchers even when the room's own writes fail", () => {
  it("a chunk write that fails on the last batch still reaches a connected watcher, and a reconnecting host sends nothing", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 19)) host.command(c);
    await bus.settle();

    // The 20th command, the game's last for now, fills chunk 0 and its write fails; nothing is played after it.
    bus.storage.failPut((k) => k.startsWith("t1:c:"));
    host.command(cmds(19, 20)[0]!);
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    // SAVED: the chunk is not stored. APPLIED: the watcher has it anyway (the room counted it, so the room sent it).
    expect(bus.storage.map.has("t1:c:000000")).toBe(false);
    expect(watcher.applied.commands).toEqual(cmds(0, 20));

    // The host reconnects: the welcome advertises 20 and the host has nothing to add. The watcher is not behind.
    const sentBefore = host.up.sent.length;
    await host.disconnect();
    host.connect();
    await bus.settle();
    expect(host.up.sent.slice(sentBefore).filter((m) => m.ch === "game")).toEqual([]);
    expect(watcher.applied.commands).toEqual(cmds(0, 20));
    // SAVED: the host leaving writes the tail, so a wake serves all twenty.
    await host.disconnect();
    expect(bus.storage.savedLog("t1", true)).toEqual(cmds(0, 20));
  });
});

describe("a full-log repair of an ended room", () => {
  it("reopens the table: the old outcome is not kept for a replacement log, and a new end replaces it", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) host.command(c);
    host.command(cmds(3, 4)[0]!, { result: "win" } as never);
    await bus.settle();
    expect(watcher.applied.outcome).toEqual({ result: "win" });

    // The host undoes the last command, but its rewind is lost; then the room asks for the whole log from zero.
    host.up.drop((m) => m.ch === "game" && m.kind === "rewind");
    host.publisher.rewind(3);
    await bus.settle();
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true });
    const endAlarm = bus.storage.alarm;
    host.publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 0 });
    await bus.settle();
    // The end grace alarm gave way to the idle one.
    expect(bus.storage.alarm).not.toBeNull();
    expect(bus.storage.alarm).toBeGreaterThan(endAlarm!);
    // SENT: a log with no outcome and no new end. SAVED: the room is open again. APPLIED: the watcher holds the
    // three commands with no outcome.
    expect(host.sentKinds().filter((k) => k === "end")).toHaveLength(1);
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: false, outcome: null });
    expect(watcher.applied.commands).toEqual(cmds(0, 3));
    expect(watcher.applied.ended).toBe(false);
    expect(watcher.applied.outcome).toBeNull();

    // The game ends differently: the new end is taken (an ended room would have ignored it).
    host.command(cmds(3, 4)[0]!, { result: "loss" } as never);
    await bus.settle();
    expect(watcher.applied.ended).toBe(true);
    expect(watcher.applied.outcome).toEqual({ result: "loss" });
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true, outcome: { result: "loss" } });
  });
});

describe("replacement log and rewind reach watchers when the room's writes fail", () => {
  it("a header write that fails on a replacement log of an ended room still replaces the watcher's log and outcome", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) host.command(c);
    host.command(cmds(3, 4)[0]!, { result: "win" } as never);
    await bus.settle();
    expect(watcher.applied.outcome).toEqual({ result: "win" });

    host.up.drop((m) => m.ch === "game" && m.kind === "rewind");
    host.publisher.rewind(3);
    await bus.settle();
    bus.storage.failPut((k) => k === "t1:header" || k.includes("header"));
    host.publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 0 });
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    // APPLIED: the watcher follows the room's memory (new log, no outcome); SENT: a reconnecting host adds nothing.
    expect(watcher.applied.commands).toEqual(cmds(0, 3));
    expect(watcher.applied.ended).toBe(false);
    const sentBefore = host.up.sent.length;
    await host.disconnect();
    host.connect();
    await bus.settle();
    expect(host.up.sent.slice(sentBefore).filter((m) => m.ch === "game")).toEqual([]);
    expect(watcher.applied.commands).toEqual(cmds(0, 3));
    expect(watcher.applied.ended).toBe(false);
  });

  it("a tail write that fails after a rewind still tells the watcher about the cut", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 5)) host.command(c);
    await bus.settle();
    expect(watcher.applied.commands).toEqual(cmds(0, 5));

    bus.storage.failPut((k) => k === "t1:tail");
    host.publisher.rewind(3);
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    expect(watcher.applied.commands).toEqual(cmds(0, 3));
    expect(bus.roomLog()).toBe(3);
  });
});

describe("a replacement header that failed to store stays dirty until it lands", () => {
  const replace = async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 5)) host.command(c);
    await bus.settle();
    // The host resumes a different header over the first three commands, then the room asks for the whole log from
    // zero; the header put of that replacement fails.
    host.publisher.replaceGame(liveGame(cmds(0, 3), "B"));
    await bus.settle();
    bus.storage.failPut((k) => k === "t1:header");
    host.publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 0 });
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    return { bus, host, watcher };
  };

  it("the host leaving stores it: a wake serves the new log to a fresh watcher", async () => {
    const { bus, host, watcher } = await replace();
    expect(watcher.applied.commands).toEqual(cmds(0, 3));
    // No further host moves: only the disconnect.
    await host.disconnect();
    await bus.restartRoom();
    const fresh = bus.watcher();
    fresh.connect();
    await bus.settle();
    expect(fresh.applied.commands).toEqual(cmds(0, 3));
    expect(fresh.applied.header).toMatchObject({ initialState: { tag: "B" } });
  });

  it("a reconnecting host repairs the header before the welcome says what the room holds", async () => {
    const { bus, host } = await replace();
    await host.disconnect();
    host.connect();
    await bus.settle();
    expect(bus.storage.map.get("t1:header")).toMatchObject({ h: { initialState: { tag: "B" } } });
    expect(bus.roomLog()).toBe(3);
  });
});

describe("a reopened table is stored whether or not the retained tail write lands", () => {
  it("a failed tail put during the rewind does not leave the old end grace alarm closing a resumed room", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) host.command(c);
    host.command(cmds(3, 4)[0]!, { result: "win" } as never);
    await bus.settle();
    const graceAlarm = bus.storage.alarm!;
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true });

    bus.storage.failPut((k) => k === "t1:tail");
    host.publisher.rewind(2);
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    // SAVED: the meta says reopened and the alarm is the idle one.
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: false, outcome: null });
    expect(bus.storage.alarm).toBeGreaterThan(graceAlarm);
    expect(watcher.applied.ended).toBe(false);
    // The old grace alarm firing now reschedules instead of closing.
    bus.clock.now = graceAlarm + 1;
    expect(await bus.room.alarm(bus.clock.now)).toBe("rescheduled");
    expect(watcher.applied.closed).toBeNull();
  });

  it("a failed meta write is retried on the next host message", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    host.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) host.command(c);
    host.command(cmds(3, 4)[0]!, { result: "win" } as never);
    await bus.settle();
    const graceAlarm = bus.storage.alarm!;

    bus.storage.failPut((k) => k === "meta");
    host.publisher.rewind(2);
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    expect(bus.storage.alarm).toBe(graceAlarm);
    // The next batch retries it before anything else.
    host.command(cmds(2, 3)[0]!);
    await bus.settle();
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: false });
    expect(bus.storage.alarm).toBeGreaterThan(graceAlarm);
  });
});

describe("a pending reopen never overwrites a newer end", () => {
  it("rewind, failed reopen write, then an end with no commands in between: the alarm and a wake still see it ended", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    for (const c of cmds(0, 3)) host.command(c);
    host.command(cmds(3, 4)[0]!, { result: "win" } as never);
    await bus.settle();

    // The rewind reopens in memory, but its meta write fails.
    bus.storage.failPut((k) => k === "meta");
    host.publisher.rewind(3);
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    // The game finishes again (a replacement log of a finished game): the end is the next frame, no commands between.
    host.up.push({ v: 1, ch: "game", kind: "end", table: "t1", outcome: { result: "loss" } } as ClientMessage);
    await bus.settle();
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true, outcome: { result: "loss" } });
    const graceAlarm = bus.storage.alarm!;

    // The alarm and a wake do not bring the old reopen back.
    bus.clock.now += 1000;
    await bus.room.alarm(bus.clock.now);
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true, outcome: { result: "loss" } });
    expect(bus.storage.alarm).toBe(graceAlarm);
    await bus.restartRoom();
    const fresh = bus.watcher();
    fresh.connect();
    await bus.settle();
    expect(fresh.applied.ended).toBe(true);
    expect(fresh.applied.outcome).toEqual({ result: "loss" });
  });
});

describe("an end whose final tail write fails", () => {
  it("is never stored as ended over a truncated log: a wake finds an open game and the host retry completes it", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    const watcher = bus.watcher();
    host.connect();
    watcher.connect();
    await bus.settle();
    // The first batch writes the tail; the next ones, within the minute, are held in memory only.
    host.command(cmds(0, 1)[0]!);
    await bus.settle();
    for (const c of cmds(1, 4)) host.command(c);
    await bus.settle();
    expect(bus.storage.savedLog()).toEqual(cmds(0, 1));

    bus.storage.failPut((k) => k === "t1:tail", 2); // the end's write and the host leaving's write both fail
    host.command(cmds(4, 5)[0]!, { result: "win" } as never);
    await bus.settle();
    expect(bus.roomErrors).toHaveLength(1);
    expect(watcher.applied.ended).toBe(true);
    // SAVED: not ended over the short log.
    expect(bus.storage.map.get("meta")).not.toMatchObject({ ended: true });

    // The room is woken cold with the host gone: an open game, never a finished one with 1 of 5 commands.
    await host.disconnect().catch(() => undefined);
    await bus.restartRoom();
    expect(bus.storage.map.get("meta")).not.toMatchObject({ ended: true });
    // The host comes back and completes it: all five commands and the outcome are stored.
    host.connect();
    await bus.settle();
    expect(bus.roomLog()).toBe(5);
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true, outcome: { result: "win" } });
    expect(bus.storage.savedLog("t1", true)).toEqual(cmds(0, 5));
    const fresh = bus.watcher();
    fresh.connect();
    await bus.settle();
    expect(fresh.applied.commands).toEqual(cmds(0, 5));
    expect(fresh.applied.outcome).toEqual({ result: "win" });
  });

  it("when the host leaving writes the tail, the end is stored with it: the wake serves all commands and the outcome", async () => {
    const bus = await FaultBus.create();
    const host = bus.host(liveGame());
    host.connect();
    await bus.settle();
    host.command(cmds(0, 1)[0]!);
    await bus.settle();
    for (const c of cmds(1, 4)) host.command(c);
    await bus.settle();
    bus.storage.failPut((k) => k === "t1:tail");
    host.command(cmds(4, 5)[0]!, { result: "win" } as never);
    await bus.settle();
    expect(bus.storage.map.get("meta")).not.toMatchObject({ ended: true });
    await host.disconnect();
    expect(bus.storage.map.get("meta")).toMatchObject({ ended: true, outcome: { result: "win" } });
    expect(bus.storage.savedLog("t1", true)).toEqual(cmds(0, 5));
    await bus.restartRoom();
    const fresh = bus.watcher();
    fresh.connect();
    await bus.settle();
    expect(fresh.applied.commands).toEqual(cmds(0, 5));
    expect(fresh.applied.ended).toBe(true);
  });
});
