/**
 * The Durable Object classes, as thin wrappers: they turn an internal request from the Worker into a call on the
 * logic classes. They use the legacy `constructor(state, env)` + `fetch()` shape and do not import
 * `cloudflare:workers`, so tests construct them directly. The Worker passes its clock in an `X-Now` header so a test
 * clock reaches the object; a missing header falls back to the real time.
 */

import type { DurableObjectStateLike, Env, GameRoomStateLike, WebSocketLike } from "./env.js";
import { DEFAULT_GAME_ROOM_LIMITS, GameRoomLogic, type RoomCodeHooks, type RoomSocket } from "./game-room.js";
import { parseGlobalResult } from "./global-protocol.js";
import { GlobalStatsLogic } from "./global-stats.js";
import { PROOF_HEADER } from "./protocol.js";
import type { Participant } from "./room-protocol.js";
import { RateLimiterLogic } from "./rate-limiter.js";
import { ReplayQuotaLogic } from "./replay-quota.js";
import { RoomCodeLogic } from "./room-code-store.js";
import { RoomLogic } from "./room.js";
import { DEFAULT_MAX_SPACE_BYTES } from "./sync-protocol.js";
import { SyncSpaceLogic, type SyncOutcome } from "./sync-space.js";

const nowOf = (request: Request): number => {
  const header = Number(request.headers.get("X-Now"));
  return Number.isFinite(header) && header > 0 ? header : Date.now();
};

export class TransferRoom {
  private readonly room: RoomLogic;

