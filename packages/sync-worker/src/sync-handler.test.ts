import { describe, expect, it } from "vitest";
import { handleRequest, type HandlerDeps } from "./handler.js";
import { ALARM_SLACK_MS, BATCHES_PER_HOUR } from "./sync-space.js";
import {
  MAX_BATCH_BYTES,
  MAX_BATCH_OPS,
  MAX_CHANGES_PAGE,
  MAX_RECORD_BYTES,
  DEFAULT_MAX_SPACE_BYTES,
  RECORD_ROW_OVERHEAD_BYTES,
  SPACE_IDLE_TTL_MS,
  type SpaceInfo,
  type SyncBatchResult,
  type SyncChanges,
  type SyncError,
  type SyncOp,
} from "./sync-protocol.js";
import { makeEnv, type TestEnv } from "./test-support.js";

const ORIGIN = "https://marvel-champions-digital-game.netlify.app";
const SPACE = "a1".repeat(16);
const TOKEN = "T".repeat(43);
const OTHER_TOKEN = "U".repeat(43);

function setup(overrides: Parameters<typeof makeEnv>[0] = {}) {
  const clock = { now: 1_000_000 };
  const env = makeEnv(overrides);
  const deps: HandlerDeps = {
    now: () => clock.now,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    fetch: async () => Response.json({ success: true }),
  };
  const call = (request: Request, e: TestEnv = env) => handleRequest(request, e, deps);
  return { clock, env, call };
}
type Call = ReturnType<typeof setup>["call"];

