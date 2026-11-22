/**
 * The live game room routes (`POST /room`, `GET /room/:id/ws`, see `room-protocol.ts` and docs/live-game-rooms.md).
 * Creating a room is guarded like a replay upload: origin, the kill switch, Turnstile when configured, and a per-IP
 * daily allowance. The room's Durable Object stores only the SHA-256 of the host token. A WebSocket upgrade is
 * forwarded to the room's object, which answers 404 for an id nobody created. Nothing from a request is logged.
 */

import type { HandlerDeps } from "./handler.js";
import { clientKey } from "./client-key.js";
import { preflightHeaders } from "./cors.js";
import type { Env } from "./env.js";
import { sha256Hex } from "./game-room.js";
import { TURNSTILE_HEADER } from "./protocol.js";
import { generateReplayId } from "./replay-handler.js";
import { REPLAY_ID_ALPHABET } from "./replay-protocol.js";
import { generateRoomCode, type RandomBytes } from "./room-code.js";
import { CODE_ALPHABET, normalizeCodeInput } from "./protocol.js";
import {
  FIRST_TABLE,
  LOBBY_CODE_LENGTH,
  ROOM_ID_PATTERN,
  ROOM_CODE_MARGIN_MS,
  ROOM_IDLE_MS,
  type LiveRoomList,
  type RoomCodeResolved,
  type RoomCreated,
  type RoomError,
  type RoomErrorReason,
} from "./room-protocol.js";
import { turnstileOk } from "./turnstile.js";

/**
 * `/room` (create), `/room/<id>/ws` (join) and `/room/code/<code>` (resolve a lobby code). Group 1 is the code, group 2
 * the id; both are absent for a create. (A room id is 12 characters and ends in `/ws`, so the two never overlap.)
 */
export const ROOM_PATH = /^\/room(?:\/code\/([^/]*)|\/([^/]*)\/ws)?$/;

/** `GET /rooms/live`: the opt-in "Live now" list. */
export const LIVE_ROOMS_PATH = /^\/rooms\/live$/;

const MAX_ID_ATTEMPTS = 5;
const MAX_CODE_ATTEMPTS = 8;
const TOKEN_LENGTH = 32;

const MESSAGES: Record<RoomErrorReason, string> = {
  disabled: "Live game rooms are turned off right now.",
  origin: "This site is not allowed to use live game rooms.",
  "bad-request": "That room request was not understood.",
  "rate-limited": "Too many rooms opened from this network. Try again later.",
  turnstile: "The human check failed. Try again.",
  "not-found": "No room matches that link. It may have closed.",
  full: "That room is full.",
  server: "Live game rooms hit a problem. Try again.",
};

const STATUS: Record<RoomErrorReason, number> = {
  disabled: 503,
  origin: 403,
  "bad-request": 400,
  "rate-limited": 429,
  turnstile: 403,
  "not-found": 404,
  full: 503,
  server: 500,
};

function fail(reason: RoomErrorReason, headers: Record<string, string>, retryAfterMs?: number): Response {
  const body: RoomError = { reason, error: MESSAGES[reason] };
  const extra =
    retryAfterMs === undefined ? {} : { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) };
  return Response.json(body, {
    status: STATUS[reason],
    headers: { ...headers, ...extra, "Cache-Control": "no-store" },
  });
}

/** 64 symbols divide 256, so `byte & 63` is unbiased. */
export function generateHostToken(randomBytes: RandomBytes): string {
  let token = "";
  for (const byte of randomBytes(TOKEN_LENGTH)) token += REPLAY_ID_ALPHABET[byte & 63];
  return token;
}

export async function handleRoom(
  request: Request,
  env: Env,
  deps: HandlerDeps,
  cors: Record<string, string>,
  origin: string | null,
  match: RegExpExecArray,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: origin ? preflightHeaders(origin) : {} });
  }
  if (env.ROOMS_ENABLED !== "true") return fail("disabled", cors);

  const code = match[1];
  const id = match[2];
  try {
    if (code !== undefined && request.method === "GET") return await resolveCode(request, env, deps, cors, code);
    if (id === undefined && code === undefined && request.method === "POST") {
      return await create(request, env, deps, cors);
    }
    if (id !== undefined && request.method === "GET") return await join(request, env, cors, id);
  } catch {
    return fail("server", cors);
  }
  return fail("not-found", cors);
}

