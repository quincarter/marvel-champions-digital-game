/**
 * Where a preview's files live in the `mc-previews` bucket. The deploy (src/deploy/) and the Worker (src/handler.ts)
 * both call `keyFor`, so a file uploaded from `dist/<path>` is the object the Worker reads for `/<path>`.
 *
 *   pr-<n>/<path>                  the pull request's own files: index.html, releases/, fonts/, packs/, ...
 *   pr-<n>/preview.json            written last by a deploy; the Worker serves a PR only once it exists
 *   pr-<n>/files.json              the shared keys the PR uses, written first; the sweep keeps every key some PR lists
 *   shared/assets/<name>           Vite's content-hashed output (JS, CSS, music, art): one copy for every PR
 *   shared/card-art/<lang>/<path>  card scans by language: one copy for every PR, rewritten only when a scan changes
 *
 * Card art is keyed by path and language rather than by the asset manifest's hash: a new card-art bundle then rewrites
 * only the scans that changed, instead of uploading all ~10,000 again under a new prefix (the R2 API takes 1,200 calls
 * per 5 minutes, so a full upload is about 50 minutes).
 */

export const PREVIEW_FILE = "preview.json";
export const FILES_FILE = "files.json";
export const SHARED_PREFIX = "shared/";

/** Card-scan languages the web build can carry (packages/client/src/art/card-language.ts). */
const LANG = /^[a-z]{2}$/;

/**
 * Vite's `[name]-[hash].[ext]`: an 8-character base64url hash before the extension. Files that `public/assets/` copies
 * as they are (controller pictures, the first-player token) don't match and stay with their PR.
 */
const HASHED_ASSET = /^assets\/(?:[^/]+\/)*[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;

/** A preview's metadata (`pr-<n>/preview.json`). */
export interface PreviewInfo {
  readonly pr: number;
  /** The commit the preview was built from. */
  readonly sha: string;
  /** The build's card language: the one `/card-art/` serves. */
  readonly lang: string;
  readonly deployedAt: string;
}

export function prPrefix(pr: number): string {
  return `pr-${pr}/`;
}

/** The pull request a preview host names (`pr-123.<domain>`), or null for any other host. */
export function prOfHost(host: string): number | null {
  const match = /^pr-([1-9][0-9]{0,6})\./.exec(host.toLowerCase());
  return match ? Number(match[1]) : null;
}

export function isHashedAsset(path: string): boolean {
  return HASHED_ASSET.test(path);
}

/**
 * The bucket key for a site path (no leading slash, already decoded), or null for a path that may not be read
 * (`..`, empty segments, a backslash). `lang` is the preview's build language.
 */
export function keyFor(path: string, pr: number, lang: string): string | null {
  if (path === "" || path.includes("\\") || path.includes("\0")) return null;
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  if (isHashedAsset(path)) return `${SHARED_PREFIX}assets/${path.slice("assets/".length)}`;
  const art = /^card-art(?:-([a-z]{2}))?\/(.+)$/.exec(path);
  if (art) {
    const artLang = art[1] ?? lang;
    if (!LANG.test(artLang)) return null;
    return `${SHARED_PREFIX}card-art/${artLang}/${art[2]}`;
  }
  return `${prPrefix(pr)}${path}`;
}

const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "public, max-age=0, must-revalidate";

/**
 * Cache-Control for a site path, as netlify.toml sets them: a year for hashed assets and card scans, and a revalidation
 * every time for everything else, so a new push shows on the next load.
 */
export function cacheControlFor(path: string): string {
  if (isHashedAsset(path) || /^card-art(?:-[a-z]{2})?\//.test(path)) return IMMUTABLE;
  return REVALIDATE;
}

const TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  webmanifest: "application/manifest+json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  wasm: "application/wasm",
  zip: "application/zip",
  pdf: "application/pdf",
};

/** A file's type from its extension; `application/octet-stream` when it has none we know. */
export function contentTypeOf(path: string): string {
  const ext = /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase();
  return (ext && TYPES[ext]) || "application/octet-stream";
}

/**
 * An image's type from its first bytes. Card scans are WebP filed under `.png` / `.jpg` names (vite-card-art.ts
 * sniffs them the same way), so the deploy stores the real type. Null when the bytes aren't an image we know.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const at = (offset: number, text: string) => [...text].every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));
  if (bytes.length >= 12 && at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (bytes.length >= 8 && bytes[0] === 0x89 && at(1, "PNG")) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && at(4, "ftypavif")) return "image/avif";
  return null;
}
