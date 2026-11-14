/**
 * The replay share-link routes (`POST /replay`, `GET /replay/:id`, see `replay-protocol.ts`). A replay is stored in R2
 * as the text the client sent, under a random id. What the Worker guards is abuse: origin, size, shape, the optional
 * Turnstile check, a per-IP daily allowance of uploads and an account-wide daily cap (the ReplayQuota object), so a
 * flood from many addresses cannot write past R2's free tier either. It logs nothing from a request.
 *
 * A read touches only R2 (one Class B operation), never the limiter, so it writes no Durable Object row; a flood of
 * reads is what REPLAYS_ENABLED is for.
 */

import type { HandlerDeps } from "./handler.js";
import { clientKey } from "./client-key.js";
import { preflightHeaders } from "./cors.js";
import type { DurableObjectNamespaceLike, Env } from "./env.js";
import { TURNSTILE_HEADER } from "./protocol.js";
import { readCappedText } from "./read-capped.js";
import {
  DEFAULT_MAX_REPLAY_BYTES,
  DEFAULT_MAX_REPLAYS_PER_DAY,
  REPLAY_ID_ALPHABET,
  REPLAY_ID_LENGTH,
  REPLAY_ID_PATTERN,
  isReplayText,
  type ReplayCreated,
  type ReplayError,
  type ReplayErrorReason,
} from "./replay-protocol.js";
import type { RandomBytes } from "./room-code.js";
import { turnstileOk } from "./turnstile.js";

/** `/replay` (upload) and `/replay/<id>` (fetch); group 1 is the id, absent for an upload. */
export const REPLAY_PATH = /^\/replay(?:\/([^/]*))?$/;

const MAX_ID_ATTEMPTS = 5;

const MESSAGES: Record<ReplayErrorReason, string> = {
  disabled: "Replay links are turned off right now.",
  origin: "This site is not allowed to use replay links.",
  "bad-request": "That replay request was not understood.",
  "too-large": "That replay is too large to share online.",
  "rate-limited": "Too many replays shared from this network. Try again later.",
  turnstile: "The human check failed. Try again.",
  "not-found": "No replay matches that link. It may have expired.",
  full: "Replay links have taken all the replays they can today. Try again tomorrow.",
  server: "Replay links hit a problem. Try again.",
};

const STATUS: Record<ReplayErrorReason, number> = {
  disabled: 503,
  origin: 403,
  "bad-request": 400,
  "too-large": 413,
  "rate-limited": 429,
  turnstile: 403,
  "not-found": 404,
  full: 503,
  server: 500,
};

function fail(reason: ReplayErrorReason, headers: Record<string, string>, retryAfterMs?: number): Response {
  const body: ReplayError = { reason, error: MESSAGES[reason] };
  const extra =
    retryAfterMs === undefined ? {} : { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) };
  return Response.json(body, {
    status: STATUS[reason],
    headers: { ...headers, ...extra, "Cache-Control": "no-store" },
  });
}

const stubFor = (namespace: DurableObjectNamespaceLike, name: string) => namespace.get(namespace.idFromName(name));

function maxReplayBytes(env: Env): number {
  const parsed = Number.parseInt(env.MAX_REPLAY_BYTES ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_REPLAY_BYTES;
}

function maxReplaysPerDay(env: Env): number {
  const parsed = Number.parseInt(env.MAX_REPLAYS_PER_DAY ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_REPLAYS_PER_DAY;
}

/** 64 symbols divide 256, so `byte & 63` is unbiased. */
export function generateReplayId(randomBytes: RandomBytes): string {
  let id = "";
  for (const byte of randomBytes(REPLAY_ID_LENGTH)) id += REPLAY_ID_ALPHABET[byte & 63];
  return id;
}

export async function handleReplay(
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
  if (env.REPLAYS_ENABLED !== "true") return fail("disabled", cors);

  const id = match[1];
  try {
    if (id === undefined && request.method === "POST") return await upload(request, env, deps, cors);
    if (id !== undefined && request.method === "GET") return await download(env, cors, id);
  } catch {
    return fail("server", cors);
  }
  return fail("not-found", cors);
}

async function upload(request: Request, env: Env, deps: HandlerDeps, cors: Record<string, string>): Promise<Response> {
  // Everything that can be refused without storage is refused before the limiter or R2 is touched.
  const cap = maxReplayBytes(env);
  const declared = request.headers.get("Content-Length");
  if (declared !== null && Number(declared) > cap) return fail("too-large", cors);
  const text = await readCappedText(request.body, cap);
  if (text === null) return fail("too-large", cors);
  if (!isReplayText(text)) return fail("bad-request", cors);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (env.TURNSTILE_SECRET) {
    const token = request.headers.get(TURNSTILE_HEADER) ?? "";
    if (!token || !(await turnstileOk(env.TURNSTILE_SECRET, token, ip, deps.fetch))) return fail("turnstile", cors);
  }

  const now = deps.now();
  const allowance = await stubFor(env.RATE_LIMITER, `ip:${clientKey(ip)}`).fetch(
    new Request("https://limiter/replay-upload", { method: "POST", headers: { "X-Now": String(now) } }),
  );
  if (allowance.status === 429) {
    const { retryAfterMs } = (await allowance.json()) as { retryAfterMs: number };
    return fail("rate-limited", cors, retryAfterMs);
  }
  if (!allowance.ok) return fail("server", cors);

  const quota = stubFor(env.REPLAY_QUOTA, "replays");
  const slot = await quota.fetch(
    new Request("https://quota/take", {
      method: "POST",
      headers: { "X-Now": String(now), "X-Max": String(maxReplaysPerDay(env)) },
    }),
  );
  if (slot.status === 429) {
    const { retryAfterMs } = (await slot.json()) as { retryAfterMs: number };
    return fail("full", cors, retryAfterMs);
  }
  if (!slot.ok) return fail("server", cors);

  // From here a slot is held: anything but a stored replay gives it back, so the cap counts only what R2 holds.
  try {
    const id = await store(env, deps, text, now);
    if (id !== null) {
      const created: ReplayCreated = { id };
      return Response.json(created, { status: 201, headers: { ...cors, "Cache-Control": "no-store" } });
    }
  } catch {
    // Refunded below.
  }
  await quota.fetch(
    new Request("https://quota/refund", {
      method: "POST",
      headers: { "X-Now": String(deps.now()), "X-Taken-At": String(now) },
    }),
  );
  return fail("server", cors);
}

/** Writes the replay under a fresh id; null when every id drawn was taken. */
async function store(env: Env, deps: HandlerDeps, text: string, now: number): Promise<string | null> {
  const createdAt = new Date(now).toISOString();
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = generateReplayId(deps.randomBytes);
    // `etagDoesNotMatch: "*"` writes only when no object has the key; R2 answers null when one does.
    const stored = await env.REPLAYS.put(id, text, {
      onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
      customMetadata: { createdAt },
    });
    if (stored !== null) return id;
  }
  return null;
}

async function download(env: Env, cors: Record<string, string>, id: string): Promise<Response> {
  if (!REPLAY_ID_PATTERN.test(id)) return fail("bad-request", cors);
  const object = await env.REPLAYS.get(id);
  if (object === null) return fail("not-found", cors);
  // A replay never changes once stored, so browsers and the edge may keep it for a year.
  return new Response(object.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
