import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
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

/**
 * The game's own art (`art/`, fetched with `pnpm assets:fetch art`): the title wallpapers behind the page's top and
 * between its sections, every hero's portrait and the villains' artwork. Each is shrunk to the width it shows at, as
 * WebP, into a cache that survives rebuilds. Without `sharp` the originals ship as they are; without `art/` the page
 * draws name tiles instead.
 */
const ART = resolve(CLIENT, "../../art");
const ART_CACHE = resolve(CLIENT, "../../node_modules/.cache/mc-landing-art");
const PICTURE = /\.(png|jpe?g|webp|avif)$/i;
/** The wallpaper behind the top of the page, a tall one for phones, and the ones between sections, in order. */
const HERO_WALLPAPER = "wallpaper-1";
const PORTRAIT_WALLPAPER = "wallpaper-portrait";
const BAND_WALLPAPERS = ["wallpaper-2", "back-to-basics-back-cover", "spider-verse-team", "mutant-genesis-x-men"];
/** The campaign comic pages the story section steps through, in order: `key` names their text in `landing-text.ts`. */
const COMIC_PAGES = [
  { key: "mtsTitan", file: "campaigns/mts/pages/01-p1-titan" },
  { key: "mtsBattle", file: "campaigns/mts/pages/03-p3-battle" },
  { key: "mtsAsgard", file: "campaigns/mts/pages/05-p5-asgard" },
  { key: "smSwing", file: "campaigns/sm/pages/01-p1-swing" },
  { key: "smSix", file: "campaigns/sm/pages/05-p5-six" },
  { key: "smGoblin", file: "campaigns/sm/pages/06-p6-goblin" },
];

type Resize = (source: string, width: number) => Promise<string>;

async function resizer(): Promise<Resize> {
  let sharp:
    | ((input: string) => {
        resize: (o: object) => { webp: (o: object) => { toFile: (f: string) => Promise<unknown> } };
      })
    | null = null;
  try {
    sharp = ((await import("sharp")) as { default: typeof sharp }).default;
  } catch {
    console.warn("[landing] sharp isn't installed; the art ships at full size.");
  }
  mkdirSync(ART_CACHE, { recursive: true });
  return async (source, width) => {
    const stamp = Math.round(statSync(source).mtimeMs);
    const base = join(
      ART_CACHE,
      `${source
        .slice(ART.length + 1)
        .replace(/[\\/]/g, "_")
        .replace(PICTURE, "")}-${width}-${stamp}`,
    );
    // A copy already in the cache wins, whichever tool made it.
    const cached = [".webp", ".jpg"].map((ext) => base + ext).find((file) => existsSync(file));
    if (cached) return cached;
    if (!sharp) return source;
    await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toFile(`${base}.webp`);
    return `${base}.webp`;
  };
}

/** The first picture in `dir` whose name (no extension) is `base`, if any. */
function pictureIn(dir: string, base: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const file = readdirSync(dir).find((name) => PICTURE.test(name) && name.replace(PICTURE, "") === base);
  return file === undefined ? undefined : join(dir, file);
}

interface ArtModule {
  readonly imports: string[];
  readonly exports: string[];
}

/** The art module: wallpapers for both pages, and (`portraits`) the hero and villain pictures for the landing page. */
async function siteArt(portraits: boolean): Promise<ArtModule> {
  const roster = JSON.parse(readFileSync(join(CLIENT, "src/site/landing/game-roster.json"), "utf8")) as {
    waves: { heroes: { id: string }[] }[];
    scenarios: { id: string }[];
  };
  const resize = await resizer();
  const imports: string[] = [];
  const asset = (file: string): string => {
    const name = `art${imports.length}`;
    imports.push(`import ${name} from ${JSON.stringify(file.replaceAll("\\", "/"))};`);
    return name;
  };

  const heroes: string[] = [];
  const heroDirs = existsSync(join(ART, "heroes")) ? readdirSync(join(ART, "heroes")) : [];
  for (const { id } of portraits ? roster.waves.flatMap((wave) => wave.heroes) : []) {
    const dir = heroDirs.find((name) => name.startsWith(`${id}-`));
    const file = dir && pictureIn(join(ART, "heroes", dir), "hero");
    if (!file) continue;
    const focusFile = join(ART, "heroes", dir, "focus.json");
    const focus = existsSync(focusFile)
      ? (JSON.parse(readFileSync(focusFile, "utf8")) as { x?: number; y?: number })
      : {};
    const position = `${Math.round((focus.x ?? 0.5) * 100)}% ${Math.round((focus.y ?? 0.2) * 100)}%`;
    heroes.push(
      `${JSON.stringify(id)}: { src: ${asset(await resize(file, 420))}, position: ${JSON.stringify(position)} }`,
    );
  }

  const villains: string[] = [];
  for (const { id } of portraits ? roster.scenarios : []) {
    const file = pictureIn(join(ART, "scenarios", id), "villain");
    if (file) villains.push(`${JSON.stringify(id)}: ${asset(await resize(file, 560))}`);
  }

  const title = join(ART, "title");
  const wallpaper = async (base: string, width: number): Promise<string> => {
    const file = pictureIn(title, base);
    return file ? asset(await resize(file, width)) : "null";
  };
  const bands: string[] = [];
  for (const base of BAND_WALLPAPERS) bands.push(await wallpaper(base, 1920));
  const comics: string[] = [];
  for (const { key, file } of portraits ? COMIC_PAGES : []) {
    const dir = join(ART, dirname(file));
    const picture = pictureIn(dir, file.split("/").at(-1)!);
    if (picture) comics.push(`{ key: ${JSON.stringify(key)}, src: ${asset(await resize(picture, 1600))} }`);
  }
  return {
    imports,
    exports: [
      `export const HERO_ART = { ${heroes.join(",\n")} };`,
      `export const VILLAIN_ART = { ${villains.join(",\n")} };`,
      `export const COMIC_PAGES = [${comics.join(",\n")}];`,
      `export const WALLPAPERS = { wide: ${await wallpaper(HERO_WALLPAPER, 2400)}, tall: ${await wallpaper(PORTRAIT_WALLPAPER, 900)}, bands: [${bands.join(", ")}].filter(Boolean) };`,
    ],
  };
}

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

