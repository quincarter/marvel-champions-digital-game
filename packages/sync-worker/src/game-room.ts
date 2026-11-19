/**
 * The live game room's logic (docs/live-game-rooms.md), over a small socket interface so Vitest drives it without
 * workerd. The room orders and relays and never reads a game: headers, commands and outcomes are opaque.
 *
 * Storage. A hibernated room is evicted from memory after seconds of quiet, so the log is persisted in frozen chunks:
 * `meta` (host token hash, createdAt, a last-host stamp written at most hourly, and the end/outcome once), one
 * `<table>:header` row at `start`/`log`, and one `<table>:c:<n>` row per completed chunk of `ROOM_CHUNK_COMMANDS`
 * commands with the checksums that fall in it, written once when the chunk fills and never rewritten. The unfinished
 * tail of up to a chunk lives in memory, and is written to one `<table>:tail` row when the host disconnects (so a host
 * who closes the app mid-game leaves watchers the whole log), overwritten each time and dropped when a frozen chunk
 * supersedes it, a rewind cuts it or a `log` replaces the table; a woken room loads the chunks and asks the host for the tail with
 * `resend { from }`. About one row per 20 commands.
 *
 * A socket's participant lives in the socket's own attachment, so it survives hibernation; the logic keys everything
 * by participant id and takes the newest socket object it is handed for that id.
 */

import type { KeyValueStorage } from "./env.js";
import {
  DEFAULT_MAX_ROOM_LOG_BYTES,
  DEFAULT_MAX_ROOM_MESSAGE_BYTES,
  DEFAULT_MAX_ROOM_PARTICIPANTS,
  FIRST_TABLE,
  LOG_PART_BYTES,
  MAX_LOG_BYTES,
  MAX_ROOM_REFUSALS,
  ROOM_CHUNK_COMMANDS,
  ROOM_END_GRACE_MS,
  ROOM_IDLE_MS,
  parseClientMessage,
  type ClientMessage,
  type Participant,
  type RoomCapability,
  type ServerMessage,
  type TableChecksums,
  type TableInfo,
} from "./room-protocol.js";

/** A connection as the logic sees it; the Durable Object adapts a real WebSocket to this. */
export interface RoomSocket {
  send(text: string): void;
  close(code?: number, reason?: string): void;
  /** The participant saved on the socket by `setParticipant`, or null before its `hello` (or after `clearParticipant`). */
  getParticipant(): Participant | null;
  setParticipant(participant: Participant): void;
  /** Forgets the participant on the socket, so a wake does not bring a replaced host back. */
  clearParticipant(): void;
}

export interface GameRoomLimits {
  readonly maxParticipants: number;
  readonly maxMessageBytes: number;
  readonly maxLogBytes: number;
}

export const DEFAULT_GAME_ROOM_LIMITS: GameRoomLimits = {
  maxParticipants: DEFAULT_MAX_ROOM_PARTICIPANTS,
  maxMessageBytes: DEFAULT_MAX_ROOM_MESSAGE_BYTES,
  maxLogBytes: DEFAULT_MAX_ROOM_LOG_BYTES,
};

/** What the room advertises; `chat`, `seats` and `tables` join this list as they are built. */
export const ROOM_CAPS: readonly RoomCapability[] = ["watch"];

/** While the host streams, the tail row is refreshed when it was last written this long ago. */
const TAIL_REFRESH_MS = 60 * 1000;

/** The host's last-message stamp is stored at most this often. */
const STAMP_EVERY_MS = 60 * 60 * 1000;

interface RoomMeta {
  readonly hostTokenHash: string;
  readonly createdAt: number;
  lastHostAt?: number;
  ended?: boolean;
  outcome?: unknown;
  endedAt?: number;
  /** The table reached the log cap and was ended by the room. */
  overflow?: boolean;
}

interface StoredChunk {
  commands: unknown[];
  checksums: Record<string, string>;
  bytes: number;
}

