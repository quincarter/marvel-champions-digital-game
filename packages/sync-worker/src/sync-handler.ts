/**
 * The device-sync routes (`/sync/<spaceId>...`, see `sync-protocol.ts`). Like the transfer routes, the Worker sees only
 * ciphertext; what it guards is abuse. Every request is counted up front against the caller's sync counters in the
 * RateLimiter object (a request and, until it authenticates, a failure), so parallel guesses cannot all slip in before
 * any failure lands; a request that reaches a space with the right token gets its failure refunded.
 */

import type { HandlerDeps } from "./handler.js";
import { clientKey } from "./client-key.js";
import { preflightHeaders } from "./cors.js";
import type { DurableObjectNamespaceLike, Env } from "./env.js";
import { TURNSTILE_HEADER, type TransferErrorReason } from "./protocol.js";
import { turnstileOk } from "./turnstile.js";
import {
  DEFAULT_MAX_SPACE_BYTES,
  MAX_BATCH_BYTES,
  SPACE_ID_PATTERN,
  TOKEN_PATTERN,
  type SyncError,
  type SyncErrorReason,
} from "./sync-protocol.js";

/** `/sync/<id>`, `/sync/<id>/changes`, `/sync/<id>/batch`. */
export const SYNC_PATH = /^\/sync\/([^/]+)(?:\/(changes|batch))?$/;

type Reason = TransferErrorReason | SyncErrorReason;

const MESSAGES: Record<Reason, string> = {
  disabled: "Device sync is turned off right now.",
  origin: "This site is not allowed to use device sync.",
  "bad-request": "That sync request was not understood.",
  "too-many-ops": "That sync batch has too many changes.",
  "too-large": "That sync change is too large.",
  "space-full": "Your sync space is full. Delete some saves to make room.",
  "rate-limited": "Too many sync requests. Try again later.",
  blocked: "Too many failed sync attempts from this network. Try again later.",
  turnstile: "The human check failed. Try again.",
  "not-found": "No sync space matches that recovery code.",
  server: "Device sync hit a problem. Try again.",
};

const STATUS: Record<Reason, number> = {
  disabled: 503,
  origin: 403,
  "bad-request": 400,
  "too-many-ops": 400,
  "too-large": 413,
  "space-full": 413,
  "rate-limited": 429,
  blocked: 429,
  turnstile: 403,
  "not-found": 404,
  server: 500,
};

function fail(reason: Reason, headers: Record<string, string>, retryAfterMs?: number): Response {
  const body: SyncError = { reason, error: MESSAGES[reason] };
  const extra =
    retryAfterMs === undefined ? {} : { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) };
  return Response.json(body, {
    status: STATUS[reason],
    headers: { ...headers, ...extra, "Cache-Control": "no-store" },
  });
}

function stubFor(namespace: DurableObjectNamespaceLike, name: string) {
  return namespace.get(namespace.idFromName(name));
}

async function retryAfterOf(response: Response): Promise<number> {
  return ((await response.json()) as { retryAfterMs: number }).retryAfterMs;
}

