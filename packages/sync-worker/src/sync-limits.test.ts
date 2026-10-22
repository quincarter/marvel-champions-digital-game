import { describe, expect, it } from "vitest";
import { handleRequest, type HandlerDeps } from "./handler.js";
import { SYNC_LIMITER_ROWS, SYNC_ROWS_PER_DAY } from "./rate-limiter.js";
import {
  DEFAULT_MAX_SPACE_BYTES,
  MAX_CHANGES_PAGE_BYTES,
  MAX_RECORD_BYTES,
  type SpaceInfo,
  type SyncBatchResult,
  type SyncChanges,
  type SyncError,
  type SyncOp,
} from "./sync-protocol.js";
import { ALARM_SLACK_MS, OPS_PER_HOUR, SyncSpaceLogic } from "./sync-space.js";
import { makeEnv, MemoryStorage, type TestEnv } from "./test-support.js";

const SPACE = "a1".repeat(16);
const TOKEN = "T".repeat(43);
const HOUR = 60 * 60 * 1000;

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
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const create = (call: Call, space = SPACE, token = TOKEN) => call(req("POST", `/sync/${space}`, token));
const info = (call: Call) => call(req("GET", `/sync/${SPACE}`));
const changes = (call: Call, since: number) => call(req("GET", `/sync/${SPACE}/changes?since=${since}`));
const batch = (call: Call, ops: SyncOp[]) => call(req("POST", `/sync/${SPACE}/batch`, TOKEN, { ops }));

const key = (n: number) => String(n).padStart(43, "k");
const data = (bytes: number) => "A".repeat(Math.ceil((bytes * 4) / 3));
const put = (n: number, baseVersion = 0, bytes = 3): SyncOp => ({ key: key(n), baseVersion, data: data(bytes) });
const json = async <T>(res: Response): Promise<T> => (await res.json()) as T;
const space = (n: number) => String(n).padStart(32, "0");

const limiterOf = (env: TestEnv) => env.RATE_LIMITER.instances.get("ip:unknown")!;
const limiterState = (env: TestEnv) =>
  limiterOf(env).storage.map.get("state") as {
    syncFailures: unknown[];
    syncRows: { h: number; n: number }[];
    syncCreates: number[];
  };
const rowsCharged = (env: TestEnv) => limiterState(env).syncRows.reduce((sum, b) => sum + b.n, 0);

describe("write budgets", () => {
  it("charges the rows a batch wrote, plus the limiter's own, to the IP's daily budget", async () => {
    const { call, env } = setup();
    await create(call);
    const before = rowsCharged(env);
    expect((await batch(call, [put(1), put(2)])).status).toBe(200);
    // meta + 2 rows per new record, and the limiter's count and refund.
    expect(rowsCharged(env) - before).toBe(1 + 2 * 2 + SYNC_LIMITER_ROWS);
  });

  it("refuses sync requests from an IP that used its 5,000 rows in 24 hours, until they age out", async () => {
    const { call, env, clock } = setup();
    await create(call);
    limiterState(env).syncRows.push({ h: Math.floor(clock.now / HOUR) * HOUR, n: SYNC_ROWS_PER_DAY });
    const spaceRows = env.SYNC_SPACE.instances.get(SPACE)!.storage.rowsWritten;
    const limiterRows = limiterOf(env).storage.rowsWritten;

    const refused = await batch(call, [put(1)]);
    expect(refused.status).toBe(429);
    expect((await json<SyncError>(refused)).reason).toBe("rate-limited");
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(env.SYNC_SPACE.instances.get(SPACE)!.storage.rowsWritten).toBe(spaceRows);
    // A refusal writes nothing in the limiter either.
    expect(limiterOf(env).storage.rowsWritten).toBe(limiterRows);

    // Another address is unaffected.
    const elsewhere = await call(req("GET", `/sync/${SPACE}`, TOKEN, undefined, { "CF-Connecting-IP": "9.9.9.9" }));
    expect(elsewhere.status).toBe(200);

    clock.now += 24 * HOUR + 1;
    expect((await batch(call, [put(1)])).status).toBe(200);
  });

  it("caps a space at 1,500 ops an hour", async () => {
    const { call, clock } = setup();
    await create(call);
    const hundred = (from: number) => Array.from({ length: 100 }, (_, i) => put(from + i));
    for (let i = 0; i < OPS_PER_HOUR / 100; i++) {
      expect((await batch(call, hundred(i * 100))).status).toBe(200);
      clock.now += 1000;
    }
    const refused = await batch(call, [put(9000)]);
    expect(refused.status).toBe(429);
    expect((await json<SyncError>(refused)).reason).toBe("rate-limited");
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    clock.now += HOUR;
    expect((await batch(call, [put(9000)])).status).toBe(200);
  });

  it("issues every write of a batch together, before any of them resolves", async () => {
    const storage = new MemoryStorage();
    const events: string[] = [];
    const later = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
      events.push(`start ${name}`);
      const result = await run();
      await new Promise((resolve) => setTimeout(resolve, 0));
      events.push(`end ${name}`);
      return result;
    };
    const slow = Object.create(storage) as MemoryStorage;
    slow.put = ((...args: unknown[]) =>
      later("put", () => (storage.put as (...a: unknown[]) => Promise<void>)(...args))) as MemoryStorage["put"];
    slow.delete = ((...args: unknown[]) =>
      later("delete", () =>
        (storage.delete as (...a: unknown[]) => Promise<unknown>)(...args),
      )) as MemoryStorage["delete"];
    slow.setAlarm = (time: number) => later("alarm", () => storage.setAlarm(time));
    const logic = new SyncSpaceLogic(slow);
    const big = 1 << 30;
    await logic.create(TOKEN, 1000, big);
    const firstOps = Array.from({ length: 100 }, (_, i) => put(i));
    await logic.batch(TOKEN, JSON.stringify({ ops: firstOps }), 1000, big);
    events.length = 0;
    // Rewrites: 200 index and stub rows plus meta in two put calls, 100 deletes in one, and the day-old alarm.
    const rewrites = Array.from({ length: 100 }, (_, i) => put(i, i + 1));
    await logic.batch(TOKEN, JSON.stringify({ ops: rewrites }), 1000 + 2 * ALARM_SLACK_MS, big);
    const firstEnd = events.findIndex((e) => e.startsWith("end"));
    expect(events.slice(0, firstEnd)).toEqual(["start put", "start put", "start delete", "start alarm"]);
    expect(events).toHaveLength(8);
  });
});