interface Table {
  id: string;
  header: unknown;
  hasHeader: boolean;
  commands: unknown[];
  checksums: Record<string, string>;
  /** Chunks written to storage: commands `[0, persisted * ROOM_CHUNK_COMMANDS)` are stored, the rest is the tail. */
  persisted: number;
  /** JSON bytes of the commands held. */
  bytes: number;
  ended: boolean;
  outcome: unknown;
  overflow: boolean;
  loaded: boolean;
  /** A `<table>:tail` row exists in storage. */
  tailStored: boolean;
  /** When the tail row was last written (or this lifetime first saw the table), for the 60 s refresh while streaming. */
  tailAt: number | undefined;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const encoder = new TextEncoder();

const sizeOf = (value: unknown): number => JSON.stringify(value)?.length ?? 0;
const sizeOfAll = (values: readonly unknown[]): number => {
  let total = 0;
  for (const v of values) total += sizeOf(v);
  return total;
};

const newTable = (id: string): Table => ({
  id,
  header: undefined,
  hasHeader: false,
  commands: [],
  checksums: {},
  persisted: 0,
  bytes: 0,
  ended: false,
  outcome: null,
  overflow: false,
  loaded: false,
  tailStored: false,
  tailAt: undefined,
});

const randomId = (): string =>
  [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, "0")).join("");

const headerKey = (table: string) => `${table}:header`;
const chunkKey = (table: string, n: number) => `${table}:c:${String(n).padStart(6, "0")}`;
const tailKey = (table: string) => `${table}:tail`;

/** The checksums of a message as a plain record, or null when a key is not a command count or a value not a string. */
function cleanChecksums(value: unknown): Record<string, string> | null {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, sum] of Object.entries(value)) {
    if (!/^\d{1,9}$/.test(key) || typeof sum !== "string" || sum.length > 128) return null;
    out[key] = sum;
  }
  return out;
}

type Refusal = "bad-message" | "too-large" | "not-allowed" | "out-of-order" | "full";

export class GameRoomLogic {
  private meta: RoomMeta | null | undefined;
  private readonly sockets = new Map<string, RoomSocket>();
  private readonly participants = new Map<string, Participant>();
  private readonly tables = new Map<string, Table>([[FIRST_TABLE, newTable(FIRST_TABLE)]]);
  private readonly loading = new Map<string, Promise<void>>();
  /** Tables whose host has been asked for a log that has not come yet, so one gap is asked once. */
  private readonly resendAsked = new Set<string>();
  /** True until the host's `start`, `log` or an in-order batch confirms the room's tail in this lifetime. */
  private unverified = true;
  private lastHostMessageAt: number | undefined;
  private readonly refusals = new WeakMap<RoomSocket, number>();

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly limits: GameRoomLimits = DEFAULT_GAME_ROOM_LIMITS,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  // ----------------------------------------------------------------------------------------------------------
  // Lifecycle and storage

  private async loadMeta(): Promise<RoomMeta | null> {
    if (this.meta === undefined) this.meta = (await this.storage.get<RoomMeta>("meta")) ?? null;
    return this.meta;
  }

  private async saveMeta(patch: Partial<RoomMeta>): Promise<void> {
    if (!this.meta) return;
    this.meta = { ...this.meta, ...patch };
    await this.storage.put("meta", this.meta);
  }

  async exists(): Promise<boolean> {
    return (await this.loadMeta()) !== null;
  }

  /** Makes the room: false when it already exists (the caller draws another id). One row, plus the idle alarm. */
  async create(hostTokenHash: string, now: number): Promise<boolean> {
    if (await this.loadMeta()) return false;
    const meta: RoomMeta = { hostTokenHash, createdAt: now };
    await this.storage.put("meta", meta);
    this.meta = meta;
    this.lastHostMessageAt = now;
    await this.storage.setAlarm(now + ROOM_IDLE_MS);
    return true;
  }

  /** Re-registers a socket that outlived the object's memory (hibernation) from its saved participant. */
  restore(socket: RoomSocket): void {
    const participant = socket.getParticipant();
    if (!participant) return;
    this.sockets.set(participant.id, socket);
    this.participants.set(participant.id, participant);
  }

