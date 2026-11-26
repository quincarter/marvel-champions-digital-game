/**
 * The order card faces are baked in, and how many are in flight at once (`card-face-baker.ts`).
 *
 * Lowest priority number first (the roster passes a tile's distance from its viewport, so on-screen tiles are 0 and
 * overscan comes after), first in first out among equals. Only items still waiting can be re-prioritised or removed;
 * once `next()` has handed one out it counts against the cap until `done()`.
 */
export class BakeQueue<T> {
  readonly #waiting = new Map<T, { priority: number; seq: number }>();
  readonly #cap: number;
  #inFlight = 0;
  #seq = 0;

  constructor(cap: number) {
    this.#cap = Math.max(1, Math.floor(cap));
  }

  get size(): number {
    return this.#waiting.size;
  }

  get inFlight(): number {
    return this.#inFlight;
  }

  has(item: T): boolean {
    return this.#waiting.has(item);
  }

  /** Queues `item`, or just updates its priority when it is already waiting. */
  enqueue(item: T, priority: number): void {
    const held = this.#waiting.get(item);
    if (held) held.priority = priority;
    else this.#waiting.set(item, { priority, seq: this.#seq++ });
  }

  /** Changes a waiting item's priority; false when it is not waiting (already dispatched, or removed). */
  reprioritize(item: T, priority: number): boolean {
    const held = this.#waiting.get(item);
    if (!held) return false;
    held.priority = priority;
    return true;
  }

  /** Drops a waiting item; false when it was not waiting. */
  remove(item: T): boolean {
    return this.#waiting.delete(item);
  }

  /** The best waiting item, counted as in flight, or null when the cap is reached or nothing waits. */
  next(): T | null {
    if (this.#inFlight >= this.#cap) return null;
    let best: T | null = null;
    let bestKey: { priority: number; seq: number } | null = null;
    for (const [item, key] of this.#waiting) {
      if (!bestKey || key.priority < bestKey.priority || (key.priority === bestKey.priority && key.seq < bestKey.seq)) {
        best = item;
        bestKey = key;
      }
    }
    if (best === null) return null;
    this.#waiting.delete(best);
    this.#inFlight++;
    return best;
  }

  /** One dispatched item finished (baked or failed). */
  done(): void {
    if (this.#inFlight > 0) this.#inFlight--;
  }

  /** Forgets everything in flight, for when the thread that was baking it is gone. */
  clearInFlight(): void {
    this.#inFlight = 0;
  }
}
