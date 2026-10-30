/**
 * The global win rate routes (`/global/...`, see `global-protocol.ts`). Uploads are anonymous and opt-in; what the Worker
 * guards is abuse: origin, body size, shape (every field is checked against the protocol's patterns), a per-IP allowance
 * and the store's own daily and key caps. It logs nothing from a request: no body, no address. The address is used only
 * to name the caller's limiter object, as the other routes do, and is never stored with a result.
 */

import type { HandlerDeps } from "./handler.js";
import { clientKey } from "./client-key.js";
import { preflightHeaders } from "./cors.js";
import type { DurableObjectNamespaceLike, Env } from "./env.js";
import {
  GLOBAL_MAX_BODY_BYTES,
  GLOBAL_VILLAIN_PATTERN,
  parseGlobalResult,
  type GlobalError,
  type GlobalErrorReason,
} from "./global-protocol.js";
import { readCappedText } from "./read-capped.js";

/** `/global/result`, `/global/stats`, `/global/cards`, `/global/status`. */
export const GLOBAL_PATH = /^\/global\/([^/]+)$/;

const MESSAGES: Record<GlobalErrorReason, string> = {
  disabled: "Global win rates are turned off right now.",
  origin: "This site is not allowed to use global win rates.",
  "bad-request": "That request was not understood.",
  "too-large": "That result is too large.",
  "rate-limited": "Too many requests. Try again later.",
  full: "Global win rates cannot take this result right now.",
  "not-found": "Nothing to show for that.",
  server: "Global win rates hit a problem. Try again.",
};

const STATUS: Record<GlobalErrorReason, number> = {
  disabled: 503,
  origin: 403,
  "bad-request": 400,
  "too-large": 413,
  "rate-limited": 429,
  full: 507,
  "not-found": 404,
  server: 500,
};

function fail(reason: GlobalErrorReason, headers: Record<string, string>, retryAfterMs?: number): Response {
  const body: GlobalError = { reason, error: MESSAGES[reason] };
  const extra =
    retryAfterMs === undefined ? {} : { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) };
  return Response.json(body, {
    status: STATUS[reason],
    headers: { ...headers, ...extra, "Cache-Control": "no-store" },
  });
}

const stubFor = (namespace: DurableObjectNamespaceLike, name: string) => namespace.get(namespace.idFromName(name));

export async function handleGlobal(
  request: Request,
  env: Env,
  deps: HandlerDeps,
  cors: Record<string, string>,
  origin: string | null,
  match: RegExpExecArray,
): Promise<Response> {
  const now = deps.now();
  const route = match[1];
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: origin ? preflightHeaders(origin) : {} });
  }
  if (env.GLOBAL_STATS_ENABLED !== "true") return fail("disabled", cors);

  // Status touches neither the limiter nor the store (the client asks before it offers the opt-in).
  if (route === "status" && request.method === "GET") {
    return Response.json({ global: true }, { headers: { ...cors, "Cache-Control": "no-store" } });
  }
  const isResult = route === "result" && request.method === "POST";
  const isStats = route === "stats" && request.method === "GET";
  const isCards = route === "cards" && request.method === "GET";
  if (!isResult && !isStats && !isCards) return fail("not-found", cors);

  try {
    // Everything that can be refused without storage is refused before any Durable Object is touched.
    let body = "";
    let villain = "";
    if (isResult) {
      const declared = request.headers.get("Content-Length");
      if (declared !== null && Number(declared) > GLOBAL_MAX_BODY_BYTES) return fail("too-large", cors);
      const text = await readCappedText(request.body, GLOBAL_MAX_BODY_BYTES);
      if (text === null) return fail("too-large", cors);
      let parsed = null;
      try {
        parsed = parseGlobalResult(JSON.parse(text));
      } catch {
        // Not JSON.
      }
      if (!parsed) return fail("bad-request", cors);
      body = JSON.stringify(parsed);
    } else if (isCards) {
      villain = new URL(request.url).searchParams.get("villain") ?? "";
      if (!GLOBAL_VILLAIN_PATTERN.test(villain)) return fail("bad-request", cors);
    }

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const allowance = await stubFor(env.RATE_LIMITER, `ip:${clientKey(ip)}`).fetch(
      new Request(`https://limiter/${isResult ? "global-result" : "global-read"}`, {
        method: "POST",
        headers: { "X-Now": String(now) },
      }),
    );
    if (allowance.status === 429) {
      const { retryAfterMs } = (await allowance.json()) as { retryAfterMs: number };
      return fail("rate-limited", cors, retryAfterMs);
    }
    if (!allowance.ok) return fail("server", cors);

    const store = stubFor(env.GLOBAL_STATS, "global");
    const headers = { "X-Now": String(now) };
    if (isResult) {
      const answer = await store.fetch(new Request("https://global/result", { method: "POST", headers, body }));
      if (answer.status === 429) {
        const { retryAfterMs } = (await answer.json()) as { retryAfterMs: number };
        return fail("rate-limited", cors, retryAfterMs);
      }
      if (answer.status === 507) return fail("full", cors);
      if (!answer.ok) return fail("server", cors);
      return new Response(answer.body, {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const answer = await store.fetch(
      new Request(isStats ? "https://global/stats" : `https://global/cards?villain=${encodeURIComponent(villain)}`, {
        headers,
      }),
    );
    if (answer.status === 404) return fail("not-found", cors);
    if (!answer.ok) return fail("server", cors);
    return new Response(answer.body, {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return fail("server", cors);
  }
}
