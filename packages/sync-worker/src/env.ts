/**
 * Minimal Worker types, written here instead of pulling in `@cloudflare/workers-types`: the logic modules run in plain
 * Node under Vitest, so they depend only on these small interfaces, and the real Cloudflare objects satisfy them.
 */

/** The slice of `DurableObjectStorage` the logic uses; tests back it with a Map. */
export interface KeyValueStorage {
  get<T>(key: string): Promise<T | undefined>;
  /** Up to 128 keys per call on the real storage; the result holds only the keys that exist. */
  get<T>(keys: string[]): Promise<Map<string, T>>;
  put(key: string, value: unknown): Promise<void>;
  /** Up to 128 entries per call on the real storage. */
  put(entries: Record<string, unknown>): Promise<void>;
  delete(key: string): Promise<unknown>;
  /** Up to 128 keys per call on the real storage. */
  delete(keys: string[]): Promise<unknown>;
  /** Keys in ascending order; `start` is inclusive. */
  list<T>(options: { prefix?: string; start?: string; limit?: number }): Promise<Map<string, T>>;
  deleteAll(): Promise<void>;
  getAlarm(): Promise<number | null>;
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

/** The slice of an R2 object read back that the replay routes use. */
export interface R2ObjectBodyLike {
  readonly body: ReadableStream<Uint8Array>;
  text(): Promise<string>;
}

export interface R2PutOptionsLike {
  /** `{ etagDoesNotMatch: "*" }` writes only when the key is free; `put` then answers null when it is taken. */
  onlyIf?: { etagDoesNotMatch?: string };
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

/** The slice of `R2Bucket` the replay routes use; tests back it with a Map. */
export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  /** Null when an `onlyIf` condition fails. */
  put(key: string, value: string, options?: R2PutOptionsLike): Promise<object | null>;
}

export interface Env {
  TRANSFER_ROOM: DurableObjectNamespaceLike;
  RATE_LIMITER: DurableObjectNamespaceLike;
  SYNC_SPACE: DurableObjectNamespaceLike;
  GLOBAL_STATS: DurableObjectNamespaceLike;
  /** The R2 bucket replay share links are stored in. */
  REPLAYS: R2BucketLike;
  /** Anything other than "true" is the kill switch. */
  TRANSFERS_ENABLED?: string;
  MAX_UPLOAD_BYTES?: string;
  /** Anything other than "true" turns every /sync route off. */
  SYNC_ENABLED?: string;
  /** Anything other than "true" turns every /global route off. */
  GLOBAL_STATS_ENABLED?: string;
  /** Live bytes one sync space may hold; defaults to DEFAULT_MAX_SPACE_BYTES. */
  MAX_SPACE_BYTES?: string;
  /** Anything other than "true" turns every /replay route off. */
  REPLAYS_ENABLED?: string;
  /** The largest replay upload in bytes; defaults to DEFAULT_MAX_REPLAY_BYTES. */
  MAX_REPLAY_BYTES?: string;
  ALLOWED_ORIGINS?: string;
  /** A secret, not a var. When set, uploads must carry a valid Turnstile token. */
  TURNSTILE_SECRET?: string;
}
