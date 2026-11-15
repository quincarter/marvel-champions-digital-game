/**
 * What the game's Cloudflare Worker (`wrangler.game.jsonc`, `mc-game`, entry `game-worker.ts`) does: everything is static assets except MarvelCDB deck
 * import by link, which `run_worker_first` sends here. Netlify proxied `/api/marvelcdb-import/*` to MarvelCDB in
 * `netlify.toml`; Cloudflare's `_redirects` can't proxy another domain, so this is the few lines of code that do it
 * (docs/custom-content-packs.md §4.1). Only those requests count toward the free plan's 100,000 Worker requests a day;
 * every page, script and card scan is served as an asset, which is free.
 *
 * The answer has the same shape the dev server's route gives (`vite-marvelcdb-import.ts`) and a packaged app builds
 * from native HTTP (`platform/deck-fetch.ts`): the upstream JSON on success, `{ error }` with a status otherwise, all
 * shaped by `platform/marvelcdb-upstream.ts`.
 */
import {
  deckImportError,
  interpretDeckResponse,
  marvelCdbDeckUrl,
  type DeckImportAnswer,
} from "../platform/marvelcdb-upstream.js";

/** Must match `ROUTE` in `platform/deck-fetch.ts` and `run_worker_first` in `wrangler.game.jsonc`. */
export const MARVELCDB_IMPORT_ROUTE = "/api/marvelcdb-import/";

const REF_PATTERN = /^(decklist|deck)\/(\d+)$/;

/** The static assets binding (`assets.binding` in `wrangler.game.jsonc`). */
export interface GameWorkerEnv {
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
}

function answer(result: DeckImportAnswer): Response {
  const headers = new Headers({ "content-type": "application/json" });
  // Never cached: a deck a player is editing on MarvelCDB should reimport with its latest contents.
  headers.set("cache-control", "no-store");
  return new Response(result.body, { status: result.status, headers });
}

/** Answers one MarvelCDB import request; `upstreamFetch` is the Worker's `fetch`, injected for the tests. */
export async function marvelCdbImport(pathname: string, upstreamFetch: typeof fetch): Promise<Response> {
  const match = REF_PATTERN.exec(pathname.slice(MARVELCDB_IMPORT_ROUTE.length));
  if (!match) return answer(deckImportError(400, "expected /api/marvelcdb-import/decklist/<id> or /deck/<id>"));
  const kind = match[1] as "decklist" | "deck";
  const id = match[2]!;
  let upstream: Response;
  let body: string;
  try {
    // A private or unknown `deck` redirects to MarvelCDB's HTML login page, which `interpretDeckResponse` reads as
    // "nothing at that id" from its content type.
    upstream = await upstreamFetch(marvelCdbDeckUrl(kind, id));
    // Inside the try as well: a connection reset or a truncated body rejects here, and gets the same JSON error as a
    // failed request rather than the runtime's own 500.
    body = await upstream.text();
  } catch (cause) {
    return answer(
      deckImportError(502, `could not reach MarvelCDB: ${cause instanceof Error ? cause.message : String(cause)}`),
    );
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  return answer(interpretDeckResponse(kind, id, { ok: upstream.ok, contentType, body }));
}

export async function handleGameRequest(
  request: Request,
  env: GameWorkerEnv,
  upstreamFetch: typeof fetch = (...args) => fetch(...args),
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith(MARVELCDB_IMPORT_ROUTE)) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    }
    return marvelCdbImport(pathname, upstreamFetch);
  }
  // Anything else that reaches the script (a request no asset matched that isn't a page navigation) goes back to the
  // assets, which answer with the game's page (`not_found_handling: "single-page-application"`).
  return env.ASSETS.fetch(request);
}
