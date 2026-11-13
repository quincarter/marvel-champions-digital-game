import { describe, expect, it, vi } from "vitest";
import { handleRequest, type HandlerDeps } from "./handler.js";
import { generateReplayId } from "./replay-handler.js";
import { REPLAY_ID_ALPHABET, REPLAY_ID_PATTERN, type ReplayCreated, type ReplayError } from "./replay-protocol.js";
import { REPLAY_UPLOADS_PER_IP_PER_DAY } from "./rate-limiter.js";
import { DAY_MS as QUOTA_DAY_MS, ReplayQuotaLogic } from "./replay-quota.js";
import { makeEnv, MemoryStorage } from "./test-support.js";

const ORIGIN = "https://marvel-champions-digital-game.netlify.app";
const DAY_MS = 24 * 60 * 60 * 1000;

function setup(overrides: Parameters<typeof makeEnv>[0] = {}, fetchImpl?: typeof fetch) {
  const clock = { now: 1_000_000 };
  const env = makeEnv(overrides);
  const deps: { -readonly [K in keyof HandlerDeps]: HandlerDeps[K] } = {
    now: () => clock.now,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    fetch: fetchImpl ?? (async () => Response.json({ success: true })),
  };
  const call = (request: Request) => handleRequest(request, env, deps);
  return { clock, env, deps, call };
}

const REPLAY = "MCREPLAY1\nH4sIAAAAAAAAA6tWKkktLlGyUlAqSy0qzszPU7JSMNQzUNJRKi1OLYrPTFGyMjQAAI8eIa4kAAAA\n";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("https://sync.test/replay", { method: "POST", headers, body });
const get = (id: string, headers: Record<string, string> = {}) =>
  new Request(`https://sync.test/replay/${id}`, { headers });

async function upload(call: ReturnType<typeof setup>["call"], headers: Record<string, string> = {}) {
  const res = await call(post(REPLAY, headers));
  expect(res.status).toBe(201);
  return (await res.json()) as ReplayCreated;
}

describe("replay upload and fetch", () => {
  it("stores the text under a fresh id and serves it back, many times, with CORS and an immutable cache", async () => {
    const { call, env, clock } = setup();
    const created = await upload(call, { Origin: ORIGIN });
    expect(created.id).toMatch(REPLAY_ID_PATTERN);
    const stored = env.REPLAYS.objects.get(created.id)!;
    expect(stored.text).toBe(REPLAY);
    expect(stored.options.httpMetadata).toEqual({ contentType: "text/plain; charset=utf-8" });
    expect(stored.options.customMetadata).toEqual({ createdAt: new Date(clock.now).toISOString() });

    for (let i = 0; i < 2; i++) {
      const res = await call(get(created.id, { Origin: ORIGIN }));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(REPLAY);
      expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    }
  });

  it("does not touch the limiter on a read", async () => {
    const { call, env } = setup();
    const created = await upload(call, { "CF-Connecting-IP": "203.0.113.9" });
    await call(get(created.id, { "CF-Connecting-IP": "198.51.100.1" }));
    expect(env.RATE_LIMITER.instances.has("ip:198.51.100.1")).toBe(false);
  });

  it("accepts CRLF line breaks and a missing final break", async () => {
    const { call } = setup();
    expect((await call(post(REPLAY.replace(/\n/g, "\r\n")))).status).toBe(201);
    expect((await call(post(REPLAY.trimEnd()))).status).toBe(201);
  });

  it("retries with a new id when one is taken", async () => {
    const { call, env, deps } = setup();
    const first = await upload(call);
    const taken = Array.from(first.id, (ch) => REPLAY_ID_ALPHABET.indexOf(ch));
    let calls = 0;
    deps.randomBytes = (n) => {
      calls++;
      return calls === 1 ? Uint8Array.from(taken) : crypto.getRandomValues(new Uint8Array(n));
    };
    const second = await upload(call);
    expect(second.id).not.toBe(first.id);
    expect(env.REPLAYS.objects.get(first.id)!.text).toBe(REPLAY);
    expect(env.REPLAYS.puts).toBe(3);
  });

  it("gives up with 500 when every id it draws is taken", async () => {
    const { call, deps } = setup();
    deps.randomBytes = (n) => new Uint8Array(n);
    expect((await call(post(REPLAY))).status).toBe(201);
    const res = await call(post(REPLAY));
    expect(res.status).toBe(500);
    expect(((await res.json()) as ReplayError).reason).toBe("server");
  });

  it("draws ids from the whole alphabet", () => {
    expect(generateReplayId(() => Uint8Array.from({ length: 12 }, (_, i) => i * 21))).toMatch(REPLAY_ID_PATTERN);
    expect(generateReplayId(() => new Uint8Array(12).fill(255))).toBe("____________");
  });
});

