/**
 * Binds a room game to the save and the engine host that run it (#909), when the game starts. `platform/room.ts` hears
 * of a room game's updates (progress, its end) long after the app may have moved on to another session (a local game,
 * a replay, a seat): sampling "the current session's game" then would write room game A's record into game B's save.
 * The binding is taken once, at the first update of a tracked game, and every later update of that game (including its
 * end) goes to the same save through the same host, however the session has changed since.
 */
import type { RoomPlayTracker } from "../live/room-play-tracker.js";

/** The save and its durable owner (the engine host that runs it) one room game is bound to. */
export interface RoomPlayBinding<T> {
  readonly roomId: string;
  readonly table: string;
  readonly gameId: string;
  readonly owner: T;
  /** The room admission id of the bound game once told; a record naming another gid is not this game. */
  readonly gid: string | null;
}

export class RoomPlayBindings<T> {
  #current: RoomPlayBinding<T> | null = null;

  get current(): RoomPlayBinding<T> | null {
    return this.#current;
  }

  /**
   * Called with the tracker before and after each room state. Another game (another room or table, or a confirmed game
   * key that changed) drops the binding, so the next game binds to its own save; the same game, a provisional key
   * promoted to its confirmed one included, keeps it. A finished game (no tracker after) keeps it for its last write,
   * until `release`.
   */
  advance(previous: RoomPlayTracker | null, next: RoomPlayTracker | null): void {
    if (next === null) return;
    if (
      previous === null ||
      previous.roomId !== next.roomId ||
      previous.table !== next.table ||
      (previous.confirmed && previous.gameKey !== next.gameKey)
    ) {
      this.#current = null;
    }
  }

  /** The binding for a record of room `roomId`, made from `sample` (the session as it is now) when none is held yet. */
  resolve(
    roomId: string,
    table: string,
    sample: () => { readonly gameId: string | null; readonly owner: T },
    gid: string | null = null,
  ): RoomPlayBinding<T> | null {
    const held = this.#current;
    if (held) {
      if (held.roomId !== roomId || held.table !== table) return null;
      // Another admission of the same room (a rematch) is another game, whatever the save: no write.
      if (held.gid !== null && gid !== held.gid) return null;
      if (held.gid === null && gid !== null) this.#current = { ...held, gid };
      return this.#current;
    }
    const now = sample();
    if (now.gameId === null) return null;
    this.#current = { roomId, table, gameId: now.gameId, owner: now.owner, gid };
    return this.#current;
  }

  release(): void {
    this.#current = null;
  }
}
