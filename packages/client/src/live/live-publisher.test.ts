import { describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@mc/sync-worker/room-protocol";
import type { Command } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { liveGameOf } from "./live-game.js";
import {
  BATCH_BYTES,
  LivePublisher,
  headerOf,
  watchLinkOf,
  type LiveGame,
  type LiveStatus,
  type RoomTableState,
} from "./live-publisher.js";

const cmd = (n: number, pad = 0): Command => ({ type: "test", n, pad: "x".repeat(pad) }) as unknown as Command;

const config = {
  scenarioId: "rhino",
  seed: 1,
  watchable: true,
  players: [{ deckId: "d", deckName: "My secret name" }],
  packs: [{ id: "mod", version: "1.0.0", cards: [] }],
} as unknown as SessionConfig;

const game = (commands: Command[] = [], checksums?: Record<string, string>): LiveGame =>
  liveGameOf({
    writer: { appVersion: "1.0.0", contentVersion: "c1" },
    config,
    createdAt: 5,
    initialState: { round: 1 } as unknown as StateWithoutPool,
    commands,
    outcome: null,
    ...(checksums ? { checksums } : {}),
  });

const room = (commands: number, extra: Partial<RoomTableState> = {}): RoomTableState => ({
  commands,
  ended: false,
  hasHeader: true,
  ...extra,
});

function setup(opts: { commands?: Command[]; checksums?: Record<string, string> } = {}) {
  const sent: ClientMessage[] = [];
  const statuses: LiveStatus[] = [];
  const onResync = vi.fn();
  const onGiveUp = vi.fn();
  const publisher = new LivePublisher({
    game: game(opts.commands, opts.checksums),
    watchBase: "https://web.example/",
    send: (m) => {
      sent.push(m);
      return true;
    },
    onStatus: (s) => statuses.push(s),
    onResync,
    onGiveUp,
  });
  publisher.roomOpened("abcdefghijkl");
  return { publisher, sent, statuses, onResync, onGiveUp, kinds: () => sent.map((m) => m.kind) };
}

/** A publisher welcomed by a brand-new room (no header yet). */
function fresh() {
  const s = setup();
  s.publisher.onWelcome({ commands: 0, ended: false, hasHeader: false });
  return s;
}

describe("live game header", () => {
  it("is a replay header: config without packs data, deck names and the watchable flag, packs by reference", () => {
    const header = headerOf(game());
    expect(header.config).not.toHaveProperty("packs");
    expect(header.config).not.toHaveProperty("watchable");
    expect(JSON.stringify(header.config)).not.toContain("My secret name");
    expect(header.packs).toEqual([{ id: "mod", version: "1.0.0" }]);
    expect(header).toMatchObject({ format: "mc-live", createdAt: 5, writer: { appVersion: "1.0.0" } });
  });
});

describe("live publisher", () => {
  it("sends start (the room has no header) then each command in order", () => {
    const { publisher, sent } = fresh();
    publisher.command(cmd(1), 1);
    publisher.command(cmd(2), 2);
    expect(sent.map((m) => m.kind)).toEqual(["start", "commands", "commands"]);
    expect(sent[1]).toMatchObject({ table: "t1", from: 0, commands: [cmd(1)] });
    expect(sent[2]).toMatchObject({ from: 1, commands: [cmd(2)] });
  });

  it("does not send start when the room already holds the header", () => {
    const { publisher, sent } = setup();
    publisher.onWelcome(room(0));
    publisher.command(cmd(1), 1);
    expect(sent.map((m) => m.kind)).toEqual(["commands"]);
  });

  it("coalesces what piles up while disconnected into one batch", () => {
    const { publisher, sent } = setup();
    publisher.command(cmd(1), 1);
    publisher.command(cmd(2), 2);
    publisher.command(cmd(3), 3);
    expect(sent).toEqual([]);
    publisher.onWelcome({ commands: 0, ended: false, hasHeader: false });
    expect(sent.map((m) => m.kind)).toEqual(["start", "commands"]);
    expect(sent[1]).toMatchObject({ from: 0, commands: [cmd(1), cmd(2), cmd(3)] });
  });

  it("splits a pile-up into batches under the message cap", () => {
    const { publisher, sent } = setup();
    for (let i = 1; i <= 10; i++) publisher.command(cmd(i, 12_000), i);
    publisher.onWelcome(room(0));
    const batches = sent.filter((m) => m.kind === "commands");
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) expect(JSON.stringify(batch).length).toBeLessThan(BATCH_BYTES + 2_000);
    let next = 0;
    for (const batch of batches) {
      const b = batch as Extract<ClientMessage, { kind: "commands" }>;
      expect(b.from).toBe(next);
      next += b.commands.length;
    }
    expect(next).toBe(10);
  });

  it("after a reconnect sends only what the room lacks", () => {
    const { publisher, sent } = fresh();
    publisher.command(cmd(1), 1);
    publisher.onDisconnected();
    publisher.command(cmd(2), 2);
    publisher.command(cmd(3), 3);
    sent.length = 0;
    publisher.onWelcome(room(1));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "commands", from: 1, commands: [cmd(2), cmd(3)] });
  });

  it("answers resend from 0 with a log of header and commands, checksums included", () => {
    const { publisher, sent } = fresh();
    for (let i = 1; i <= 10; i++) publisher.command(cmd(i), i, i === 10 ? "sum10" : undefined);
    sent.length = 0;
    publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 0 });
    const log = sent[0] as Extract<ClientMessage, { kind: "log" }>;
    expect(log.kind).toBe("log");
    expect(log.commands).toHaveLength(10);
    expect(log.checksums).toEqual({ "10": "sum10" });
    expect(log.header).toMatchObject({ format: "mc-live" });
  });

  it("answers resend from n with the batches from n only", () => {
    const { publisher, sent } = fresh();
    for (let i = 1; i <= 4; i++) publisher.command(cmd(i), i);
    sent.length = 0;
    publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 2 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "commands", from: 2, commands: [cmd(3), cmd(4)] });
  });

  it("ignores the brand-new room's resend that follows the welcome it already answered", () => {
    const { publisher, sent } = fresh();
    sent.length = 0;
    publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 0 });
    expect(sent).toEqual([]);
  });

  it("sends end again after a resend of an ended game, and a log's prefix stays under the cap", () => {
    const { publisher, sent } = fresh();
    for (let i = 1; i <= 40; i++)
      publisher.command(cmd(i, 40_000), i, undefined, i === 40 ? ({ result: "win" } as never) : undefined);
    sent.length = 0;
    publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 0 });
    const kinds = sent.map((m) => m.kind);
    expect(kinds[0]).toBe("log");
    expect(kinds.at(-1)).toBe("end");
    expect(kinds.filter((k) => k === "log")).toHaveLength(1);
    const covered =
      (sent[0] as Extract<ClientMessage, { kind: "log" }>).commands.length +
      sent
        .filter((m) => m.kind === "commands")
        .reduce((n, m) => n + (m as Extract<ClientMessage, { kind: "commands" }>).commands.length, 0);
    expect(covered).toBe(40);
  });

  it("sends the starting state's checksum with the first batch", () => {
    const { publisher, sent } = setup({ checksums: { "0": "s0" } });
    publisher.onWelcome(room(0));
    publisher.command(cmd(1), 1, "c1");
    expect(sent[0]).toMatchObject({ kind: "commands", from: 0, checksums: { "0": "s0", "1": "c1" } });
    publisher.command(cmd(2), 2);
    expect(sent.at(-1)).not.toHaveProperty("checksums");
  });

  it("sends a rewind when the sent log is cut, and drops the cut checksums", () => {
    const { publisher, sent } = fresh();
    for (let i = 1; i <= 3; i++) publisher.command(cmd(i), i, `c${i}`);
    sent.length = 0;
    publisher.rewind(1);
    expect(sent).toEqual([{ v: 1, ch: "game", kind: "rewind", table: "t1", to: 1 }]);
    publisher.command(cmd(9), 2);
    expect(sent.at(-1)).toMatchObject({ kind: "commands", from: 1, commands: [cmd(9)] });
    publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 0 });
    expect(sent.at(-1)).toMatchObject({ kind: "log", checksums: { "1": "c1" } });
  });

  it("a cut made offline, then new commands, rewinds the room to the low-water mark on welcome", () => {
    const { publisher, sent } = fresh();
    for (let i = 1; i <= 5; i++) publisher.command(cmd(i), i);
    publisher.onDisconnected();
    publisher.rewind(2);
    publisher.command(cmd(10), 3);
    publisher.command(cmd(11), 4);
    publisher.command(cmd(12), 5);
    publisher.command(cmd(13), 6);
    sent.length = 0;
    publisher.onWelcome(room(5));
    expect(sent.map((m) => m.kind)).toEqual(["rewind", "commands"]);
    expect(sent[0]).toMatchObject({ to: 2 });
    expect(sent[1]).toMatchObject({ from: 2, commands: [cmd(10), cmd(11), cmd(12), cmd(13)] });
  });

  it("an offline cut the room never saw needs no rewind", () => {
    const { publisher, sent } = fresh();
    for (let i = 1; i <= 3; i++) publisher.command(cmd(i), i);
    publisher.onDisconnected();
    publisher.rewind(1);
    sent.length = 0;
    publisher.onWelcome(room(1));
    expect(sent).toEqual([]);
  });

  it("sends end after the command that ended the game, once", () => {
    const { publisher, sent } = fresh();
    publisher.command(cmd(1), 1, "final", { result: "win" } as never);
    expect(sent.map((m) => m.kind)).toEqual(["start", "commands", "end"]);
    publisher.onDisconnected();
    publisher.onWelcome(room(1, { ended: true }));
    expect(sent.map((m) => m.kind)).toEqual(["start", "commands", "end"]);
  });

  it("a rewind of an ended table cuts the room, which un-ends it", () => {
    const { publisher, sent } = fresh();
    publisher.command(cmd(1), 1, "f", { result: "loss" } as never);
    publisher.command(cmd(2), 2);
    sent.length = 0;
    publisher.rewind(1);
    expect(sent).toEqual([{ v: 1, ch: "game", kind: "rewind", table: "t1", to: 1 }]);
  });

  it("asks for a resync on a gap and ignores the command", () => {
    const { publisher, sent, onResync } = fresh();
    publisher.command(cmd(5), 5);
    expect(onResync).toHaveBeenCalledTimes(1);
    expect(sent.map((m) => m.kind)).toEqual(["start"]);
    expect(publisher.commandCount).toBe(0);
  });

  it("replaceGame reconciles: cuts the room back to where the logs part, then extends", () => {
    const { publisher, sent } = fresh();
    for (let i = 1; i <= 4; i++) publisher.command(cmd(i), i);
    sent.length = 0;
    publisher.replaceGame(game([cmd(1), cmd(2), cmd(7), cmd(8), cmd(9)]));
    expect(sent.map((m) => m.kind)).toEqual(["rewind", "commands"]);
    expect(sent[0]).toMatchObject({ to: 2 });
    expect(sent[1]).toMatchObject({ from: 2, commands: [cmd(7), cmd(8), cmd(9)] });
  });

  it("replaceGame with a pure extension just sends the new commands", () => {
    const { publisher, sent } = fresh();
    publisher.command(cmd(1), 1);
    sent.length = 0;
    publisher.replaceGame(game([cmd(1), cmd(2)]));
    expect(sent.map((m) => m.kind)).toEqual(["commands"]);
    expect(sent[0]).toMatchObject({ from: 1 });
  });

  it("stops after the room refuses too-large, and answers no resend", () => {
    const { publisher, sent, onGiveUp } = fresh();
    publisher.onMessage({ v: 1, ch: "room", kind: "refused", reason: "too-large" });
    expect(onGiveUp).toHaveBeenCalled();
    sent.length = 0;
    publisher.command(cmd(1), 1);
    publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1", from: 0 });
    expect(sent).toEqual([]);
  });

  it("abandon sends an end with no outcome, once, only while connected", () => {
    const { publisher, sent } = fresh();
    publisher.abandon();
    expect(sent.at(-1)).toMatchObject({ kind: "end", outcome: null });
    const other = setup();
    other.publisher.abandon();
    expect(other.sent).toEqual([]);
  });

  it("starts a resumed game with its existing commands", () => {
    const { publisher, sent } = setup({ commands: [cmd(1), cmd(2)] });
    publisher.onWelcome({ commands: 0, ended: false, hasHeader: false });
    publisher.command(cmd(3), 3);
    expect(sent[1]).toMatchObject({ kind: "commands", from: 0, commands: [cmd(1), cmd(2)] });
    expect(sent[2]).toMatchObject({ kind: "commands", from: 2, commands: [cmd(3)] });
  });

  it("reports the watch url, watcher count and connection on change only", () => {
    const { publisher, statuses } = setup();
    expect(statuses.at(-1)).toEqual({
      watchUrl: "https://web.example/#watch=abcdefghijkl",
      watchers: 0,
      connected: false,
    });
    publisher.onWelcome(room(0));
    publisher.onMessage({ v: 1, ch: "room", kind: "roster", participants: [], watchers: 2 });
    publisher.onMessage({ v: 1, ch: "room", kind: "roster", participants: [], watchers: 2 });
    publisher.onDisconnected();
    expect(statuses.map((s) => [s.watchers, s.connected])).toEqual([
      [0, false],
      [0, true],
      [2, true],
      [2, false],
    ]);
  });

  it("builds watch links", () => {
    expect(watchLinkOf("abc", "https://marvel.example/")).toBe("https://marvel.example/#watch=abc");
  });
});
