/**
 * The live game room's logic (docs/live-game-rooms.md), over a small socket interface so Vitest drives it without
 * workerd. The room orders and relays and never reads a game: headers, commands and outcomes are opaque. It keeps each
 * table's log in memory only (a woken room with an empty log asks the table's host to send it again), so a command
 * writes no storage row. Storage holds one `meta` row from creation (the host token's hash and when the room was made),
 * and one `endedAt` row once every table has ended.
 *
 * A socket's participant lives in the socket's own attachment, so it survives hibernation; the logic keys everything
 * by participant id and takes the newest socket object it is handed for that id.
 */

import type { KeyValueStorage } from "./env.js";
import {
  DEFAULT_MAX_ROOM_MESSAGE_BYTES,
  DEFAULT_MAX_ROOM_PARTICIPANTS,
  FIRST_TABLE,
  MAX_LOG_BYTES,
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
  /** The participant saved on the socket by `setParticipant`, or null before its `hello`. */
  getParticipant(): Participant | null;
  setParticipant(participant: Participant): void;
}

export interface GameRoomLimits {
  readonly maxParticipants: number;
  readonly maxMessageBytes: number;
}

export const DEFAULT_GAME_ROOM_LIMITS: GameRoomLimits = {
  maxParticipants: DEFAULT_MAX_ROOM_PARTICIPANTS,
  maxMessageBytes: DEFAULT_MAX_ROOM_MESSAGE_BYTES,
};

/** What the room advertises; `chat`, `seats` and `tables` join this list as they are built. */
export const ROOM_CAPS: readonly RoomCapability[] = ["watch"];

interface RoomMeta {
  readonly hostTokenHash: string;
  readonly createdAt: number;
}

interface Table {
  id: string;
  header: unknown;
  hasHeader: boolean;
  commands: unknown[];
  checksums: Record<string, string>;
  outcome: unknown;
  ended: boolean;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const encoder = new TextEncoder();

const newTable = (id: string): Table => ({
  id,
  header: undefined,
  hasHeader: false,
  commands: [],
  checksums: {},
  outcome: undefined,
  ended: false,
});

const randomId = (): string =>
  [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(16).padStart(2, "0")).join("");

export class GameRoomLogic {
  private meta: RoomMeta | null | undefined;
  private endedAt: number | null | undefined;
  private readonly sockets = new Map<string, RoomSocket>();
  private readonly participants = new Map<string, Participant>();
  private readonly tables = new Map<string, Table>([[FIRST_TABLE, newTable(FIRST_TABLE)]]);
  /** Tables whose host has been asked for a log that has not come yet, so one gap is asked once. */
  private readonly resendAsked = new Set<string>();
  private lastHostMessageAt: number | undefined;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly limits: GameRoomLimits = DEFAULT_GAME_ROOM_LIMITS,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  // ----------------------------------------------------------------------------------------------------------
  // Lifecycle

  private async loadMeta(): Promise<RoomMeta | null> {
    if (this.meta === undefined) this.meta = (await this.storage.get<RoomMeta>("meta")) ?? null;
    return this.meta;
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
    };
  }

  private rosterList(): Participant[] {
    return [...this.participants.values()];
  }

  // ----------------------------------------------------------------------------------------------------------
  // Sending

  private sendTo(id: string, message: ServerMessage): void {
    try {
      this.sockets.get(id)?.send(JSON.stringify(message));
    } catch {
      // A socket that cannot take a message is closing; its close event removes it.
    }
  }

