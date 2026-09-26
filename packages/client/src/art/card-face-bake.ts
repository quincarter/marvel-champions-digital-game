/**
 * Bakes a `CardFaceSpec` (`card-face.ts`) into an `ImageBitmap`: fetches and decodes the art, downscaled to the size
 * the card shows it at, and paints the face over it. The same code runs inside `card-face.worker.ts` and, where a
 * worker can't (no `OffscreenCanvas`, or no fonts in workers — older WebKit), on the main thread
 * (`card-face-baker.ts`'s inline fallback). Either way the decode itself is `createImageBitmap`'s, which browsers
 * do off the main thread.
 *
 * Decoded art is kept in a small LRU (`ArtBitmaps`), keyed by URL and decode size, so re-baking a card for a new
 * state (selected, seated, dimmed) doesn't fetch and decode its art again.
 */
import { artDecodeSize, footerHeightOf, paintCardFace, type CardFaceSpec, type FaceContext } from "./card-face.js";

interface DecodedArt {
  readonly width: number;
  readonly height: number;
  readonly source: ImageBitmap;
}

/** How many decoded (already downscaled) art bitmaps one baker keeps. A shelf screen shows a dozen or two at once. */
const ART_CACHE_SIZE = 32;

export class ArtBitmaps {
  readonly #decoded = new Map<string, Promise<DecodedArt | null>>();
  /** Fetches in flight, by URL, so two decode sizes of one picture asked for at once fetch it once. */
  readonly #blobs = new Map<string, Promise<Blob | null>>();

  get(spec: CardFaceSpec): Promise<DecodedArt | null> {
    const url = spec.artUrl;
    if (!url) return Promise.resolve(null);
    const slot = { width: spec.width, height: spec.height - footerHeightOf(spec) };
    const key = `${url}|${Math.round(slot.width)}x${Math.round(slot.height)}@${spec.resolution}|${spec.artFit}`;
    const hit = this.#decoded.get(key);
    if (hit) {
      // Re-inserted, so the map's own order is least- to most-recently used.
      this.#decoded.delete(key);
      this.#decoded.set(key, hit);
      return hit;
    }
    const decoding = this.#decode(url, slot, spec);
    this.#decoded.set(key, decoding);
    while (this.#decoded.size > ART_CACHE_SIZE) {
      const oldest = this.#decoded.keys().next().value as string;
      const evicted = this.#decoded.get(oldest);
      this.#decoded.delete(oldest);
      void evicted?.then((art) => art?.source.close());
    }
    return decoding;
  }

  async #decode(url: string, slot: { width: number; height: number }, spec: CardFaceSpec): Promise<DecodedArt | null> {
    const blob = await this.#blob(url);
    if (!blob) return null;
    try {
      const full = await createImageBitmap(blob);
      const size = artDecodeSize(full, slot, spec.artFit, spec.resolution);
      if (size.width >= full.width || size.height >= full.height)
        return { width: full.width, height: full.height, source: full };
      // A second, resized bitmap from the first: the resize is the browser's own high-quality filter, off this
      // thread, and a 2160×3840 picture shown at 430×700 is held as the smaller one from here on.
      const scaled = await createImageBitmap(full, {
        resizeWidth: size.width,
        resizeHeight: size.height,
        resizeQuality: "high",
      });
      full.close();
      return { width: scaled.width, height: scaled.height, source: scaled };
    } catch {
      return null;
    }
  }

  #blob(url: string): Promise<Blob | null> {
    let pending = this.#blobs.get(url);
    if (!pending) {
      pending = fetch(url)
        .then((response) => (response.ok ? response.blob() : null))
        .catch(() => null)
        .finally(() => this.#blobs.delete(url));
      this.#blobs.set(url, pending);
    }
    return pending;
  }
}

/** A canvas to paint on, and how to turn what was painted into a bitmap. */
function surfaceFor(
  width: number,
  height: number,
): {
  readonly ctx: FaceContext;
  readonly finish: () => Promise<ImageBitmap>;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (ctx)
      return { ctx: ctx as unknown as FaceContext, finish: () => Promise.resolve(canvas.transferToImageBitmap()) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2D canvas context");
  return { ctx: ctx as unknown as FaceContext, finish: () => createImageBitmap(canvas) };
}

export async function bakeCardFace(spec: CardFaceSpec, art: ArtBitmaps): Promise<ImageBitmap> {
  const decoded = await art.get(spec);
  const pixelWidth = Math.max(1, Math.ceil(spec.width * spec.resolution));
  const pixelHeight = Math.max(1, Math.ceil(spec.height * spec.resolution));
  const { ctx, finish } = surfaceFor(pixelWidth, pixelHeight);
  ctx.save();
  ctx.scale(spec.resolution, spec.resolution);
  paintCardFace(ctx, spec, decoded);
  ctx.restore();
  return finish();
}
