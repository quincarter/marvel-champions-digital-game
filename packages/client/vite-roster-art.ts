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
 * The shrinking and its cache are `src/art/art-copy.ts`. Without `sharp`, or when it cannot read a file, the
 * original's URL stands in, so nothing breaks.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { ART_ROOT, copyOf } from "./src/art/art-copy.js";
import { copySourceOf, hasCopy } from "./src/art/roster-size.js";

const ART = ART_ROOT;
const ROUTE = "/@art-copy/";

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
