/**
 * Minimal Worker types, written here instead of pulling in `@cloudflare/workers-types`: the logic modules run in plain
 * Node under Vitest, so they depend only on these small interfaces, and the real Cloudflare objects satisfy them.
 */

/** The slice of `DurableObjectStorage` the logic uses; tests back it with a Map. */
export interface KeyValueStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<unknown>;
  deleteAll(): Promise<void>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): object;
  get(id: object): DurableObjectStubLike;
}

/** What a Durable Object's legacy constructor receives. */
export interface DurableObjectStateLike {
  readonly storage: KeyValueStorage;
}

export interface Env {
  TRANSFER_ROOM: DurableObjectNamespaceLike;
  RATE_LIMITER: DurableObjectNamespaceLike;
  /** Anything other than "true" is the kill switch. */
  TRANSFERS_ENABLED?: string;
  MAX_UPLOAD_BYTES?: string;
  ALLOWED_ORIGINS?: string;
  /** A secret, not a var. When set, uploads must carry a valid Turnstile token. */
  TURNSTILE_SECRET?: string;
}
