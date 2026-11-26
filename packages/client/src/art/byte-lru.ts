/**
 * A least-recently-used map capped by both entry count and bytes (`card-face-bake.ts`'s decoded art): a few big
 * bitmaps cost far more than many small ones, and a count alone let a phone's tab die on them. An entry's size may be
 * unknown when it is added (a decode in flight) and set once it is known with `setBytes`.
 */
export class ByteLru<V> {
  readonly #entries = new Map<string, { value: V; bytes: number }>();
  readonly #maxEntries: number;
  readonly #maxBytes: number;
  #bytes = 0;

  constructor(maxEntries: number, maxBytes: number) {
    this.#maxEntries = maxEntries;
    this.#maxBytes = maxBytes;
  }

  get size(): number {
    return this.#entries.size;
  }

  get bytes(): number {
    return this.#bytes;
  }

  /** The value, made the most recently used; undefined when absent. */
  get(key: string): V | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  /** The value without touching its recency. */
  peek(key: string): V | undefined {
    return this.#entries.get(key)?.value;
  }

  /** Adds `value` as most recently used and returns what was evicted to stay in budget (never `value` itself). */
  set(key: string, value: V, bytes = 0): V[] {
    const old = this.#entries.get(key);
    if (old) this.#bytes -= old.bytes;
    this.#entries.delete(key);
    this.#entries.set(key, { value, bytes });
    this.#bytes += bytes;
    return this.#trim(key);
  }

  /** Records the size of an entry once known; returns what that evicted. A key no longer present is ignored. */
  setBytes(key: string, bytes: number): V[] {
    const entry = this.#entries.get(key);
    if (!entry) return [];
    this.#bytes += bytes - entry.bytes;
    entry.bytes = bytes;
    return this.#trim(key);
  }

  #trim(keep: string): V[] {
    const evicted: V[] = [];
    for (const [key, entry] of this.#entries) {
      if (this.#entries.size <= this.#maxEntries && this.#bytes <= this.#maxBytes) break;
      if (key === keep) continue;
      this.#entries.delete(key);
      this.#bytes -= entry.bytes;
      evicted.push(entry.value);
    }
    return evicted;
  }
}