/**
 * `GET /rooms/live`: the newest listed rooms (at most `LIVE_LIST_MAX`), `{ rooms: [] }` when none or when the Worker has
 * no directory. A read: no rows written, and the answer may be cached for a few seconds.
 */
export async function handleLiveRooms(
  request: Request,
  env: Env,
  deps: HandlerDeps,
  cors: Record<string, string>,
  origin: string | null,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: origin ? preflightHeaders(origin) : {} });
  }
  if (env.ROOMS_ENABLED !== "true") return fail("disabled", cors);
  if (request.method !== "GET") return fail("not-found", cors);
  // One directory read per ten seconds for the whole world: the body is kept in the edge cache (no CORS in it, as the
  // origin differs per caller) and CORS is added to each answer.
  const key = new Request("https://mc-sync.cache/rooms/live");
  const cached = await deps.cache?.match(key).catch(() => undefined);
  let text = cached ? await cached.text() : null;
  if (text === null) {
    const ns = env.ROOM_DIRECTORY;
    let rooms: unknown = [];
    if (ns) {
      try {
        const res = await ns.get(ns.idFromName("live")).fetch(new Request("https://directory/list"));
        if (!res.ok) return fail("server", cors);
        rooms = ((await res.json()) as LiveRoomList).rooms;
      } catch {
        return fail("server", cors);
      }
    }
    text = JSON.stringify({ rooms });
    try {
      await deps.cache?.put(
        key,
        new Response(text, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=10" } }),
      );
    } catch {
      // A cache that will not take it only costs a read next time.
    }
  }
  return new Response(text, {
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=10" },
  });
}

async function create(request: Request, env: Env, deps: HandlerDeps, cors: Record<string, string>): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  // The secret is shared with transfers, replays and sync, so rooms check it only when ROOMS_TURNSTILE opts in (the
  // game's room client sends no token yet).
  if (env.ROOMS_TURNSTILE === "true" && env.TURNSTILE_SECRET) {
    const token = request.headers.get(TURNSTILE_HEADER) ?? "";
    if (!token || !(await turnstileOk(env.TURNSTILE_SECRET, token, ip, deps.fetch))) return fail("turnstile", cors);
  }

  const now = deps.now();
  const limiter = env.RATE_LIMITER;
  const allowance = await limiter
    .get(limiter.idFromName(`ip:${clientKey(ip)}`))
    .fetch(new Request("https://limiter/room-create", { method: "POST", headers: { "X-Now": String(now) } }));
  if (allowance.status === 429) {
    const { retryAfterMs } = (await allowance.json()) as { retryAfterMs: number };
    return fail("rate-limited", cors, retryAfterMs);
  }
  if (!allowance.ok) return fail("server", cors);

  const lobby = await wantsLobby(request);
  const hostToken = generateHostToken(deps.randomBytes);
  const hostTokenHash = await sha256Hex(hostToken);
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const roomId = generateReplayId(deps.randomBytes);
    // A lobby room claims its code first (a code collision draws another code); a room id collision, which at 72 random
    // bits never happens in practice, gives the code back and starts over.
    let code: string | null = null;
    if (lobby) {
      code = await claimCode(env, deps, roomId, now);
      if (code === null) return fail("server", cors);
    }
    const made = await env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId)).fetch(
      new Request("https://room/create", {
        method: "POST",
        headers: {
          "X-Now": String(now),
          "X-Host-Hash": hostTokenHash,
          ...(code ? { "X-Code": code, "X-Room-Id": roomId } : {}),
        },
      }),
    );
    if (made.status === 409 || !made.ok) {
      if (code) await releaseCode(env, code, roomId);
      if (made.status === 409) continue;
      return fail("server", cors);
    }
    const created: RoomCreated = { roomId, hostToken, table: FIRST_TABLE, ...(code ? { code } : {}) };
    return Response.json(created, { status: 201, headers: { ...cors, "Cache-Control": "no-store" } });
  }
  return fail("server", cors);
}

