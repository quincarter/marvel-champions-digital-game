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

  constructor(table: string = FIRST_TABLE) {
    this.#table = table;
  }

  get has(): boolean {
    return this.#has;
  }

  get count(): number {
    return this.#commands.length;
  }

  clear(): void {
    this.#has = false;
    this.#header = undefined;
    this.#commands = [];
    this.#checksums = {};
    this.#ended = false;
    this.#outcome = null;
    this.#pendingTotal = null;
  }

  /** Applies a game message; `"gap"` when a batch does not line up (the mirror is then not to be trusted). */
  apply(message: ServerMessage): "applied" | "ignored" | "gap" {
    if (message.ch !== "game" || !("table" in message) || message.table !== this.#table) return "ignored";
    const m: GameMessage = message;
    switch (m.kind) {
      case "log":
        this.#has = true;
        this.#header = m.header;
        this.#commands = [...m.commands];
        this.#checksums = { ...m.checksums };
        this.#ended = false;
        this.#outcome = m.outcome ?? null;
        this.#pendingTotal = m.total !== undefined && m.total > m.commands.length ? m.total : null;
        return "applied";
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
        return "applied";
      default:
        return "ignored";
    }
  }

  #dropChecksumsAfter(count: number): void {
    for (const key of Object.keys(this.#checksums)) if (Number(key) > count) delete this.#checksums[key];
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
