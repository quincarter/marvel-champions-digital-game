/**
 * Same-origin proxying for MarvelCDB deck import, dev/preview only.
 *
 * The user's decision (PLAN.md Phase 9, "Decided 2026-09-13"): paste works
 * everywhere; import by MarvelCDB deck URL or id goes through a same-origin
 * route that exists only in dev/preview, with paste as the fallback that must
 * work regardless. This mirrors `vite-card-art.ts`'s reasoning and its "a
 * production build 404s, and that is a supported outcome" stance — a client
 * built for production has no middleware, so `/api/marvelcdb-import/*` 404s
 * there and the Decks screen falls back to paste.
 *
 * **What was actually observed fetching MarvelCDB live (2026-09-13), and why
 * this route still exists even though the news was better than expected:**
 * `GET /api/public/decklist/<id>.json` and `GET /api/public/deck/<id>.json`
 * *do* send `access-control-allow-origin: *` on a successful response — unlike
 * the card-art CDN, these two endpoints are not flatly CORS-walled. But the
 * *failure* shapes are not uniformly CORS-enabled and are actively
 * misleading read directly:
 *   - an unknown `decklist` id answers HTTP 200 with an **empty body** (no
 *     ACAO header on that particular response, and nothing to parse anyway);
 *   - an unknown or private `deck` id answers with a 302 **redirect to
 *     `/login`**, whose target is an HTML page, not JSON, and does not carry
 *     an ACAO header either — so `fetch`'s default (redirect-following, CORS)
 *     mode cross-origin would surface this as an opaque network failure,
 *     indistinguishable from every other kind of failure.
 * A same-origin route turns both into one clear, same-shape JSON error the
 * client can show a message from, and sidesteps relying on a third party's
 * CORS headers being present on every response shape rather than just the
 * happy path.
 */
import type { ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";

export const MARVELCDB_IMPORT_ROUTE = "/api/marvelcdb-import/";

const REF_PATTERN = /^(decklist|deck)\/(\d+)$/;

function upstreamUrl(kind: "decklist" | "deck", id: string): string {
  return `https://marvelcdb.com/api/public/${kind}/${id}.json`;
}

/** A same-shape error body for every failure case, so the client has one thing to read regardless of which quirk produced it. */
function sendError(response: ServerResponse, status: number, message: string): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ error: message }));
}

const middleware = (): Connect.NextHandleFunction => {
  return (request, response, next) => {
    const url = request.url ?? "";
    if (!url.startsWith(MARVELCDB_IMPORT_ROUTE)) {
      next();
      return;
    }
    const path = url.slice(MARVELCDB_IMPORT_ROUTE.length).split("?")[0] ?? "";
    const match = REF_PATTERN.exec(path);
    if (!match) {
      sendError(response, 400, "expected /api/marvelcdb-import/decklist/<id> or /deck/<id>");
      return;
    }
    const kind = match[1] as "decklist" | "deck";
    const id = match[2]!;

    void (async () => {
      let upstream: Response;
      try {
        // `fetch` follows the `deck` endpoint's redirect itself; the shape
        // that lands here for a private/unknown deck is a 200 HTML page from
        // /login, handled below by the content-type check rather than by
        // inspecting the redirect (Node's fetch does not expose the chain).
        upstream = await fetch(upstreamUrl(kind, id));
      } catch (cause) {
        sendError(response, 502, `could not reach MarvelCDB: ${cause instanceof Error ? cause.message : String(cause)}`);
        return;
      }
      const contentType = upstream.headers.get("content-type") ?? "";
      const body = await upstream.text();
      // Both observed "not found" shapes are non-JSON (empty, or an HTML
      // login page) and both mean the same thing to a client: nothing to
      // import at that reference.
      if (!upstream.ok || !contentType.includes("application/json") || body.trim().length === 0) {
        sendError(response, 404, `MarvelCDB has no ${kind === "deck" ? "deck" : "public decklist"} at id ${id} (it may not exist, or may be private).`);
        return;
      }
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      // Never cached: a deck a player is actively editing on MarvelCDB should
      // reimport with its latest contents, unlike card art, which never changes.
      response.setHeader("cache-control", "no-store");
      response.end(body);
    })();
  };
};

/** Installs the route on `vite dev` and `vite preview` only — never in a production build. */
export function marvelcdbImportPlugin(): Plugin {
  return {
    name: "mc-marvelcdb-import",
    configureServer(server) {
      server.middlewares.use(middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware());
    },
  };
}