const req = (method: string, path: string, token: string | null = TOKEN, body?: unknown, headers = {}) =>
  new Request(`https://sync.test${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });

const create = (call: Call, token: string | null = TOKEN, space = SPACE) => call(req("POST", `/sync/${space}`, token));
const info = (call: Call, token: string | null = TOKEN) => call(req("GET", `/sync/${SPACE}`, token));
const changes = (call: Call, since: number | string = 0, token: string | null = TOKEN) =>
  call(req("GET", `/sync/${SPACE}/changes?since=${since}`, token));
const batch = (call: Call, ops: unknown, token: string | null = TOKEN) =>
  call(req("POST", `/sync/${SPACE}/batch`, token, { ops }));

const key = (n: number) => String(n).padStart(43, "k");
/** Valid base64url that decodes to `bytes` bytes. */
const data = (bytes: number) => "A".repeat(Math.ceil((bytes * 4) / 3));
/** What a record of `bytes` decoded bytes counts toward the space cap. */
const stored = (bytes: number) => data(bytes).length + RECORD_ROW_OVERHEAD_BYTES;
const put = (n: number, baseVersion = 0, bytes = 3): SyncOp => ({ key: key(n), baseVersion, data: data(bytes) });
const del = (n: number, baseVersion: number): SyncOp => ({ key: key(n), baseVersion, deleted: true });

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
async function runBatch(call: Call, ops: SyncOp[]) {
  const res = await batch(call, ops);
  expect(res.status).toBe(200);
  return json<SyncBatchResult>(res);
}

describe("creating a space", () => {
  it("creates on an empty space, confirms for the same token, refuses another without revealing it", async () => {
    const { call, clock, env } = setup();
    const first = await create(call);
    expect(first.status).toBe(201);
    expect(first.headers.get("Cache-Control")).toBe("no-store");
    expect(await json<SpaceInfo>(first)).toEqual({
      cursor: 0,
      epoch: clock.now,
      bytes: 0,
      maxBytes: DEFAULT_MAX_SPACE_BYTES,
      records: 0,
      createdAt: clock.now,
    });

    clock.now += 1000;
    const again = await create(call);
    expect(again.status).toBe(200);
    expect((await json<SpaceInfo>(again)).createdAt).toBe(1_000_000);

    const other = await create(call, OTHER_TOKEN);
    expect(other.status).toBe(404);
    expect((await json<SyncError>(other)).reason).toBe("not-found");
    expect((await info(call)).status).toBe(200);
    expect((await info(call, OTHER_TOKEN)).status).toBe(404);
    expect(JSON.stringify([...env.SYNC_SPACE.instances.get(SPACE)!.storage.map])).not.toContain(TOKEN);
  });

  it("answers GET on a space that was never created with the same 404 as a wrong token", async () => {
    const { call } = setup();
    const res = await info(call);
    expect(res.status).toBe(404);
    expect((await json<SyncError>(res)).reason).toBe("not-found");
  });

  it("reports the MAX_SPACE_BYTES var in the space info", async () => {
    const { call } = setup({ MAX_SPACE_BYTES: "5000" });
    expect((await json<SpaceInfo>(await create(call))).maxBytes).toBe(5000);
  });
});

describe("auth failures and rate limits", () => {
  it("treats a bad space id, a bad or missing token as not-found failures", async () => {
    const { call, env } = setup();
    expect((await create(call, TOKEN, "short")).status).toBe(404);
    expect((await create(call, "not a token")).status).toBe(404);
    expect((await create(call, null)).status).toBe(404);
    expect(env.RATE_LIMITER.instances.get("ip:unknown")!.storage.map.get("state")).toMatchObject({
      syncFailures: [
        { t: expect.any(Number), s: "invalid" },
        { t: expect.any(Number), s: "a1".repeat(16) },
        { t: expect.any(Number), s: "a1".repeat(16) },
      ],
    });
    expect(env.SYNC_SPACE.instances.size).toBe(0);
  });

  it("blocks an IP once failures span 5 space ids, refunds good requests, and keeps transfer separate", async () => {
    const { call, clock } = setup();
    await create(call);
    for (let i = 0; i < 30; i++) expect((await info(call)).status).toBe(200);

    const stranger = (n: number) => call(req("GET", `/sync/${String(n).padStart(32, "0")}`));
    for (let n = 1; n <= 5; n++) expect((await stranger(n)).status).toBe(404);
    const blocked = await info(call);
    expect(blocked.status).toBe(429);
    expect((await json<SyncError>(blocked)).reason).toBe("blocked");
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);

    const transfer = await call(
      new Request("https://sync.test/transfer/ZZZZZZZZ", { headers: { "X-Transfer-Proof": "A".repeat(43) } }),
    );
    expect(transfer.status).toBe(404);

    clock.now += 60 * 60 * 1000 + 1;
    expect((await info(call)).status).toBe(200);
  });

  it("does not block a network for one stale device polling a deleted space, until 60 failures", async () => {
    const { call } = setup();
    for (let i = 0; i < 59; i++) expect((await info(call)).status).toBe(404);
    expect((await json<SyncError>(await info(call))).reason).toBe("not-found");
    expect((await json<SyncError>(await info(call))).reason).toBe("blocked");
    // Four other space ids in the same window would not have blocked it either.
    const other = setup();
    for (let n = 1; n <= 4; n++) await other.call(req("GET", `/sync/${String(n).padStart(32, "0")}`));
    expect((await other.call(req("POST", `/sync/${SPACE}`))).status).toBe(201);
  });

  it("does not let wrong transfer codes block sync", async () => {
    const { call } = setup();
    await create(call);
    for (let i = 0; i < 5; i++)
      await call(
        new Request("https://sync.test/transfer/ZZZZZZZZ", { headers: { "X-Transfer-Proof": "A".repeat(43) } }),
      );
    expect(
      (
        await call(
          new Request("https://sync.test/transfer/ZZZZZZZZ", { headers: { "X-Transfer-Proof": "A".repeat(43) } }),
        )
      ).status,
    ).toBe(429);
    expect((await info(call)).status).toBe(200);
  });

  it("caps requests per IP per 10 minutes without counting the refused one as a failure", async () => {
    const { call, clock } = setup();
    await create(call);
    for (let i = 0; i < 299; i++) expect((await info(call)).status).toBe(200);
    const refused = await info(call);
    expect(refused.status).toBe(429);
    expect((await json<SyncError>(refused)).reason).toBe("rate-limited");
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    clock.now += 10 * 60 * 1000 + 1;
    expect((await info(call)).status).toBe(200);
  });

  it("treats unknown routes and methods as not-found without counting anything", async () => {
    const { call, env } = setup();
    expect((await call(req("PUT", `/sync/${SPACE}`))).status).toBe(404);
    expect((await call(req("GET", `/sync/${SPACE}/batch`))).status).toBe(404);
    expect((await call(req("GET", `/sync/${SPACE}/other`))).status).toBe(404);
    expect((await call(req("GET", "/sync"))).status).toBe(404);
    expect(env.RATE_LIMITER.instances.size).toBe(0);
  });
});

describe("batches", () => {
  it("accepts new records and assigns the next versions in order", async () => {
    const { call } = setup();
    await create(call);
    const result = await runBatch(call, [put(1, 0, 10), put(2, 0, 20)]);
    expect(result).toEqual({
      cursor: 2,
      results: [
        { key: key(1), ok: true, version: 1 },
        { key: key(2), ok: true, version: 2 },
      ],
    });
    expect(await json<SpaceInfo>(await info(call))).toMatchObject({
      cursor: 2,
      bytes: stored(10) + stored(20),
      records: 2,
    });
  });

  it("refuses a stale base as a conflict and applies the other ops", async () => {
    const { call } = setup();
    await create(call);
    await runBatch(call, [put(1)]);
    await runBatch(call, [put(1, 1)]);
    const result = await runBatch(call, [put(1, 1), put(2, 0)]);
    expect(result.results).toEqual([
      { key: key(1), ok: false, reason: "conflict", version: 2 },
      { key: key(2), ok: true, version: 3 },
    ]);
    expect(result.cursor).toBe(3);
  });

  it("refuses a new-key write when the key exists, and a base on a key that does not", async () => {
    const { call } = setup();
    await create(call);
    await runBatch(call, [put(1)]);
    const result = await runBatch(call, [put(1, 0), put(9, 4)]);
    expect(result.results).toEqual([
      { key: key(1), ok: false, reason: "conflict", version: 1 },
      { key: key(9), ok: false, reason: "conflict", version: 0 },
    ]);
    expect(result.cursor).toBe(1);
  });

  it("applies two ops on one key in order, the later naming the earlier one's version", async () => {
    const { call } = setup();
    await create(call);
    const result = await runBatch(call, [put(1, 0, 6), put(1, 1, 9), put(1, 1, 3)]);
    expect(result.results.map((r) => r.ok)).toEqual([true, true, false]);
    const list = await json<SyncChanges>(await changes(call));
    expect(list.records).toEqual([{ key: key(1), version: 2, deleted: false, data: data(9) }]);
    expect(await json<SpaceInfo>(await info(call))).toMatchObject({ bytes: stored(9), records: 1 });
  });

  it("keeps a tombstone, frees its bytes, and lets it be written again from its version", async () => {
    const { call } = setup();
    await create(call);
    await runBatch(call, [put(1, 0, 30), put(2, 0, 30)]);
    const result = await runBatch(call, [del(1, 1)]);
    expect(result.results).toEqual([{ key: key(1), ok: true, version: 3 }]);
    expect(await json<SpaceInfo>(await info(call))).toMatchObject({
      bytes: stored(30) + RECORD_ROW_OVERHEAD_BYTES,
      records: 1,
      cursor: 3,
    });

    const list = await json<SyncChanges>(await changes(call));
    expect(list.records).toEqual([
      { key: key(2), version: 2, deleted: false, data: data(30) },
      { key: key(1), version: 3, deleted: true },
    ]);
    expect((await runBatch(call, [put(1, 1)])).results[0]).toMatchObject({ ok: false, version: 3 });
    expect((await runBatch(call, [put(1, 3, 12)])).results[0]).toEqual({ key: key(1), ok: true, version: 4 });
    expect(await json<SpaceInfo>(await info(call))).toMatchObject({ bytes: stored(30) + stored(12), records: 2 });
  });

  it("returns changes in version order, one index row per record, and pages with `more`", async () => {
    const { call, env } = setup();
    await create(call);
    const total = MAX_CHANGES_PAGE + 5;
    for (let from = 0; from < total; from += MAX_BATCH_OPS) {
      const ops = Array.from({ length: Math.min(MAX_BATCH_OPS, total - from) }, (_, i) => put(from + i));
      await runBatch(call, ops);
    }
    // Rewriting an early record moves it to the end of the order and leaves one index row.
    await runBatch(call, [put(0, 1, 6)]);
    const { storage } = env.SYNC_SPACE.instances.get(SPACE)!;
    expect([...storage.map.keys()].filter((k) => k.startsWith("v:"))).toHaveLength(total);

    const first = await json<SyncChanges>(await changes(call, 0));
    expect(first.records).toHaveLength(MAX_CHANGES_PAGE);
    expect(first.more).toBe(true);
    expect(first.records.map((r) => r.version)).toEqual(Array.from({ length: MAX_CHANGES_PAGE }, (_, i) => i + 2));
    expect(first.cursor).toBe(MAX_CHANGES_PAGE + 1);

    const second = await json<SyncChanges>(await changes(call, first.cursor));
    expect(second.more).toBe(false);
    expect(second.records.map((r) => r.version)).toEqual([
      MAX_CHANGES_PAGE + 2,
      MAX_CHANGES_PAGE + 3,
      MAX_CHANGES_PAGE + 4,
      MAX_CHANGES_PAGE + 5,
      MAX_CHANGES_PAGE + 6,
    ]);
    expect(second.records.at(-1)).toMatchObject({ key: key(0), data: data(6) });
    expect(second.cursor).toBe(MAX_CHANGES_PAGE + 6);

    const none = await json<SyncChanges>(await changes(call, second.cursor));
    expect(none).toEqual({ cursor: MAX_CHANGES_PAGE + 6, epoch: 1_000_000, more: false, records: [] });
  });

  it("rejects a bad since and a malformed batch", async () => {
    const { call } = setup();
    await create(call);
    expect((await changes(call, "-1")).status).toBe(400);
    expect((await changes(call, "abc")).status).toBe(400);
    const bads: unknown[] = [
      "not json",
      {},
      { ops: [] },
      { ops: [{ key: "short", baseVersion: 0, data: "AAAA" }] },
      { ops: [{ key: key(1), baseVersion: -1, data: "AAAA" }] },
      { ops: [{ key: key(1), baseVersion: 1.5, data: "AAAA" }] },
      { ops: [{ key: key(1), baseVersion: 0 }] },
      { ops: [{ key: key(1), baseVersion: 0, data: "AA==" }] },
      { ops: [{ key: key(1), baseVersion: 0, data: "" }] },
      { ops: [{ key: key(1), baseVersion: 0, deleted: true, data: "AAAA" }] },
      { ops: [null] },
    ];
    for (const body of bads) {
      const res = await call(req("POST", `/sync/${SPACE}/batch`, TOKEN, body));
      expect(res.status).toBe(400);
      expect((await json<SyncError>(res)).reason).toBe("bad-request");
    }
    expect((await json<SpaceInfo>(await info(call))).cursor).toBe(0);
  });

  it("enforces the record, batch-byte and batch-op caps and writes nothing when refused", async () => {
    const { call, env } = setup({ MAX_SPACE_BYTES: String(100 * 1024 * 1024) });
    await create(call);
    const rows = env.SYNC_SPACE.instances.get(SPACE)!.storage.map.size;

    const big = await batch(call, [put(1, 0, MAX_RECORD_BYTES + 1)]);
    expect(big.status).toBe(413);
    expect((await json<SyncError>(big)).reason).toBe("too-large");
    expect((await batch(call, [put(1, 0, MAX_RECORD_BYTES)])).status).toBe(200);

    // Four records of the maximum size are exactly MAX_BATCH_BYTES; three more bytes tip it over.
    const full = Array.from({ length: MAX_BATCH_BYTES / MAX_RECORD_BYTES }, (_, i) => put(20 + i, 0, MAX_RECORD_BYTES));
    const heavy = await batch(call, [...full, put(30, 0, 3)]);
    expect(heavy.status).toBe(413);
    expect((await json<SyncError>(heavy)).reason).toBe("too-large");
    expect((await batch(call, full)).status).toBe(200);

    const tooMany = await batch(
      call,
      Array.from({ length: MAX_BATCH_OPS + 1 }, (_, i) => put(100 + i)),
    );
    expect(tooMany.status).toBe(400);
    expect((await json<SyncError>(tooMany)).reason).toBe("too-many-ops");
    expect(
      (
        await batch(
          call,
          Array.from({ length: MAX_BATCH_OPS }, (_, i) => put(100 + i)),
        )
      ).status,
    ).toBe(200);

    expect(env.SYNC_SPACE.instances.get(SPACE)!.storage.map.size).toBeGreaterThan(rows);
    expect((await json<SpaceInfo>(await info(call))).cursor).toBe(1 + full.length + MAX_BATCH_OPS);
  });

  it("refuses a body far over the cap before reading it all", async () => {
    const { call } = setup();
    await create(call);
    const res = await call(req("POST", `/sync/${SPACE}/batch`, TOKEN, "x".repeat(4 * 1024 * 1024)));
    expect(res.status).toBe(413);
  });

  it("refuses a batch that would push counted bytes over the space cap, and deletes free the data", async () => {
    const { call } = setup({ MAX_SPACE_BYTES: "1000" });
    await create(call);
    await runBatch(call, [put(1, 0, 450)]);

    const full = await batch(call, [put(2, 0, 450), put(3, 0, 10)]);
    expect(full.status).toBe(413);
    expect((await json<SyncError>(full)).reason).toBe("space-full");
    expect(await json<SpaceInfo>(await info(call))).toMatchObject({ cursor: 1, bytes: stored(450), records: 1 });

    // A rewrite that fits replaces the old bytes; one that does not is refused.
    expect((await batch(call, [put(1, 1, 600)])).status).toBe(200);
    expect((await batch(call, [put(1, 2, 710)])).status).toBe(413);

    // A batch that deletes and adds is judged on the total; the tombstone keeps its overhead.
    expect((await runBatch(call, [del(1, 2), put(2, 0, 600)])).results.every((r) => r.ok)).toBe(true);
    expect((await json<SpaceInfo>(await info(call))).bytes).toBe(RECORD_ROW_OVERHEAD_BYTES + stored(600));
    await runBatch(call, [del(2, 4)]);
    expect((await json<SpaceInfo>(await info(call))).bytes).toBe(2 * RECORD_ROW_OVERHEAD_BYTES);
    expect((await runBatch(call, [put(3, 0, 600)])).results[0]).toMatchObject({ ok: true });
  });

  it("does not count a conflicting op toward the space cap", async () => {
    const { call } = setup({ MAX_SPACE_BYTES: "1000" });
    await create(call);
    await runBatch(call, [put(1, 0, 10)]);
    const result = await runBatch(call, [put(1, 0, 5000)]);
    expect(result.results[0]).toMatchObject({ ok: false });
  });

  it("caps batches per space per hour (and ops, below)", async () => {
    const { call, clock } = setup();
    await create(call);
    for (let i = 0; i < BATCHES_PER_HOUR; i++) {
      expect((await batch(call, [put(i % 5, 0, 3)])).status).toBe(200);
      clock.now += 1000;
    }
    const refused = await batch(call, [put(50)]);
    expect(refused.status).toBe(429);
    expect((await json<SyncError>(refused)).reason).toBe("rate-limited");
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    // Reads are not batches.
    expect((await changes(call)).status).toBe(200);
    clock.now += 60 * 60 * 1000;
    expect((await batch(call, [put(50)])).status).toBe(200);
  });

  it("writes as few rows as the layout allows, in few put calls", async () => {
    const { call, env } = setup();
    await create(call);
    const { storage } = env.SYNC_SPACE.instances.get(SPACE)!;
    let before = storage.rowsWritten;
    await runBatch(call, [put(1), put(2), put(3)]);
    expect(storage.rowsWritten - before).toBe(1 + 3 * 2);
    before = storage.rowsWritten;
    await runBatch(call, [put(1, 1), del(2, 2)]);
    expect(storage.rowsWritten - before).toBe(1 + 2 * 3);
    before = storage.rowsWritten;
    await runBatch(call, [put(1, 0)]);
    expect(storage.rowsWritten - before).toBe(1);
  });
});

describe("deleting a space and idle expiry", () => {
  it("wipes everything and the alarm on DELETE, then the token is no longer known", async () => {
    const { call, env } = setup();
    await create(call);
    await runBatch(call, [put(1)]);
    const { storage } = env.SYNC_SPACE.instances.get(SPACE)!;
    expect((await call(req("DELETE", `/sync/${SPACE}`, OTHER_TOKEN))).status).toBe(404);
    expect(storage.map.size).toBeGreaterThan(0);

    const res = await call(req("DELETE", `/sync/${SPACE}`));
    expect(res.status).toBe(204);
    expect(storage.map.size).toBe(0);
    expect(storage.alarm).toBeNull();
    expect((await info(call)).status).toBe(404);
    expect((await create(call, OTHER_TOKEN)).status).toBe(201);
  });

  it("sets the idle alarm on create and pushes it out at most once a day", async () => {
    const { call, clock, env } = setup();
    await create(call);
    const { storage } = env.SYNC_SPACE.instances.get(SPACE)!;
    const first = clock.now + SPACE_IDLE_TTL_MS;
    expect(storage.alarm).toBe(first);

    clock.now += ALARM_SLACK_MS - 1;
    await info(call);
    await runBatch(call, [put(1)]);
    await changes(call);
    expect(storage.alarm).toBe(first);

    clock.now += 1;
    const before = storage.rowsWritten;
    await info(call);
    expect(storage.alarm).toBe(clock.now + SPACE_IDLE_TTL_MS);
    expect(storage.rowsWritten - before).toBe(1);
    expect((storage.map.get("meta") as { lastSeenAt: number }).lastSeenAt).toBe(clock.now);

    clock.now += ALARM_SLACK_MS;
    await runBatch(call, [put(2)]);
    expect(storage.alarm).toBe(clock.now + SPACE_IDLE_TTL_MS);
  });

  it("wipes the space when its alarm fires", async () => {
    const { call, env } = setup();
    await create(call);
    await runBatch(call, [put(1)]);
    const { storage, object } = env.SYNC_SPACE.instances.get(SPACE)!;
    await object.alarm();
    expect(storage.map.size).toBe(0);
    expect(storage.alarm).toBeNull();
  });

  it("treats a space past its idle time as gone even before the alarm runs, and lets it be created anew", async () => {
    const { call, clock } = setup();
    await create(call);
    clock.now += SPACE_IDLE_TTL_MS + 1;
    expect((await info(call)).status).toBe(404);
    clock.now += 1;
    expect((await create(call, OTHER_TOKEN)).status).toBe(201);
  });
});

describe("kill switch and CORS", () => {
  it("answers 503 disabled on every sync route when SYNC_ENABLED is not true, transfer unaffected", async () => {
    const { call } = setup({ SYNC_ENABLED: "false" });
    for (const request of [
      req("POST", `/sync/${SPACE}`),
      req("GET", `/sync/${SPACE}`),
      req("GET", `/sync/${SPACE}/changes?since=0`),
      req("POST", `/sync/${SPACE}/batch`, TOKEN, { ops: [] }),
      req("DELETE", `/sync/${SPACE}`),
    ]) {
      const res = await call(request);
      expect(res.status).toBe(503);
      expect((await json<SyncError>(res)).reason).toBe("disabled");
    }
    const transfer = await call(new Request("https://sync.test/transfer/ZZZZZZZZ"));
    expect(transfer.status).toBe(404);
  });

  it("allows the new methods and the Authorization header in a preflight, and refuses other origins", async () => {
    const { call } = setup();
    const preflight = (origin: string) =>
      new Request(`https://sync.test/sync/${SPACE}/batch`, {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "DELETE" },
      });
    const ok = await call(preflight(ORIGIN));
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(ok.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, DELETE, OPTIONS");
    expect(ok.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect((await call(preflight("https://evil.example"))).status).toBe(403);
  });

  it("adds CORS headers to sync answers, errors included", async () => {
    const { call } = setup();
    const headers = { Origin: ORIGIN };
    const created = await call(req("POST", `/sync/${SPACE}`, TOKEN, undefined, headers));
    expect(created.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const missing = await call(req("GET", `/sync/${SPACE}`, OTHER_TOKEN, undefined, headers));
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const gone = await call(req("DELETE", `/sync/${SPACE}`, TOKEN, undefined, headers));
    expect(gone.status).toBe(204);
    expect(gone.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });
});
