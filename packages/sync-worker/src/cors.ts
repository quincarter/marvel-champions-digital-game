/**
 * CORS for the transfer and sync APIs. Only the origins in the `ALLOWED_ORIGINS` var get `Access-Control-Allow-Origin`; the
 * list may use `*` in a host (a Netlify preview name) or as a port (`http://localhost:*`).
 */

import { PROOF_HEADER, TURNSTILE_HEADER } from "./protocol.js";

function patternToRegExp(pattern: string): RegExp {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === "*") source += pattern[i - 1] === ":" ? "[0-9]*" : "[A-Za-z0-9-]*";
    else source += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

export function originAllowed(origin: string, allowedOrigins: string | undefined): boolean {
  return (allowedOrigins ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .some((entry) => patternToRegExp(entry).test(origin));
}

/** Headers for a response to an allowed origin; empty when there is no Origin (curl) or it is not allowed. */
export function corsHeaders(origin: string | null, allowedOrigins: string | undefined): Record<string, string> {
  if (!origin || !originAllowed(origin, allowedOrigins)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Expose-Headers": "Retry-After", Vary: "Origin" };
}

export function preflightHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": `Content-Type, Authorization, ${PROOF_HEADER}, ${TURNSTILE_HEADER}`,
    "Access-Control-Expose-Headers": "Retry-After",
    "Access-Control-Max-Age": "86400",
  };
}
