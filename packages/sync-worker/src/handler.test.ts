import { describe, expect, it, vi } from "vitest";
import { clientKey, handleRequest, type HandlerDeps } from "./handler.js";
import { TRANSFER_TTL_MS, type TransferCreated, type TransferError } from "./protocol.js";
import { makeEnv, OTHER_PROOF, PROOF, type TestEnv } from "./test-support.js";

const ORIGIN = "https://marvel-champions-digital-game.netlify.app";

function setup(overrides: Parameters<typeof makeEnv>[0] = {}, fetchImpl?: typeof fetch) {
  const clock = { now: 1_000_000 };
  const env = makeEnv(overrides);
  const deps: { -readonly [K in keyof HandlerDeps]: HandlerDeps[K] } = {
    now: () => clock.now,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    fetch: fetchImpl ?? (async () => Response.json({ success: true })),
  };
  const call = (request: Request, e: TestEnv = env) => handleRequest(request, e, deps);
  return { clock, env, deps, call };
}

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("https://sync.test/transfer", {
    method: "POST",
    headers: { "X-Transfer-Proof": PROOF, ...headers },
    body,
  });
const get = (room: string, proof: string | null = PROOF, headers: Record<string, string> = {}) =>
  new Request(`https://sync.test/transfer/${room}`, {
    headers: { ...(proof ? { "X-Transfer-Proof": proof } : {}), ...headers },
  });

const payload = () => new Uint8Array([1, 2, 3, 4, 5]);

async function upload(call: ReturnType<typeof setup>["call"], headers: Record<string, string> = {}) {
  const res = await call(post(payload(), headers));
  expect(res.status).toBe(201);
  return (await res.json()) as TransferCreated;
}

describe("upload and one-time fetch", () => {
  it("round-trips bytes once, then 404s", async () => {
    const { call, clock } = setup();
    const created = await upload(call);
    expect(created.code).toHaveLength(8);
    expect(created.expiresAt).toBe(clock.now + TRANSFER_TTL_MS);

    const res = await call(get(created.code));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(payload());

    const again = await call(get(created.code));
    expect(again.status).toBe(404);
    expect(((await again.json()) as TransferError).reason).toBe("not-found");
  });

  it("answers a wrong proof like a missing room, keeps the upload and counts a failure", async () => {
    const { call, env } = setup();
    const created = await upload(call);
    const wrong = await call(get(created.code, OTHER_PROOF));
    expect(wrong.status).toBe(404);
    expect(((await wrong.json()) as TransferError).reason).toBe("not-found");
    const missing = await call(get("ZZZZZZZZ"));
    expect(missing.status).toBe(404);
    expect(env.RATE_LIMITER.instances.get("ip:unknown")!.storage.map.get("state")).toMatchObject({
      failures: [expect.any(Number), expect.any(Number)],
    });
    expect((await call(get(created.code))).status).toBe(200);
  });

  it("treats malformed room codes and missing proofs as not-found failures", async () => {
    const { call } = setup();
    expect((await call(get("short"))).status).toBe(404);
    expect((await call(get("ABCDEFGH", null))).status).toBe(404);
    expect((await call(get("ABCDEFG0"))).status).toBe(404);
  });

  it("blocks an IP after 5 failed fetches, then lets it back in after an hour", async () => {
    const { call, clock } = setup();
    for (let i = 0; i < 5; i++) expect((await call(get("ZZZZZZZZ"))).status).toBe(404);
    const blocked = await call(get("ZZZZZZZZ"));
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as TransferError).reason).toBe("blocked");
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    clock.now += 60 * 60 * 1000 + 1;
    expect((await call(get("ZZZZZZZZ"))).status).toBe(404);
  });

  it("treats an upload past its TTL as missing, and the room alarm empties it", async () => {
    const { call, clock, env } = setup();
    const created = await upload(call);
    const room = env.TRANSFER_ROOM.instances.get(created.code)!;
    expect(room.storage.alarm).toBe(created.expiresAt);
    clock.now += TRANSFER_TTL_MS;
    expect((await call(get(created.code))).status).toBe(404);
    expect(room.storage.map.size).toBe(0);

    const second = await upload(call);
    const secondRoom = env.TRANSFER_ROOM.instances.get(second.code)!;
    await secondRoom.object.alarm();
    expect(secondRoom.storage.map.size).toBe(0);
  });

  it("retries with a new code when a room is occupied", async () => {
    const { call, deps, env } = setup();
    const first = await upload(call);
    const taken = Array.from(first.code, (ch) => "23456789ABCDEFGHJKMNPQRSTUVWXYZ".indexOf(ch));
    let calls = 0;
    deps.randomBytes = (n) => {
      calls++;
      return calls === 1 ? Uint8Array.from(taken) : crypto.getRandomValues(new Uint8Array(n));
    };
    const res = await handleRequest(post(payload()), env, deps);
    expect(res.status).toBe(201);
    expect(((await res.json()) as TransferCreated).code).not.toBe(first.code);
    expect(calls).toBeGreaterThan(1);
  });
});

