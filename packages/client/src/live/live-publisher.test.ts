import { describe, expect, it } from "vitest";
import type { ClientMessage } from "@mc/sync-worker/room-protocol";
import type { Command } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { liveGameOf } from "./live-game.js";
import { LivePublisher, headerOf, watchLinkOf, type LiveGame, type LiveStatus } from "./live-publisher.js";

const cmd = (n: number): Command => ({ type: "test", n }) as unknown as Command;

const config = {
  scenarioId: "rhino",
  seed: 1,
  players: [{ deckId: "d", deckName: "My secret name" }],
  packs: [{ id: "mod", version: "1.0.0", cards: [] }],
} as unknown as SessionConfig;

const game = (commands: Command[] = []): LiveGame =>
  liveGameOf({
    writer: { appVersion: "1.0.0", contentVersion: "c1" },
    config,
    createdAt: 5,
    initialState: { round: 1 } as unknown as StateWithoutPool,
    commands,
    outcome: null,
  });

function setup(opts: { commands?: Command[]; up?: boolean } = {}) {
  const sent: ClientMessage[] = [];
  const statuses: LiveStatus[] = [];
  let up = opts.up ?? true;
  const publisher = new LivePublisher({
    game: game(opts.commands),
    watchBase: "https://web.example/",
    send: (m) => {
      if (!up) return false;
      sent.push(m);
      return true;
    },
    onStatus: (s) => statuses.push(s),
  });
  publisher.roomOpened("abcdefghijkl");
  return {
    publisher,
    sent,
    statuses,
    kinds: () => sent.map((m) => m.kind),
    setUp: (v: boolean) => {
      up = v;
    },
  };
}

describe("live game header", () => {
  it("is a replay header: config without packs data and deck names, packs by reference", () => {
    const header = headerOf(game());
    expect(header.config).not.toHaveProperty("packs");
    expect(JSON.stringify(header.config)).not.toContain("My secret name");
    expect(header.packs).toEqual([{ id: "mod", version: "1.0.0" }]);
    expect(header).toMatchObject({ format: "mc-live", createdAt: 5, writer: { appVersion: "1.0.0" } });
  });
});

describe("live publisher", () => {
  it("sends start then each command in order as it is applied", () => {
    const { publisher, sent } = withWelcome();
    publisher.command(cmd(1), 1);
    publisher.command(cmd(2), 2);
    expect(sent.map((m) => m.kind)).toEqual(["start", "commands", "commands"]);
    expect(sent[1]).toMatchObject({ table: "t1", from: 0, commands: [cmd(1)] });
    expect(sent[2]).toMatchObject({ from: 1, commands: [cmd(2)] });
  });

  it("coalesces what piles up while disconnected into one batch", () => {
    const { publisher, sent } = setup({ up: true });
    publisher.command(cmd(1), 1);
    publisher.command(cmd(2), 2);
    publisher.command(cmd(3), 3);
    expect(sent).toEqual([]);
    publisher.onWelcome(undefined);
    expect(sent.map((m) => m.kind)).toEqual(["start", "commands"]);
    expect(sent[1]).toMatchObject({ from: 0, commands: [cmd(1), cmd(2), cmd(3)] });
  });

  it("after a reconnect sends only what the room lacks", () => {
    const { publisher, sent } = withWelcome();
    publisher.command(cmd(1), 1);
    publisher.onDisconnected();
    publisher.command(cmd(2), 2);
    publisher.command(cmd(3), 3);
    sent.length = 0;
    publisher.onWelcome({ commands: 1, ended: false });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "commands", from: 1, commands: [cmd(2), cmd(3)] });
  });

  it("answers resend with the whole log, header and checksums", () => {
    const { publisher, sent } = withWelcome();
    for (let i = 1; i <= 10; i++) publisher.command(cmd(i), i, i === 10 ? "sum10" : undefined);
    sent.length = 0;
    publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1" });
    expect(sent).toHaveLength(1);
    const log = sent[0] as Extract<ClientMessage, { kind: "log" }>;
    expect(log.kind).toBe("log");
    expect(log.commands).toHaveLength(10);
    expect(log.checksums).toEqual({ "10": "sum10" });
    expect(log.header).toMatchObject({ format: "mc-live" });
  });

  it("attaches checksums to the batch that contains their positions", () => {
    const { publisher, sent } = withWelcome();
    publisher.command(cmd(1), 1, "c1");
    expect(sent.at(-1)).toMatchObject({ kind: "commands", checksums: { "1": "c1" } });
    publisher.command(cmd(2), 2);
    expect(sent.at(-1)).not.toHaveProperty("checksums");
  });

  it("sends a rewind when the sent log is cut, and drops the cut checksums", () => {
    const { publisher, sent } = withWelcome();
    for (let i = 1; i <= 3; i++) publisher.command(cmd(i), i, `c${i}`);
    sent.length = 0;
    publisher.rewind(1);
    expect(sent).toEqual([{ v: 1, ch: "game", kind: "rewind", table: "t1", to: 1 }]);
    publisher.command(cmd(9), 2);
    expect(sent.at(-1)).toMatchObject({ kind: "commands", from: 1, commands: [cmd(9)] });
    publisher.onMessage({ v: 1, ch: "game", kind: "resend", table: "t1" });
    expect(sent.at(-1)).toMatchObject({ kind: "log", checksums: {} });
  });

  it("rewinds the room after a reconnect when the cut happened offline", () => {
    const { publisher, sent } = withWelcome();
    for (let i = 1; i <= 3; i++) publisher.command(cmd(i), i);
    publisher.onDisconnected();
    publisher.rewind(1);
    sent.length = 0;
    publisher.onWelcome({ commands: 3, ended: false });
    expect(sent).toEqual([{ v: 1, ch: "game", kind: "rewind", table: "t1", to: 1 }]);
  });

  it("sends end after the command that ended the game, once", () => {
    const { publisher, sent } = withWelcome();
    publisher.command(cmd(1), 1, "final", { result: "win" } as never);
    expect(sent.map((m) => m.kind)).toEqual(["start", "commands", "end"]);
    publisher.onDisconnected();
    publisher.onWelcome({ commands: 1, ended: true });
    expect(sent.map((m) => m.kind)).toEqual(["start", "commands", "end"]);
  });

  it("ignores a command that does not continue the log", () => {
    const { publisher, sent } = withWelcome();
    publisher.command(cmd(5), 5);
    expect(sent.map((m) => m.kind)).toEqual(["start"]);
    expect(publisher.commandCount).toBe(0);
  });

  it("starts a resumed game with its existing commands", () => {
    const { publisher, sent } = setup({ commands: [cmd(1), cmd(2)] });
    publisher.onWelcome(undefined);
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
    publisher.onWelcome(undefined);
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

function withWelcome() {
  const s = setup();
  s.publisher.onWelcome(undefined);
  return s;
}
