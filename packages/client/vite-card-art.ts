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
 *
 * `MC_CARD_LANGS` adds more languages, each copied to `dist/card-art-<lang>/`
 * and resolved the same way (the web build, whose player picks one;
 * `carriedLanguagesOf`). The dev server serves every language on disk.
 *
 * `MC_CARD_LANG` picks the language of the scans (`src/art/card-language.ts`):
 * `en` (default), or a language whose set `pnpm card-art:localize` wrote to
 * `assets/card-art-locales/<lang>/` under the English scans' own paths. Each
 * path is answered from that set when it has the scan and from the English
 * folder when it doesn't, so the English fallback is settled here, in the dev
 * server and in the copy, and the client never has to know.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runnerImport, type Plugin, type Connect } from "vite";
import { CARD_ART_ROUTE } from "./src/art/art-source.js";
import { BASE_CARD_LANGUAGE, CARD_LANGUAGES, isCardLanguage, type CardLanguage } from "./src/art/card-language.js";

export { CARD_ART_ROUTE };

/** Repo-root `assets/card-art/`. */
const ART_ROOT = path.resolve(import.meta.dirname, "../../assets/card-art");

/** Repo-root `assets/card-art-locales/`: a folder per language other than English, laid out like `ART_ROOT`. */
const LOCALES_ROOT = path.resolve(import.meta.dirname, "../../assets/card-art-locales");

/** The language this build's scans are in, from `MC_CARD_LANG`. `vite.config.ts` hands the same answer to the client. */
export function cardLanguageOf(value = process.env.MC_CARD_LANG): CardLanguage {
  const lang = value?.trim() || BASE_CARD_LANGUAGE;
  if (isCardLanguage(lang)) return lang;
  throw new Error(`MC_CARD_LANG must be one of ${CARD_LANGUAGES.join(", ")} (got "${lang}")`);
}

/**
 * Every language a build carries, its build language first (`MC_CARD_LANGS`, comma-separated; the build language alone
 * when unset). The web build carries all of them and the player picks one; a native installer carries one, since its
 * executable embeds `dist/` and two sets would pass GitHub's 2 GiB limit on a release asset.
 */
export function carriedLanguagesOf(
  build: CardLanguage = cardLanguageOf(),
  value = process.env.MC_CARD_LANGS,
): readonly CardLanguage[] {
  const listed = (value ?? "")
    .split(",")
    .map((lang) => lang.trim())
    .filter((lang) => lang !== "");
  for (const lang of listed) {
    if (!isCardLanguage(lang)) throw new Error(`MC_CARD_LANGS must list ${CARD_LANGUAGES.join(", ")} (got "${lang}")`);
  }
  const extra = (listed as CardLanguage[]).filter((lang, i) => lang !== build && listed.indexOf(lang) === i);
  return [build, ...extra];
}

/** Where `lang`'s scans are served: the build language's at `/card-art/`, any other at `/card-art-<lang>/`. */
function routeOf(lang: CardLanguage, build: CardLanguage): string {
  return lang === build ? CARD_ART_ROUTE : `/card-art-${lang}/`;
}

/**
 * The folders a scan is looked up in, first match wins: the language's own set, then English. Fails when the
 * language has no set on disk, rather than building a Spanish app that is quietly all English.
 */
function artRoots(lang: CardLanguage): readonly string[] {
  if (lang === BASE_CARD_LANGUAGE) return [ART_ROOT];
  const root = path.join(LOCALES_ROOT, lang);
  if (!existsSync(path.join(root, "bundles"))) {
    throw new Error(`MC_CARD_LANG=${lang}, but assets/card-art-locales/${lang}/ has no scans (pnpm card-art:localize)`);
  }
  return [root, ART_ROOT];
}

/** `relative`'s scan from the first of `roots` that has it, and which root that was; null when none does. */
async function readArt(
  roots: readonly string[],
  relative: string,
): Promise<{ readonly bytes: Buffer; readonly root: number } | null> {
  for (const [root, dir] of roots.entries()) {
    const file = safeArtPath(dir, relative);
    const bytes = file === null ? null : await readFile(file).catch(() => null);
    if (bytes !== null) return { bytes, root };
  }
  return null;
}

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
 * The type is sniffed from the bytes, not the extension: scans are WebP filed
 * under the `.png`/`.jpg` paths their card records name (`fetch_card_art.py
 * compress`). Browsers sniff too, so getting this wrong is survivable, but
 * honest headers cost nothing.
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
 * Resolves a request path to a file under an art root, or null if it tries to
 * escape it. A path from the network decides a filesystem read here, so this
 * check is not optional.
 */
