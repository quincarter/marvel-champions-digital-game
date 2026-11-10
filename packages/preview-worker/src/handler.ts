/**
 * The preview Worker: `https://pr-<n>.<domain>/<path>` answers from the `mc-previews` bucket, laid out as
 * src/layout.ts says. It does what netlify.toml does for the Netlify site: the MarvelCDB deck proxy, the two release
 * redirects, the cache headers and the SPA fallback.
 *
 * Every request here is one Worker request on the free plan's 100,000 a day (shared with mc-sync) and one R2 read
 * (10 million a month free). Hashed assets and card scans are cached by the browser for a year, so a second visit
 * costs only index.html and the files a push changed.
 */

import type { Env, R2ObjectLike } from "./env.ts";
import {
  cacheControlFor,
  contentTypeOf,
  keyFor,
  prOfHost,
  prPrefix,
  PREVIEW_FILE,
  type PreviewInfo,
} from "./layout.ts";

/** How long an isolate trusts a preview's `preview.json` (or its absence) before reading it again. */
export const INFO_TTL_MS = 30_000;

const infoCache = new Map<number, { readonly at: number; readonly info: PreviewInfo | null }>();

/** Tests only: forget the cached `preview.json` reads. */
export function clearInfoCache(): void {
  infoCache.clear();
}

/** Previews stay out of search engines. */
const COMMON_HEADERS = { "X-Robots-Tag": "noindex" };

const MARVELCDB_ROUTE = /^api\/marvelcdb-import\/(decklist|deck)\/([0-9]{1,10})$/;

export type Upstream = (input: Request | string, init?: RequestInit) => Promise<Response>;

export async function handleRequest(
  request: Request,
  env: Env,
  upstream: Upstream = fetch,
  now: () => number = Date.now,
): Promise<Response> {
  const url = new URL(request.url);
  const pr = prOfHost(url.hostname);
  // Not a preview host: the route caught a name it shouldn't have (CONTRIBUTING.md asks for "None" routes on the
  // other hosts). Hand the request on untouched rather than break that host.
  if (pr === null) return upstream(request);
  if (env.PREVIEWS_ENABLED !== "true") return text(503, "Previews are switched off.");
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD", ...COMMON_HEADERS } });
  }

  let path: string;
  try {
    path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    return text(400, "Bad path.");
  }

  const marvelcdb = MARVELCDB_ROUTE.exec(path);
  if (marvelcdb) return marvelCdb(marvelcdb[1]!, marvelcdb[2]!, upstream);

  const info = await previewInfo(env, pr, now());
  if (info === null) return notDeployed(pr);

  // Builds up to v0.39.0 have a title bar that opens this retired page (netlify.toml).
  if (path === "shadowland-info.html") return redirect("/releases/v0.43.2/index.html", 302);

  if (path === "" || path.endsWith("/")) path += "index.html";
  const key = keyFor(path, pr, info.lang);
  if (key === null) return text(404, "Not found.");

  const found = await serve(env, request, key, path);
  if (found) return found;

  const last = path.slice(path.lastIndexOf("/") + 1);
  const hasExtension = last.includes(".");
  // A folder named without its slash (`/releases`): Netlify's pretty URLs serve its index.html.
  if (!hasExtension) {
    const index = keyFor(`${path}/index.html`, pr, info.lang);
    if (index !== null && (await env.PREVIEWS.head(index))) {
      return redirect(`/${path}/${url.search}`, 301);
    }
  }
  // A release with no report of its own is a page of the release history (netlify.toml).
  const release = /^releases\/([^/]+)$/.exec(path);
  if (release) return redirect(`/releases/#${release[1]}`, 302);
  // The SPA fallback, for page paths only: a missing script, scan or sound is a real 404 here, where Netlify answered
  // index.html with a 200.
  if (!hasExtension || last.endsWith(".html")) {
    const app = await serve(env, request, `${prPrefix(pr)}index.html`, "index.html");
    if (app) return app;
  }
  return text(404, "Not found.");
}

