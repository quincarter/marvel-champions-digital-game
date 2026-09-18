/**
 * Card art in a packaged app: the native half of `vite-card-art.ts`.
 *
 * `art-source.ts` resolves every face to a `/card-art/<path>` URL, which the
 * dev/preview server answers. A packaged app has no server, so here the same
 * `<path>` is fetched from MarvelCDB through native HTTP and handed to Phaser as
 * a `blob:` URL. A blob made by this page is same-origin, so WebGL takes it as a
 * texture — the property the dev route exists to provide.
 *
 * Differences from the dev route, all deliberate:
 *  - No local `assets/card-art/` folder: a packaged app ships no scans (the
 *    folder is never bundled; see CLAUDE.md on art), so an `ArtRef`-only card
 *    has nothing to fetch and falls back to its generated frame, as it does on
 *    a dev server without the scan.
 *  - Requests are capped at `MAX_CONCURRENT` and a transient failure (a
 *    network error, a 429, a 5xx) is retried with backoff. `card-art.ts`
 *    remembers a failed key as missing for the whole session, which is right
 *    for a 404 but wrong for a blip — and a board redraw asks for dozens of
 *    scans at once, which is exactly when an upstream host starts refusing.
 *    The dev route never met this: it answers most requests from disk.
 *  - No disk cache yet. Fetched bytes are kept in memory for the session (a
 *    texture evicted by `card-art.ts`'s budget reloads from here, not the
 *    network), bounded by `MAX_CACHED` so the compressed copies can't become
 *    the leak the texture budget was written to stop.
 */

import { MARVELCDB_IMAGE_BASE } from "@mc/content";
import { CARD_ART_ROUTE } from "../art/art-source.js";
import { nativeGet } from "./native-http.js";
import type { Platform } from "./platform.js";

/** A few hundred compressed scans at ~150–300 kB each. */
const MAX_CACHED = 300;

/** Upstream requests in flight at once. */
const MAX_CONCURRENT = 6;

/** Waits before each retry of a transient failure; its length is the retry count. */
const RETRY_DELAYS_MS = [400, 1500];

export type ArtUrlResolver = (url: string) => Promise<string | null>;

/**
 * Turns a `/card-art/<path>` URL into a loadable `blob:` URL, or null when
 * MarvelCDB has no image there (the caller treats null as a 404).
 */
export function nativeArtResolver(
  platform: Exclude<Platform, "web">,
  get: typeof nativeGet = nativeGet,
  objectUrls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms)),
): ArtUrlResolver {
  // Insertion order doubles as recency: a hit is re-inserted at the end.
  const cache = new Map<string, Promise<string | null>>();
  const limited = limiter(MAX_CONCURRENT);
  const fetchOnce = (url: string): Promise<Fetched> => limited(() => fetchArt(platform, url, get));

  const evict = (): void => {
    while (cache.size > MAX_CACHED) {
      const [oldest, entry] = cache.entries().next().value!;
      cache.delete(oldest);
      void entry.then((blobUrl) => blobUrl && objectUrls.revokeObjectURL(blobUrl));
    }
  };

  return (url) => {
    const hit = cache.get(url);
    if (hit) {
      cache.delete(url);
      cache.set(url, hit);
      return hit;
    }
    const pending = withRetries(() => fetchOnce(url), sleep).then((bytes) =>
      bytes ? objectUrls.createObjectURL(new Blob([bytes.body as BlobPart], { type: bytes.contentType })) : null,
    );
    cache.set(url, pending);
    // A failed fetch isn't remembered here: `card-art.ts` already records the
    // key as missing, and a network blip shouldn't outlive this session's cache.
    void pending.then((blobUrl) => {
      if (blobUrl === null && cache.get(url) === pending) cache.delete(url);
    });
    evict();
    return pending;
  };
}

/** Image bytes; `missing` for a definite no; `retry` for a failure that may pass. */
type Fetched = { readonly body: Uint8Array; readonly contentType: string } | "missing" | "retry";

async function withRetries(attempt: () => Promise<Fetched>, sleep: (ms: number) => Promise<void>): Promise<Exclude<Fetched, "missing" | "retry"> | null> {
  for (let i = 0; ; i++) {
    const result = await attempt();
    if (result === "missing") return null;
    if (result !== "retry") return result;
    const delay = RETRY_DELAYS_MS[i];
    if (delay === undefined) return null;
    await sleep(delay);
  }
}

async function fetchArt(platform: Exclude<Platform, "web">, url: string, get: typeof nativeGet): Promise<Fetched> {
  if (!url.startsWith(CARD_ART_ROUTE)) return "missing";
  const path = url.slice(CARD_ART_ROUTE.length);
  let response;
  try {
    response = await get(platform, `${MARVELCDB_IMAGE_BASE}/${path}`, "bytes");
  } catch {
    return "retry";
  }
  if (response.status === 429 || response.status >= 500) return "retry";
  // Refuse anything that isn't an image: an error page drawn as a card would
  // be worse than the generated frame.
  if (response.status < 200 || response.status >= 300 || !response.contentType.startsWith("image/")) return "missing";
  return { body: response.body, contentType: response.contentType };
}

/** Runs at most `max` of the tasks it is handed at once, in arrival order. */
function limiter(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: (() => void)[] = [];
  return (task) =>
    new Promise((resolve, reject) => {
      const run = (): void => {
        active++;
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            queue.shift()?.();
          });
      };
      if (active < max) run();
      else queue.push(run);
    });
}
