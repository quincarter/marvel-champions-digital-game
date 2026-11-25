/**
 * A deterministic fault-injection harness for the live game room: the real `GameRoomLogic` (in memory, over a storage
 * that can fail or defer a write), the host's `LivePublisher` and any number of watchers' `WatchFeed`, wired through
 * pipes that can drop, duplicate, hold and reorder messages per direction, with a side that can disconnect and
 * reconnect and a room that can be restarted (a hibernation: memory gone, storage and sockets kept). No network, no
 * Durable Object runtime, no timers: a test calls `settle()` to deliver what is queued.
 *
 * The room is imported through the `@mc/sync-worker/game-room` export, which exists only for this harness.
 *
 * Each scenario asserts three different things, which the harness keeps apart: what was SENT (`up.sent`, per pipe),
 * what was durably SAVED (`storage.map`, `savedLog()`), and what a watcher APPLIED (`Watcher.applied`).
 */
import { GameRoomLogic, sha256Hex, type RoomSocket } from "@mc/sync-worker/game-room";
import type { ClientMessage, Participant, ServerMessage } from "@mc/sync-worker/room-protocol";
import type { Command } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "../../engine/host.js";
import { LivePublisher, type LiveGame, type RoomTableState } from "../live-publisher.js";
import { WatchFeed } from "../watch-feed.js";

export const HOST_TOKEN = "H".repeat(32);
export const cmd = (n: number): Command => ({ type: "test", n }) as unknown as Command;
export const cmds = (from: number, to: number): Command[] => Array.from({ length: to - from }, (_, i) => cmd(from + i));

export const liveGame = (commands: Command[] = [], tag = "A", outcome: LiveGame["outcome"] = null): LiveGame => ({
  writer: { appVersion: "1.0.0", contentVersion: "c1" },
  config: { scenarioId: tag, seed: 1, players: [] } as unknown as SessionConfig,
  createdAt: 5,
  initialState: { round: 1, tag } as unknown as StateWithoutPool,
  commands,
  outcome,
  // The engine takes a checksum on every command here (the real cadence is sparser): a welcome then proves the log.
  checksums: { ...Object.fromEntries(commands.map((_, i) => [String(i + 1), `s${i + 1}`])), "0": "s0" },
});

type Rule<M> = { match: (m: M) => boolean; action: "drop" | "duplicate"; left: number };

/** One direction of the wire. Messages queue until `pump`; rules act as they are pushed. */
export class Pipe<M> {
  /** Everything handed to the pipe, in order, before faults. */
  readonly sent: M[] = [];
  /** What came out the far end (after drops, duplicates, reordering). */
  readonly delivered: M[] = [];
  queue: M[] = [];
  held = false;
  private readonly rules: Rule<M>[] = [];

  /** Drops the next `times` messages matching `match`. */
  drop(match: (m: M) => boolean, times = 1): void {
    this.rules.push({ match, action: "drop", left: times });
  }
  /** Delivers the next `times` messages matching `match` twice in a row. */
  duplicate(match: (m: M) => boolean, times = 1): void {
    this.rules.push({ match, action: "duplicate", left: times });
  }
  /** Reverses what is queued (call while held). */
  reverse(): void {
    this.queue.reverse();
  }
  /** Loses what is in flight (a connection died). */
  lose(): void {
    this.queue = [];
  }

  push(message: M): void {
    this.sent.push(message);
    const rule = this.rules.find((r) => r.left > 0 && r.match(message));
    if (rule) {
      rule.left -= 1;
      if (rule.action === "drop") return;
      this.queue.push(message, message);
      return;
    }
    this.queue.push(message);
  }

  async pump(deliver: (message: M) => Promise<void> | void): Promise<boolean> {
    let moved = false;
    while (!this.held && this.queue.length > 0) {
      const message = this.queue.shift() as M;
      this.delivered.push(message);
      moved = true;
      await deliver(message);
    }
    return moved;
  }
}

type KeyRule = { match: (key: string) => boolean; left: number };

/** A storage over a Map whose writes can fail, or be held and then applied or lost (a crash before they landed). */
export class FaultStorage {
  readonly map = new Map<string, unknown>();
  alarm: number | null = null;
  /** The keys of every write that landed, in order. */
  readonly writes: string[] = [];
  private readonly failRules: KeyRule[] = [];
  private readonly deferRules: KeyRule[] = [];
  private readonly deleteFailRules: KeyRule[] = [];
  private pending: (() => void)[] = [];
  private parked: (() => void)[] = [];