  constructor(state: DurableObjectStateLike, _env?: unknown) {
    this.room = new RoomLogic(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const proof = request.headers.get(PROOF_HEADER) ?? "";
    const now = nowOf(request);
    if (pathname === "/store") {
      const body = new Uint8Array(await request.arrayBuffer());
      const ttl = Number(request.headers.get("X-Ttl"));
      const stored = await this.room.store(proof, body, now, ttl);
      return stored ? Response.json(stored, { status: 201 }) : new Response(null, { status: 409 });
    }
    if (pathname === "/claim") {
      const result = await this.room.claim(proof, now);
      return result.ok ? new Response(result.body as BodyInit) : new Response(null, { status: 404 });
    }
    return new Response(null, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.room.expire();
  }
}

export class RateLimiter {
  private readonly limiter: RateLimiterLogic;

  constructor(state: DurableObjectStateLike, _env?: unknown) {
    this.limiter = new RateLimiterLogic(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);
    const now = nowOf(request);
    if (pathname === "/upload") {
      const result = await this.limiter.takeUpload(now);
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/attempt") {
      const result = await this.limiter.reserveAttempt(now);
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/sync-attempt") {
      const result = await this.limiter.reserveSync(now, searchParams.get("space") ?? "");
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/sync-refund") {
      const rows = Number(searchParams.get("rows"));
      await this.limiter.refundSync(now, searchParams.get("space") ?? "", Number.isFinite(rows) ? rows : 0, now);
      return Response.json({ ok: true });
    }
    if (pathname === "/sync-create") {
      const result = await this.limiter.reserveCreate(now);
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/sync-create-release") {
      await this.limiter.releaseCreate(now, now);
      return Response.json({ ok: true });
    }
    if (pathname === "/global-result" || pathname === "/global-read") {
      const result =
        pathname === "/global-result" ? await this.limiter.takeGlobalResult(now) : this.limiter.takeGlobalRead(now);
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/replay-upload") {
      const result = await this.limiter.takeReplayUpload(now);
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/room-create") {
      const result = await this.limiter.takeRoomCreate(now);
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/room-lookup") {
      const result = this.limiter.takeRoomLookup(now);
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/refund") {
      await this.limiter.refund(now, now);
      return Response.json({ ok: true });
    }
    return new Response(null, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.limiter.sweep(Date.now());
  }
}

function outcomeResponse(outcome: SyncOutcome<unknown>, okStatus = 200): Response {
  if (outcome.ok) {
    return Response.json(outcome.value, { status: okStatus, headers: { "X-Rows-Written": String(outcome.rows) } });
  }
  return Response.json({ reason: outcome.reason, retryAfterMs: outcome.retryAfterMs ?? 0 }, { status: outcome.status });
}

/**
 * One sync space. The Worker authenticates nothing itself: it forwards the bearer token in `Authorization` and the
 * object checks it against the stored hash. `X-Max-Bytes` carries the Worker's MAX_SPACE_BYTES var.
 */
export class SyncSpace {
  private readonly space: SyncSpaceLogic;

  constructor(state: DurableObjectStateLike, _env?: unknown) {
    this.space = new SyncSpaceLogic(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = nowOf(request);
    const token = /^Bearer (\S+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1] ?? "";
    const declared = Number(request.headers.get("X-Max-Bytes"));
    const maxBytes = Number.isFinite(declared) && declared > 0 ? declared : DEFAULT_MAX_SPACE_BYTES;
    if (url.pathname === "/create") {
      const outcome = await this.space.create(token, now, maxBytes, request.headers.has("X-Existing-Only"));
      return outcomeResponse(outcome, outcome.ok && outcome.created ? 201 : 200);
    }
    if (url.pathname === "/info") return outcomeResponse(await this.space.info(token, now, maxBytes));
    if (url.pathname === "/changes") {
      const since = url.searchParams.get("since");
      return outcomeResponse(await this.space.changes(token, since === null ? 0 : Number(since), now));
    }
    if (url.pathname === "/batch") {
      return outcomeResponse(await this.space.batch(token, await request.text(), now, maxBytes));
    }
    if (url.pathname === "/wipe") {
      const outcome = await this.space.wipe(token, now);
      return outcome.ok ? new Response(null, { status: 204 }) : outcomeResponse(outcome);
    }
    return new Response(null, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.space.expire();
  }
}

/**
 * The global win rate store: one instance, named "global". Its input is a body the Worker already validated, but it is
 * parsed again here, so no caller can write a row the protocol would refuse.
 */
export class GlobalStats {
  private readonly stats: GlobalStatsLogic;

  constructor(state: DurableObjectStateLike, _env?: unknown) {
    this.stats = new GlobalStatsLogic(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = nowOf(request);
    if (url.pathname === "/result" && request.method === "POST") {
      let parsed;
      try {
        parsed = parseGlobalResult(JSON.parse(await request.text()));
      } catch {
        parsed = null;
      }
      if (!parsed) return Response.json({ reason: "bad-request" }, { status: 400 });
      const outcome = await this.stats.record(parsed, now);
      if (outcome.ok) return Response.json({ counted: outcome.counted });
      return Response.json(outcome, { status: outcome.reason === "full" ? 507 : 429 });
    }
    if (url.pathname === "/stats") return Response.json(await this.stats.stats(now));
    if (url.pathname === "/cards") {
      const cards = await this.stats.cards(url.searchParams.get("villain") ?? "");
      return cards ? Response.json(cards) : new Response(null, { status: 404 });
    }
    return new Response(null, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.stats.expire(Date.now());
  }
}

/**
 * The daily cap on replay uploads across the whole account: one instance, named "replays". `/take` carries the cap in
 * `X-Max`; `/refund` carries in `X-Taken-At` the clock value the slot was taken with.
 */
export class ReplayQuota {
  private readonly quota: ReplayQuotaLogic;

  constructor(state: DurableObjectStateLike, _env?: unknown) {
    this.quota = new ReplayQuotaLogic(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const now = nowOf(request);
    if (pathname === "/take") {
      const max = Number(request.headers.get("X-Max"));
      const result = await this.quota.take(now, Number.isFinite(max) ? max : 0);
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/refund") {
      await this.quota.refund(Number(request.headers.get("X-Taken-At")), now);
      return Response.json({ ok: true });
    }
    return new Response(null, { status: 404 });
  }
}

/**
 * One lobby room code (docs/live-game-rooms.md section 8), named by the code. `/claim` carries the room id and expiry in
 * `X-Room-Id` and `X-Expires` (409 when a live mapping holds the code), `/resolve` answers `{ roomId }` or 404, `/refresh`
 * and `/release` come from the room itself and need its id.
 */
export class RoomCode {
  private readonly codes: RoomCodeLogic;

  constructor(state: DurableObjectStateLike, _env?: unknown) {
    this.codes = new RoomCodeLogic(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const now = nowOf(request);
    const roomId = request.headers.get("X-Room-Id") ?? "";
    const expires = Number(request.headers.get("X-Expires"));
    if (pathname === "/claim") {
      if (!roomId || !Number.isFinite(expires)) return new Response(null, { status: 400 });
      return new Response(null, { status: (await this.codes.claim(roomId, expires, now)) ? 201 : 409 });
    }
    if (pathname === "/resolve") {
      const found = await this.codes.resolve(now);
      return found ? Response.json({ roomId: found }) : new Response(null, { status: 404 });
    }
    if (pathname === "/refresh") {
      if (!roomId || !Number.isFinite(expires)) return new Response(null, { status: 400 });
      return new Response(null, { status: (await this.codes.refresh(roomId, expires)) ? 204 : 404 });
    }
    if (pathname === "/release") {
      return new Response(null, { status: (await this.codes.release(roomId)) ? 204 : 404 });
    }
    return new Response(null, { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.codes.expire(Date.now());
  }
}

const positive = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** The room's calls to its code's directory entry; absent when the Worker has no `ROOM_CODE` binding. */
function codeHooks(env: Env | undefined): RoomCodeHooks | undefined {
  const ns = env?.ROOM_CODE;
  if (!ns) return undefined;
  // A failed call (an error status, not a 404 for a code that is not ours) is tried once more, then thrown for the
  // room to ignore: the directory entry has a margin past the room's expiry, so a miss costs nothing at once.
  const call = async (path: string, code: string, roomId: string, expiresAt?: number) => {
    for (let attempt = 0; ; attempt++) {
      const res = await ns.get(ns.idFromName(code)).fetch(
        new Request(`https://code${path}`, {
          method: "POST",
          headers: { "X-Room-Id": roomId, ...(expiresAt === undefined ? {} : { "X-Expires": String(expiresAt) }) },
        }),
      );
      if (res.ok || res.status === 404) return;
      if (attempt === 1) throw new Error(`room code ${path} failed: ${res.status}`);
    }
  };
  return {
    refresh: (code, roomId, expiresAt) => call("/refresh", code, roomId, expiresAt),
    release: (code, roomId) => call("/release", code, roomId),
  };
}

/**
 * One live game room (docs/live-game-rooms.md), named by its room id. The Worker's `/create` call makes it; `/ws`
 * takes a WebSocket through the Hibernation API, so an idle room costs no duration. Each socket's participant rides
 * in its attachment, which is what lets a woken room know who is connected.
 */
export class GameRoom {
  private readonly room: GameRoomLogic;
  private readonly state: GameRoomStateLike;
  private readonly maxSockets: number;
  private readonly adapted = new WeakMap<WebSocketLike, RoomSocket>();

  constructor(state: GameRoomStateLike, env?: Env) {
    this.state = state;
    const maxParticipants = positive(env?.MAX_ROOM_PARTICIPANTS, DEFAULT_GAME_ROOM_LIMITS.maxParticipants);
    // Sockets that have not said hello yet are not participants; this bounds them.
    this.maxSockets = maxParticipants + 5;
    this.room = new GameRoomLogic(
      state.storage,
      {
        maxParticipants,
        maxMessageBytes: positive(env?.MAX_ROOM_MESSAGE_BYTES, DEFAULT_GAME_ROOM_LIMITS.maxMessageBytes),
        maxLogBytes: positive(env?.MAX_ROOM_LOG_BYTES, DEFAULT_GAME_ROOM_LIMITS.maxLogBytes),
      },
      undefined,
      codeHooks(env),
    );
    for (const ws of state.getWebSockets()) this.room.restore(this.socketOf(ws));
  }

  private socketOf(ws: WebSocketLike): RoomSocket {
    let socket = this.adapted.get(ws);
    if (!socket) {
      socket = {
        send: (text) => ws.send(text),
        close: (code, reason) => ws.close(code, reason),
        getParticipant: () => (ws.deserializeAttachment() as Participant | null) ?? null,
        setParticipant: (participant) => ws.serializeAttachment(participant),
        clearParticipant: () => ws.serializeAttachment(null),
      };
      this.adapted.set(ws, socket);
    }
    return socket;
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/create" && request.method === "POST") {
      const code = request.headers.get("X-Code");
      const created = await this.room.create(
        request.headers.get("X-Host-Hash") ?? "",
        nowOf(request),
        code ? { code, roomId: request.headers.get("X-Room-Id") ?? "" } : undefined,
      );
      return new Response(null, { status: created ? 201 : 409 });
    }
    if (pathname.endsWith("/ws")) {
      if (!(await this.room.exists())) return new Response(null, { status: 404 });
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response(null, { status: 426 });
      if (!this.makeRoomForSocket()) return new Response(null, { status: 503 });
      const { WebSocketPair } = globalThis as unknown as {
        WebSocketPair: new () => { 0: WebSocketLike; 1: WebSocketLike };
      };
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
    }
    return new Response(null, { status: 404 });
  }

  /**
   * At the socket cap, drops one socket that never said hello to make room (so idle strangers cannot lock the host
   * out); false when every socket is a participant.
   */
  private makeRoomForSocket(): boolean {
    const open = this.state.getWebSockets();
    if (open.length < this.maxSockets) return true;
    const stranger = open.find((ws) => !ws.deserializeAttachment());
    if (!stranger) return false;
    try {
      stranger.close(1013, "busy");
    } catch {
      // Already closing.
    }
    return true;
  }

  async webSocketMessage(ws: WebSocketLike, message: string | ArrayBuffer): Promise<void> {
    await this.room.message(this.socketOf(ws), message);
  }

  async webSocketClose(ws: WebSocketLike, code?: number, reason?: string): Promise<void> {
    await this.room.close(this.socketOf(ws));
    try {
      ws.close(code && code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 ? code : 1000, reason);
    } catch {
      // Already closed.
    }
  }

  async webSocketError(ws: WebSocketLike): Promise<void> {
    await this.room.close(this.socketOf(ws));
  }

  async alarm(): Promise<void> {
    await this.room.alarm(Date.now());
  }
}