describe("replay upload validation", () => {
  it("rejects anything that is not a replay file with 400 and stores nothing", async () => {
    const { call, env } = setup();
    const bodies = [
      "",
      "hello",
      "MCREPLAY1\n",
      "MCREPLAY2\nAAAA\n",
      "MCREPLAY1\nnot base64!\n",
      "MCREPLAY1\nH4sIAAAA\nAAAA\n",
      // Base64, but not of a gzip stream.
      "MCREPLAY1\nAAAA\n",
      "MCREPLAY1\neyJ2IjoxfQ==\n",
      '{"v":1}',
    ];
    for (const body of bodies) {
      const res = await call(post(body));
      expect(res.status, body).toBe(400);
      expect(((await res.json()) as ReplayError).reason).toBe("bad-request");
    }
    expect(env.REPLAYS.puts).toBe(0);
    expect(env.RATE_LIMITER.instances.size).toBe(0);
  });

  it("rejects by Content-Length and by the bytes actually read with 413", async () => {
    const { call, env } = setup();
    const big = `MCREPLAY1\nH4sI${"A".repeat(1000)}\n`;
    const declared = await call(post(big, { "Content-Length": String(big.length) }));
    expect(declared.status).toBe(413);
    expect(((await declared.json()) as ReplayError).reason).toBe("too-large");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("MCREPLAY1\nH4sI"));
        for (let i = 0; i < 3; i++) controller.enqueue(encoder.encode("A".repeat(400)));
        controller.close();
      },
    });
    const streamed = new Request("https://sync.test/replay", {
      method: "POST",
      headers: { "Content-Length": "10" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect((await call(streamed)).status).toBe(413);
    expect(env.REPLAYS.puts).toBe(0);
  });

  it("accepts exactly the cap", async () => {
    const { call } = setup();
    const body = `MCREPLAY1\nH4sI${"A".repeat(1000 - 15)}\n`;
    expect(new TextEncoder().encode(body).length).toBe(1000);
    expect((await call(post(body))).status).toBe(201);
  });

  it("falls back to 256 KiB when MAX_REPLAY_BYTES is not set", async () => {
    const { call, env } = setup();
    delete env.MAX_REPLAY_BYTES;
    const atCap = `MCREPLAY1\nH4sI${"A".repeat(256 * 1024 - 15)}\n`;
    expect(atCap.length).toBe(256 * 1024);
    expect((await call(post(atCap))).status).toBe(201);
    expect((await call(post(`${atCap}A`))).status).toBe(413);
    expect((await call(post(REPLAY, { "Content-Length": String(256 * 1024 + 1) }))).status).toBe(413);
  });
});

