/**
 * The two Durable Object classes, as thin wrappers: they turn an internal request from the Worker into a call on the
 * logic classes. They use the legacy `constructor(state, env)` + `fetch()` shape and do not import
 * `cloudflare:workers`, so tests construct them directly. The Worker passes its clock in an `X-Now` header so a test
 * clock reaches the object; a missing header falls back to the real time.
 */

import type { DurableObjectStateLike } from "./env.js";
import { PROOF_HEADER } from "./protocol.js";
import { RateLimiterLogic } from "./rate-limiter.js";
import { RoomLogic } from "./room.js";

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
    const { pathname } = new URL(request.url);
    const now = nowOf(request);
    if (pathname === "/upload") {
      const result = await this.limiter.takeUpload(now);
      return result.ok ? Response.json({ retryAfterMs: 0 }) : Response.json(result, { status: 429 });
    }
    if (pathname === "/attempt") {
      const result = await this.limiter.reserveAttempt(now);
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