describe("creating spaces", () => {
  it("gives one IP 3 new spaces a day, and gives the slot back when no new space was made", async () => {
    const { call, env, clock } = setup();
    for (let i = 0; i < 5; i++) expect((await create(call)).status).toBe(i === 0 ? 201 : 200);
    expect((await create(call, SPACE, "U".repeat(43))).status).toBe(404);
    expect(limiterState(env).syncCreates).toHaveLength(1);

    expect((await create(call, space(2))).status).toBe(201);
    expect((await create(call, space(3))).status).toBe(201);
    const refused = await create(call, space(4));
    expect(refused.status).toBe(429);
    expect((await json<SyncError>(refused)).reason).toBe("rate-limited");
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(env.SYNC_SPACE.instances.get(space(4))?.storage.map.size ?? 0).toBe(0);
    // An existing space still confirms; only new ones are limited.
    expect((await create(call, space(3))).status).toBe(200);

    clock.now += 24 * HOUR + 1;
    expect((await create(call, space(4))).status).toBe(201);
  });

  it("tells an over-quota create for an unknown space 429, not 404, whatever token it carries", async () => {
    const { call, env } = setup();
    for (let n = 1; n <= 3; n++) await create(call, space(n));
    for (const token of [TOKEN, "U".repeat(43)]) {
      const res = await create(call, space(9), token);
      expect(res.status).toBe(429);
      expect((await json<SyncError>(res)).reason).toBe("rate-limited");
      expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(1);
    }
    // A wrong token on an existing space is the same answer, so nothing is revealed.
    expect((await create(call, space(1), "U".repeat(43))).status).toBe(429);
    expect(env.SYNC_SPACE.instances.get(space(9))?.storage.map.size ?? 0).toBe(0);
  });

  it("does not count a refused create as a failed attempt", async () => {
    const { call, env } = setup();
    for (let n = 1; n <= 3; n++) await create(call, space(n));
    for (let n = 4; n <= 12; n++) expect((await create(call, space(n))).status).toBe(429);
    expect(limiterState(env).syncFailures).toEqual([]);
  });

  it("needs a Turnstile token when TURNSTILE_SECRET is set, on create only", async () => {
    const { call } = setup({ TURNSTILE_SECRET: "secret" });
    const missing = await create(call);
    expect(missing.status).toBe(403);
    expect((await json<SyncError>(missing)).reason).toBe("turnstile");
    const ok = await call(req("POST", `/sync/${SPACE}`, TOKEN, undefined, { "CF-Turnstile-Response": "token" }));
    expect(ok.status).toBe(201);
    expect((await info(call)).status).toBe(200);
  });
});