describe("replay ids", () => {
  it("answers an unknown id with 404 JSON", async () => {
    const { call } = setup();
    const res = await call(get("AAAAAAAAAAAA", { Origin: ORIGIN }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      reason: "not-found",
      error: "No replay matches that link. It may have expired.",
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  it("answers a malformed id with 400 without reading R2", async () => {
    const { call, env } = setup();
    for (const id of ["short", "AAAAAAAAAAAAA", "AAAAAAAAAAA!", "AAAAAAAAAA%2F", ""]) {
      const res = await call(get(id));
      expect(res.status, id).toBe(400);
      expect(((await res.json()) as ReplayError).reason).toBe("bad-request");
    }
    expect(env.REPLAYS.gets).toBe(0);
  });
});

describe("replay rate limit", () => {
  it("refuses one upload past the daily allowance from one IP with Retry-After; another IP is unaffected", async () => {
    const { call, clock } = setup();
    const ip = { "CF-Connecting-IP": "203.0.113.9" };
    for (let i = 0; i < REPLAY_UPLOADS_PER_IP_PER_DAY; i++) expect((await call(post(REPLAY, ip))).status).toBe(201);
    const refused = await call(post(REPLAY, ip));
    expect(refused.status).toBe(429);
    expect(((await refused.json()) as ReplayError).reason).toBe("rate-limited");
    expect(Number(refused.headers.get("Retry-After"))).toBe(DAY_MS / 1000);
    expect((await call(post(REPLAY, { "CF-Connecting-IP": "203.0.113.10" }))).status).toBe(201);
    clock.now += DAY_MS;
    expect((await call(post(REPLAY, ip))).status).toBe(201);
  });

  it("keeps its allowance apart from transfer uploads", async () => {
    const { call } = setup();
    const ip = { "CF-Connecting-IP": "203.0.113.9" };
    for (let i = 0; i < 12; i++) expect((await call(post(REPLAY, ip))).status).toBe(201);
    const transfer = new Request("https://sync.test/transfer", {
      method: "POST",
      headers: { ...ip, "X-Transfer-Proof": "A".repeat(43) },
      body: new Uint8Array([1, 2, 3]),
    });
    expect((await call(transfer)).status).toBe(201);
  });

  it("fails closed when the limiter errors", async () => {
    const { call, env } = setup();
    env.RATE_LIMITER.get = () => ({ fetch: async () => new Response("boom", { status: 500 }) });
    expect((await call(post(REPLAY))).status).toBe(500);
    expect(env.REPLAYS.puts).toBe(0);
  });
});

describe("replay origin, kill switch and Turnstile", () => {
  it("refuses other origins with 403 on both routes", async () => {
    const { call, env } = setup();
    const evil = { Origin: "https://evil.example" };
    for (const request of [post(REPLAY, evil), get("AAAAAAAAAAAA", evil)]) {
      const res = await call(request);
      expect(res.status).toBe(403);
      expect(((await res.json()) as ReplayError).reason).toBe("origin");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
    expect(env.REPLAYS.puts + env.REPLAYS.gets).toBe(0);
  });

  it("answers a preflight for an allowed origin", async () => {
    const { call } = setup();
    const res = await call(
      new Request("https://sync.test/replay", {
        method: "OPTIONS",
        headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  it("answers 503 JSON with CORS headers on both routes when REPLAYS_ENABLED is not true", async () => {
    for (const value of ["false", "", undefined]) {
      const { call, env } = setup();
      if (value === undefined) delete env.REPLAYS_ENABLED;
      else env.REPLAYS_ENABLED = value;
      for (const request of [post(REPLAY, { Origin: ORIGIN }), get("AAAAAAAAAAAA", { Origin: ORIGIN })]) {
        const res = await call(request);
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ reason: "disabled", error: "Replay links are turned off right now." });
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
      }
      expect(env.REPLAYS.puts + env.REPLAYS.gets).toBe(0);
    }
  });

  it("checks Turnstile on upload only when the secret is set", async () => {
    const siteverify = vi.fn(async () => Response.json({ success: false }));
    const open = setup({}, siteverify as unknown as typeof fetch);
    expect((await open.call(post(REPLAY))).status).toBe(201);
    expect(siteverify).not.toHaveBeenCalled();

    const guarded = setup({ TURNSTILE_SECRET: "s" }, siteverify as unknown as typeof fetch);
    expect((await guarded.call(post(REPLAY))).status).toBe(403);
    const res = await guarded.call(post(REPLAY, { "CF-Turnstile-Response": "tok" }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as ReplayError).reason).toBe("turnstile");
    expect(guarded.env.REPLAYS.puts).toBe(0);

    const passing = setup({ TURNSTILE_SECRET: "s" }, (async () => Response.json({ success: true })) as typeof fetch);
    const created = await upload(passing.call, { "CF-Turnstile-Response": "tok" });
    // Reads need no token.
    expect((await passing.call(get(created.id))).status).toBe(200);
  });

  it("404s other methods and paths under /replay", async () => {
    const { call } = setup();
    for (const request of [
      new Request("https://sync.test/replay"),
      new Request("https://sync.test/replay/AAAAAAAAAAAA", { method: "POST", body: REPLAY }),
      new Request("https://sync.test/replay/AAAAAAAAAAAA", { method: "DELETE" }),
    ]) {
      const res = await call(request);
      expect(res.status).toBe(404);
      expect(((await res.json()) as ReplayError).reason).toBe("not-found");
    }
  });
});

describe("replay daily cap across the account", () => {
  const ipOf = (i: number) => ({ "CF-Connecting-IP": `198.51.100.${i}` });
  const quotaCount = (env: ReturnType<typeof setup>["env"]) =>
    (env.REPLAY_QUOTA.instances.get("replays")?.storage.map.get("day") as { n: number } | undefined)?.n ?? 0;

  it("refuses uploads from any IP past MAX_REPLAYS_PER_DAY with 503 full until the next UTC day", async () => {
    const { call, env, clock } = setup({ MAX_REPLAYS_PER_DAY: "3" });
    for (let i = 0; i < 3; i++) expect((await call(post(REPLAY, ipOf(i)))).status).toBe(201);
    const refused = await call(post(REPLAY, { ...ipOf(9), Origin: ORIGIN }));
    expect(refused.status).toBe(503);
    expect(((await refused.json()) as ReplayError).reason).toBe("full");
    expect(refused.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const nextDay = Math.ceil(clock.now / DAY_MS) * DAY_MS;
    expect(Number(refused.headers.get("Retry-After"))).toBe(Math.ceil((nextDay - clock.now) / 1000));
    expect(env.REPLAYS.puts).toBe(3);
    // Reads are not capped.
    const [id] = [...env.REPLAYS.objects.keys()];
    expect((await call(get(id!))).status).toBe(200);

    clock.now = nextDay;
    expect((await call(post(REPLAY, ipOf(9)))).status).toBe(201);
    expect(quotaCount(env)).toBe(1);
  });

  it("is checked after the shape check and the per-IP limit, so neither spends a slot", async () => {
    const { call, env } = setup({ MAX_REPLAYS_PER_DAY: "100" });
    expect((await call(post("MCREPLAY1\nAAAA\n"))).status).toBe(400);
    expect(env.REPLAY_QUOTA.instances.size).toBe(0);
    const ip = ipOf(1);
    for (let i = 0; i < REPLAY_UPLOADS_PER_IP_PER_DAY; i++) await call(post(REPLAY, ip));
    expect((await call(post(REPLAY, ip))).status).toBe(429);
    expect(quotaCount(env)).toBe(REPLAY_UPLOADS_PER_IP_PER_DAY);
  });

  it("gives the slot back when the R2 write throws or every id is taken", async () => {
    const { call, env, deps } = setup({ MAX_REPLAYS_PER_DAY: "1" });
    const realPut = env.REPLAYS.put.bind(env.REPLAYS);
    env.REPLAYS.put = async () => {
      throw new Error("R2 down");
    };
    const failed = await call(post(REPLAY, ipOf(1)));
    expect(failed.status).toBe(500);
    expect(((await failed.json()) as ReplayError).reason).toBe("server");
    expect(quotaCount(env)).toBe(0);

    env.REPLAYS.put = realPut;
    deps.randomBytes = (n) => new Uint8Array(n);
    expect((await call(post(REPLAY, ipOf(2)))).status).toBe(201);
    expect(quotaCount(env)).toBe(1);
    // The cap is 1 and it is taken: the next upload is refused before R2.
    expect((await call(post(REPLAY, ipOf(3)))).status).toBe(503);
    expect(env.REPLAYS.puts).toBe(1);
    env.REPLAY_QUOTA.instances.get("replays")!.storage.map.set("day", { d: Math.floor(deps.now() / DAY_MS), n: 0 });
    // Every id it draws is taken now: 500, and the slot comes back.
    expect((await call(post(REPLAY, ipOf(4)))).status).toBe(500);
    expect(quotaCount(env)).toBe(0);
  });

  it("fails closed when the quota object errors", async () => {
    const { call, env } = setup();
    env.REPLAY_QUOTA.get = () => ({ fetch: async () => new Response("boom", { status: 500 }) });
    expect((await call(post(REPLAY))).status).toBe(500);
    expect(env.REPLAYS.puts).toBe(0);
  });

  it("defaults to 200 a day when MAX_REPLAYS_PER_DAY is not set", async () => {
    const { call, env, clock } = setup();
    delete env.MAX_REPLAYS_PER_DAY;
    expect((await call(post(REPLAY, ipOf(1)))).status).toBe(201);
    env.REPLAY_QUOTA.instances.get("replays")!.storage.map.set("day", { d: Math.floor(clock.now / DAY_MS), n: 199 });
    expect((await call(post(REPLAY, ipOf(2)))).status).toBe(201);
    expect((await call(post(REPLAY, ipOf(3)))).status).toBe(503);
  });

  it("writes one row per take and refund, none for a refusal, and ignores a refund from an earlier day", async () => {
    const storage = new MemoryStorage();
    const quota = new ReplayQuotaLogic(storage);
    const day = 5 * QUOTA_DAY_MS;
    expect(await quota.take(day + 10, 1)).toEqual({ ok: true });
    expect(storage.rowsWritten).toBe(1);
    expect(await quota.take(day + 20, 1)).toEqual({ ok: false, retryAfterMs: QUOTA_DAY_MS - 20 });
    expect(storage.rowsWritten).toBe(1);
    await quota.refund(day - 1, day + 30);
    expect(await quota.count(day + 30)).toBe(1);
    await quota.refund(day + 10, day + 40);
    expect(await quota.count(day + 40)).toBe(0);
    expect(storage.rowsWritten).toBe(2);
    await quota.refund(day + 10, day + 50);
    expect(await quota.count(day + 50)).toBe(0);
  });
});