  /** The next `times` puts of a key matching `match` reject, writing nothing. */
  failPut(match: (key: string) => boolean, times = 1): void {
    this.failRules.push({ match, left: times });
  }
  /** The next `times` puts of a matching key wait (their caller too) until `releaseDeferred` or `loseDeferred`. */
  deferPut(match: (key: string) => boolean, times = 1): void {
    this.deferRules.push({ match, left: times });
  }
  /** The next `times` deletes touching a matching key reject, deleting nothing. */
  failDelete(match: (key: string) => boolean, times = 1): void {
    this.deleteFailRules.push({ match, left: times });
  }
  /** Resolves once a deferred put is parked (the room is waiting on its storage). */
  whenParked(): Promise<void> {
    return this.pending.length > 0 ? Promise.resolve() : new Promise<void>((resolve) => this.parked.push(resolve));
  }
  releaseDeferred(): void {
    for (const apply of this.pending.splice(0)) apply();
  }
  /** A crash: the held writes never land and their callers never hear back. */
  loseDeferred(): void {
    this.pending = [];
  }

  private take(rules: KeyRule[], keys: string[]): boolean {
    const rule = rules.find((r) => r.left > 0 && keys.some(r.match));
    if (!rule) return false;
    rule.left -= 1;
    return true;
  }

  get<T>(key: string): Promise<T | undefined>;
  get<T>(keys: string[]): Promise<Map<string, T>>;
  async get<T>(key: string | string[]): Promise<T | undefined | Map<string, T>> {
    if (typeof key !== "string") {
      const found = new Map<string, T>();
      for (const k of key) if (this.map.has(k)) found.set(k, structuredClone(this.map.get(k)) as T);
      return found;
    }
    return structuredClone(this.map.get(key)) as T | undefined;
  }
  put(key: string, value: unknown): Promise<void>;
  put(entries: Record<string, unknown>): Promise<void>;
  async put(key: string | Record<string, unknown>, value?: unknown): Promise<void> {
    const entries = typeof key === "string" ? { [key]: value } : key;
    const keys = Object.keys(entries);
    if (this.take(this.failRules, keys)) throw new Error(`storage put failed: ${keys.join(",")}`);
    const apply = () => {
      for (const [k, v] of Object.entries(entries)) {
        this.map.set(k, structuredClone(v));
        this.writes.push(k);
      }
    };
    if (this.take(this.deferRules, keys)) {
      await new Promise<void>((resolve) => {
        this.pending.push(() => {
          apply();
          resolve();
        });
        for (const wake of this.parked.splice(0)) wake();
      });
      return;
    }
    apply();
  }
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  async delete(key: string | string[]): Promise<boolean | number> {
    if (this.take(this.deleteFailRules, typeof key === "string" ? [key] : key))
      throw new Error("storage delete failed");
    if (typeof key !== "string") {
      let n = 0;
      for (const k of key) if (this.map.delete(k)) n += 1;
      return n;
    }
    return this.map.delete(key);
  }
  async list<T>(options: { prefix?: string; start?: string; limit?: number }): Promise<Map<string, T>> {
    const keys = [...this.map.keys()]
      .filter((k) => k.startsWith(options.prefix ?? "") && (options.start === undefined || k >= options.start))
      .sort();
    return new Map(keys.slice(0, options.limit).map((k) => [k, structuredClone(this.map.get(k)) as T]));
  }
  async deleteAll(): Promise<void> {
    this.map.clear();
  }
  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }
  async setAlarm(at: number): Promise<void> {
    this.alarm = at;
  }
  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }

  /**
   * The command log the room would serve after a restart, read the way it loads: the frozen chunks in key order, then
   * the tail (a hole ends the chunks, and a tail overlap with them is skipped).
   */
  savedLog(table = "t1", strict = false): unknown[] {
    const log: unknown[] = [];
    // The rows live in the slot of the stored header's storage generation (even: the `b` keys).
    const sg = (this.map.get(`${table}:header`) as { sg?: number } | undefined)?.sg;
    const slot = sg !== undefined && sg % 2 === 0 ? "b:" : "";
    // As the room loads: chunks while they run gapless from 0, then the tail minus what the chunks already hold.
    const chunks = [...this.map.keys()].filter((k) => k.startsWith(`${table}:${slot}c:`)).sort();
    let n = 0;
    for (const key of chunks) {
      if (!key.endsWith(String(n).padStart(6, "0"))) {
        if (strict) throw new Error(`stored chunk ${n} is missing (chunks: ${chunks.join(",")})`);
        break;
      }
      log.push(...(this.map.get(key) as { commands: unknown[] }).commands);
      n += 1;
    }
    const tail = this.map.get(`${table}:${slot}tail`) as { commands: unknown[]; from?: number } | undefined;
    const from = tail?.from ?? n * 20;
    if (strict && tail && from !== log.length)
      throw new Error(`tail starts at ${from} but the chunks hold ${log.length}`);
    if (tail && from <= log.length) log.push(...tail.commands.slice(log.length - from));
    return log;
  }
}

