import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { writeReleaseHistory } from "./vite-release-history.js";

/**
 * The two small sites beside the game (`site/`), built on their own and picked by Vite's mode: `--mode moved` (the "we
 * have moved" page the old Netlify address serves in production) and `--mode landing` (the landing page at the new
 * domain's top level). Each
 * builds to `dist-<site>/` with its page at the root. `pnpm site:build:moved` / `pnpm site:build:landing` run them, and
 * `pnpm site:dev:<site>` serves one with live reload.
 *
 * The moved page reads the game's own save code from `src/`. The landing page reads its release feed, screenshots and
 * mod list at build time through `virtual:landing-data` (below), so it carries no copy of them and never reads the
 * card pool (its hero list is `src/site/landing/game-roster.json`, which a test keeps current).
 */
const SITES = ["moved", "landing"] as const;
type Site = (typeof SITES)[number];

const CLIENT = import.meta.dirname;
const PUBLIC_RELEASES = join(CLIENT, "public/releases");
const PACK_CATALOG_URL = "https://packs.champions-digital-game.com/index.json";

/** How many releases the feed lists, and from how many of the newest reports the gallery takes its screenshots. */
const FEED_LENGTH = 8;
const GALLERY_REPORTS = 3;
const GALLERY_LENGTH = 9;

function siteOf(mode: string): Site {
  if (!(SITES as readonly string[]).includes(mode)) throw new Error(`--mode must be one of ${SITES.join(", ")}`);
  return mode as Site;
}

interface Figure {
  readonly file: string;
  readonly alt: string;
  readonly caption: string;
}

const decode = (text: string): string =>
  text
    .replace(/\s+/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

/** Each `<figure>` screenshot of a report page, in page order. */
function figuresOf(html: string, dir: string): Figure[] {
  const figures: Figure[] = [];
  for (const [, body] of html.matchAll(/<figure[^>]*>([\s\S]*?)<\/figure>/g)) {
    const src = /<img[\s\S]*?src="([^"]+)"/.exec(body!)?.[1];
    const alt = /<img[\s\S]*?alt="([^"]*)"/.exec(body!)?.[1] ?? "";
    const caption = /<figcaption>([\s\S]*?)<\/figcaption>/.exec(body!)?.[1] ?? "";
    if (!src || /^(https?:)?\/\//.test(src)) continue;
    const file = join(dir, src);
    if (existsSync(file) && /\.(webp|png|jpe?g)$/i.test(file)) {
      figures.push({ file, alt: decode(alt), caption: decode(caption.replace(/<[^>]+>/g, "")) });
    }
  }
  return figures;
}

