/**
 * The three Durable Object classes, as thin wrappers: they turn an internal request from the Worker into a call on the
 * logic classes. They use the legacy `constructor(state, env)` + `fetch()` shape and do not import
 * `cloudflare:workers`, so tests construct them directly. The Worker passes its clock in an `X-Now` header so a test
 * clock reaches the object; a missing header falls back to the real time.
 */

import type { DurableObjectStateLike } from "./env.js";
import { PROOF_HEADER } from "./protocol.js";
import { RateLimiterLogic } from "./rate-limiter.js";
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
