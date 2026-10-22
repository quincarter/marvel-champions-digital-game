/**
 * A typed client for the device-sync routes (`@mc/sync-worker/sync-protocol`, issue #276 step 2). Like
 * `save-data/transfer-client.ts`, every call answers `{ ok: true, ... }` or `{ ok: false, failure }`, with one plain
 * failure kind per thing a screen would say, so nothing above this file inspects a status code. Response bodies are
 * checked before they are trusted: a Worker that answers 200 with something else is "unavailable", not a crash later.
 */
import {
  MAX_BATCH_OPS,
  RECORD_KEY_PATTERN,
  type SpaceInfo,
  type SyncBatchResult,
  type SyncChanges,
  type SyncError,
  type SyncOp,
  type SyncOpResult,
  type SyncRecord,
} from "@mc/sync-worker/sync-protocol";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import type { SyncCredentials } from "./sync-credentials.js";

/** How long a request may take before it counts as the service being unavailable. */
export const SYNC_TIMEOUT_MS = 20_000;

export type SyncFailure =
  /** No service configured, a network error or timeout, a 5xx, a refused origin, or an answer that makes no sense. */
  | { readonly kind: "unavailable" }
  /** The service answers but has no sync routes (an older Worker), or this browser can't encrypt. */
  | { readonly kind: "unsupported" }
  /** 404: no space for this recovery code (it is wrong, or the space was deleted or expired). */
  | { readonly kind: "not-found" }
  /** 429: too many requests from here for now; `retryAfterSeconds` is the service's `Retry-After`, when it sent one. */
  | { readonly kind: "rate-limited"; readonly retryAfterSeconds?: number }
  /** 429 after too many wrong codes: this device is blocked for a while (`Retry-After` as above). */
  | { readonly kind: "blocked"; readonly retryAfterSeconds?: number }
  /** 413: the space is at its size limit. */
  | { readonly kind: "space-full" }
  /** 413 or 400 `too-many-ops`: a record or a batch is bigger than the service accepts. */
  | { readonly kind: "too-large" };

export interface SyncDeps {
  readonly baseUrl: string | null;
  readonly fetch: typeof fetch;
}

export type SyncResult<T> = ({ readonly ok: true } & T) | { readonly ok: false; readonly failure: SyncFailure };