async function packCatalog(): Promise<unknown[]> {
  try {
    const response = await fetch(PACK_CATALOG_URL, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { packs?: Record<string, unknown>[] };
    // Only what the page shows: a pack's version list (URLs and checksums) is most of the catalog's weight.
    return (data.packs ?? [])
      .filter((pack) => !pack.withdrawn)
      .map(({ id, kind, name, creator, summary, thumbnail, latest }) => ({
        id,
        kind,
        name,
        creator,
        summary,
        thumbnail,
        latest,
      }));
  } catch (error) {
    // The page fetches the catalog itself too, so a build without the network still ships, with the list to come.
    console.warn(`[landing] the mod store catalog was out of reach (${String(error)}); the page will load it live.`);
    return [];
  }
}

const LATEST_RELEASE_API = "https://api.github.com/repos/quincarter/marvel-champions-digital-game/releases/latest";

/**
 * GitHub's latest release at build time, trimmed to what the download panel reads, or `null`. The pages ask GitHub
 * again when they open; this is what they show when that fails (GitHub allows 60 unauthenticated calls an hour per
 * address, which a shared network can spend). CI passes `GITHUB_TOKEN` so the build itself isn't rate limited.
 */
async function latestRelease(): Promise<unknown> {
  try {
    const token = process.env.GITHUB_TOKEN;
    const response = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as {
      tag_name: string;
      html_url: string;
      published_at?: string;
      assets: { name: string; browser_download_url: string }[];
    };
    return {
      tag_name: data.tag_name,
      html_url: data.html_url,
      published_at: data.published_at,
      assets: data.assets.map(({ name, browser_download_url }) => ({ name, browser_download_url })),
    };
  } catch (error) {
    console.warn(`[site] GitHub's latest release was out of reach (${String(error)}); the page will ask live.`);
    return null;
  }
}

const RELEASE_VIRTUAL = "virtual:site-release";

/** `virtual:site-release`: `BUILT_RELEASE`, the latest release when the page was built. */
function siteReleasePlugin(): Plugin {
  return {
    name: "mc-site-release",
    resolveId: (id) => (id === RELEASE_VIRTUAL ? `\0${RELEASE_VIRTUAL}` : undefined),
    async load(id) {
      if (id !== `\0${RELEASE_VIRTUAL}`) return undefined;
      return `export const BUILT_RELEASE = ${JSON.stringify(await latestRelease())};`;
    },
  };
}

const VIRTUAL = "virtual:landing-data";
const RESOLVED = `\0${VIRTUAL}`;

/** `virtual:landing-data`: the release feed (both languages), report screenshots as bundled assets, and the mods. */
function landingDataPlugin(): Plugin {
  return {
    name: "mc-landing-data",
    resolveId: (id) => (id === VIRTUAL ? RESOLVED : undefined),
    async load(id) {
      if (id !== RESOLVED) return undefined;
      writeReleaseHistory();
      const history = join(PUBLIC_RELEASES, "history");
      const feed = (dir: string) => {
        const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as { version: string }[];
        return manifest.slice(0, FEED_LENGTH).map(({ version }) => {
          const notes = JSON.parse(readFileSync(join(dir, `${version}.json`), "utf8")) as Record<string, unknown>;
          const { date, title, summaryHtml, report, reportFile } = notes;
          return { version, date, title, summaryHtml, report, reportFile };
        });
      };
      const releases = { en: feed(history), es: feed(join(history, "es")) };

      const imports: string[] = [];
      const shots: string[] = [];
      for (const { version, report } of releases.en.slice(0, GALLERY_REPORTS * 2)) {
        if (!report || shots.length >= GALLERY_LENGTH) continue;
        const dir = join(PUBLIC_RELEASES, version);
        const english = figuresOf(readFileSync(join(dir, "index.html"), "utf8"), dir);
        const spanishFile = join(dir, "index.es.html");
        const spanish = existsSync(spanishFile) ? figuresOf(readFileSync(spanishFile, "utf8"), dir) : [];
        // A report's first few screenshots, which are its headline features.
        for (const [i, figure] of english.slice(0, 3).entries()) {
          if (shots.length >= GALLERY_LENGTH) break;
          const name = `shot${shots.length}`;
          imports.push(`import ${name} from ${JSON.stringify(figure.file.replaceAll("\\", "/"))};`);
          const es = spanish[i]?.file === figure.file ? spanish[i]! : figure;
          shots.push(
            `{ src: ${name}, version: ${JSON.stringify(version)}, alt: ${JSON.stringify({ en: figure.alt, es: es.alt })}, caption: ${JSON.stringify({ en: figure.caption, es: es.caption })} }`,
          );
        }
      }
      const mods = await packCatalog();
      return [
        ...imports,
        `export const RELEASES = ${JSON.stringify(releases)};`,
        `export const SCREENSHOTS = [${shots.join(",\n")}];`,
        `export const MODS = ${JSON.stringify(mods)};`,
        `export const BUILT_AT = ${JSON.stringify(new Date().toISOString())};`,
      ].join("\n");
    },
  };
}

export default defineConfig(({ mode }) => {
  const site = siteOf(mode);
  return {
    root: resolve(CLIENT, "site", site),
    // The fonts live in the game's `public/`; the pages reach them by path and the build bundles them. A site's own
    // `public/` (the moved page's Netlify `_redirects`) is copied as is.
    publicDir: existsSync(resolve(CLIENT, "site", site, "public")) ? resolve(CLIENT, "site", site, "public") : false,
    plugins: site === "landing" ? [siteReleasePlugin(), landingDataPlugin()] : [siteReleasePlugin()],
    server: { fs: { allow: [CLIENT] } },
    build: {
      target: "es2022",
      outDir: resolve(CLIENT, `dist-${site}`),
      emptyOutDir: true,
    },
  };
});