describe("fetch limiting", () => {
  it("lets at most 5 of 10 parallel wrong guesses reach the room", async () => {
    const { call, env } = setup();
    const created = await upload(call);
    const room = env.TRANSFER_ROOM.instances.get(created.code)!.object;
    const claim = vi.spyOn(room, "fetch");
    const results = await Promise.all(Array.from({ length: 10 }, () => call(get(created.code, OTHER_PROOF))));
    expect(claim.mock.calls.length).toBeLessThanOrEqual(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
  });

  it("refunds the attempt on a successful claim", async () => {
    const { call } = setup();
    for (let i = 0; i < 4; i++) await call(get("ZZZZZZZZ"));
    const created = await upload(call);
    expect((await call(get(created.code))).status).toBe(200);
    expect((await call(get("ZZZZZZZZ"))).status).toBe(404);
  });

  it("deletes the upload after 5 wrong proofs from different IPs", async () => {
    const { call } = setup();
    const created = await upload(call);
    for (let i = 0; i < 5; i++) await call(get(created.code, OTHER_PROOF, { "CF-Connecting-IP": `198.51.100.${i}` }));
    const res = await call(get(created.code, PROOF, { "CF-Connecting-IP": "198.51.100.99" }));
    expect(res.status).toBe(404);
  });

  it("fails closed when the limiter errors", async () => {
    const { call, env } = setup();
    const broken = { fetch: async () => new Response("boom", { status: 500 }) };
    env.RATE_LIMITER.get = () => broken;
    const down = await call(get("ABCDEFGH"));
    expect(down.status).toBe(500);
    expect((await call(post(payload()))).status).toBe(500);
  });
});

describe("client keys", () => {
  it("groups IPv6 by /64 and keeps IPv4 whole", () => {
    expect(clientKey("203.0.113.9")).toBe("203.0.113.9");
    expect(clientKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(clientKey("2001:0db8:0001:0002::1"));
    expect(clientKey("2001:db8:1:2::1")).not.toBe(clientKey("2001:db8:1:3::1"));
    expect(clientKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });

  it("shares one upload allowance across a /64", async () => {
    const { call } = setup();
    for (let i = 0; i < 10; i++) {
      expect((await call(post(payload(), { "CF-Connecting-IP": `2001:db8:1:2::${i + 1}` }))).status).toBe(201);
    }
    expect((await call(post(payload(), { "CF-Connecting-IP": "2001:db8:1:2:f::1" }))).status).toBe(429);
  });
});

describe("upload validation", () => {
  it("needs a well-formed proof", async () => {
    const { call } = setup();
    expect((await call(post(payload(), { "X-Transfer-Proof": "short" }))).status).toBe(400);
    const none = new Request("https://sync.test/transfer", { method: "POST", body: payload() });
    expect((await call(none)).status).toBe(400);
  });

  it("rejects an empty body", async () => {
    const { call } = setup();
    expect((await call(post(new Uint8Array(0)))).status).toBe(400);
  });

  it("rejects by Content-Length and by the bytes actually read", async () => {
    const { call } = setup();
    const big = new Uint8Array(1001);
    const declared = await call(post(big, { "Content-Length": "1001" }));
    expect(declared.status).toBe(413);
    expect(((await declared.json()) as TransferError).reason).toBe("too-large");

    // A lying Content-Length on a streamed body: the stream is what gets capped.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 3; i++) controller.enqueue(new Uint8Array(400));
        controller.close();
      },
    });
    const streamed = new Request("https://sync.test/transfer", {
      method: "POST",
      headers: { "X-Transfer-Proof": PROOF, "Content-Length": "10" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect((await call(streamed)).status).toBe(413);
  });

  it("accepts exactly the cap", async () => {
    const { call } = setup();
    expect((await call(post(new Uint8Array(1000)))).status).toBe(201);
  });

  it("refuses the 11th upload from one IP in an hour with Retry-After; another IP is unaffected", async () => {
    const { call } = setup();
    const ip = { "CF-Connecting-IP": "203.0.113.9" };
    for (let i = 0; i < 10; i++) expect((await call(post(payload(), ip))).status).toBe(201);
    const refused = await call(post(payload(), ip));
    expect(refused.status).toBe(429);
    expect(((await refused.json()) as TransferError).reason).toBe("rate-limited");
    expect(Number(refused.headers.get("Retry-After"))).toBe(3600);
    expect((await call(post(payload(), { "CF-Connecting-IP": "203.0.113.10" }))).status).toBe(201);
  });
});

describe("CORS", () => {
  it("echoes an allowed origin and varies on it", async () => {
    const { call } = setup();
    const res = await call(post(payload(), { Origin: ORIGIN }));
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Vary")).toBe("Origin");
    expect(res.headers.get("Access-Control-Expose-Headers")).toBe("Retry-After");
  });

  it("allows wildcard preview origins and any localhost port", async () => {
    const { call } = setup();
    for (const origin of [
      "https://deploy-preview-12--marvel-champions-digital-game.netlify.app",
      "http://localhost:5173",
    ]) {
      const res = await call(post(payload(), { Origin: origin }));
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    }
  });

  it("refuses other origins with 403 origin, including look-alikes", async () => {
    const { call } = setup();
    for (const origin of [
      "https://evil.example",
      "https://marvel-champions-digital-game.netlify.app.evil.example",
      "http://localhost:80.evil.example",
    ]) {
      const res = await call(post(payload(), { Origin: origin }));
      expect(res.status).toBe(403);
      expect(((await res.json()) as TransferError).reason).toBe("origin");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
  });

  it("gives a request with no Origin no CORS headers", async () => {
    const { call } = setup();
    const res = await call(post(payload()));
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers a preflight for an allowed origin and refuses others", async () => {
    const { call } = setup();
    const preflight = (origin: string) =>
      new Request("https://sync.test/transfer", {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
      });
    const ok = await call(preflight(ORIGIN));
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(ok.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
    expect(ok.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, X-Transfer-Proof, CF-Turnstile-Response",
    );
    expect((await call(preflight("https://evil.example"))).status).toBe(403);
  });
});

describe("kill switch", () => {
  it("answers 503 JSON with CORS headers on every transfer route", async () => {
    const { call } = setup({ TRANSFERS_ENABLED: "false" });
    for (const request of [post(payload(), { Origin: ORIGIN }), get("ABCDEFGH", PROOF, { Origin: ORIGIN })]) {
      const res = await call(request);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ reason: "disabled", error: "Online transfer is turned off right now." });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    }
  });

  it("treats a missing var as off", async () => {
    const { call } = setup({ TRANSFERS_ENABLED: "" });
    expect((await call(post(payload()))).status).toBe(503);
  });
});

describe("Turnstile", () => {
  it("is skipped when no secret is set", async () => {
    const siteverify = vi.fn(async () => Response.json({ success: false }));
    const { call } = setup({}, siteverify as unknown as typeof fetch);
    expect((await call(post(payload()))).status).toBe(201);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it("verifies the token with the secret when set", async () => {
    const siteverify = vi.fn(async () => Response.json({ success: true }));
    const { call } = setup({ TURNSTILE_SECRET: "s3cret" }, siteverify as unknown as typeof fetch);
    expect((await call(post(payload(), { "CF-Turnstile-Response": "tok" }))).status).toBe(201);
    expect(siteverify).toHaveBeenCalledTimes(1);
    const [url, init] = siteverify.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect((init.body as URLSearchParams).get("secret")).toBe("s3cret");
    expect((init.body as URLSearchParams).get("response")).toBe("tok");
  });

  it("refuses a missing token, a failed check and an unreachable verifier", async () => {
    const bad = setup({ TURNSTILE_SECRET: "s" }, (async () => Response.json({ success: false })) as typeof fetch);
    expect((await bad.call(post(payload()))).status).toBe(403);
    const res = await bad.call(post(payload(), { "CF-Turnstile-Response": "tok" }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as TransferError).reason).toBe("turnstile");

    const down = setup({ TURNSTILE_SECRET: "s" }, (async () => {
      throw new Error("offline");
    }) as typeof fetch);
    expect((await down.call(post(payload(), { "CF-Turnstile-Response": "tok" }))).status).toBe(403);
  });
});

describe("routing", () => {
  it("404s anything else as JSON", async () => {
    const { call } = setup();
    for (const request of [
      new Request("https://sync.test/"),
      new Request("https://sync.test/transfer", { method: "GET" }),
      new Request("https://sync.test/transfer/ABCDEFGH", { method: "DELETE" }),
    ]) {
      const res = await call(request);
      expect(res.status).toBe(404);
      expect(((await res.json()) as TransferError).reason).toBe("not-found");
    }
  });
});
