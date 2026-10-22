/**
 * The Worker's HTTP surface: `POST /transfer` and `GET /transfer/:room`. The Worker never sees a save in the clear (the
 * client encrypts it), so what it guards is abuse: origin, size, rate and guessing. It logs nothing from a request;
 * bodies and proofs never reach a log line.
 *
 * Clock, random bytes and `fetch` (for Turnstile) are injected so tests control them.
 */

import { corsHeaders, originAllowed, preflightHeaders } from "./cors.js";
import type { DurableObjectNamespaceLike, Env } from "./env.js";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  PROOF_HEADER,
  PROOF_PATTERN,
  TRANSFER_TTL_MS,
  TURNSTILE_HEADER,
  isRoomCode,
  type TransferCreated,
  type TransferError,
  type TransferErrorReason,
} from "./protocol.js";
import { defaultRandomBytes, generateRoomCode, type RandomBytes } from "./room-code.js";

export interface HandlerDeps {
  readonly now: () => number;
  readonly randomBytes: RandomBytes;
  readonly fetch: typeof fetch;
}

export const defaultDeps: HandlerDeps = {
  now: () => Date.now(),
  randomBytes: defaultRandomBytes,
  fetch: (input, init) => fetch(input, init),
};

const MAX_CODE_ATTEMPTS = 5;
const TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const MESSAGES: Record<TransferErrorReason, string> = {
  disabled: "Online transfer is turned off right now.",
  origin: "This site is not allowed to use online transfer.",
  "bad-request": "That transfer request was not understood.",
  "too-large": "That save is too large to transfer online.",
  "rate-limited": "Too many transfers from this network. Try again later.",
  blocked: "Too many wrong codes from this network. Try again later.",
  turnstile: "The human check failed. Try again.",
  "not-found": "No transfer matches that code. It may have expired or been used already.",
  server: "Online transfer hit a problem. Try again.",
};

const STATUS: Record<TransferErrorReason, number> = {
  disabled: 503,
  origin: 403,
  "bad-request": 400,
  "too-large": 413,
  "rate-limited": 429,
  blocked: 429,
  turnstile: 403,
  "not-found": 404,
  server: 500,
};

function fail(reason: TransferErrorReason, headers: Record<string, string>, retryAfterMs?: number): Response {
  const body: TransferError = { reason, error: MESSAGES[reason] };
  const extra =
    retryAfterMs === undefined ? {} : { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) };
  return Response.json(body, {
    status: STATUS[reason],
    headers: { ...headers, ...extra, "Cache-Control": "no-store" },
  });
}

function maxUploadBytes(env: Env): number {
  const parsed = Number.parseInt(env.MAX_UPLOAD_BYTES ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
}

/** Reads at most `cap` bytes; `null` when the stream carries more (whatever Content-Length claimed). */
async function readCapped(body: ReadableStream<Uint8Array> | null, cap: number): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function turnstileOk(secret: string, token: string, ip: string, doFetch: typeof fetch): Promise<boolean> {
  const form = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") form.set("remoteip", ip);
  try {
    const answer = await doFetch(TURNSTILE_URL, { method: "POST", body: form });
    return answer.ok && ((await answer.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

function stubFor(namespace: DurableObjectNamespaceLike, name: string) {
  return namespace.get(namespace.idFromName(name));
}

/** IPv6 clients are keyed by their /64 (one subscriber holds the whole prefix); IPv4 by address. */
export function clientKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1]!;
  const [head = "", tail] = ip.split("::");
  const front = head === "" ? [] : head.split(":");
  const back = tail === undefined || tail === "" ? [] : tail.split(":");
  const groups =
    tail === undefined
      ? front
      : [...front, ...Array<string>(Math.max(0, 8 - front.length - back.length)).fill("0"), ...back];
  const prefix = groups.slice(0, 4).map((g) => (Number.parseInt(g || "0", 16) || 0).toString(16));
  return `v6:${prefix.join(":")}`;
}

async function limiterCall(env: Env, ip: string, path: string, now: number): Promise<Response> {
  return stubFor(env.RATE_LIMITER, `ip:${clientKey(ip)}`).fetch(
    new Request(`https://limiter${path}`, { method: "POST", headers: { "X-Now": String(now) } }),
  );
}

async function retryAfterOf(response: Response): Promise<number> {
  return ((await response.json()) as { retryAfterMs: number }).retryAfterMs;
}

export async function handleRequest(request: Request, env: Env, deps: HandlerDeps = defaultDeps): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

  if (origin && !originAllowed(origin, env.ALLOWED_ORIGINS)) return fail("origin", {});

  const roomMatch = /^\/transfer\/([^/]+)$/.exec(url.pathname);
  const isUpload = url.pathname === "/transfer";
  if (!isUpload && !roomMatch) return fail("not-found", cors);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: origin ? preflightHeaders(origin) : {} });
  }
  if (env.TRANSFERS_ENABLED !== "true") return fail("disabled", cors);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const proof = request.headers.get(PROOF_HEADER) ?? "";
  const now = deps.now();

  try {
    if (isUpload && request.method === "POST") return await upload(request, env, deps, cors, ip, proof, now);
    if (roomMatch && request.method === "GET") return await download(env, cors, ip, roomMatch[1]!, proof, now);
  } catch {
    return fail("server", cors);
  }
  return fail("not-found", cors);
}

