/**
 * Smaller copies of the full-bleed pictures in `art/`, made at build time and never committed. A roster tile
 * (`?roster`: Scenario select's villains, Take your seats' heroes) is a few hundred px wide, and a title picture in the
 * guide chooser's panel (`?display`) is not 4000 px; fetching the originals for them cost a phone megabytes and a
 * decode of the full bitmap. `import url from ".../hero.jpg?roster"` resolves to a WebP shrunk by `copySizeFor`; a
 * plain import still gives the original, for where a large picture is drawn.
 *
 *  - build: the copy is emitted as a hashed asset next to the others.
 *  - dev / preview: `/@art-copy/<kind>/<path under art/>.webp` is answered by a middleware.
 *
 * Copies are cached in `node_modules/.cache/mc-art-copies`, keyed by the source's path, size and mtime, the copy's
 * size and quality and the sharp version, so a rebuild only shrinks what changed. Without `sharp`, or when it cannot
 * read a file, the original's URL stands in, so nothing breaks.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { ROSTER_QUALITY, copySizeFor, copySourceOf, hasCopy, type CopyKind } from "./src/art/roster-size.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = resolve(HERE, "../../art");
const CACHE = resolve(HERE, "../../node_modules/.cache/mc-art-copies");
const ROUTE = "/@art-copy/";
const QUALITY: Record<CopyKind, number> = { roster: ROSTER_QUALITY, display: 78 };
/** Bump when the copy settings change in a way the cache key does not see. */
const CACHE_VERSION = 1;

/** The sharp release, in the cache key. */
const sharpVersion = ((): string => {
  try {
    return (createRequire(import.meta.url)("sharp/package.json") as { version: string }).version;
  } catch {
    return "none";
  }
})();

interface Sharp {
  (input: string): {
    metadata: () => Promise<{ width?: number; height?: number }>;
    rotate: () => {
      resize: (o: object) => { webp: (o: object) => { toBuffer: () => Promise<Buffer> } };
    };
  };
}

let sharpPromise: Promise<Sharp | null> | null = null;
function loadSharp(): Promise<Sharp | null> {
  sharpPromise ??= import("sharp").then(
    (m) => (m as unknown as { default: Sharp }).default,
    () => {
      console.warn("[art-copy] sharp is not installed; pictures ship at full size.");
      return null;
    },
  );
  return sharpPromise;
}

/** The copy's bytes (cached on disk), or null without `sharp`. Throws when sharp cannot read the file. */
async function copyOf(kind: CopyKind, file: string): Promise<Buffer | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  const stat = statSync(file);
  const meta = await sharp(file).metadata();
  const size = copySizeFor(kind, meta.width ?? 0, meta.height ?? 0);
  const name = createHash("sha1")
    .update(
      [
        CACHE_VERSION,
        sharpVersion,
        kind,
        resolve(file).replaceAll("\\", "/"),
        stat.size,
        Math.round(stat.mtimeMs),
        size.width,
        size.height,
        QUALITY[kind],
      ].join("|"),
    )
    .digest("hex");
  const cached = join(CACHE, `${name}.webp`);
  if (existsSync(cached)) return readFileSync(cached);
  // `.rotate()` applies the EXIF orientation. A rotated source is sized by its stored axes, which only differs by a
  // swap, and the result is still within the cap.
  const bytes = await sharp(file)
    .rotate()
    .resize({ width: size.width, height: size.height, fit: "fill" })
    .webp({ quality: QUALITY[kind] })
    .toBuffer();
  mkdirSync(CACHE, { recursive: true });
  const temp = `${cached}.${process.pid}.tmp`;
  writeFileSync(temp, bytes);
  renameSync(temp, cached);
  return bytes;
}

export function artCopyPlugin(): Plugin {
  let serving = false;
  return {
    name: "mc-art-copy",
    enforce: "pre",
    configResolved(config) {
      serving = config.command === "serve";
    },
    async load(id) {
      const source = copySourceOf(id);
      if (!source) return null;
      // The original stands in when there is no copy: a plain import of the same file.
      const original = `import url from ${JSON.stringify(source.file)}; export default url;`;
      if (serving) return `export default ${JSON.stringify(`${ROUTE}${source.kind}/${source.underArt}.webp`)};`;
      try {
        const bytes = await copyOf(source.kind, source.file);
        if (!bytes) return original;
        const stem = source.underArt.slice(0, source.underArt.lastIndexOf("."));
        const ref = this.emitFile({ type: "asset", name: `${stem.replaceAll("/", "-")}.webp`, source: bytes });
        return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
      } catch (error) {
        console.warn(`[art-copy] ${source.underArt}: ${(error as Error).message}; the original ships instead.`);
        return original;
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = req.url?.split("?")[0] ?? "";
          if (!url.startsWith(ROUTE)) return next();
          const path = decodeURIComponent(url.slice(ROUTE.length)).replace(/\.webp$/, "");
          const slash = path.indexOf("/");
          const kind = path.slice(0, slash);
          const underArt = path.slice(slash + 1);
          if ((kind !== "roster" && kind !== "display") || underArt.includes("..") || !hasCopy(kind, underArt)) {
            return next();
          }
          const file = join(ART, underArt);
          if (!existsSync(file)) return next();
          const bytes = await copyOf(kind, file).catch((error: unknown) => {
            console.warn(`[art-copy] ${underArt}: ${(error as Error).message}`);
            return null;
          });
          if (!bytes) {
            // No copy to give: send the browser to the original.
            res.statusCode = 302;
            res.setHeader("Location", `/@fs/${file.replaceAll("\\", "/")}`);
            res.end();
            return;
          }
          res.setHeader("Content-Type", "image/webp");
          res.setHeader("Cache-Control", "no-cache");
          res.end(bytes);
        } catch {
          next();
        }
      });
    },
  };
}