describe("changes", () => {
  it("stops a page at about 2 MiB of data, always returns one record, and sets `more` from the cursor", async () => {
    const { call } = setup({ MAX_SPACE_BYTES: String(100 * 1024 * 1024) });
    await create(call);
    // Each is 512 KiB decoded, about 700 KB encoded: two fit in 2 MiB, a third does not.
    const ops = [put(1, 0, MAX_RECORD_BYTES), put(2, 0, MAX_RECORD_BYTES), put(3, 0, MAX_RECORD_BYTES)];
    expect((await batch(call, ops)).status).toBe(200);
    const first = await json<SyncChanges>(await changes(call, 0));
    expect(first.records.map((r) => r.version)).toEqual([1, 2]);
    expect(first.more).toBe(true);
    expect(first.cursor).toBe(2);
    const sent = first.records.reduce((sum, r) => sum + (r.data?.length ?? 0), 0);
    expect(sent).toBeLessThanOrEqual(MAX_CHANGES_PAGE_BYTES);
    const second = await json<SyncChanges>(await changes(call, first.cursor));
    expect(second.records.map((r) => r.version)).toEqual([3]);
    expect(second.more).toBe(false);
  });

  it("carries the epoch, and answers a since beyond the cursor with the real cursor and no records", async () => {
    const { call, clock } = setup();
    await create(call);
    await batch(call, [put(1)]);
    const ahead = await json<SyncChanges>(await changes(call, 50));
    expect(ahead).toEqual({ cursor: 1, epoch: 1_000_000, more: false, records: [] });

    await call(req("DELETE", `/sync/${SPACE}`));
    clock.now += 5000;
    await create(call);
    const fresh = await json<SyncChanges>(await changes(call, 50));
    expect(fresh).toEqual({ cursor: 0, epoch: 1_005_000, more: false, records: [] });
    expect((await json<SpaceInfo>(await info(call))).epoch).toBe(1_005_000);
  });
});

describe("failures inside the Worker", () => {
  it("still answers a committed batch when the refund call fails", async () => {
    const { call, env } = setup();
    await create(call);
    const limiter = env.RATE_LIMITER;
    const realGet = limiter.get.bind(limiter);
    limiter.get = (id) => {
      const stub = realGet(id);
      return {
        fetch: (request: Request) =>
          new URL(request.url).pathname === "/sync-refund"
            ? Promise.reject(new Error("limiter down"))
            : stub.fetch(request),
      };
    };
    const res = await batch(call, [put(1)]);
    expect(res.status).toBe(200);
    expect((await json<SyncBatchResult>(res)).results[0]).toMatchObject({ ok: true });
    expect(env.SYNC_SPACE.instances.get(SPACE)!.storage.map.has("v:000000000001")).toBe(true);
  });

  it("answers 500 for a space that throws, without counting a failure or keeping a create slot", async () => {
    const { call, env } = setup();
    env.SYNC_SPACE.get = () => ({ fetch: () => Promise.reject(new Error("boom")) });
    const res = await create(call);
    expect(res.status).toBe(500);
    expect((await json<SyncError>(res)).reason).toBe("server");
    expect(limiterState(env).syncFailures).toEqual([]);
    expect(limiterState(env).syncCreates).toEqual([]);
  });

  it("does not write limiter state for a refused request", async () => {
    const { call, env } = setup();
    await create(call);
    for (let i = 0; i < 299; i++) await info(call);
    const writes = limiterOf(env).storage.rowsWritten;
    expect((await info(call)).status).toBe(429);
    expect(limiterOf(env).storage.rowsWritten).toBe(writes);
  });

  it("does not write limiter state for a refused transfer upload", async () => {
    const { call, env } = setup();
    const upload = () =>
      call(
        new Request("https://sync.test/transfer", {
          method: "POST",
          headers: { "X-Transfer-Proof": "A".repeat(43) },
          body: "x",
        }),
      );
    for (let i = 0; i < 10; i++) expect((await upload()).status).toBe(201);
    const writes = limiterOf(env).storage.rowsWritten;
    expect((await upload()).status).toBe(429);
    expect(limiterOf(env).storage.rowsWritten).toBe(writes);
  });

  it("falls back to the default space cap when the object gets no usable X-Max-Bytes", async () => {
    const { env } = setup();
    const stub = env.SYNC_SPACE.get(env.SYNC_SPACE.idFromName(SPACE));
    const headers = { Authorization: `Bearer ${TOKEN}`, "X-Max-Bytes": "junk" };
    const res = await stub.fetch(new Request("https://space/create", { method: "POST", headers }));
    expect((await json<SpaceInfo>(res)).maxBytes).toBe(DEFAULT_MAX_SPACE_BYTES);
  });
});

describe("the two kill switches are independent", () => {
  it("keeps sync working when transfers are off", async () => {
    const { call } = setup({ TRANSFERS_ENABLED: "false" });
    expect((await create(call)).status).toBe(201);
    expect((await batch(call, [put(1)])).status).toBe(200);
    const transfer = await call(new Request("https://sync.test/transfer", { method: "POST" }));
    expect(transfer.status).toBe(503);
  });
});
