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
 * Copies are cached in `node_modules/.cache/mc-art-copies`, keyed by the source's size and mtime, so a rebuild only
 * shrinks what changed. Without `sharp` the original's URL stands in, so nothing breaks.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { ROSTER_QUALITY, copySizeFor, copySourceOf, hasCopy, type CopyKind } from "./src/art/roster-size.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = resolve(HERE, "../../art");
const CACHE = resolve(HERE, "../../node_modules/.cache/mc-art-copies");
const ROUTE = "/@art-copy/";
const QUALITY: Record<CopyKind, number> = { roster: ROSTER_QUALITY, display: 78 };

interface Sharp {
  (input: string): {
    metadata: () => Promise<{ width?: number; height?: number }>;
    resize: (o: object) => { webp: (o: object) => { toBuffer: () => Promise<Buffer> } };
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

/** The copy's bytes (cached on disk), or null without `sharp`. */
async function copyOf(kind: CopyKind, file: string): Promise<Buffer | null> {
  const stat = statSync(file);
  const name = createHash("sha1")
    .update(`${kind}|${file}|${stat.size}|${Math.round(stat.mtimeMs)}`)
    .digest("hex");
  const cached = join(CACHE, `${name}.webp`);
  if (existsSync(cached)) return readFileSync(cached);
  const sharp = await loadSharp();
  if (!sharp) return null;
  const meta = await sharp(file).metadata();
  const size = copySizeFor(kind, meta.width ?? 0, meta.height ?? 0);
  const bytes = await sharp(file)
    .resize({ width: size.width, height: size.height, fit: "fill" })
    .webp({ quality: QUALITY[kind] })
    .toBuffer();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cached, bytes);
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
      const stem = source.underArt.slice(0, source.underArt.lastIndexOf("."));
      if (serving) return `export default ${JSON.stringify(`${ROUTE}${source.kind}/${stem}.webp`)};`;
      const bytes = await copyOf(source.kind, source.file);
      // No sharp: the original is the copy.
      if (!bytes) return `import url from ${JSON.stringify(source.file)}; export default url;`;
      const ref = this.emitFile({ type: "asset", name: `${stem.replaceAll("/", "-")}.webp`, source: bytes });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith(ROUTE)) return next();
        const [kind, ...rest] = decodeURIComponent(url.slice(ROUTE.length))
          .replace(/\.webp$/, "")
          .split("/");
        const stem = rest.join("/");
        if ((kind !== "roster" && kind !== "display") || stem.includes("..")) return next();
        for (const ext of ["png", "jpg", "jpeg", "webp", "avif"]) {
          const file = join(ART, `${stem}.${ext}`);
          if (!existsSync(file) || !hasCopy(kind, `${stem}.${ext}`)) continue;
          const bytes = await copyOf(kind, file);
          if (!bytes) return next();
          res.setHeader("Content-Type", "image/webp");
          res.setHeader("Cache-Control", "no-cache");
          res.end(bytes);
          return;
        }
        next();
      });
    },
  };
}
