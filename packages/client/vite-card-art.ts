/**
 * Card art is a build input. This plugin is the whole of how it reaches the
 * client, in dev and in every packaged form.
 *
 * The scans live in the repo's `assets/card-art/`, put there by the content
 * scripts. Nothing fetches them at runtime — not this dev server, not the
 * desktop shell, not the mobile shell:
 *
 *  - **dev / preview:** `/card-art/<path>` is answered straight from that
 *    folder.
 *  - **build:** the pool's share of the folder (`src/art/bundled-art.ts`) is
 *    copied to `dist/card-art/`, so the same URL is a plain static file. A web
 *    deploy serves it; Tauri (`frontendDist`) and Capacitor (`webDir`) both
 *    wrap that same `dist/`, so neither shell needs any art code of its own.
 *
 * Same-origin is the point of the route: WebGL refuses a cross-origin image as
 * a texture, so a scan has to come from the app's own origin to be drawn.
 *
 * A scan that isn't on disk is a 404, and a 404 is a *supported* outcome — the
 * card falls back to its generated frame. But it is a gap in the asset folder,
 * not something to paper over at runtime, so the build names every one.
 *
 * `MC_CARD_ART` overrides how much a build carries: `pool` (default), `all`
 * (the whole folder — over a gigabyte; never for the desktop shell, which
 * embeds `dist/` in its binary), or `none` (skip the copy, e.g. a CI typecheck
 * build).
 */

import { createHash } from "node:crypto";
import { cp, copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { runnerImport, type Plugin, type Connect } from "vite";
import { CARD_ART_ROUTE } from "./src/art/art-source.js";

export { CARD_ART_ROUTE };

/** Repo-root `assets/card-art/`. */
const ART_ROOT = path.resolve(import.meta.dirname, "../../assets/card-art");

/**
 * Which scans the pool needs, asked of the client's own code
 * (`src/art/bundled-art.ts`) rather than restated here.
 *
 * It is loaded through Vite's module runner, at build time only, and not with a
 * plain `import`: that module reaches `@mc/content`, a workspace package whose
 * entry is raw TypeScript. Vite's config loader leaves a bare package import
 * external, so Node would be handed `.ts` source it cannot link. The runner
 * resolves it exactly as the app does — and the dev server never pays for it.
 */
async function poolArtPaths(): Promise<{ readonly cardCount: number; readonly paths: readonly string[] }> {
  const entry = path.resolve(import.meta.dirname, "src/art/bundled-art.ts");
  const { module } = await runnerImport<typeof import("./src/art/bundled-art.js")>(entry, {
    root: import.meta.dirname,
    // Not this config again: it would only re-enter this plugin.
    configFile: false,
    logLevel: "silent",
  });
  return module.poolArtPaths();
}

/**
 * The type is sniffed from the bytes, not the extension: some scans are JPEGs
 * filed under `.png` paths. Browsers sniff too, so getting this wrong is
 * survivable, but honest headers cost nothing.
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
 * Resolves a request path to a file under the art root, or null if it tries to
 * escape it. A path from the network decides a filesystem read here, so this
 * check is not optional.
 */
function safeArtPath(requestPath: string): string | null {
  const decoded = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const resolved = path.resolve(ART_ROOT, decoded);
  return resolved.startsWith(ART_ROOT + path.sep) ? resolved : null;
}

/** In-process memo, so a card re-requested during one session doesn't hit the disk twice. */
const memory = new Map<string, Buffer>();

const middleware = (): Connect.NextHandleFunction => {
  return (request, response, next) => {
    const url = request.url ?? "";
    if (!url.startsWith(CARD_ART_ROUTE)) {
      next();
      return;
    }
    const requestPath = url.slice(CARD_ART_ROUTE.length).split("?")[0] ?? "";
    const file = safeArtPath(requestPath);
    if (!file) {
      response.statusCode = 400;
      response.end("bad card-art path");
      return;
    }

    void (async () => {
      const bytes = memory.get(file) ?? (await readFile(file).catch(() => null));
      const type = bytes ? imageTypeOf(bytes) : "application/octet-stream";
      if (!bytes || type === "application/octet-stream") {
        // No scan (or not an image at all): the client draws the generated frame.
        response.statusCode = 404;
        response.end("no art");
        return;
      }
      memory.set(file, bytes);
      response.statusCode = 200;
      response.setHeader("content-type", type);
      // Card art never changes under a given path, so it is safe to cache hard.
      response.setHeader("cache-control", "public, max-age=31536000, immutable");
      response.setHeader("etag", `"${createHash("sha1").update(bytes).digest("hex")}"`);
      response.end(bytes);
    })();
  };
};

type BundleMode = "pool" | "all" | "none";

function bundleMode(): BundleMode {
  const mode = process.env.MC_CARD_ART ?? "pool";
  if (mode === "pool" || mode === "all" || mode === "none") return mode;
  throw new Error(`MC_CARD_ART must be "pool", "all" or "none" (got "${mode}")`);
}

/** Copies the scans a build carries into `<outDir>/card-art/`, and says what it did. */
async function copyArt(outDir: string, log: (message: string) => void, warn: (message: string) => void): Promise<void> {
  const mode = bundleMode();
  const target = path.join(outDir, CARD_ART_ROUTE);
  if (mode === "none") {
    log("card art: skipped (MC_CARD_ART=none) — every card will draw its generated frame");
    return;
  }
  if (mode === "all") {
    await cp(ART_ROOT, target, { recursive: true });
    log(`card art: copied the whole of assets/card-art/ (MC_CARD_ART=all)`);
    return;
  }

  const { cardCount, paths } = await poolArtPaths();
  const missing: string[] = [];
  let bytes = 0;
  for (const relative of paths) {
    const from = path.join(ART_ROOT, relative);
    const size = await stat(from).then((s) => s.size, () => null);
    if (size === null) {
      missing.push(relative);
      continue;
    }
    const to = path.join(target, relative);
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
    bytes += size;
  }
  log(`card art: ${paths.length - missing.length} scans for ${cardCount} pool cards → ${path.relative(process.cwd(), target)} (${(bytes / 1e6).toFixed(1)} MB)`);
  if (missing.length > 0) {
    warn(
      `card art: ${missing.length} scan(s) the pool references are not in assets/card-art/ — those faces will draw their generated frame:\n` +
        missing.map((relative) => `  ${relative}`).join("\n"),
    );
  }
}

/** Serves `/card-art/*` on `vite dev` and `vite preview`, and bundles the scans on `vite build`. */
export function cardArtPlugin(): Plugin {
  let outDir = "dist";
  return {
    name: "mc-card-art",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware());
    },
    async closeBundle() {
      // `closeBundle` also fires for the worker's own sub-build and in watch mode;
      // only a real client build has an output directory to fill.
      if (this.meta.watchMode) return;
      await copyArt(outDir, (message) => this.info(message), (message) => this.warn(message));
    },
  };
}