  private sendSocket(socket: RoomSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // As above.
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

  private logMessage(table: Table): ServerMessage {
    return {
      v: 1,
      ch: "game",
      kind: "log",
      table: table.id,
      header: table.header,
      commands: table.commands,
      checksums: table.checksums,
      ...(table.ended ? { outcome: table.outcome } : {}),
    };
  }

  /** Asks the table's host for the whole log, once per gap. */
  private askResend(tableId: string): void {
    const host = this.hostOf(tableId);
    if (!host || this.resendAsked.has(tableId)) return;
    this.resendAsked.add(tableId);
    this.sendTo(host.id, { v: 1, ch: "game", kind: "resend", table: tableId });
  }

  // ----------------------------------------------------------------------------------------------------------
  // Incoming

  /** One text frame from a socket. Never throws on a bad frame; it answers `refused`. */
  async message(socket: RoomSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== "string") return this.refuse(socket, "bad-message");
    const bytes = encoder.encode(data).byteLength;
    if (bytes > MAX_LOG_BYTES) return this.refuse(socket, "too-large");
    const message = parseClientMessage(data);
    if (!message) return this.refuse(socket, "bad-message");
    const isLog = message.ch === "game" && (message.kind === "start" || message.kind === "log");
    if (bytes > this.limits.maxMessageBytes && !isLog) return this.refuse(socket, "too-large");

    if (message.ch === "room") return this.hello(socket, message);
    const participant = socket.getParticipant();
    if (!participant) return this.refuse(socket, "bad-message");
    if (!this.participants.has(participant.id)) this.restore(socket);
    else this.sockets.set(participant.id, socket);

    if (message.ch === "chat" || message.kind === "propose") return this.refuse(socket, "not-allowed");
    const table = this.tableOf(message.table);
    if (participant.role !== "host" || participant.table !== message.table || !table) {
      return this.refuse(socket, "not-allowed");
    }
    this.lastHostMessageAt = this.clock();
    await this.game(socket, participant, table, message);
  }

  private refuse(
    socket: RoomSocket,
    reason: "bad-message" | "too-large" | "not-allowed" | "out-of-order" | "full",
  ): void {
    this.sendSocket(socket, { v: 1, ch: "room", kind: "refused", reason });
  }

  private async hello(socket: RoomSocket, message: Extract<ClientMessage, { kind: "hello" }>): Promise<void> {
    if (message.ch !== "room" || message.kind !== "hello" || socket.getParticipant()) {
      return this.refuse(socket, "bad-message");
    }
    const meta = await this.loadMeta();
    if (!meta) return socket.close(1011, "no such room");
    const isHost = message.token !== undefined && (await sha256Hex(message.token)) === meta.hostTokenHash;

    // A host reconnecting takes its place back: the old host socket is dropped first, so a full room still lets it in.
    if (isHost) {
      const old = this.hostOf(FIRST_TABLE);
      if (old) {
        const oldSocket = this.sockets.get(old.id);
        this.participants.delete(old.id);
        this.sockets.delete(old.id);
        try {
          oldSocket?.close(4000, "replaced");
        } catch {
          // Already gone.
        }
      }
    }
    if (this.participants.size >= this.limits.maxParticipants) {
      this.refuse(socket, "full");
      socket.close(1013, "full");
      return;
    }

    const you: Participant = {
      id: randomId(),
      role: isHost ? "host" : "watcher",
      ...(isHost ? { table: FIRST_TABLE } : {}),
      ...(message.name ? { name: message.name } : {}),
    };
    socket.setParticipant(you);
    this.sockets.set(you.id, socket);
    this.participants.set(you.id, you);
    if (isHost) {
      this.lastHostMessageAt = this.clock();
      this.resendAsked.delete(FIRST_TABLE);
    }

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
    const table = this.tables.get(FIRST_TABLE)!;
    if (isHost) this.broadcastTable(table);
    if (table.hasHeader) {
      if (!isHost) this.sendSocket(socket, this.logMessage(table));
    } else if (isHost || this.hostOf(FIRST_TABLE)) {
      // The room has no log (it woke empty, or is new): the host sends it again, or starts.
      this.askResend(FIRST_TABLE);
    }
  }