/** `pr-<n>/preview.json`, or null when the PR has no preview (not deployed yet, or cleaned up after it closed). */
async function previewInfo(env: Env, pr: number, now: number): Promise<PreviewInfo | null> {
  const cached = infoCache.get(pr);
  if (cached && now - cached.at < INFO_TTL_MS) return cached.info;
  let info: PreviewInfo | null = null;
  const object = await env.PREVIEWS.get(`${prPrefix(pr)}${PREVIEW_FILE}`);
  if (object?.body) {
    try {
      const parsed = JSON.parse(await new Response(object.body).text()) as Partial<PreviewInfo>;
      if (typeof parsed.lang === "string" && /^[a-z]{2}$/.test(parsed.lang)) info = parsed as PreviewInfo;
    } catch {
      info = null;
    }
  }
  infoCache.set(pr, { at: now, info });
  return info;
}

/** The object at `key` as a response, honouring Range and conditional headers; null when there is no such object. */
async function serve(env: Env, request: Request, key: string, path: string): Promise<Response | null> {
  const object = await env.PREVIEWS.get(key, { onlyIf: request.headers, range: request.headers });
  if (object === null) return null;
  const headers = new Headers({
    "Content-Type": object.httpMetadata?.contentType || contentTypeOf(path),
    "Cache-Control": cacheControlFor(path),
    ETag: object.httpEtag,
    "Last-Modified": object.uploaded.toUTCString(),
    "Accept-Ranges": "bytes",
    ...COMMON_HEADERS,
  });
  // The conditions in onlyIf failed: a matching If-None-Match / If-Modified-Since, or a failed If-Match.
  if (!object.body) {
    const notModified = request.headers.has("If-None-Match") || request.headers.has("If-Modified-Since");
    return new Response(null, { status: notModified ? 304 : 412, headers });
  }
  const range = rangeOf(object);
  let status = 200;
  if (range && request.headers.has("Range")) {
    status = 206;
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${object.size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
  } else {
    headers.set("Content-Length", String(object.size));
  }
  return new Response(request.method === "HEAD" ? null : object.body, { status, headers });
}

function rangeOf(object: R2ObjectLike): { start: number; end: number } | null {
  const range = object.range;
  if (!range || object.size === 0) return null;
  if (range.suffix !== undefined) {
    const length = Math.min(range.suffix, object.size);
    return { start: object.size - length, end: object.size - 1 };
  }
  const start = range.offset ?? 0;
  const length = range.length ?? object.size - start;
  return { start, end: Math.min(start + length, object.size) - 1 };
}

/**
 * The MarvelCDB deck import route (netlify.toml proxies it on the Netlify site), answered in the shape the Decks screen
 * reads (packages/client/src/platform/marvelcdb-upstream.ts): the upstream JSON on success, `{ error }` otherwise.
 */
async function marvelCdb(kind: string, id: string, upstream: Upstream): Promise<Response> {
  let response: Response;
  try {
    response = await upstream(`https://marvelcdb.com/api/public/${kind}/${id}.json`, {
      headers: { Accept: "application/json" },
    });
  } catch (cause) {
    return json(502, { error: `could not reach MarvelCDB: ${cause instanceof Error ? cause.message : String(cause)}` });
  }
  const type = response.headers.get("Content-Type") ?? "";
  if (response.ok && type.includes("json")) {
    return new Response(response.body, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...COMMON_HEADERS },
    });
  }
  // MarvelCDB answers a private or missing deck with an HTML page, sometimes with a 200.
  const status = response.ok || response.status === 404 ? 404 : 502;
  return json(status, { error: `MarvelCDB has no public ${kind} ${id} (HTTP ${response.status})` });
}

function notDeployed(pr: number): Response {
  const body = `<!doctype html><meta charset="utf-8"><title>No preview for PR #${pr}</title>
<p>There is no preview for pull request #${pr}. It is still building, or the pull request has closed.</p>`;
  return new Response(body, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...COMMON_HEADERS },
  });
}

function redirect(location: string, status: number): Response {
  return new Response(null, {
    status,
    headers: { Location: location, "Cache-Control": "no-store", ...COMMON_HEADERS },
  });
}

function text(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...COMMON_HEADERS },
  });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...COMMON_HEADERS },
  });
}