const WALLPAPER_VIRTUAL = "virtual:site-wallpapers";

/** `virtual:site-wallpapers`: just `WALLPAPERS`, for the moved page. */
function siteWallpapersPlugin(): Plugin {
  return {
    name: "mc-site-wallpapers",
    resolveId: (id) => (id === WALLPAPER_VIRTUAL ? `\0${WALLPAPER_VIRTUAL}` : undefined),
    async load(id) {
      if (id !== `\0${WALLPAPER_VIRTUAL}`) return undefined;
      const art = await siteArt(false);
      return [...art.imports, ...art.exports.filter((line) => line.startsWith("export const WALLPAPERS"))].join("\n");
    },
  };
}

/**
 * The release pages (`public/releases`: the history page, every report and its Spanish copy) and the fonts they load
 * (`../../fonts/`), copied beside the landing page so they live on the top-level domain too.
 */
function releasePagesPlugin(): Plugin {
  let outDir = "";
  return {
    name: "mc-landing-release-pages",
    apply: "build",
    configResolved: (config) => {
      outDir = config.build.outDir;
    },
    closeBundle() {
      for (const folder of ["releases", "fonts"]) {
        cpSync(join(CLIENT, "public", folder), join(outDir, folder), { recursive: true });
      }
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
      const mods = (await packCatalog()) as { id: string; latest: string; thumbnail?: string }[];
      // Each pack's cover, saved at build time so it ships with the page (and shows where the pack host's images
      // can't load); a cover that won't download keeps its URL on the pack host.
      const coverImports: string[] = [];
      const modCode: string[] = [];
      for (const mod of mods) {
        let cover = mod.thumbnail ? JSON.stringify(mod.thumbnail) : "undefined";
        if (mod.thumbnail) {
          const file = join(
            ART_CACHE,
            "mods",
            `${mod.id}-${mod.latest}${extname(new URL(mod.thumbnail).pathname) || ".webp"}`,
          );
          try {
            if (!existsSync(file)) {
              const response = await fetch(mod.thumbnail, { signal: AbortSignal.timeout(10_000) });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              mkdirSync(dirname(file), { recursive: true });
              writeFileSync(file, Buffer.from(await response.arrayBuffer()));
            }
            cover = `cover${coverImports.length}`;
            coverImports.push(`import ${cover} from ${JSON.stringify(file.replaceAll("\\", "/"))};`);
          } catch (error) {
            console.warn(`[landing] ${mod.id}'s cover didn't download (${String(error)}); linking it instead.`);
          }
        }
        modCode.push(`{ ...${JSON.stringify(mod)}, thumbnail: ${cover} }`);
      }
      const art = await siteArt(true);
      return [
        ...imports,
        ...art.imports,
        ...coverImports,
        ...art.exports,
        `export const RELEASES = ${JSON.stringify(releases)};`,
        `export const SCREENSHOTS = [${shots.join(",\n")}];`,
        `export const MODS = [${modCode.join(",\n")}];`,
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
    plugins:
      site === "landing"
        ? [siteReleasePlugin(), landingDataPlugin(), releasePagesPlugin()]
        : [siteReleasePlugin(), siteWallpapersPlugin()],
    server: { fs: { allow: [CLIENT] } },
    build: {
      target: "es2022",
      outDir: resolve(CLIENT, `dist-${site}`),
      emptyOutDir: true,
    },
  };
});
