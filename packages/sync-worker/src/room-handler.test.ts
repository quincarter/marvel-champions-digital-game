import { describe, expect, it } from "vitest";
import { handleRequest, type HandlerDeps } from "./handler.js";
import { sha256Hex } from "./game-room.js";
import {
  DEFAULT_ROOMS_PER_IP_PER_DAY,
  ROOM_ID_PATTERN,
  ROOM_TOKEN_PATTERN,
  type RoomCreated,
} from "./room-protocol.js";
import { makeEnv } from "./test-support.js";

const ORIGIN = "https://marvel-champions-digital-game.netlify.app";

function setup(overrides: Parameters<typeof makeEnv>[0] = {}, fetchImpl?: typeof fetch) {
  const clock = { now: 1_000_000 };
  const env = makeEnv(overrides);
  const deps: HandlerDeps = {
    now: () => clock.now,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    fetch: fetchImpl ?? (async () => Response.json({ success: true })),
  };
  return { clock, env, call: (request: Request) => handleRequest(request, env, deps) };
}

const post = (headers: Record<string, string> = {}) =>
  new Request("https://sync.test/room", { method: "POST", headers });
const ws = (id: string, headers: Record<string, string> = {}) =>
  new Request(`https://sync.test/room/${id}/ws`, { headers: { Upgrade: "websocket", ...headers } });

describe("POST /room", () => {
  it("creates a room: 201 with an id, a 32 character host token and the first table; stores only the token hash", async () => {
    const { call, env, clock } = setup();
    const res = await call(post({ Origin: ORIGIN }));
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const created = (await res.json()) as RoomCreated;
    expect(created.roomId).toMatch(ROOM_ID_PATTERN);
    expect(created.hostToken).toMatch(ROOM_TOKEN_PATTERN);
    expect(created.table).toBe("t1");
    const entry = env.GAME_ROOM.instances.get(created.roomId)!;
    expect([...entry.storage.map.keys()]).toEqual(["meta"]);
    expect(entry.storage.map.get("meta")).toEqual({
      hostTokenHash: await sha256Hex(created.hostToken),
      createdAt: clock.now,
    });
    expect(JSON.stringify([...entry.storage.map.values()])).not.toContain(created.hostToken);
  });

  it("gives every room its own id and token", async () => {
    const { call } = setup();
    const a = (await (await call(post())).json()) as RoomCreated;
    const b = (await (await call(post())).json()) as RoomCreated;
    expect(a.roomId).not.toBe(b.roomId);
    expect(a.hostToken).not.toBe(b.hostToken);
  });

  it("answers 503 disabled behind the kill switch, and touches nothing", async () => {
    const { call, env } = setup({ ROOMS_ENABLED: "false" });
    for (const request of [post(), ws("A".repeat(12))]) {
      const res = await call(request);
      expect(res.status).toBe(503);
      expect(((await res.json()) as { reason: string }).reason).toBe("disabled");
    }
    expect(env.GAME_ROOM.instances.size).toBe(0);
    expect(env.RATE_LIMITER.instances.size).toBe(0);
  });

  it("limits each IP per day, with Retry-After, and frees the allowance a day later", async () => {
    const { call, clock } = setup();
    const headers = { "CF-Connecting-IP": "203.0.113.9" };
    for (let i = 0; i < DEFAULT_ROOMS_PER_IP_PER_DAY; i++) expect((await call(post(headers))).status).toBe(201);
    const refused = await call(post(headers));
    expect(refused.status).toBe(429);
    expect(((await refused.json()) as { reason: string }).reason).toBe("rate-limited");
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await call(post({ "CF-Connecting-IP": "198.51.100.1" }))).status).toBe(201);
    clock.now += 24 * 60 * 60 * 1000 + 1;
    expect((await call(post(headers))).status).toBe(201);
  });

  it("requires a Turnstile token when TURNSTILE_SECRET is set, and checks it", async () => {
    const { call } = setup({ TURNSTILE_SECRET: "secret" }, async (_url, init) =>
      Response.json({ success: (init!.body as URLSearchParams).get("response") === "good" }),
    );
    expect((await call(post())).status).toBe(403);
    expect((await call(post({ "CF-Turnstile-Response": "bad" }))).status).toBe(403);
    expect((await call(post({ "CF-Turnstile-Response": "good" }))).status).toBe(201);
  });

  it("refuses an origin that is not allowed and answers preflight", async () => {
    const { call } = setup();
    expect((await call(post({ Origin: "https://evil.example" }))).status).toBe(403);
    const pre = await call(new Request("https://sync.test/room", { method: "OPTIONS", headers: { Origin: ORIGIN } }));
    expect(pre.status).toBe(204);
  });

  it("draws another id when one is taken", async () => {
    const { call, env } = setup();
    let first = true;
    const original = env.GAME_ROOM.get.bind(env.GAME_ROOM);
    env.GAME_ROOM.get = (id) => {
      if (!first) return original(id);
      first = false;
      return { fetch: async () => new Response(null, { status: 409 }) };
    };
    expect((await call(post())).status).toBe(201);
  });
});

describe("GET /room/:id/ws", () => {
  it("answers 404 for a room nobody created, before upgrading", async () => {
    const { call } = setup();
    expect((await call(ws("A".repeat(12)))).status).toBe(404);
  });

  it("answers 404 for a malformed id and 426 without an upgrade", async () => {
    const { call } = setup();
    expect((await call(ws("short"))).status).toBe(404);
    expect((await call(new Request("https://sync.test/room/AAAAAAAAAAAA/ws"))).status).toBe(426);
    const created = (await (await call(post())).json()) as RoomCreated;
    const plain = await call(new Request(`https://sync.test/room/${created.roomId}/ws`));
    expect(plain.status).toBe(426);
  });

  it("forwards the upgrade request itself to the room named by the id", async () => {
    const { call, env } = setup();
    const seen: Request[] = [];
    env.GAME_ROOM.get = () => ({
      fetch: async (request) => {
        seen.push(request);
        return new Response("room", { status: 200 });
      },
    });
    const res = await call(ws("A".repeat(12), { Origin: ORIGIN }));
    expect(await res.text()).toBe("room");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.headers.get("Upgrade")).toBe("websocket");
    expect(new URL(seen[0]!.url).pathname).toBe(`/room/${"A".repeat(12)}/ws`);
  });
});
