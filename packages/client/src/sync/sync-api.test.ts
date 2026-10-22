import { MAX_BATCH_OPS, type SyncOp } from "@mc/sync-worker/sync-protocol";
import { describe, expect, test, vi } from "vitest";
import { SYNC_TIMEOUT_MS, batch, changes, createSpace, deleteSpace, spaceInfo, type SyncDeps } from "./sync-api.js";
import { deriveCredentials } from "./sync-credentials.js";

const BASE = "https://mc-sync.test";
const creds = await deriveCredentials("ABCDEFGHJKMNPQRSTUVWXYZ23");
const KEY_A = "A".repeat(43);
const KEY_B = "B".repeat(43);
const INFO = { cursor: 3, bytes: 10, maxBytes: 100, records: 2, createdAt: 5 };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function serving(response: () => Response | Promise<Response>): {
  deps: SyncDeps;
  calls: { url: string; init: RequestInit }[];
} {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFake = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return response();
  };
  return { deps: { baseUrl: BASE, fetch: fetchFake as typeof fetch }, calls };
}

describe("requests", () => {
  test("every route targets the space and carries the bearer token", async () => {
    const { deps, calls } = serving(() => json(200, INFO));
    await spaceInfo(creds, deps);
    expect(calls[0]!.url).toBe(`${BASE}/sync/${creds.spaceId}`);
    expect(calls[0]!.init.method).toBe("GET");
    expect(new Headers(calls[0]!.init.headers).get("Authorization")).toBe(`Bearer ${creds.token}`);
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  test("createSpace tells a new space (201) from an existing one (200)", async () => {
    const fresh = serving(() => json(201, INFO));
    const made = await createSpace(creds, fresh.deps);
    expect(made).toEqual({ ok: true, info: INFO, created: true });
    expect(fresh.calls[0]!.init.method).toBe("POST");
    const existing = await createSpace(creds, serving(() => json(200, INFO)).deps);
    expect(existing).toMatchObject({ ok: true, created: false });
  });

  test("changes passes the cursor and returns the page", async () => {
    const page = { cursor: 7, more: true, records: [{ key: KEY_A, version: 7, deleted: false, data: "abc" }] };
    const { deps, calls } = serving(() => json(200, page));
    expect(await changes(creds, 4, deps)).toEqual({ ok: true, changes: page });
    expect(calls[0]!.url).toBe(`${BASE}/sync/${creds.spaceId}/changes?since=4`);
  });

  test("a tombstone has no data", async () => {
    const page = { cursor: 8, more: false, records: [{ key: KEY_A, version: 8, deleted: true }] };
    expect(await changes(creds, 0, serving(() => json(200, page)).deps)).toMatchObject({ ok: true });
  });

  test("batch posts the ops as JSON and returns per-op results, conflicts included", async () => {
    const ops: SyncOp[] = [
      { key: KEY_A, baseVersion: 0, data: "abc" },
      { key: KEY_B, baseVersion: 2, deleted: true },
    ];
    const result = {
      cursor: 9,
      results: [
        { key: KEY_A, ok: true, version: 9 },
        { key: KEY_B, ok: false, reason: "conflict", version: 5 },
      ],
    };
    const { deps, calls } = serving(() => json(200, result));
    expect(await batch(creds, ops, deps)).toEqual({ ok: true, result });
    expect(calls[0]!.url).toBe(`${BASE}/sync/${creds.spaceId}/batch`);
    expect(calls[0]!.init.method).toBe("POST");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ ops });
    expect(new Headers(calls[0]!.init.headers).get("Content-Type")).toBe("application/json");
  });

  test("an empty batch and a non-finite since are refused without a request", async () => {
    const { deps, calls } = serving(() => json(200, {}));
    await expect(batch(creds, [], deps)).rejects.toThrow(RangeError);
    await expect(changes(creds, Number.NaN, deps)).rejects.toThrow(RangeError);
    await expect(changes(creds, Infinity, deps)).rejects.toThrow(RangeError);
    expect(calls).toHaveLength(0);
  });

  test("a batch over the op limit is too-large without a request", async () => {
    const { deps, calls } = serving(() => json(200, {}));
    const ops = Array.from({ length: MAX_BATCH_OPS + 1 }, () => ({ key: KEY_A, baseVersion: 0, data: "a" }));
    expect(await batch(creds, ops, deps)).toEqual({ ok: false, failure: { kind: "too-large" } });
    expect(calls).toHaveLength(0);
  });

  test("deleteSpace accepts 204", async () => {
    const { deps, calls } = serving(() => new Response(null, { status: 204 }));
    expect(await deleteSpace(creds, deps)).toEqual({ ok: true });
    expect(calls[0]!.init.method).toBe("DELETE");
  });
});