class WireSocket implements RoomSocket {
  attachment: Participant | null = null;
  dead = false;
  constructor(private readonly down: Pipe<ServerMessage>) {}
  send(text: string): void {
    if (!this.dead) this.down.push(JSON.parse(text) as ServerMessage);
  }
  close(): void {
    this.dead = true;
  }
  getParticipant(): Participant | null {
    return this.attachment;
  }
  setParticipant(p: Participant): void {
    this.attachment = p;
  }
  clearParticipant(): void {
    this.attachment = null;
  }
}

/** A side of the wire: its own pair of pipes and the socket the room sees, replaced on each reconnect. */
abstract class Endpoint {
  readonly up = new Pipe<ClientMessage>();
  readonly down = new Pipe<ServerMessage>();
  socket: WireSocket | null = null;
  constructor(protected readonly bus: FaultBus) {}

  get connected(): boolean {
    return this.socket !== null && !this.socket.dead;
  }
  protected abstract token(): string | undefined;
  protected abstract onServer(message: ServerMessage): void;
  protected abstract onLinkChanged(connected: boolean): void;

  /** Opens a fresh socket and says `hello`. Pipes keep their history (`sent`); what was in flight is gone. */
  connect(): void {
    if (this.connected) return;
    this.up.lose();
    this.down.lose();
    this.socket = new WireSocket(this.down);
    const token = this.token();
    this.up.push({ v: 1, ch: "room", kind: "hello", caps: ["watch"], ...(token ? { token } : {}) } as ClientMessage);
    this.bus.attach(this);
  }

  /** The link drops: messages in flight both ways are lost, and the room learns the socket closed. */
  async disconnect(): Promise<void> {
    const socket = this.socket;
    if (!socket || socket.dead) return;
    socket.dead = true;
    this.up.lose();
    this.down.lose();
    this.onLinkChanged(false);
    await this.bus.room.close(socket);
  }

  async pump(): Promise<boolean> {
    const socket = this.socket;
    if (!socket) return false;
    // A message the room reads is judged on the socket that sent it; a dead socket's leftovers never arrive.
    const moved = await this.up.pump(async (m) => {
      if (socket.dead) return;
      try {
        await this.bus.room.message(socket, JSON.stringify(m));
      } catch (error) {
        // A failed storage write: the room throws and the host hears nothing (as on the real socket).
        this.bus.roomErrors.push(String((error as Error).message));
      }
    });
    const back = await this.down.pump((m) => this.onServer(m));
    return moved || back;
  }
}

export class HostSide extends Endpoint {
  readonly resyncs: number[] = [];
  gaveUp = false;
  /** The welcome handed to the publisher carries the table's admission id, as the controller's does. Off by default. */
  reportGid = false;
  publisher!: LivePublisher;

  constructor(bus: FaultBus, game: LiveGame) {
    super(bus);
    this.publish(game);
  }

  /** A new publisher for a game (a restart of the app resumes with the game's log). */
  publish(game: LiveGame): void {
    this.publisher = new LivePublisher({
      game,
      watchBase: "https://web.example/",
      send: (m) => {
        if (!this.connected) return false;
        this.up.push(m);
        return true;
      },
      onStatus: () => undefined,
      onResync: () => this.resyncs.push(this.publisher.commandCount),
      onGiveUp: () => {
        this.gaveUp = true;
      },
    });
    this.publisher.roomOpened(this.bus.roomId);
  }

  protected token(): string {
    return HOST_TOKEN;
  }
  protected onLinkChanged(connected: boolean): void {
    if (!connected) this.publisher.onDisconnected();
  }
  protected onServer(message: ServerMessage): void {
    if (message.ch === "room" && message.kind === "welcome") {
      const t = message.tables.find((x) => x.id === "t1");
      const state: RoomTableState | undefined = t
        ? {
            commands: t.commands,
            ended: t.ended,
            hasHeader: t.hasHeader,
            checkpoint: t.checkpoint ?? null,
            ...(this.reportGid && t.gid !== undefined ? { gid: t.gid } : {}),
            ...(t.adjusted ? { adjusted: true } : {}),
          }
        : undefined;
      this.publisher.onWelcome(state);
    } else {
      this.publisher.onMessage(message);
    }
  }