  private async game(
    socket: RoomSocket,
    host: Participant,
    table: Table,
    message: Exclude<ClientMessage, { ch: "room" } | { ch: "chat" } | { kind: "propose" }>,
  ): Promise<void> {
    switch (message.kind) {
      case "start": {
        Object.assign(table, newTable(table.id), { header: message.header, hasHeader: true });
        this.resendAsked.delete(table.id);
        this.broadcast(this.logMessage(table), host.id);
        this.broadcastTable(table);
        return;
      }
      case "log": {
        table.header = message.header;
        table.hasHeader = true;
        table.commands = [...message.commands];
        table.checksums = { ...message.checksums };
        this.resendAsked.delete(table.id);
        this.broadcast(this.logMessage(table), host.id);
        this.broadcastTable(table);
        return;
      }
      case "commands": {
        if (!table.hasHeader || message.from !== table.commands.length) {
          this.refuse(socket, "out-of-order");
          this.resendAsked.delete(table.id);
          this.askResend(table.id);
          return;
        }
        table.commands.push(...message.commands);
        if (message.checksums) Object.assign(table.checksums, message.checksums);
        this.broadcast(
          {
            v: 1,
            ch: "game",
            kind: "commands",
            table: table.id,
            from: message.from,
            commands: message.commands,
            ...(message.checksums ? { checksums: message.checksums } : {}),
          },
          host.id,
        );
        this.broadcastTable(table);
        return;
      }
      case "rewind": {
        if (!table.hasHeader || message.to > table.commands.length) return this.refuse(socket, "out-of-order");
        table.commands.length = message.to;
        for (const key of Object.keys(table.checksums)) if (Number(key) > message.to) delete table.checksums[key];
        this.broadcast({ v: 1, ch: "game", kind: "rewind", table: table.id, to: message.to }, host.id);
        this.broadcastTable(table);
        return;
      }
      case "end": {
        table.ended = true;
        table.outcome = message.outcome;
        this.broadcast({ v: 1, ch: "game", kind: "end", table: table.id, outcome: message.outcome }, host.id);
        this.broadcastTable(table);
        if ([...this.tables.values()].every((t) => t.ended)) {
          const now = this.clock();
          this.endedAt = now;
          await this.storage.put("endedAt", now);
          await this.storage.setAlarm(now + ROOM_END_GRACE_MS);
        }
        return;
      }
    }
  }

  // ----------------------------------------------------------------------------------------------------------
  // Leaving and closing

  /** A socket closed or errored. A host replaced by a newer one is already gone and changes nothing. */
  close(socket: RoomSocket): void {
    const participant = socket.getParticipant();
    if (!participant || !this.participants.has(participant.id)) return;
    this.participants.delete(participant.id);
    this.sockets.delete(participant.id);
    this.broadcastRoster();
    if (participant.role === "host" && participant.table) {
      const table = this.tableOf(participant.table);
      this.resendAsked.delete(participant.table);
      if (table) this.broadcastTable(table);
    }
  }

  /**
   * The alarm: the room closes 12 hours after the last host message, or 5 minutes after every table ended. When the
   * time has not come (the last message is newer than the alarm that woke us) the alarm moves out, one row.
   */
  async alarm(now: number): Promise<"closed" | "rescheduled" | "gone"> {
    const meta = await this.loadMeta();
    if (!meta) return "gone";
    if (this.endedAt === undefined) this.endedAt = (await this.storage.get<number>("endedAt")) ?? null;
    if (this.endedAt !== null && now >= this.endedAt + ROOM_END_GRACE_MS) {
      await this.shutdown("ended");
      return "closed";
    }
    // After hibernation the memory of the last host message is gone: count the wake as one, once, so a host that is
    // still connected keeps the room and one that has left lets it expire at the next alarm.
    if (this.lastHostMessageAt === undefined) {
      this.lastHostMessageAt = this.hostOf(FIRST_TABLE) ? now : meta.createdAt;
    }
    const due = this.lastHostMessageAt + ROOM_IDLE_MS;
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
    this.endedAt = null;
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