  /** Loads a table's header and stored chunks once per lifetime. */
  private ensureLoaded(table: Table): Promise<void> {
    if (table.loaded) return Promise.resolve();
    let pending = this.loading.get(table.id);
    if (!pending) {
      pending = this.load(table).finally(() => this.loading.delete(table.id));
      this.loading.set(table.id, pending);
    }
    return pending;
  }

  private async load(table: Table): Promise<void> {
    const meta = await this.loadMeta();
    const header = await this.storage.get<{ h: unknown }>(headerKey(table.id));
    if (header) {
      const rows = await this.storage.list<StoredChunk>({ prefix: `${table.id}:c:` });
      const commands: unknown[] = [];
      const checksums: Record<string, string> = {};
      let bytes = 0;
      let persisted = 0;
      for (const chunk of rows.values()) {
        commands.push(...chunk.commands);
        Object.assign(checksums, chunk.checksums);
        bytes += chunk.bytes;
        persisted += 1;
      }
      table.header = header.h;
      table.hasHeader = true;
      table.commands = commands;
      table.checksums = checksums;
      table.bytes = bytes;
      table.persisted = persisted;
      const tail = await this.storage.get<{ commands: unknown[]; checksums: Record<string, string>; at?: number }>(
        tailKey(table.id),
      );
      table.tailAt = tail?.at ?? this.clock();
      if (tail) {
        table.commands = [...table.commands, ...tail.commands];
        table.checksums = { ...table.checksums, ...tail.checksums };
        table.bytes += sizeOfAll(tail.commands);
        table.tailStored = true;
      }
    }
    table.ended = meta?.ended ?? false;
    table.outcome = meta?.outcome ?? null;
    table.overflow = meta?.overflow ?? false;
    table.loaded = true;
  }

  private async deleteChunks(tableId: string, from: number, to: number): Promise<void> {
    const keys: string[] = [];
    for (let n = from; n < to; n++) keys.push(chunkKey(tableId, n));
    for (let i = 0; i < keys.length; i += 128) await this.storage.delete(keys.slice(i, i + 128));
  }

  /** Deletes the stored tail row, if there is one. */
  private async dropTail(table: Table): Promise<void> {
    if (!table.tailStored) return;
    table.tailStored = false;
    await this.storage.delete(tailKey(table.id));
  }

  /** Writes the unfinished tail (commands past the last frozen chunk, with their checksums), overwriting the last. */
  private async writeTail(table: Table): Promise<void> {
    const first = table.persisted * ROOM_CHUNK_COMMANDS;
    if (!table.loaded || !table.hasHeader) return;
    if (table.commands.length <= first) return this.dropTail(table);
    await this.storage.put(tailKey(table.id), {
      commands: table.commands.slice(first),
      checksums: this.checksumsIn(table, first, table.commands.length),
      at: this.clock(),
    });
    table.tailStored = true;
    table.tailAt = this.clock();
  }

  /** Writes every chunk that has filled since the last write, each once. */
  private async persistChunks(table: Table): Promise<void> {
    let entries: Record<string, StoredChunk> = {};
    let count = 0;
    while (table.commands.length >= (table.persisted + 1) * ROOM_CHUNK_COMMANDS) {
      const n = table.persisted;
      const first = n * ROOM_CHUNK_COMMANDS;
      const commands = table.commands.slice(first, first + ROOM_CHUNK_COMMANDS);
      const checksums: Record<string, string> = {};
      for (const [key, sum] of Object.entries(table.checksums)) {
        const at = Number(key);
        if (at > first && at <= first + ROOM_CHUNK_COMMANDS) checksums[key] = sum;
      }
      entries[chunkKey(table.id, n)] = { commands, checksums, bytes: sizeOfAll(commands) };
      table.persisted += 1;
      count += 1;
      if (count === 100) {
        await this.storage.put(entries);
        entries = {};
        count = 0;
      }
    }
    if (count > 0) {
      await this.storage.put(entries);
      await this.dropTail(table);
    }
  }

  private tableOf(id: string): Table | undefined {
    return this.tables.get(id);
  }

  private hostOf(tableId: string): Participant | undefined {
    for (const p of this.participants.values()) if (p.role === "host" && p.table === tableId) return p;
    return undefined;
  }