  /** The engine applied one more command. */
  command(c: Command, outcome?: LiveGame["outcome"]): void {
    const count = this.publisher.commandCount + 1;
    this.publisher.command(c, count, `s${count}`, outcome);
  }
  /** What the publisher put on the socket (not counting `hello`), by kind. */
  sentKinds(): string[] {
    return this.up.sent.filter((m) => m.ch === "game").map((m) => (m as { kind: string }).kind);
  }
}

/** A watcher's replay as the controller would build it from the feed's actions, kept bare so a test can compare it. */
export interface Applied {
  opened: boolean;
  header: unknown;
  commands: unknown[];
  /** Mirrors the feed ended flag as the controller would apply it (an `end` sets it, a batch or rewind clears it). */
  ended: boolean;
  outcome: unknown;
  closed: string | null;
  /** How many times each kind of action was applied. */
  actions: Record<string, number>;
}

export class Watcher extends Endpoint {
  readonly feed = new WatchFeed();
  applied: Applied = {
    opened: false,
    header: null,
    commands: [],
    ended: false,
    outcome: null,
    closed: null,
    actions: {},
  };
  /** The feed asked for a resync: like the controller, the watcher reconnects for a fresh `log`. */
  autoResync = true;
  private wantsResync = false;

  protected token(): undefined {
    return undefined;
  }
  protected onLinkChanged(connected: boolean): void {
    if (!connected) this.feed.onDisconnected();
  }
  protected onServer(message: ServerMessage): void {
    for (const action of this.feed.onMessage(message)) {
      const a = this.applied;
      a.actions[action.kind] = (a.actions[action.kind] ?? 0) + 1;
      switch (action.kind) {
        case "open":
        case "reset":
          a.opened = true;
          a.header = action.header;
          a.commands = [...action.commands];
          a.ended = action.outcome != null;
          a.outcome = action.outcome ?? null;
          break;
        case "append":
          a.commands.push(...action.commands);
          a.ended = false;
          break;
        case "rewind":
          a.commands.length = action.to;
          a.ended = false;
          a.outcome = null;
          break;
        case "end":
          a.ended = true;
          a.outcome = action.outcome ?? null;
          break;
        case "closed":
          a.closed = action.reason;
          break;
        case "resync":
          this.wantsResync = true;
          break;
        default:
          break;
      }
    }
  }
  /** Runs the controller's answer to a resync request, once the wire is quiet. */
  async answerResync(): Promise<boolean> {
    if (!this.wantsResync || !this.autoResync) return false;
    this.wantsResync = false;
    await this.disconnect();
    this.connect();
    return true;
  }
}

export class FaultBus {
  readonly storage = new FaultStorage();
  readonly roomId = "room-1";
  room!: GameRoomLogic;
  readonly clock = { now: 1_000 };
  /** What the room threw while handling a frame (a storage write that failed). */
  readonly roomErrors: string[] = [];
  private readonly endpoints = new Set<Endpoint>();

  static async create(): Promise<FaultBus> {
    const bus = new FaultBus();
    await bus.restartRoom(true);
    return bus;
  }

  /** The room object is rebuilt over the same storage: memory gone, sockets still attached (hibernation). */
  async restartRoom(first = false): Promise<void> {
    this.room = new GameRoomLogic(this.storage, undefined, () => this.clock.now);
    if (first) await this.room.create(await sha256Hex(HOST_TOKEN), this.clock.now);
    for (const e of this.endpoints) if (e.socket && !e.socket.dead) this.room.restore(e.socket);
  }

  attach(endpoint: Endpoint): void {
    this.endpoints.add(endpoint);
  }

  host(game: LiveGame): HostSide {
    return new HostSide(this, game);
  }
  watcher(): Watcher {
    return new Watcher(this);
  }

  /** Delivers everything queued, in both directions on every side, until nothing moves. Held pipes stay held. */
  async settle(): Promise<void> {
    for (let i = 0; i < 200; i++) {
      let moved = false;
      for (const e of this.endpoints) {
        if (await e.pump()) moved = true;
        if (e instanceof Watcher && (await e.answerResync())) moved = true;
      }
      if (!moved) return;
    }
    throw new Error("the wire did not go quiet");
  }

  /** How many commands the room holds in memory for the table. */
  roomLog(): number {
    return this.room.logLength();
  }
}
