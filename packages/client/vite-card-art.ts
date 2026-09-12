/**
 * Serving card art to the client, same-origin.
 *
 * Two facts decide this design:
 *
 *  1. **WebGL refuses tainted textures.** MarvelCDB serves the card images the
 *     content package points at, but with no `access-control-allow-origin`
 *     header, so a cross-origin `<img>` can be decoded and then *not* uploaded
 *     as a texture. Fetching it through our own origin is the only way a Phaser
 *     scene can draw it at all.
 *  2. **No card art is ever committed** (CLAUDE.md "Content & IP boundaries").
 *     Everything this middleware caches lands in the repo's gitignored
 *     `assets/card-art/`, which is the folder that rule already names.
 *
 * So: one route, `/card-art/<path>`, answered from disk first and from
 * MarvelCDB second. A player who owns scans can drop them at
 * `assets/card-art/<path>` and they win over the fetch, which is what
 * `ArtRef` ("a key into a gitignored local asset folder") is for.
 *
 * This is a dev/preview server concern only. A production build of the client
 * has no middleware, so `/card-art/*` 404s unless the host serves that folder —
 * and a 404 is a *supported* outcome: every card falls back to the generated
 * frame, which is the designs' behaviour for a missing scan.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, Connect } from "vite";
// One constant, one place: the content package owns where MarvelCDB serves its
// `ImageRef` paths, and this is the same host its `imageUrl` resolves against.
import { MARVELCDB_IMAGE_BASE } from "../content/src/schema/images.js";

/** The URL prefix the client asks for. Must match `src/art/art-source.ts`. */
export const CARD_ART_ROUTE = "/card-art/";

/** Repo-root `assets/card-art/`, the folder .gitignore already excludes. */
const CACHE_ROOT = path.resolve(import.meta.dirname, "../../assets/card-art");

/**
 * The type is sniffed from the bytes, not the extension: MarvelCDB serves JPEGs
 * under `.png` paths (and labels them `image/png`). Browsers sniff too, so
 * getting this wrong is survivable — but a cached file with no extension to go
 * on wouldn't be, and honest headers cost nothing.
 */
function imageTypeOf(bytes: Buffer): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 6 && bytes.subarray(0, 3).toString() === "GIF") return "image/gif";
  return "application/octet-stream";
}

/**
 * Resolves a request path to a file under the cache root, or null if it tries
 * to escape it. A path from the network decides a filesystem read here, so this
 * check is not optional.
 */
function safeCachePath(requestPath: string): string | null {
  const decoded = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const resolved = path.resolve(CACHE_ROOT, decoded);
  const root = CACHE_ROOT + path.sep;
  return resolved.startsWith(root) ? resolved : null;
}

/** In-process memo, so a card re-requested during one session hits neither disk nor network twice. */
const memory = new Map<string, Buffer>();

async function fetchUpstream(requestPath: string): Promise<Buffer | null> {
  const url = `${MARVELCDB_IMAGE_BASE}/${requestPath.replace(/^\/+/, "")}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const type = response.headers.get("content-type") ?? "";
  // Refuse anything that isn't an image: an upstream error page rendered as a
  // card would be worse than the generated frame.
  if (!type.startsWith("image/")) return null;
  return Buffer.from(await response.arrayBuffer());
}

const middleware = (): Connect.NextHandleFunction => {
  return (request, response, next) => {
    const url = request.url ?? "";
    if (!url.startsWith(CARD_ART_ROUTE)) {
      next();
      return;
    }
    const requestPath = url.slice(CARD_ART_ROUTE.length).split("?")[0] ?? "";
    const file = safeCachePath(requestPath);
    if (!file) {
      response.statusCode = 400;
      response.end("bad card-art path");
      return;
    }

    void (async () => {
      const cached = memory.get(file);
      const bytes =
        cached ??
        (await readFile(file).catch(() => null)) ??
        (await fetchUpstream(requestPath).catch(() => null));

      if (!bytes) {
        // The client treats 404 as "no scan", and draws the generated frame.
        response.statusCode = 404;
        response.end("no art");
        return;
      }
      if (!cached) {
        memory.set(file, bytes);
        // Write through, so the next run of the dev server is offline-capable.
        await mkdir(path.dirname(file), { recursive: true }).catch(() => undefined);
        await writeFile(file, bytes).catch(() => undefined);
      }

      const type = imageTypeOf(bytes);
      if (type === "application/octet-stream") {
        // Not an image at all: better a missing scan than a corrupt texture.
        response.statusCode = 404;
        response.end("no art");
        return;
      }

      response.statusCode = 200;
      response.setHeader("content-type", type);
      // Card art never changes under a given path, so it is safe to cache hard.
      response.setHeader("cache-control", "public, max-age=31536000, immutable");
      response.setHeader("etag", `"${createHash("sha1").update(bytes).digest("hex")}"`);
      response.end(bytes);
    })();
  };
};

/** Installs the route on both `vite dev` and `vite preview`. */
export function cardArtPlugin(): Plugin {
  return {
    name: "mc-card-art",
    configureServer(server) {
      server.middlewares.use(middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware());
    },
  };
}