function safeArtPath(root: string, requestPath: string): string | null {
  const decoded = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const resolved = path.resolve(root, decoded);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

/** In-process memo, so a card re-requested during one session doesn't hit the disk twice. */
const memory = new Map<string, Buffer>();

/**
 * Answers each language's route from that language's roots (`routeOf`). The dev and preview servers serve every
 * language that has a set on disk, so the web's card language picker works without a build.
 */
const middleware = (routes: ReadonlyMap<string, readonly string[]>): Connect.NextHandleFunction => {
  return (request, response, next) => {
    const url = request.url ?? "";
    const route = [...routes.keys()].find((prefix) => url.startsWith(prefix));
    if (route === undefined) {
      next();
      return;
    }
    const roots = routes.get(route)!;
    const requestPath = url.slice(route.length).split("?")[0] ?? "";
    const file = safeArtPath(ART_ROOT, requestPath);
    if (!file) {
      response.statusCode = 400;
      response.end("bad card-art path");
      return;
    }

    void (async () => {
      const memo = route + requestPath;
      const bytes = memory.get(memo) ?? (await readArt(roots, requestPath))?.bytes ?? null;
      const type = bytes ? imageTypeOf(bytes) : "application/octet-stream";
      if (!bytes || type === "application/octet-stream") {
        // No scan (or not an image at all): the client draws the generated frame.
        response.statusCode = 404;
        response.end("no art");
        return;
      }
      memory.set(memo, bytes);
      response.statusCode = 200;
      response.setHeader("content-type", type);
      // Card art never changes under a given path, so it is safe to cache hard.
      response.setHeader("cache-control", "public, max-age=31536000, immutable");
      response.setHeader("etag", `"${createHash("sha1").update(bytes).digest("hex")}"`);
      response.end(bytes);
    })();
  };
};

/** Every language with a set on disk, the build language first: what the dev and preview servers serve. */
export function servedLanguages(): readonly CardLanguage[] {
  const build = cardLanguageOf();
  const onDisk = CARD_LANGUAGES.filter(
    (lang) => lang === BASE_CARD_LANGUAGE || existsSync(path.join(LOCALES_ROOT, lang, "bundles")),
  );
  return [build, ...onDisk.filter((lang) => lang !== build)];
}

function servedRoutes(): ReadonlyMap<string, readonly string[]> {
  const build = cardLanguageOf();
  return new Map(servedLanguages().map((lang) => [routeOf(lang, build), artRoots(lang)] as const));
}

type BundleMode = "pool" | "all" | "none";

export function bundleMode(): BundleMode {
  const mode = process.env.MC_CARD_ART ?? "pool";
  if (mode === "pool" || mode === "all" || mode === "none") return mode;
  throw new Error(`MC_CARD_ART must be "pool", "all" or "none" (got "${mode}")`);
}

/**
 * Copies the scans a build carries into `<outDir>/card-art/`, and into `<outDir>/card-art-<lang>/` for each other
 * language it carries (`carriedLanguagesOf`), and says what it did. `MC_CARD_ART=all` copies the build language only.
 */
async function copyArt(outDir: string, log: (message: string) => void, warn: (message: string) => void): Promise<void> {
  const mode = bundleMode();
  const lang = cardLanguageOf();
  const carried = carriedLanguagesOf(lang);
  const target = path.join(outDir, CARD_ART_ROUTE);
  if (mode === "none") {
    log("card art: skipped (MC_CARD_ART=none) — every card will draw its generated frame");
    return;
  }
  const roots = artRoots(lang);
  if (mode === "all") {
    await cp(ART_ROOT, target, { recursive: true });
    // The language's set over the English one: the same answer, path by path, that the dev server gives.
    if (roots.length > 1) await cp(path.join(roots[0]!, "bundles"), path.join(target, "bundles"), { recursive: true });
    log(`card art: copied the whole of assets/card-art/ (MC_CARD_ART=all, MC_CARD_LANG=${lang})`);
    return;
  }

  const { cardCount, paths } = await poolArtPaths();
  const { missing, lossless } = await copyPool(lang, roots, paths, target, cardCount, log);
  for (const other of carried.slice(1)) {
    await copyPool(other, artRoots(other), paths, path.join(outDir, routeOf(other, lang)), cardCount, log);
  }
  if (missing.length > 0) {
    warn(
      `card art: ${missing.length} scan(s) the pool references are not in assets/card-art/ — those faces will draw their generated frame:\n` +
        missing.map((relative) => `  ${relative}`).join("\n"),
    );
  }
  if (lossless.length > 0) {
    // Every bundled scan is paid for in every installer (the desktop shell embeds them in its executable), and a
    // lossless PNG scan is several times the size of the WebP one `compress` writes.
    warn(
      `card art: ${lossless.length} bundled scan(s) are lossless PNGs; \`mise run card-art-compress\` re-encodes them as WebP:\n` +
        lossless.map((relative) => `  ${relative}`).join("\n"),
    );
  }
}

/** Copies one language's share of `paths` into `target`, first root first; says what it copied and what it lacks. */
async function copyPool(
  lang: CardLanguage,
  roots: readonly string[],
  paths: readonly string[],
  target: string,
  cardCount: number,
  log: (message: string) => void,
): Promise<{ readonly missing: readonly string[]; readonly lossless: readonly string[] }> {
  const missing: string[] = [];
  const lossless: string[] = [];
  let bytes = 0;
  let translated = 0;
  for (const relative of paths) {
    const found = await readArt(roots, relative);
    if (found === null) {
      missing.push(relative);
      continue;
    }
    const scan = found.bytes;
    if (roots.length > 1 && found.root === 0) translated++;
    if (imageTypeOf(scan) === "image/png") lossless.push(relative);
    const to = path.join(target, relative);
    await mkdir(path.dirname(to), { recursive: true });
    await writeFile(to, scan);
    bytes += scan.length;
  }
  log(
    `card art: ${paths.length - missing.length} scans for ${cardCount} pool cards → ${path.relative(process.cwd(), target)} (${(bytes / 1e6).toFixed(1)} MB)`,
  );
  if (roots.length > 1) {
    const english = paths.length - missing.length - translated;
    log(`card art: ${lang}: ${translated} ${lang} scans, ${english} English where the ${lang} set has none`);
  }
  return { missing, lossless };
}

/** Serves `/card-art/*` (and each other language's route) on `vite dev` and `vite preview`, and bundles the scans on `vite build`. */
export function cardArtPlugin(): Plugin {
  let outDir = "dist";
  return {
    name: "mc-card-art",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(middleware(servedRoutes()));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(servedRoutes()));
    },
    async closeBundle() {
      // `closeBundle` also fires for the worker's own sub-build and in watch mode;
      // only a real client build has an output directory to fill.
      if (this.meta.watchMode) return;
      await copyArt(
        outDir,
        (message) => this.info(message),
        (message) => this.warn(message),
      );
    },
  };
}
