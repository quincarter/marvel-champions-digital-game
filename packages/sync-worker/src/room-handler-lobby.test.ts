import { describe, expect, it } from "vitest";
import type { GameRoomLogic, RoomSocket } from "./game-room.js";
import { sha256Hex } from "./game-room.js";
import { handleRequest, type HandlerDeps } from "./handler.js";
import { CODE_ALPHABET } from "./protocol.js";
import { ROOM_LOOKUPS_PER_IP_PER_HOUR } from "./rate-limiter.js";
import { RoomCodeLogic } from "./room-code-store.js";
import {
  DEFAULT_ROOMS_PER_IP_PER_DAY,
  LOBBY_CODE_LENGTH,
  ROOM_END_GRACE_MS,
  ROOM_CODE_MARGIN_MS,
  ROOM_IDLE_MS,
  type RoomCreated,
} from "./room-protocol.js";
import { makeEnv, type TestEnv } from "./test-support.js";

const ORIGIN = "https://marvel-champions-digital-game.netlify.app";
const HOUR = 60 * 60 * 1000;

function setup(overrides: Parameters<typeof makeEnv>[0] = {}) {
  const clock = { now: 1_000_000 };
  const env = makeEnv(overrides);
  // Draws are random unless a test queues bytes for the room code (its draws ask for 12 bytes: 6 characters x 2).
  const codeDraws: Uint8Array[] = [];
  const deps: HandlerDeps = {
    now: () => clock.now,
    randomBytes: (n) =>
      n === LOBBY_CODE_LENGTH * 2 && codeDraws.length > 0
        ? codeDraws.shift()!
        : crypto.getRandomValues(new Uint8Array(n)),
    fetch: async () => Response.json({ success: true }),
  };
  return { clock, env, codeDraws, call: (request: Request) => handleRequest(request, env, deps) };
}

const postLobby = (headers: Record<string, string> = {}) =>
  new Request("https://sync.test/room", { method: "POST", headers, body: JSON.stringify({ lobby: true }) });
const lookup = (code: string, headers: Record<string, string> = {}) =>
  new Request(`https://sync.test/room/code/${code}`, { headers });
const created = async (res: Response) => (await res.json()) as RoomCreated;
const bytesFor = (code: string) => {
  // Two bytes per character; the first of each pair is the symbol's index, the second is unused.
  const out = new Uint8Array(LOBBY_CODE_LENGTH * 2);
  [...code].forEach((ch, i) => (out[i] = CODE_ALPHABET.indexOf(ch)));
  return out;
};

function logicOf(env: TestEnv, roomId: string): GameRoomLogic {
  return (env.GAME_ROOM.instances.get(roomId)!.object as unknown as { room: GameRoomLogic }).room;
}

function fakeSocket(): RoomSocket & { sent: string[] } {
  let attachment: never | null = null;
  return {
    sent: [],
    send(text) {
      this.sent.push(text);
    },
    close() {},
    getParticipant: () => attachment,
    setParticipant: (p) => (attachment = p as never),
    clearParticipant: () => (attachment = null),
  };
}

describe("POST /room without a lobby", () => {
  it("returns no code and makes no code entry for no body, an empty object, bad JSON or a non-true lobby", async () => {
    const { call, env } = setup();
    for (const body of [
      undefined,
      "{}",
      "not json",
      JSON.stringify({ lobby: "yes" }),
      JSON.stringify({ lobby: false }),
    ]) {
      const res = await call(new Request("https://sync.test/room", { method: "POST", ...(body ? { body } : {}) }));
      expect(res.status).toBe(201);
      expect((await created(res)).code).toBeUndefined();
    }
    expect(env.ROOM_CODE.instances.size).toBe(0);
  });
});