/** `{ "lobby": true }` in the body; a missing, empty or unreadable body is a plain watch room, as before lobbies. */
async function wantsLobby(request: Request): Promise<boolean> {
  try {
    const text = await request.text();
    if (text.length === 0 || text.length > 1024) return false;
    const body = JSON.parse(text) as { lobby?: unknown } | null;
    return body !== null && typeof body === "object" && body.lobby === true;
  } catch {
    return false;
  }
}

/** Draws codes until the code directory takes one for the room; null after `MAX_CODE_ATTEMPTS` collisions or an error. */
async function claimCode(env: Env, deps: HandlerDeps, roomId: string, now: number): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode(deps.randomBytes, LOBBY_CODE_LENGTH);
    const res = await env.ROOM_CODE.get(env.ROOM_CODE.idFromName(code)).fetch(
      new Request("https://code/claim", {
        method: "POST",
        headers: {
          "X-Now": String(now),
          "X-Room-Id": roomId,
          "X-Expires": String(now + ROOM_IDLE_MS + ROOM_CODE_MARGIN_MS),
        },
      }),
    );
    if (res.status === 201) return code;
    if (res.status !== 409) return null;
  }
  return null;
}

async function releaseCode(env: Env, code: string, roomId: string): Promise<void> {
  try {
    await env.ROOM_CODE.get(env.ROOM_CODE.idFromName(code)).fetch(
      new Request("https://code/release", { method: "POST", headers: { "X-Room-Id": roomId } }),
    );
  } catch {
    // The entry expires on its own alarm.
  }
}

/** `GET /room/code/:code`: `{ roomId }` for a live code (any case), 404 otherwise. Per IP, in memory, no rows. */
async function resolveCode(
  request: Request,
  env: Env,
  deps: HandlerDeps,
  cors: Record<string, string>,
  raw: string,
): Promise<Response> {
  let typed: string;
  try {
    typed = decodeURIComponent(raw);
  } catch {
    return fail("not-found", cors);
  }
  const code = normalizeCodeInput(typed);
  if (code.length !== LOBBY_CODE_LENGTH || ![...code].every((ch) => CODE_ALPHABET.includes(ch))) {
    return fail("not-found", cors);
  }
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const now = deps.now();
  const limiter = env.RATE_LIMITER;
  const allowance = await limiter
    .get(limiter.idFromName(`ip:${clientKey(ip)}`))
    .fetch(new Request("https://limiter/room-lookup", { method: "POST", headers: { "X-Now": String(now) } }));
  if (allowance.status === 429) {
    const { retryAfterMs } = (await allowance.json()) as { retryAfterMs: number };
    return fail("rate-limited", cors, retryAfterMs);
  }
  if (!allowance.ok) return fail("server", cors);
  const found = await env.ROOM_CODE.get(env.ROOM_CODE.idFromName(code)).fetch(
    new Request("https://code/resolve", { method: "GET", headers: { "X-Now": String(now) } }),
  );
  if (!found.ok) return fail("not-found", cors);
  const { roomId } = (await found.json()) as RoomCodeResolved;
  return Response.json({ roomId } satisfies RoomCodeResolved, { headers: { ...cors, "Cache-Control": "no-store" } });
}

async function join(request: Request, env: Env, cors: Record<string, string>, id: string): Promise<Response> {
  if (!ROOM_ID_PATTERN.test(id)) return fail("not-found", cors);
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response(null, { status: 426, headers: { ...cors, Upgrade: "websocket" } });
  }
  // The room answers 404 for an id nobody created, before it upgrades; its response (101 or an error) goes straight back.
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(id)).fetch(request);
}
