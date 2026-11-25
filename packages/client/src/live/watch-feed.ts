/**
 * The watcher's side of a live game room as plain logic with no socket in it (docs/live-game-rooms.md section 5,
 * item 4): it reads the room's messages for the one table being followed and says what to do to the replay, in order.
 *
 * The room may send a joining watcher the log in parts (a `log`, then `commands` that continue it), and a reconnect
 * brings a whole `log` again, so a `log` while a replay is already open is a `reset` and a `commands` batch is judged
 * by where it starts: right at the end of what is held (an append), behind it (authoritative: a rewind to its start,
 * then an append), past it (a gap: the feed asks for a `resync`, which the controller answers by reconnecting for a fresh `log`).
 */
import { FIRST_TABLE, type ServerMessage, type TableChecksums } from "@mc/sync-worker/room-protocol";
import type { Command } from "@mc/engine";

export type WatchAction =
  /** The first `log`: the replay can be opened. */
  | {
      readonly kind: "open" | "reset";
      readonly header: unknown;
      readonly commands: readonly Command[];
      readonly checksums: TableChecksums;
      readonly outcome: unknown;
    }
  | {
      readonly kind: "append";
      readonly commands: readonly Command[];
      readonly checksums: TableChecksums | undefined;
    }
  | { readonly kind: "rewind"; readonly to: number }
  | { readonly kind: "end"; readonly outcome: unknown }
  | { readonly kind: "resync" }
  /** The room has no game for this table yet (the host has not started it): keep waiting. */
  | { readonly kind: "waiting" }
  /** The room turned this watcher away: it is full. */
  | { readonly kind: "refused" }
  | { readonly kind: "presence"; readonly hostConnected: boolean; readonly watchers: number }
  | { readonly kind: "closed"; readonly reason: "ended" | "idle" | "disabled" | "host" };

export class WatchFeed {
  readonly #table: string;
  #opened = false;
  /** The table has ended (an `end`, or a `log` that carries an outcome): a same-count rewind then reopens it. */
  #ended = false;
  #count = 0;
  #hostConnected = false;
  /** A resync was asked for and its fresh `log` has not come: further gaps wait for it rather than ask again. */
  #resyncing = false;
  #watchers = 0;

  constructor(table: string = FIRST_TABLE) {
    this.#table = table;
  }

  /** Commands held so far. */
  get count(): number {
    return this.#count;
  }

  get opened(): boolean {
    return this.#opened;
  }

  /** What a room message means for the replay. A reconnect brings its own `log`, which resets what is held. */
  onMessage(message: ServerMessage): readonly WatchAction[] {
    if (message.ch === "room") return this.#room(message);
    if (message.ch !== "game" || !("table" in message) || message.table !== this.#table) return [];
    switch (message.kind) {
      case "log": {
        const kind = this.#opened ? "reset" : "open";
        this.#opened = true;
        this.#resyncing = false;
        this.#count = message.commands.length;
        this.#ended = message.outcome != null;
        return [
          {
            kind,
            header: message.header,
            commands: message.commands as readonly Command[],
            checksums: message.checksums ?? {},
            outcome: message.outcome,
          },
        ];
      }
      case "commands": {
        if (!this.#opened) return [];
        const from = message.from;
        const end = from + message.commands.length;
        if (from > this.#count) {
          if (this.#resyncing) return [];
          this.#resyncing = true;
          return [{ kind: "resync" }];
        }
        // A batch that starts inside what is held is authoritative (an Undo while the room slept): cut back to where it
        // starts and take it, rather than assume the overlap is the same game.
        const behind = from < this.#count;
        this.#count = end;
        if (message.commands.length > 0) this.#ended = false;
        return [
          ...(behind ? ([{ kind: "rewind", to: from }] as const) : []),
          { kind: "append", commands: message.commands as readonly Command[], checksums: message.checksums },
        ];
      }
      case "rewind":
        // A same-count rewind is how the room reopens an ended table (clearing its outcome): forward it then.
        if (!this.#opened || message.to > this.#count || (message.to === this.#count && !this.#ended)) return [];
        this.#count = message.to;
        this.#ended = false;
        return [{ kind: "rewind", to: message.to }];
      case "end":
        if (!this.#opened) return [];
        this.#ended = true;
        return [{ kind: "end", outcome: message.outcome }];
      default:
        return [];
    }
  }

  #room(message: Extract<ServerMessage, { ch: "room" }>): readonly WatchAction[] {
    switch (message.kind) {
      case "welcome": {
        const table = message.tables.find((t) => t.id === this.#table);
        this.#watchers = message.participants.filter((p) => p.role === "watcher").length;
        this.#hostConnected = table?.hostConnected ?? false;
        return table?.hasHeader ? this.#presence() : [{ kind: "waiting" }, ...this.#presence()];
      }
      case "roster":
        this.#watchers = message.watchers;
        return this.#presence();
      case "table":
        if (message.table.id !== this.#table) return [];
        this.#hostConnected = message.table.hostConnected;
        return this.#presence();
      case "closed":
        return [{ kind: "closed", reason: message.reason }];
      case "refused":
        return message.reason === "full" ? [{ kind: "refused" }] : [];
      default:
        return [];
    }
  }

  /** The socket is down: the host is not known to be there. */
  onDisconnected(): readonly WatchAction[] {
    this.#hostConnected = false;
    return this.#presence();
  }

  #presence(): readonly WatchAction[] {
    return [{ kind: "presence", hostConnected: this.#hostConnected, watchers: this.#watchers }];
  }
}