async function upload(
  request: Request,
  env: Env,
  deps: HandlerDeps,
  cors: Record<string, string>,
  ip: string,
  proof: string,
  now: number,
): Promise<Response> {
  if (!PROOF_PATTERN.test(proof)) return fail("bad-request", cors);
  const cap = maxUploadBytes(env);
  const declared = request.headers.get("Content-Length");
  if (declared !== null && Number(declared) > cap) return fail("too-large", cors);

  if (env.TURNSTILE_SECRET) {
    const token = request.headers.get(TURNSTILE_HEADER) ?? "";
    if (!token || !(await turnstileOk(env.TURNSTILE_SECRET, token, ip, deps.fetch))) return fail("turnstile", cors);
  }

  const allowance = await limiterCall(env, ip, "/upload", now);
  if (allowance.status === 429) return fail("rate-limited", cors, await retryAfterOf(allowance));
  if (!allowance.ok) return fail("server", cors);

  const body = await readCapped(request.body, cap);
  if (body === null) return fail("too-large", cors);
  if (body.length === 0) return fail("bad-request", cors);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode(deps.randomBytes);
    const stored = await stubFor(env.TRANSFER_ROOM, code).fetch(
      new Request("https://room/store", {
        method: "POST",
        headers: { [PROOF_HEADER]: proof, "X-Now": String(now), "X-Ttl": String(TRANSFER_TTL_MS) },
        body: body as BodyInit,
      }),
    );
    if (stored.status === 409) continue;
    if (!stored.ok) return fail("server", cors);
    const { expiresAt } = (await stored.json()) as { expiresAt: number };
    const created: TransferCreated = { code, expiresAt };
    return Response.json(created, { status: 201, headers: { ...cors, "Cache-Control": "no-store" } });
  }
  return fail("server", cors);
}

async function download(
  env: Env,
  cors: Record<string, string>,
  ip: string,
  room: string,
  proof: string,
  now: number,
): Promise<Response> {
  const attempt = await limiterCall(env, ip, "/attempt", now);
  if (attempt.status === 429) return fail("blocked", cors, await retryAfterOf(attempt));
  if (!attempt.ok) return fail("server", cors);

  const notFound = () => fail("not-found", cors);
  if (!isRoomCode(room) || !PROOF_PATTERN.test(proof)) return notFound();

  const claimed = await stubFor(env.TRANSFER_ROOM, room).fetch(
    new Request("https://room/claim", { method: "POST", headers: { [PROOF_HEADER]: proof, "X-Now": String(now) } }),
  );
  if (!claimed.ok) return notFound();
  await limiterCall(env, ip, "/refund", now);
  return new Response(claimed.body, {
    status: 200,
    headers: { ...cors, "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}
