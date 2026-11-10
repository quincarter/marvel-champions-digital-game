/**
 * The R2 calls the deploy makes, through Cloudflare's REST API with the CI's existing CLOUDFLARE_API_TOKEN (the same
 * endpoints `wrangler r2 object` uses), so previews need no separate R2 access keys.
 *
 * The API allows 1,200 calls per 5 minutes per user, across everything that token does; the limiter keeps this under
 * 1,000 so a concurrent wrangler deploy keeps room. A 429 or a 5xx is retried with backoff.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: number | undefined;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** The token can't do this (missing R2 permission, wrong account): the caller skips with a notice. */
  get isPermission(): boolean {
    return this.status === 401 || this.status === 403 || this.code === 10000;
  }

  /** The bucket doesn't exist yet. */
  get isMissingBucket(): boolean {
    return this.code === 10006 || (this.status === 404 && /bucket/i.test(this.message));
  }
}

export interface RemoteObject {
  readonly key: string;
  /** MD5 hex of the object for a single-part upload, which is every upload this tooling makes. */
  readonly etag: string;
  readonly size: number;
  readonly lastModified: number;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** At most `limit` starts in any `windowMs`. */
export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #starts: number[] = [];

  constructor(limit: number, windowMs: number, now = Date.now, sleep = defaultSleep) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
    this.#sleep = sleep;
  }

  async take(): Promise<void> {
    for (;;) {
      const now = this.#now();
      while (this.#starts.length > 0 && now - this.#starts[0]! >= this.#windowMs) this.#starts.shift();
      if (this.#starts.length < this.#limit) {
        this.#starts.push(now);
        return;
      }
      await this.#sleep(this.#windowMs - (now - this.#starts[0]!) + 50);
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Each segment encoded, the slashes kept: the API routes `/objects/<key>` with the key's own slashes. */
export function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export interface R2ApiOptions {
  readonly accountId: string;
  readonly token: string;
  readonly bucket: string;
  readonly fetch?: FetchLike;
  readonly limiter?: RateLimiter;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly retries?: number;
  readonly baseUrl?: string;
}

export class R2Api {
  readonly #base: string;
  readonly #token: string;
  readonly #fetch: FetchLike;
  readonly #limiter: RateLimiter;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #retries: number;
  /** API calls made, for the run's summary. */
  calls = 0;

  constructor(options: R2ApiOptions) {
    const base = options.baseUrl ?? "https://api.cloudflare.com/client/v4";
    this.#base = `${base}/accounts/${options.accountId}/r2/buckets/${options.bucket}/objects`;
    this.#token = options.token;
    this.#fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.#limiter = options.limiter ?? new RateLimiter(1000, 5 * 60_000);
    this.#sleep = options.sleep ?? defaultSleep;
    this.#retries = options.retries ?? 6;
  }

  /** Every object under `prefix`, 1,000 to a call. */
  async list(prefix: string): Promise<RemoteObject[]> {
    const objects: RemoteObject[] = [];
    let cursor: string | undefined;
    do {
      const query = new URLSearchParams({ prefix, per_page: "1000" });
      if (cursor) query.set("cursor", cursor);
      const body = (await this.#json(`${this.#base}?${query}`, { method: "GET" })) as ListBody;
      for (const item of body.result ?? []) {
        objects.push({
          key: item.key,
          etag: (item.etag ?? "").replaceAll('"', "").toLowerCase(),
          size: item.size ?? 0,
          lastModified: item.last_modified ? Date.parse(item.last_modified) : 0,
        });
      }
      cursor = body.result_info?.is_truncated ? body.result_info.cursor : undefined;
    } while (cursor);
    return objects;
  }

  /** The common prefixes under `prefix` up to the next `/` (`pr-12/`, `pr-40/`, ...). */
  async folders(prefix: string): Promise<string[]> {
    const folders: string[] = [];
    let cursor: string | undefined;
    do {
      const query = new URLSearchParams({ prefix, delimiter: "/", per_page: "1000" });
      if (cursor) query.set("cursor", cursor);
      const body = (await this.#json(`${this.#base}?${query}`, { method: "GET" })) as ListBody;
      folders.push(...(body.result_info?.delimited ?? []));
      cursor = body.result_info?.is_truncated ? body.result_info.cursor : undefined;
    } while (cursor);
    return folders;
  }

  /** One object's text, or null when there is none. */
  async getText(key: string): Promise<string | null> {
    const response = await this.#call(`${this.#base}/${encodeKey(key)}`, { method: "GET" }, true);
    return response === null ? null : response.text();
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.#call(`${this.#base}/${encodeKey(key)}`, {
      method: "PUT",
      body: body as BodyInit,
      headers: { "Content-Type": contentType },
    });
  }

  async delete(key: string): Promise<void> {
    await this.#call(`${this.#base}/${encodeKey(key)}`, { method: "DELETE" }, true);
  }

  async #json(url: string, init: RequestInit): Promise<unknown> {
    const response = await this.#call(url, init);
    return response!.json();
  }

  /** The response, retried on 429 / 5xx / network errors; null for a 404 when `allow404`. */
  async #call(url: string, init: RequestInit, allow404 = false): Promise<Response | null> {
    for (let attempt = 0; ; attempt++) {
      await this.#limiter.take();
      this.calls++;
      let response: Response;
      try {
        response = await this.#fetch(url, {
          ...init,
          headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${this.#token}` },
        });
      } catch (cause) {
        if (attempt >= this.#retries) throw cause;
        await this.#sleep(backoff(attempt));
        continue;
      }
      if (response.ok) return response;
      const text = await response.text().catch(() => "");
      const code = errorCode(text);
      if (response.status === 404 && allow404 && code !== 10006) return null;
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < this.#retries) {
        const after = Number(response.headers.get("Retry-After"));
        await this.#sleep(Number.isFinite(after) && after > 0 ? after * 1000 : backoff(attempt));
        continue;
      }
      throw new ApiError(
        `${init.method ?? "GET"} ${url.replace(/\?.*$/, "")}: HTTP ${response.status} ${text.slice(0, 300)}`,
        response.status,
        code,
      );
    }
  }
}

interface ListBody {
  result?: { key: string; etag?: string; size?: number; last_modified?: string }[];
  result_info?: { cursor?: string; is_truncated?: boolean; delimited?: string[] };
}

function backoff(attempt: number): number {
  return Math.min(60_000, 1000 * 2 ** attempt);
}

function errorCode(text: string): number | undefined {
  try {
    const code = (JSON.parse(text) as { errors?: { code?: number }[] }).errors?.[0]?.code;
    return typeof code === "number" ? code : undefined;
  } catch {
    return undefined;
  }
}