function maxSpaceBytes(env: Env): number {
  const parsed = Number.parseInt(env.MAX_SPACE_BYTES ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_SPACE_BYTES;
}

/** Room for a batch at MAX_BATCH_BYTES of data: base64 is 4/3 of the bytes, plus the JSON around each op. */
const MAX_BODY_BYTES = Math.ceil((MAX_BATCH_BYTES * 4) / 3) + 64 * 1024;

async function readCappedText(body: ReadableStream<Uint8Array> | null, cap: number): Promise<string | null> {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function handleSync(
  request: Request,
  env: Env,
  deps: HandlerDeps,
  cors: Record<string, string>,
  origin: string | null,
  match: RegExpExecArray,
): Promise<Response> {
  const now = deps.now();
  const [, spaceId = "", sub] = match;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: origin ? preflightHeaders(origin) : {} });
  }
  if (env.SYNC_ENABLED !== "true") return fail("disabled", cors);

  // Method and route pairs; anything else is not a route (and costs the caller nothing).
  const route =
    sub === "changes" && request.method === "GET"
      ? "/changes"
      : sub === "batch" && request.method === "POST"
        ? "/batch"
        : sub === undefined && request.method === "POST"
          ? "/create"
          : sub === undefined && request.method === "GET"
            ? "/info"
            : sub === undefined && request.method === "DELETE"
              ? "/wipe"
              : null;
  if (!route) return fail("not-found", cors);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const isCreate = route === "/create";
  const validSpace = SPACE_ID_PATTERN.test(spaceId);
  // The space id names the failure bucket; anything that is not a space id shares one.
  const space = validSpace ? spaceId : "invalid";
  const limiterCall = (path: string, query = "") =>
    stubFor(env.RATE_LIMITER, `ip:${clientKey(ip)}`).fetch(
      new Request(`https://limiter${path}${query}`, { method: "POST", headers: { "X-Now": String(now) } }),
    );
  // The failure counted up front is taken back for anything that is not a failed attempt; rows the space wrote are
  // charged to the IP. The batch is already committed by then, so a limiter that fails here must not fail the request.
  const refund = async (rows = 0) => {
    try {
      await limiterCall("/sync-refund", `?space=${space}&rows=${rows}`);
    } catch {
      // Best effort.
    }
  };

  let reserved = false;
  let slot = false;
  let existingOnly = false;
  let quotaRetryMs = 0;
  try {
    if (isCreate && env.TURNSTILE_SECRET) {
      const token = request.headers.get(TURNSTILE_HEADER) ?? "";
      if (!token || !(await turnstileOk(env.TURNSTILE_SECRET, token, ip, deps.fetch))) return fail("turnstile", cors);
    }

    const allowance = await limiterCall("/sync-attempt", `?space=${space}`);
    if (allowance.status === 429) {
      const { reason, retryAfterMs } = (await allowance.json()) as { reason: Reason; retryAfterMs: number };
      return fail(reason, cors, retryAfterMs);
    }
    if (!allowance.ok) return fail("server", cors);
    reserved = true;

    const token = /^Bearer (\S+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1] ?? "";
    if (!validSpace || !TOKEN_PATTERN.test(token)) return fail("not-found", cors);

    if (isCreate) {
      const taken = await limiterCall("/sync-create");
      if (taken.status === 429) {
        // Over the daily quota of new spaces: an existing space can still be confirmed, nothing new is made.
        existingOnly = true;
        quotaRetryMs = await retryAfterOf(taken);
      } else if (taken.ok) {
        slot = true;
      } else {
        return fail("server", cors);
      }
    }

    let body: string | null = null;
    if (route === "/batch") {
      const declared = request.headers.get("Content-Length");
      if (declared !== null && Number(declared) > MAX_BODY_BYTES) return fail("too-large", cors);
      body = await readCappedText(request.body, MAX_BODY_BYTES);
      if (body === null) return fail("too-large", cors);
    }

    const search = route === "/changes" ? new URL(request.url).search : "";
    const answer = await stubFor(env.SYNC_SPACE, spaceId).fetch(
      new Request(`https://space${route}${search}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Now": String(now),
          "X-Max-Bytes": String(maxSpaceBytes(env)),
          ...(existingOnly ? { "X-Existing-Only": "1" } : {}),
        },
        ...(body === null ? {} : { body }),
      }),
    );
    if (existingOnly && answer.status !== 200) {
      reserved = false;
      await refund();
      return fail("rate-limited", cors, quotaRetryMs);
    }
    // A create that made no new space gives its slot back (an existing space, or a wrong token).
    if (slot && answer.status !== 201) {
      slot = false;
      await limiterCall("/sync-create-release").catch(() => undefined);
    }
    // A wrong token and a missing space look alike, and keep the failure counted.
    if (answer.status === 404) return fail("not-found", cors);
    reserved = false;
    await refund(Number(answer.headers.get("X-Rows-Written")) || 0);
    if (!answer.ok) {
      const { reason, retryAfterMs } = (await answer.json()) as { reason: Reason; retryAfterMs?: number };
      return fail(reason, cors, reason === "rate-limited" ? retryAfterMs : undefined);
    }
    if (answer.status === 204) {
      return new Response(null, { status: 204, headers: { ...cors, "Cache-Control": "no-store" } });
    }
    return new Response(answer.body, {
      status: answer.status,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    // Our fault, not the caller's: give back the failure and any create slot.
    if (slot) await limiterCall("/sync-create-release").catch(() => undefined);
    if (reserved) await refund();
    return fail("server", cors);
  }
}
