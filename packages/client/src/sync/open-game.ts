/**
 * Which game device sync must leave alone: the one on the table, and the one Continue has started opening. Continue
 * asks other devices first and then loads the game, and between "the check ended" and "the Board is up" nothing is on
 * the table yet, so the id is held from `begin` until the player has been at the table and left it (or, if the game
 * never opened, for a while). Plain TypeScript; the Board's presence is passed in.
 */
export const RESUME_GRACE_MS = 30_000;

export class OpenGameTracker {
  readonly #now: () => number;
  #resuming: string | null = null;
  #since = 0;
  #sawTable = false;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  /** Continue is opening this game. */
  begin(gameId: string): void {
    this.#resuming = gameId;
    this.#since = this.#now();
    this.#sawTable = false;
  }

  /** Feed the table's presence; releases the held id once the table has been and gone, or the open never happened. */
  observe(onTable: boolean): void {
    if (this.#resuming === null) return;
    if (onTable) this.#sawTable = true;
    else if (this.#sawTable || this.#now() - this.#since > RESUME_GRACE_MS) this.#resuming = null;
  }

  /** The game sync must not write: the one being resumed, else the one on the table (null when none). */
  current(onTable: boolean, tableGameId: string | null): string | null {
    this.observe(onTable);
    return this.#resuming ?? (onTable ? tableGameId : null);
  }
}