function defaultDeps(): SyncDeps {
  return { baseUrl: syncServiceUrl(), fetch: (...args) => globalThis.fetch(...args) };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function isSpaceInfo(value: unknown): value is SpaceInfo {
  return (
    isObject(value) &&
    isCount(value.cursor) &&
    isCount(value.bytes) &&
    isCount(value.maxBytes) &&
    isCount(value.records) &&
    isCount(value.createdAt) &&
    isCount(value.epoch)
  );
}

function isSyncRecord(value: unknown): value is SyncRecord {
  if (!isObject(value) || typeof value.key !== "string" || !RECORD_KEY_PATTERN.test(value.key)) return false;
  if (!isCount(value.version) || value.version < 1 || typeof value.deleted !== "boolean") return false;
  return value.deleted ? value.data === undefined : typeof value.data === "string" && value.data.length > 0;
}

/**
 * A page after `since`: the cursor never goes back, advances when there is more, and every record sits in
 * (since, cursor] in ascending order, so a client that trusts it can never loop or skip.
 */
function isSyncChanges(value: unknown, since: number): value is SyncChanges {
  if (!isObject(value) || !isCount(value.cursor) || !isCount(value.epoch) || typeof value.more !== "boolean")
    return false;
  if (!Array.isArray(value.records) || !value.records.every(isSyncRecord)) return false;
  // A cursor below `since` with nothing else is how a re-created space answers an older epoch's cursor: the engine
  // reads the epoch and starts over. With records or `more` it is nonsense.
  if (value.cursor < since && (value.more || value.records.length > 0)) return false;
  if (value.more && value.cursor <= since) return false;
  let previous = Math.min(since, value.cursor);
  for (const record of value.records as SyncRecord[]) {
    if (record.version <= previous || record.version > value.cursor) return false;
    previous = record.version;
  }
  return true;
}

function isOpResult(value: unknown): value is SyncOpResult {
  if (!isObject(value) || typeof value.key !== "string" || !isCount(value.version)) return false;
  return value.ok === true || (value.ok === false && value.reason === "conflict");
}

/** The answer must be about exactly the ops sent, in order. */
function isBatchResult(value: unknown, ops: readonly SyncOp[]): value is SyncBatchResult {
  return (
    isObject(value) &&
    isCount(value.cursor) &&
    Array.isArray(value.results) &&
    value.results.length === ops.length &&
    value.results.every((result, i) => isOpResult(result) && result.key === ops[i]!.key)
  );
}

async function errorOf(response: Response): Promise<Partial<SyncError> | null> {
  try {
    const body: unknown = await response.json();
    return isObject(body) ? (body as Partial<SyncError>) : null;
  } catch {
    return null;
  }
}

async function failureOf(response: Response): Promise<SyncFailure> {
  const { status } = response;
  const reason = (await errorOf(response))?.reason;
  // A 404 that isn't the protocol's own answer (no JSON `not-found`) is a Worker without these routes.
  if (status === 404) return { kind: reason === "not-found" ? "not-found" : "unsupported" };
  if (status === 405) return { kind: "unsupported" };
  if (reason === "space-full") return { kind: "space-full" };
  if (status === 413 || reason === "too-large" || reason === "too-many-ops") return { kind: "too-large" };
  if (status === 429) {
    const seconds = Number(response.headers.get("Retry-After"));
    const retryAfterSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
    return { kind: reason === "blocked" ? "blocked" : "rate-limited", ...(retryAfterSeconds && { retryAfterSeconds }) };
  }
  return { kind: "unavailable" };
}

/** Sends one authorized request and, when `expect` accepts the status, parses the JSON body with `check`. */
async function call<T>(
  deps: SyncDeps,
  creds: SyncCredentials,
  path: string,
  init: RequestInit,
  accept: readonly number[],
  check: (body: unknown) => T | null,
): Promise<SyncResult<{ readonly value: T; readonly status: number }>> {
  if (!deps.baseUrl) return { ok: false, failure: { kind: "unavailable" } };
  let response: Response;
  try {
    const headers = { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${creds.token}` };
    response = await deps.fetch(`${deps.baseUrl}/sync/${creds.spaceId}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
  } catch {
    // A network error, a refused connection and the timeout all read the same to the player.
    return { ok: false, failure: { kind: "unavailable" } };
  }
  if (!accept.includes(response.status)) return { ok: false, failure: await failureOf(response) };
  try {
    const value = check(response.status === 204 ? null : await response.json());
    return value === null
      ? { ok: false, failure: { kind: "unavailable" } }
      : { ok: true, value, status: response.status };
  } catch {
    // Not JSON, or the connection dropped mid-body.
    return { ok: false, failure: { kind: "unavailable" } };
  }
}

/** Creates the space for these credentials; `created` is false when it already existed (same token). */
export async function createSpace(
  creds: SyncCredentials,
  deps: SyncDeps = defaultDeps(),
): Promise<SyncResult<{ readonly info: SpaceInfo; readonly created: boolean }>> {
  const got = await call(deps, creds, "", { method: "POST" }, [200, 201], (body) => (isSpaceInfo(body) ? body : null));
  return got.ok ? { ok: true, info: got.value, created: got.status === 201 } : got;
}

/** The space's cursor and size; `not-found` is how a wrong or unused recovery code shows up. */
export async function spaceInfo(
  creds: SyncCredentials,
  deps: SyncDeps = defaultDeps(),
): Promise<SyncResult<{ readonly info: SpaceInfo }>> {
  const got = await call(deps, creds, "", { method: "GET" }, [200], (body) => (isSpaceInfo(body) ? body : null));
  return got.ok ? { ok: true, info: got.value } : got;
}

/**
 * One page of records changed after version `since`; call again with `changes.cursor` while `changes.more`.
 * Throws a `RangeError` for a `since` that is not a finite number (a caller bug).
 */
export async function changes(
  creds: SyncCredentials,
  since: number,
  deps: SyncDeps = defaultDeps(),
): Promise<SyncResult<{ readonly changes: SyncChanges }>> {
  if (!Number.isFinite(since)) throw new RangeError("changes needs a finite `since`.");
  const from = Math.max(0, Math.trunc(since));
  const got = await call(deps, creds, `/changes?since=${from}`, { method: "GET" }, [200], (body) =>
    isSyncChanges(body, from) ? body : null,
  );
  return got.ok ? { ok: true, changes: got.value } : got;
}

/**
 * Writes 1 to `MAX_BATCH_OPS` ops; a stale `baseVersion` comes back as a per-op conflict, not a failure. An empty
 * batch throws a `RangeError` without a request (the caller skips it); more than the limit is `too-large`, also unsent.
 */
export async function batch(
  creds: SyncCredentials,
  ops: readonly SyncOp[],
  deps: SyncDeps = defaultDeps(),
): Promise<SyncResult<{ readonly result: SyncBatchResult }>> {
  if (ops.length === 0) throw new RangeError("batch needs at least one op.");
  if (ops.length > MAX_BATCH_OPS) return { ok: false, failure: { kind: "too-large" } };
  const got = await call(
    deps,
    creds,
    "/batch",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ops }) },
    [200],
    (body) => (isBatchResult(body, ops) ? body : null),
  );
  return got.ok ? { ok: true, result: got.value } : got;
}

/** Wipes the space and every record in it. */
export async function deleteSpace(creds: SyncCredentials, deps: SyncDeps = defaultDeps()): Promise<SyncResult<object>> {
  const got = await call(deps, creds, "", { method: "DELETE" }, [204], () => true);
  return got.ok ? { ok: true } : got;
}
