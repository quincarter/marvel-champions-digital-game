/**
 * Test doubles: an in-memory storage, and a fake Durable Object namespace whose stubs call the class's `fetch`
 * directly (one instance per name, like the real thing). Not part of the Worker bundle.
 */

import { RateLimiter, TransferRoom } from "./durable-objects.js";
import type { DurableObjectNamespaceLike, Env, KeyValueStorage } from "./env.js";

export class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, unknown>();
  alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<boolean> {
    return this.map.delete(key);
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
}

export function makeEnv(overrides: Partial<Env> = {}): TestEnv {
  return {
    TRANSFER_ROOM: fakeNamespace((storage) => new TransferRoom({ storage })),
    RATE_LIMITER: fakeNamespace((storage) => new RateLimiter({ storage })),
    TRANSFERS_ENABLED: "true",
    MAX_UPLOAD_BYTES: "1000",
    ALLOWED_ORIGINS:
      "https://marvel-champions-digital-game.netlify.app,https://*--marvel-champions-digital-game.netlify.app,http://localhost:*",
    ...overrides,
  } as TestEnv;
}

export const PROOF = "A".repeat(43);
export const OTHER_PROOF = "B".repeat(43);
