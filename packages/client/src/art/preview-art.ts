/**
 * Card pictures of a pack that is not installed yet (the Mod Store's pack page, docs/custom-content-packs.md §11.6).
 *
 * A picture is `<version base>/cards/<lang>/<code>.webp` on the pack host. It is fetched lazily, when a tile that shows
 * it is drawn, through the store's own fetch path (`pack-fetch.ts`: the web's CORS fetch, a packaged app's native HTTP),
 * and held as a same-origin `blob:` URL, because WebGL takes no cross-origin texture. `previewPictureFor` answers
 * synchronously like `pack-art.ts`'s `packArtFor`: null while the bytes are on their way (the card draws its generated
 * face) and null for good on a 404; a redraw is announced when one lands. The texture key is `art:preview:<url>`, and
 * the URL carries the pack's version, so an updated pack never draws the old texture.
 *
 * Bounded: at most `MAX_PARALLEL` fetches at once, and the oldest pictures' blobs are released past `MAX_HELD`.
 */
import type { FetchLike } from "../packs/catalog.js";
import { packFetchFor } from "../packs/pack-fetch.js";
import type { ArtSource } from "./art-source.js";

const MAX_PARALLEL = 4;
const MAX_HELD = 120;
/** A card picture is a few hundred KB; a file bigger than this is not one. */
const MAX_BYTES = 8_000_000;

type Entry = { readonly state: "loading" } | { readonly state: "missing" } | { readonly state: "ready"; url: string };

const entries = new Map<string, Entry>();
const order: string[] = [];
const waiting: string[] = [];
const listeners = new Set<() => void>();
let running = 0;
let announceTimer: ReturnType<typeof setTimeout> | undefined;
let fetcher: FetchLike | undefined;

export const previewArtKey = (url: string): string => `art:preview:${url}`;

/** Calls `listener` (once for a run of arrivals) when a picture lands. */
export function onPreviewArtArrived(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announceSoon(): void {
  if (announceTimer !== undefined) return;
  announceTimer = setTimeout(() => {
    announceTimer = undefined;
    for (const listener of [...listeners]) listener();
  }, 80);
}

function pump(): void {
  while (running < MAX_PARALLEL && waiting.length > 0) {
    const url = waiting.shift()!;
    running += 1;
    void load(url).finally(() => {
      running -= 1;
      pump();
    });
  }
}

async function load(url: string): Promise<void> {
  try {
    const response = await (fetcher ?? packFetchFor())(url);
    if (!response.ok) throw new Error(`picture ${response.status}`);
    const blob = await response.blob();
    if (blob.size === 0 || blob.size > MAX_BYTES) throw new Error("not a card picture");
    entries.set(url, { state: "ready", url: URL.createObjectURL(blob) });
    order.push(url);
    while (order.length > MAX_HELD) {
      const oldest = order.shift()!;
      const held = entries.get(oldest);
      if (held?.state === "ready") URL.revokeObjectURL(held.url);
      entries.delete(oldest);
    }
  } catch {
    entries.set(url, { state: "missing" });
  }
  announceSoon();
}

/**
 * The picture at `url` as an art source, or null while it loads or when the pack host has none (the generated face is
 * the answer for both). The first ask starts the fetch.
 */
export function previewPictureFor(url: string): ArtSource | null {
  const entry = entries.get(url);
  if (entry?.state === "ready") return { key: previewArtKey(url), url: entry.url };
  if (!entry) {
    entries.set(url, { state: "loading" });
    waiting.push(url);
    pump();
  }
  return null;
}

/** Test seam: forgets every picture and sets the fetch to use. */
export function resetPreviewArt(fetchWith?: FetchLike): void {
  for (const entry of entries.values()) if (entry.state === "ready") URL.revokeObjectURL(entry.url);
  entries.clear();
  order.length = 0;
  waiting.length = 0;
  running = 0;
  fetcher = fetchWith;
  if (announceTimer !== undefined) clearTimeout(announceTimer);
  announceTimer = undefined;
}