  private info(table: Table): TableInfo {
    return {
      id: table.id,
      hostConnected: this.hostOf(table.id) !== undefined,
      commands: table.commands.length,
      ended: table.ended,
      hasHeader: table.hasHeader,
    };
  }

  private rosterList(): Participant[] {
    return [...this.participants.values()];
  }

  // ----------------------------------------------------------------------------------------------------------
  // Sending

  private sendTo(id: string, message: ServerMessage): void {
    const socket = this.sockets.get(id);
    if (socket) this.sendSocket(socket, message);
  }

  private sendSocket(socket: RoomSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // A socket that cannot take a message is closing; its close event removes it.
    }
  }

  private broadcast(message: ServerMessage, except?: string): void {
    const text = JSON.stringify(message);
    for (const [id, socket] of this.sockets) {
      if (id === except) continue;
      try {
        socket.send(text);
      } catch {
        // As above.
      }
    }
  }

  private broadcastRoster(): void {
    const participants = this.rosterList();
    this.broadcast({
      v: 1,
      ch: "room",
      kind: "roster",
      participants,
      watchers: participants.filter((p) => p.role === "watcher").length,
    });
  }

  private broadcastTable(table: Table): void {
    this.broadcast({ v: 1, ch: "room", kind: "table", table: this.info(table) });
  }

  private checksumsIn(table: Table, after: number, upTo: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, sum] of Object.entries(table.checksums)) {
      const at = Number(key);
      if (at > after && at <= upTo) out[key] = sum;
    }
    return out;
  }

  /**
   * The table's log to one socket in parts: a `log` with the header and the first commands up to about
   * `LOG_PART_BYTES`, `commands` batches for the rest, then `end` if the table ended. No part nears the WebSocket cap.
   */
  private sendLog(socket: RoomSocket, table: Table): void {
    const commands = table.commands;
    let used = sizeOf(table.header);
    let index = 0;
    let first = true;
    do {
      const from = index;
      const part: unknown[] = [];
      while (index < commands.length) {
        const size = sizeOf(commands[index]);
        if (part.length > 0 && used + size > LOG_PART_BYTES) break;
        part.push(commands[index]);
        used += size;
        index += 1;
      }
      const checksums = this.checksumsIn(table, from, index);
      if (first) {
        this.sendSocket(socket, {
          v: 1,
          ch: "game",
          kind: "log",
          table: table.id,
          header: table.header,
          commands: part,
          checksums,
        });
        first = false;
      } else {
        this.sendSocket(socket, {
          v: 1,
          ch: "game",
          kind: "commands",
          table: table.id,
          from,
          commands: part,
          ...(Object.keys(checksums).length > 0 ? { checksums } : {}),
        });
      }
      used = 0;
    } while (index < commands.length);
    if (table.ended)
      this.sendSocket(socket, { v: 1, ch: "game", kind: "end", table: table.id, outcome: table.outcome });
  }

  /** The log to everyone but the table's host. */
  private broadcastLog(table: Table, hostId: string): void {
    for (const [id, socket] of this.sockets) if (id !== hostId) this.sendLog(socket, table);
  }

  /** Asks the table's host for what the room lacks from `from`, once per gap. */
  private askResend(tableId: string, from: number): void {
    const host = this.hostOf(tableId);
    if (!host || this.resendAsked.has(tableId)) return;
    this.resendAsked.add(tableId);
    this.sendTo(host.id, { v: 1, ch: "game", kind: "resend", table: tableId, from });
  }

  // ----------------------------------------------------------------------------------------------------------
  // Incoming

  /** One text frame from a socket. Never throws on a bad frame; it answers `refused`. */
  async message(socket: RoomSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== "string") return this.refuse(socket, "bad-message");
    const participant = socket.getParticipant();
    const bytes = encoder.encode(data).byteLength;
    if (bytes > MAX_LOG_BYTES) return this.refuse(socket, "too-large");
    // Only a host may send a start or log, so everyone else is held to the ordinary cap before anything is parsed.
    if (participant?.role !== "host" && bytes > this.limits.maxMessageBytes) return this.refuse(socket, "too-large");
    const message = parseClientMessage(data);
    if (!message) return this.refuse(socket, "bad-message");

    if (message.ch === "room") return this.hello(socket, message);
    if (!participant) return this.refuse(socket, "bad-message");
    if (!this.participants.has(participant.id)) {
      // An attachment the room does not know (a replaced host's socket still closing): not part of this room.
      this.refuse(socket, "not-allowed");
      socket.close(1008, "not in the room");
      return;
    }
    this.sockets.set(participant.id, socket);

    if (message.ch === "chat" || message.kind === "propose") return this.refuse(socket, "not-allowed");
    const table = this.tableOf(message.table);
    if (participant.role !== "host" || participant.table !== message.table || !table) {
      return this.refuse(socket, "not-allowed");
    }
    const isLog = message.kind === "start" || message.kind === "log";
    if (bytes > this.limits.maxMessageBytes && !isLog) return this.refuse(socket, "too-large");
    await this.ensureLoaded(table);
    await this.touchHost();
    await this.game(socket, participant, table, message);
  }

  private refuse(socket: RoomSocket, reason: Refusal): void {
    this.sendSocket(socket, { v: 1, ch: "room", kind: "refused", reason });
    if (reason === "out-of-order") return;
    const count = (this.refusals.get(socket) ?? 0) + 1;
    this.refusals.set(socket, count);
    if (count >= MAX_ROOM_REFUSALS) {
      try {
        socket.close(1008, "too many refusals");
      } catch {
        // Already gone.
      }
    }
  }

  /** Notes a host message; the stamp is stored at most once an hour, so a command writes nothing. */
  private async touchHost(): Promise<void> {
    const now = this.clock();
    this.lastHostMessageAt = now;
    const meta = this.meta;
    if (meta && now - (meta.lastHostAt ?? meta.createdAt) >= STAMP_EVERY_MS) await this.saveMeta({ lastHostAt: now });
  }

  private async hello(socket: RoomSocket, message: Extract<ClientMessage, { kind: "hello" }>): Promise<void> {
    if (socket.getParticipant()) return this.refuse(socket, "bad-message");
    const meta = await this.loadMeta();
    if (!meta) return socket.close(1011, "no such room");
    const isHost = message.token !== undefined && (await sha256Hex(message.token)) === meta.hostTokenHash;
    const table = this.tables.get(FIRST_TABLE)!;
    await this.ensureLoaded(table);

    // A valid host token is always let in, whatever the room holds, and takes the old host socket's place.
    if (isHost) {
      const old = this.hostOf(FIRST_TABLE);
      if (old) {
        const oldSocket = this.sockets.get(old.id);
        this.participants.delete(old.id);
        this.sockets.delete(old.id);
        try {
          oldSocket?.clearParticipant();
          oldSocket?.close(4000, "replaced");
        } catch {
          // Already gone.
        }
        await this.writeTail(table);
      }
    } else if (this.participants.size >= this.limits.maxParticipants) {
      this.refuse(socket, "full");
      socket.close(1013, "full");
      return;
    }

    // `hello.name` is ignored until chat exists.
    const you: Participant = {
      id: randomId(),
      role: isHost ? "host" : "watcher",
      ...(isHost ? { table: FIRST_TABLE } : {}),
    };
    socket.setParticipant(you);
    this.sockets.set(you.id, socket);
    this.participants.set(you.id, you);

    this.sendSocket(socket, {
      v: 1,
      ch: "room",
      kind: "welcome",
      you,
      caps: ROOM_CAPS,
      participants: this.rosterList(),
      tables: [...this.tables.values()].map((t) => this.info(t)),
    });
    this.broadcastRoster();
    if (isHost) {
      await this.touchHost();
      this.resendAsked.delete(FIRST_TABLE);
      this.broadcastTable(table);
    } else if (table.hasHeader) {
      this.sendLog(socket, table);
    }
    // The room's tail (or the whole log) is unconfirmed since it woke or was made: the host sends what it lacks.
    if (this.unverified) this.askResend(FIRST_TABLE, table.hasHeader ? table.commands.length : 0);
  }

  private async game(
    socket: RoomSocket,
    host: Participant,
    table: Table,
    message: Exclude<ClientMessage, { ch: "room" } | { ch: "chat" } | { kind: "propose" }>,
  ): Promise<void> {
    switch (message.kind) {
      case "start": {
        if (table.ended) return this.refuse(socket, "not-allowed");
        await this.dropTail(table);
        await this.deleteChunks(table.id, 0, table.persisted);
        await this.storage.put(headerKey(table.id), { h: message.header });
        Object.assign(table, newTable(table.id), { header: message.header, hasHeader: true, loaded: true });
        this.unverified = false;
        this.resendAsked.delete(table.id);
        this.broadcastLog(table, host.id);
        this.broadcastTable(table);
        return;
      }
      case "log": {
        const checksums = cleanChecksums(message.checksums);
        if (!checksums) return this.refuse(socket, "bad-message");
        if (table.overflow) return this.refuse(socket, "too-large");
        const bytes = sizeOfAll(message.commands);
        if (bytes > this.limits.maxLogBytes) {
          this.refuse(socket, "too-large");
          await this.endTable(table, null, true);
          return;
        }
        await this.dropTail(table);
        await this.deleteChunks(table.id, 0, table.persisted);
        table.header = message.header;
        table.hasHeader = true;
        table.commands = [...message.commands];
        table.checksums = { ...checksums };
        table.persisted = 0;
        table.bytes = bytes;
        await this.storage.put(headerKey(table.id), { h: message.header });
        await this.persistChunks(table);
        this.unverified = false;
        this.resendAsked.delete(table.id);
        this.broadcastLog(table, host.id);
        this.broadcastTable(table);
        return;
      }
      case "commands": {
        const checksums = cleanChecksums(message.checksums);
        if (!checksums) return this.refuse(socket, "bad-message");
        if (table.overflow) return this.refuse(socket, "too-large");
        if (!table.hasHeader || message.from !== table.commands.length) {
          this.refuse(socket, "out-of-order");
          this.askResend(table.id, table.hasHeader ? table.commands.length : 0);
          return;
        }
        const added = sizeOfAll(message.commands);
        if (table.bytes + added > this.limits.maxLogBytes) {
          this.refuse(socket, "too-large");
          await this.endTable(table, null, true);
          return;
        }
        table.commands.push(...message.commands);
        table.checksums = { ...table.checksums, ...checksums };
        table.bytes += added;
        await this.persistChunks(table);
        // A host that closes the app may never return to write the tail: refresh it while it streams, at most once a
        // minute, so an evicted room still has the commands past the last chunk.
        table.tailAt ??= this.clock();
        if (this.clock() - table.tailAt >= TAIL_REFRESH_MS) await this.writeTail(table);
        this.unverified = false;
        this.resendAsked.delete(table.id);
        this.broadcast(
          {
            v: 1,
            ch: "game",
            kind: "commands",
            table: table.id,
            from: message.from,
            commands: message.commands,
            ...(Object.keys(checksums).length > 0 ? { checksums } : {}),
          },
          host.id,
        );
        this.broadcastTable(table);
        return;
      }
      case "rewind": {
        if (!table.hasHeader || message.to > table.commands.length) return this.refuse(socket, "out-of-order");
        const cut = message.to < table.commands.length;
        const keep = Math.floor(message.to / ROOM_CHUNK_COMMANDS);
        if (cut) await this.dropTail(table);
        if (keep < table.persisted) {
          await this.deleteChunks(table.id, keep, table.persisted);
          table.persisted = keep;
        }
        table.commands.length = message.to;
        for (const key of Object.keys(table.checksums)) if (Number(key) > message.to) delete table.checksums[key];
        table.bytes = sizeOfAll(table.commands);
        // An Undo past the end reopens the game: the end alarm is cancelled and the idle one re-armed.
        if (cut && table.ended) await this.reopen(table);
        this.broadcast({ v: 1, ch: "game", kind: "rewind", table: table.id, to: message.to }, host.id);
        this.broadcastTable(table);
        return;
      }
      case "end": {
        await this.endTable(table, message.outcome ?? null, false);
        return;
      }
    }
  }

  private async reopen(table: Table): Promise<void> {
    table.ended = false;
    table.outcome = null;
    table.overflow = false;
    if (this.meta) {
      const { endedAt: _endedAt, ...rest } = this.meta;
      this.meta = { ...rest, ended: false, outcome: null, overflow: false };
      await this.storage.put("meta", this.meta);
      const last = Math.max(this.lastHostMessageAt ?? 0, this.meta.lastHostAt ?? this.meta.createdAt);
      await this.storage.setAlarm(last + ROOM_IDLE_MS);
    }
  }

  /** Ends a table once: a second `end` writes and changes nothing. */
  private async endTable(table: Table, outcome: unknown, overflow: boolean): Promise<void> {
    if (table.ended) return;
    table.ended = true;
    table.outcome = outcome;
    if (overflow) table.overflow = true;
    this.broadcast({ v: 1, ch: "game", kind: "end", table: table.id, outcome });
    this.broadcastTable(table);
    const now = this.clock();
    // The game is over and the host may never come back: store the tail with the end.
    await this.writeTail(table);
    await this.saveMeta({ ended: true, outcome, endedAt: now, ...(overflow ? { overflow: true } : {}) });
    if ([...this.tables.values()].every((t) => t.ended)) await this.storage.setAlarm(now + ROOM_END_GRACE_MS);
  }

  // ----------------------------------------------------------------------------------------------------------
  // Leaving and closing

  /** A socket closed or errored. A host replaced by a newer one is already gone and changes nothing. */
  async close(socket: RoomSocket): Promise<void> {
    const participant = socket.getParticipant();
    if (!participant || !this.participants.has(participant.id)) return;
    this.participants.delete(participant.id);
    this.sockets.delete(participant.id);
    this.broadcastRoster();
    if (participant.role === "host" && participant.table) {
      const table = this.tableOf(participant.table);
      this.resendAsked.delete(participant.table);
      if (table) {
        this.broadcastTable(table);
        await this.writeTail(table);
      }
    }
  }

  /**
   * The alarm: the room closes 12 hours after the last host message (the stored hourly stamp, or the newer one in
   * memory), or 5 minutes after every table ended. When the time has not come the alarm moves out, one row.
   */
  async alarm(now: number): Promise<"closed" | "rescheduled" | "gone"> {
    const meta = await this.loadMeta();
    if (!meta) return "gone";
    if (meta.ended && meta.endedAt !== undefined) {
      const closeAt = meta.endedAt + ROOM_END_GRACE_MS;
      if (now >= closeAt) {
        await this.shutdown("ended");
        return "closed";
      }
      await this.storage.setAlarm(closeAt);
      return "rescheduled";
    }
    const last = Math.max(this.lastHostMessageAt ?? 0, meta.lastHostAt ?? meta.createdAt);
    const due = last + ROOM_IDLE_MS;
    if (now >= due) {
      await this.shutdown("idle");
      return "closed";
    }
    await this.storage.setAlarm(due);
    return "rescheduled";
  }

  /** Closes the room for good: tells everyone, closes the sockets, and forgets the room so its id is a 404 again. */
  async shutdown(reason: "ended" | "idle" | "disabled"): Promise<void> {
    this.broadcast({ v: 1, ch: "room", kind: "closed", reason });
    for (const socket of this.sockets.values()) {
      try {
        socket.close(1000, reason);
      } catch {
        // Already gone.
      }
    }
    this.sockets.clear();
    this.participants.clear();
    await this.storage.deleteAlarm();
    await this.storage.deleteAll();
    this.meta = null;
  }

  // Test and handler views.
  get participantCount(): number {
    return this.participants.size;
  }

  logLength(tableId: string = FIRST_TABLE): number {
    return this.tables.get(tableId)?.commands.length ?? 0;
  }

  checksums(tableId: string = FIRST_TABLE): TableChecksums {
    return this.tables.get(tableId)?.checksums ?? {};
  }
}
