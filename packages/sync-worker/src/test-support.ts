/**
 * Test doubles: an in-memory storage, and a fake Durable Object namespace whose stubs call the class's `fetch`
 * directly (one instance per name, like the real thing). Not part of the Worker bundle.
 */

import { RateLimiter, SyncSpace, TransferRoom } from "./durable-objects.js";
import type { DurableObjectNamespaceLike, Env, KeyValueStorage } from "./env.js";

export class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, unknown>();
  alarm: number | null = null;
  /** Rows written so far: one per key put or deleted, the way the free plan counts them. */
  rowsWritten = 0;

  get<T>(key: string): Promise<T | undefined>;
  get<T>(keys: string[]): Promise<Map<string, T>>;
  async get<T>(key: string | string[]): Promise<T | undefined | Map<string, T>> {
    if (typeof key !== "string") {
      if (key.length > 128) throw new Error("get: more than 128 keys");
      const found = new Map<string, T>();
      for (const k of key) if (this.map.has(k)) found.set(k, this.map.get(k) as T);
      return found;
    }
    return this.map.get(key) as T | undefined;
  }
  put(key: string, value: unknown): Promise<void>;
  put(entries: Record<string, unknown>): Promise<void>;
  async put(key: string | Record<string, unknown>, value?: unknown): Promise<void> {
    if (typeof key !== "string") {
      const entries = Object.entries(key);
      if (entries.length > 128) throw new Error("put: more than 128 keys");
      for (const [k, v] of entries) this.map.set(k, v);
      this.rowsWritten += entries.length;
      return;
    }
    this.map.set(key, value);
    this.rowsWritten += 1;
  }
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  async delete(key: string | string[]): Promise<boolean | number> {
    if (typeof key !== "string") {
      if (key.length > 128) throw new Error("delete: more than 128 keys");
      let count = 0;
      for (const k of key) if (this.map.delete(k)) count += 1;
      this.rowsWritten += count;
      return count;
    }
    const existed = this.map.delete(key);
    if (existed) this.rowsWritten += 1;
    return existed;
  }
  async list<T>(options: { prefix?: string; start?: string; limit?: number }): Promise<Map<string, T>> {
    const keys = [...this.map.keys()]
      .filter((k) => k.startsWith(options.prefix ?? "") && (options.start === undefined || k >= options.start))
      .sort();
    return new Map(keys.slice(0, options.limit).map((k) => [k, this.map.get(k) as T]));
  }
  async deleteAll(): Promise<void> {
    this.map.clear();
  }
  async setAlarm(scheduledTime: number): Promise<void> {
    this.alarm = scheduledTime;
  }
  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
}

export interface FakeNamespace<T> extends DurableObjectNamespaceLike {
  readonly instances: Map<string, { object: T; storage: MemoryStorage }>;
}

export function fakeNamespace<T extends { fetch(request: Request): Promise<Response> }>(
  make: (storage: MemoryStorage) => T,
): FakeNamespace<T> {
  const instances = new Map<string, { object: T; storage: MemoryStorage }>();
  // A real Durable Object runs one request at a time across its storage awaits (the input gate); queue to match.
  const queues = new Map<string, Promise<unknown>>();
  return {
    instances,
    idFromName: (name) => ({ name }),
    get(id) {
      const name = (id as { name: string }).name;
      let entry = instances.get(name);
      if (!entry) {
        const storage = new MemoryStorage();
        entry = { object: make(storage), storage };
        instances.set(name, entry);
      }
      const target = entry;
      return {
        fetch(request: Request) {
          const run = (queues.get(name) ?? Promise.resolve()).then(() => target.object.fetch(request));
          queues.set(
            name,
            run.catch(() => undefined),
          );
          return run;
        },
      };
    },
  };
}

export interface TestEnv extends Env {
  TRANSFER_ROOM: FakeNamespace<TransferRoom>;
  RATE_LIMITER: FakeNamespace<RateLimiter>;
  SYNC_SPACE: FakeNamespace<SyncSpace>;
}

export function makeEnv(overrides: Partial<Env> = {}): TestEnv {
  return {
    TRANSFER_ROOM: fakeNamespace((storage) => new TransferRoom({ storage })),
    RATE_LIMITER: fakeNamespace((storage) => new RateLimiter({ storage })),
    SYNC_SPACE: fakeNamespace((storage) => new SyncSpace({ storage })),
    TRANSFERS_ENABLED: "true",
    SYNC_ENABLED: "true",
    MAX_UPLOAD_BYTES: "1000",
    ALLOWED_ORIGINS:
      "https://marvel-champions-digital-game.netlify.app,https://*--marvel-champions-digital-game.netlify.app,http://localhost:*",
    ...overrides,
  } as TestEnv;
}

export const PROOF = "A".repeat(43);
export const OTHER_PROOF = "B".repeat(43);
