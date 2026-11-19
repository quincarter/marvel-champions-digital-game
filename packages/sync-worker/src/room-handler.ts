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
import type { RandomBytes } from "./room-code.js";
import {
  FIRST_TABLE,
  ROOM_ID_PATTERN,
  type RoomCreated,
  type RoomError,
  type RoomErrorReason,
} from "./room-protocol.js";
import { turnstileOk } from "./turnstile.js";

/** `/room` (create) and `/room/<id>/ws` (join); group 1 is the id, absent for a create. */
export const ROOM_PATH = /^\/room(?:\/([^/]*)\/ws)?$/;

const MAX_ID_ATTEMPTS = 5;
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

  const id = match[1];
  try {
    if (id === undefined && request.method === "POST") return await create(request, env, deps, cors);
    if (id !== undefined && request.method === "GET") return await join(request, env, cors, id);
  } catch {
    return fail("server", cors);
  }
  return fail("not-found", cors);
}

async function create(request: Request, env: Env, deps: HandlerDeps, cors: Record<string, string>): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (env.TURNSTILE_SECRET) {
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

  const hostToken = generateHostToken(deps.randomBytes);
  const hostTokenHash = await sha256Hex(hostToken);
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const roomId = generateReplayId(deps.randomBytes);
    const made = await env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId)).fetch(
      new Request("https://room/create", {
        method: "POST",
        headers: { "X-Now": String(now), "X-Host-Hash": hostTokenHash },
      }),
    );
    if (made.status === 409) continue;
    if (!made.ok) return fail("server", cors);
    const created: RoomCreated = { roomId, hostToken, table: FIRST_TABLE };
    return Response.json(created, { status: 201, headers: { ...cors, "Cache-Control": "no-store" } });
  }
  return fail("server", cors);
}

async function join(request: Request, env: Env, cors: Record<string, string>, id: string): Promise<Response> {
  if (!ROOM_ID_PATTERN.test(id)) return fail("not-found", cors);
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response(null, { status: 426, headers: { ...cors, Upgrade: "websocket" } });
  }
  // The room answers 404 for an id nobody created, before it upgrades; its response (101 or an error) goes straight back.
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(id)).fetch(request);
}