describe("POST /room { lobby: true }", () => {
  it("returns a 6 character code from the room-code alphabet, stored with the room and in the directory", async () => {
    const { call, env, clock } = setup();
    const res = await call(postLobby({ Origin: ORIGIN }));
    expect(res.status).toBe(201);
    const room = await created(res);
    expect(room.code).toHaveLength(LOBBY_CODE_LENGTH);
    for (const ch of room.code!) expect(CODE_ALPHABET).toContain(ch);
    expect(env.GAME_ROOM.instances.get(room.roomId)!.storage.map.get("meta")).toEqual({
      hostTokenHash: await sha256Hex(room.hostToken),
      createdAt: clock.now,
      code: room.code,
      roomId: room.roomId,
    });
    expect(env.ROOM_CODE.instances.get(room.code!)!.storage.map.get("code")).toEqual({
      roomId: room.roomId,
      expiresAt: clock.now + ROOM_IDLE_MS + ROOM_CODE_MARGIN_MS,
    });
  });

  it("gives ten rooms ten different codes, each opening its own room", async () => {
    const { call } = setup();
    const rooms: RoomCreated[] = [];
    for (let i = 0; i < 10; i++) rooms.push(await created(await call(postLobby())));
    expect(new Set(rooms.map((r) => r.code)).size).toBe(10);
    for (const r of rooms) expect(await (await call(lookup(r.code!))).json()).toEqual({ roomId: r.roomId });
  });

  it("draws another code when one is taken", async () => {
    const { call, codeDraws } = setup();
    const first = await created(await call(postLobby()));
    // The first 12-byte draw is the room id; the second is the code, which collides; the third is a fresh code.
    codeDraws.push(bytesFor(first.code!), bytesFor(first.code!));
    const second = await created(await call(postLobby()));
    expect(second.code).not.toBe(first.code);
    expect(codeDraws).toHaveLength(0);
    expect(await (await call(lookup(first.code!))).json()).toEqual({ roomId: first.roomId });
    expect(await (await call(lookup(second.code!))).json()).toEqual({ roomId: second.roomId });
  });

  it("fails with a server error after 8 collisions and leaves no room behind", async () => {
    const { call, env, codeDraws } = setup();
    const first = await created(await call(postLobby()));
    const rooms = env.GAME_ROOM.instances.size;
    // The room id draw is also 12 bytes and takes the first; then 8 code draws all collide.
    for (let i = 0; i < 9; i++) codeDraws.push(bytesFor(first.code!));
    const res = await call(postLobby());
    expect(res.status).toBe(500);
    expect(env.GAME_ROOM.instances.size).toBe(rooms);
  });

  it("gives the code back when the room cannot be made", async () => {
    const { call, env } = setup();
    env.GAME_ROOM.get = () => ({ fetch: async () => new Response(null, { status: 500 }) });
    expect((await call(postLobby())).status).toBe(500);
    for (const entry of env.ROOM_CODE.instances.values()) expect(entry.storage.map.size).toBe(0);
  });

  it("still counts against the daily allowance, honors the kill switch and the origin check", async () => {
    const off = setup({ ROOMS_ENABLED: "false" });
    expect((await off.call(postLobby())).status).toBe(503);
    expect((await off.call(lookup("ZZZZZZ"))).status).toBe(503);
    const { call } = setup();
    expect((await call(postLobby({ Origin: "https://evil.example" }))).status).toBe(403);
    expect((await call(lookup("ZZZZZZ", { Origin: "https://evil.example" }))).status).toBe(403);
    const headers = { "CF-Connecting-IP": "203.0.113.77" };
    for (let i = 0; i < DEFAULT_ROOMS_PER_IP_PER_DAY; i++) expect((await call(postLobby(headers))).status).toBe(201);
    expect((await call(postLobby(headers))).status).toBe(429);
  });
});

