/**
 * A guest's copy of the room's game log (issue #880): the room worker holds every `game` message it received as one
 * log (header, commands, checksums, end), so a watcher that attaches later (the guest pressing "Watch" after the host
 * started) gets the whole game as one `log`, as a joiner of the room would, without a second socket.
 *
 * It applies messages the way `WatchFeed` does: a `commands` batch that starts inside what is held is authoritative
 * (cut back to its start, then take it); one that starts past the end is a gap (`"gap"`: the log cannot be trusted
 * and the session reconnects for a fresh `log`).
 */
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import { FIRST_TABLE } from "@mc/sync-worker/room-protocol";

type GameMessage = Extract<ServerMessage, { ch: "game" }>;

/** A room's game as a guest holds it: the table's header as the room carries it (unread, `parseLiveHeader`) and the log. */
export interface RoomGameSalvage {
  readonly header: unknown;
  readonly commands: readonly unknown[];
  /**
   * The game was adjusted (issue #909): the room relayed `adjusted` on a `rewind` (an acknowledged Undo past a reveal)
   * or on the `end`. Latched from those frames only; an ordinary cutting rewind does not mark it.
   */
  readonly adjusted?: true;
}

export class GameMirror {
  readonly #table: string;
  #header: unknown = undefined;
  #has = false;
  #commands: unknown[] = [];
  #checksums: Record<string, string> = {};
  #ended = false;
  #outcome: unknown = null;
  /** The server's `total` while a multi-part `log` is still arriving: a snapshot carries it so a follower keeps assembling. */
  #pendingTotal: number | null = null;
  /** A frame said this game was adjusted (sticky; reset only when a different game's header arrives). */
  #adjusted = false;
  #gameStamp: unknown = undefined;

  constructor(table: string = FIRST_TABLE) {
    this.#table = table;
  }

  get has(): boolean {
    return this.#has;
  }

  get count(): number {
    return this.#commands.length;
  }

  /** `keepLatch`: a reconnect, which brings the same game's log again: what was latched about it is kept. */
  clear(keepLatch = false): void {
    this.#has = false;
    this.#header = undefined;
    this.#commands = [];
    this.#checksums = {};
    this.#ended = false;
    this.#outcome = null;
    this.#pendingTotal = null;
    if (!keepLatch) {
      this.#adjusted = false;
      this.#gameStamp = undefined;
    }
  }

  /** Applies a game message; `"gap"` when a batch does not line up (the mirror is then not to be trusted). */
  apply(message: ServerMessage): "applied" | "ignored" | "gap" {
    if (message.ch !== "game" || !("table" in message) || message.table !== this.#table) return "ignored";
    const m: GameMessage = message;
    switch (m.kind) {
      case "log": {
        // The same game's log again (a reconnect) keeps what was latched; another game's header starts clean.
        const stamp = (m.header as { createdAt?: unknown } | null)?.createdAt;
        if (stamp === undefined || stamp !== this.#gameStamp) this.#adjusted = false;
        this.#gameStamp = stamp;
        this.#has = true;
        this.#header = m.header;
        this.#commands = [...m.commands];
        this.#checksums = { ...m.checksums };
        this.#ended = false;
        this.#outcome = m.outcome ?? null;
        this.#pendingTotal = m.total !== undefined && m.total > m.commands.length ? m.total : null;
        return "applied";
      }
      case "commands": {
        if (!this.#has) return "ignored";
        if (m.from > this.#commands.length) return "gap";
        this.#commands.length = m.from;
        this.#commands.push(...m.commands);
        this.#dropChecksumsAfter(m.from);
        Object.assign(this.#checksums, m.checksums);
        // A batch after the end means the game went on (the room clears its own end the same way): never snapshot a
        // finished game that has since taken commands.
        this.#ended = false;
        this.#outcome = null;
        if (this.#pendingTotal !== null && this.#commands.length >= this.#pendingTotal) this.#pendingTotal = null;
        return "applied";
      }
      case "rewind":
        // A rewind to the current count cuts nothing, but it reopens a finished game (a resumed host whose game is not
        // over says so that way): the end is cleared, as the room and `WatchFeed` do.
        if (this.#has && m.adjusted === true) this.#adjusted = true;
        if (!this.#has || m.to > this.#commands.length || (m.to === this.#commands.length && !this.#ended))
          return "ignored";
        this.#commands.length = m.to;
        this.#dropChecksumsAfter(m.to);
        this.#ended = false;
        this.#outcome = null;
        this.#pendingTotal = null;
        return "applied";
      case "end":
        if (!this.#has) return "ignored";
        this.#ended = true;
        this.#outcome = m.outcome;
        if (m.adjusted === true) this.#adjusted = true;
        return "applied";
      default:
        return "ignored";
    }
  }

  #dropChecksumsAfter(count: number): void {
    for (const key of Object.keys(this.#checksums)) if (Number(key) > count) delete this.#checksums[key];
  }

  /**
   * The game as it stands, for a guest whose room just closed (`live/room-continue.ts`): the header and every command
   * held, or null when there is nothing to continue from (no game, a multi-part log still arriving, a game that is over).
   */
  salvage(): RoomGameSalvage | null {
    if (!this.#has || this.#header === undefined || this.#pendingTotal !== null || this.#ended) return null;
    return {
      header: this.#header,
      commands: [...this.#commands],
      ...(this.#adjusted ? { adjusted: true as const } : {}),
    };
  }

  /** The whole game as the messages a fresh watcher would receive: a `log`, then `end` when the game is over. */
  snapshot(): readonly ServerMessage[] {
    if (!this.#has) return [];
    const log: ServerMessage = {
      v: 1,
      ch: "game",
      kind: "log",
      table: this.#table,
      header: this.#header,
      commands: [...this.#commands],
      checksums: { ...this.#checksums },
      ...(this.#pendingTotal !== null ? { total: this.#pendingTotal } : {}),
      ...(this.#ended ? { outcome: this.#outcome } : {}),
    };
    return this.#ended ? [log, { v: 1, ch: "game", kind: "end", table: this.#table, outcome: this.#outcome }] : [log];
  }
}
