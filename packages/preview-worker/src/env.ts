/**
 * Minimal Worker types, written here instead of pulling in `@cloudflare/workers-types` (as packages/sync-worker does):
 * the handler runs in plain Node under Vitest against a fake bucket, and the real R2 binding satisfies these.
 */

export interface R2HttpMetadataLike {
  contentType?: string;
}

export interface R2RangeLike {
  offset?: number;
  length?: number;
  suffix?: number;
}

/** What `get` / `head` return: the metadata, and the body for a `get` whose conditions passed. */
export interface R2ObjectLike {
  readonly key: string;
  readonly size: number;
  readonly httpEtag: string;
  readonly uploaded: Date;
  readonly httpMetadata?: R2HttpMetadataLike;
  readonly range?: R2RangeLike;
  /** Absent when an `onlyIf` condition failed (the caller answers 304 or 412). */
  readonly body?: ReadableStream;
  text?(): Promise<string>;
}

export interface R2GetOptionsLike {
  onlyIf?: Headers;
  range?: Headers;
}

export interface R2BucketLike {
  get(key: string, options?: R2GetOptionsLike): Promise<R2ObjectLike | null>;
  head(key: string): Promise<R2ObjectLike | null>;
}

export interface Env {
  /** The `mc-previews` bucket. */
  PREVIEWS: R2BucketLike;
  /** Kill switch: anything but "true" answers every preview request with 503. */
  PREVIEWS_ENABLED?: string;
}