describe("GET /room/code/:code", () => {
  it("resolves a code to its room id in any case, with a dash or spaces, and carries CORS", async () => {
    const { call } = setup();
    const room = await created(await call(postLobby()));
    const code = room.code!;
    for (const typed of [
      code,
      code.toLowerCase(),
      `${code.slice(0, 3)}-${code.slice(3).toLowerCase()}`,
      `${code.slice(0, 3)}%20${code.slice(3)}`,
    ]) {
      const res = await call(lookup(typed, { Origin: ORIGIN }));
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
      expect(await res.json()).toEqual({ roomId: room.roomId });
    }
  });

  it("answers 404 not-found for an unknown, malformed or look-alike code", async () => {
    const { call } = setup();
    for (const code of ["ZZZZZZ", "short", "TOOLONGCODE", "0OIL1A", "%E0%A4%A"]) {
      const res = await call(lookup(code));
      expect(res.status).toBe(404);
      expect(((await res.json()) as { reason: string }).reason).toBe("not-found");
    }
  });

  it("is a 404 once the room's time is up with no refresh, and 200 a moment before", async () => {
    const { call, clock } = setup();
    const room = await created(await call(postLobby()));
    clock.now += ROOM_IDLE_MS + ROOM_CODE_MARGIN_MS - 1;
    expect((await call(lookup(room.code!))).status).toBe(200);
    clock.now += 1;
    expect((await call(lookup(room.code!))).status).toBe(404);
  });

  it("a live room moves its code's expiry out with its alarm, so the code outlives 12 hours", async () => {
    const { call, env, clock } = setup();
    const room = await created(await call(postLobby()));
    const logic = logicOf(env, room.roomId);
    clock.now += ROOM_IDLE_MS - 1;
    const host = fakeSocket();
    await logic.message(
      host,
      JSON.stringify({ v: 1, ch: "room", kind: "hello", caps: [], token: room.hostToken, name: "H" }),
    );
    await logic.message(host, JSON.stringify({ v: 1, ch: "game", kind: "start", table: "t1", header: {} }));
    clock.now += 1;
    expect(await logic.alarm(clock.now)).toBe("rescheduled");
    const alarm = env.GAME_ROOM.instances.get(room.roomId)!.storage.alarm;
    const entry = env.ROOM_CODE.instances.get(room.code!)!.storage;
    expect((entry.map.get("code") as { expiresAt: number }).expiresAt).toBe(alarm! + ROOM_CODE_MARGIN_MS);
    clock.now = alarm! + ROOM_CODE_MARGIN_MS - 1;
    expect((await call(lookup(room.code!))).status).toBe(200);
  });

  it("is deleted when the room closes", async () => {
    const { call, env, clock } = setup();
    const room = await created(await call(postLobby()));
    clock.now += ROOM_END_GRACE_MS;
    await logicOf(env, room.roomId).shutdown("ended");
    expect((await call(lookup(room.code!))).status).toBe(404);
    expect(env.ROOM_CODE.instances.get(room.code!)!.storage.map.size).toBe(0);
  });

  it("is deleted when the room's alarm closes it for idleness", async () => {
    const { call, env, clock } = setup();
    const room = await created(await call(postLobby()));
    clock.now += ROOM_IDLE_MS;
    expect(await logicOf(env, room.roomId).alarm(clock.now)).toBe("closed");
    expect(env.ROOM_CODE.instances.get(room.code!)!.storage.map.size).toBe(0);
  });

  it("a closing room cannot delete a code that now belongs to another room", async () => {
    const { call, env, clock } = setup();
    const room = await created(await call(postLobby()));
    clock.now += ROOM_IDLE_MS + ROOM_CODE_MARGIN_MS;
    // The code lapsed and another room took it before this one (which never heard) closes.
    const storage = env.ROOM_CODE.instances.get(room.code!)!.storage;
    await new RoomCodeLogic(storage).claim("BBBBBBBBBBBB", clock.now + ROOM_IDLE_MS, clock.now);
    await logicOf(env, room.roomId).shutdown("idle");
    expect(await (await call(lookup(room.code!))).json()).toEqual({ roomId: "BBBBBBBBBBBB" });
  });

  it("limits lookups per IP per hour with Retry-After and no stored row, then frees them", async () => {
    const { call, env, clock } = setup();
    const headers = { "CF-Connecting-IP": "203.0.113.50" };
    for (let i = 0; i < ROOM_LOOKUPS_PER_IP_PER_HOUR; i++)
      expect((await call(lookup("ZZZZZZ", headers))).status).toBe(404);
    const limited = await call(lookup("ZZZZZZ", headers));
    expect(limited.status).toBe(429);
    expect(((await limited.json()) as { reason: string }).reason).toBe("rate-limited");
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    for (const entry of env.RATE_LIMITER.instances.values()) expect(entry.storage.map.size).toBe(0);
    expect((await call(lookup("ZZZZZZ", { "CF-Connecting-IP": "198.51.100.2" }))).status).toBe(404);
    clock.now += HOUR + 1;
    expect((await call(lookup("ZZZZZZ", headers))).status).toBe(404);
  });

  it("does not shadow the join route: an id still upgrades or 404s as before", async () => {
    const { call } = setup();
    expect(
      (await call(new Request(`https://sync.test/room/${"A".repeat(12)}/ws`, { headers: { Upgrade: "websocket" } })))
        .status,
    ).toBe(404);
    expect((await call(new Request("https://sync.test/room/code/ws", { method: "POST" }))).status).toBe(404);
  });
});