describe("failures", () => {
  const failure = async (response: Response) => {
    const got = await spaceInfo(creds, serving(() => response).deps);
    return got.ok ? null : got.failure.kind;
  };

  test("maps statuses and reasons to one kind each", async () => {
    expect(await failure(json(404, { reason: "not-found", error: "no" }))).toBe("not-found");
    expect(await failure(json(404, { error: "nope" }))).toBe("unsupported");
    expect(await failure(new Response("<html>", { status: 404 }))).toBe("unsupported");
    expect(await failure(json(405, {}))).toBe("unsupported");
    expect(await failure(json(429, { reason: "rate-limited", error: "slow" }))).toBe("rate-limited");
    expect(await failure(json(429, { reason: "blocked", error: "no" }))).toBe("blocked");
    expect(await failure(json(413, { reason: "space-full", error: "full" }))).toBe("space-full");
    expect(await failure(json(413, { reason: "too-large", error: "big" }))).toBe("too-large");
    expect(await failure(json(400, { reason: "too-many-ops", error: "many" }))).toBe("too-large");
    expect(await failure(json(503, { reason: "disabled", error: "off" }))).toBe("unavailable");
    expect(await failure(json(403, { reason: "origin", error: "no" }))).toBe("unavailable");
    expect(await failure(json(500, { reason: "server", error: "oops" }))).toBe("unavailable");
  });

  test("rate-limited and blocked carry Retry-After when the service sends it", async () => {
    const limited = (reason: string, retryAfter?: string) =>
      new Response(JSON.stringify({ reason, error: "x" }), {
        status: 429,
        headers: retryAfter ? { "Retry-After": retryAfter } : {},
      });
    const kindOf = async (response: Response) => {
      const got = await spaceInfo(creds, serving(() => response).deps);
      return got.ok ? null : got.failure;
    };
    expect(await kindOf(limited("rate-limited", "30"))).toEqual({ kind: "rate-limited", retryAfterSeconds: 30 });
    expect(await kindOf(limited("blocked", "3600"))).toEqual({ kind: "blocked", retryAfterSeconds: 3600 });
    expect(await kindOf(limited("rate-limited"))).toEqual({ kind: "rate-limited" });
    expect(await kindOf(limited("rate-limited", "soon"))).toEqual({ kind: "rate-limited" });
  });

  test("a changes page that doesn't fit the cursor is unavailable", async () => {
    const record = (version: number) => ({ key: KEY_A, version, deleted: true });
    const page = (body: unknown, since: number) => changes(creds, since, serving(() => json(200, body)).deps);
    expect((await page({ cursor: 5, more: false, records: [record(6)] }, 4)).ok).toBe(false); // beyond the cursor
    expect((await page({ cursor: 5, more: false, records: [record(4)] }, 4)).ok).toBe(false); // not after since
    expect((await page({ cursor: 6, more: false, records: [record(6), record(5)] }, 4)).ok).toBe(false); // descending
    expect((await page({ cursor: 3, more: false, records: [] }, 4)).ok).toBe(false); // cursor went back
    expect((await page({ cursor: 4, more: true, records: [] }, 4)).ok).toBe(false); // more, but no progress
    expect((await page({ cursor: 4, more: false, records: [] }, 4)).ok).toBe(true);
    expect((await page({ cursor: 6, more: true, records: [record(5), record(6)] }, 4)).ok).toBe(true);
  });

  test("no service, a network error and a timeout are unavailable", async () => {
    expect(await spaceInfo(creds, { baseUrl: null, fetch })).toEqual({ ok: false, failure: { kind: "unavailable" } });
    const offline: SyncDeps = {
      baseUrl: BASE,
      fetch: (async () => {
        throw new TypeError("offline");
      }) as typeof fetch,
    };
    expect(await spaceInfo(creds, offline)).toEqual({ ok: false, failure: { kind: "unavailable" } });
    expect(SYNC_TIMEOUT_MS).toBe(20_000);
  });

  test("the timeout signal is passed and aborts", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    await spaceInfo(creds, serving(() => json(200, INFO)).deps);
    expect(spy).toHaveBeenCalledWith(SYNC_TIMEOUT_MS);
    spy.mockRestore();
  });

  test("a body that doesn't match the protocol is unavailable, never trusted", async () => {
    const bad = async (response: Response, call: (deps: SyncDeps) => Promise<{ ok: boolean }>) =>
      (await call(serving(() => response).deps)).ok;
    expect(await bad(json(200, { cursor: "3" }), (d) => spaceInfo(creds, d))).toBe(false);
    expect(await bad(json(200, { ...INFO, records: -1 }), (d) => spaceInfo(creds, d))).toBe(false);
    expect(await bad(new Response("not json", { status: 200 }), (d) => spaceInfo(creds, d))).toBe(false);
    expect(
      await bad(json(200, { cursor: 1, more: false, records: [{ key: "short", version: 1, deleted: true }] }), (d) =>
        changes(creds, 0, d),
      ),
    ).toBe(false);
    expect(
      await bad(json(200, { cursor: 1, more: false, records: [{ key: KEY_A, version: 1, deleted: false }] }), (d) =>
        changes(creds, 0, d),
      ),
    ).toBe(false);
    const ops: SyncOp[] = [{ key: KEY_A, baseVersion: 0, data: "a" }];
    // A result for a different key, or the wrong number of results.
    expect(
      await bad(json(200, { cursor: 1, results: [{ key: KEY_B, ok: true, version: 1 }] }), (d) => batch(creds, ops, d)),
    ).toBe(false);
    expect(await bad(json(200, { cursor: 1, results: [] }), (d) => batch(creds, ops, d))).toBe(false);
    expect(
      await bad(json(200, { cursor: 1, results: [{ key: KEY_A, ok: false, reason: "other", version: 1 }] }), (d) =>
        batch(creds, ops, d),
      ),
    ).toBe(false);
    const got = await createSpace(creds, serving(() => json(201, { nope: true })).deps);
    expect(got).toEqual({ ok: false, failure: { kind: "unavailable" } });
  });

  test("an unexpected success status is a failure", async () => {
    expect(await deleteSpace(creds, serving(() => json(200, {})).deps)).toMatchObject({ ok: false });
  });
});
