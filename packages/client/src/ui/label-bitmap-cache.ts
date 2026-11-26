/**
 * Painted labels, kept so a redraw that makes the same label again reuses the pixels instead of painting them again.
 *
 * Every screen here redraws whole (`destroyChildren`) on every change, and a screen's first draws are usually followed
 * by more as its data arrives (saves, unlocks, art). Each redraw used to paint every label again: in a screen's first
 * frames that went to the text worker, so the whole page's text blinked out until the bitmaps came back; after them it
 * went to the main thread, so a tab click or a tap held a frame while some forty labels were painted. Most of those
 * labels are the same as the ones just destroyed ("LOCKED", a tab's name, a heading), so the paint they need is
 * already done.
 *
 * Keyed on everything a paint depends on (`PaintJob` without its id: size, font, colors, the laid-out lines), so a hit
 * is the same pixels by construction. Bounded by the bytes the canvases hold and by how many there are, least recently
 * used first out. The count matters as much as the bytes: every kept label is a canvas element of its own, with a
 * drawing context and a backing store the bytes do not count, and a long game paints thousands of distinct labels
 * (each new card name, value and log line). Capped by bytes alone the cache grew past 2,000 canvases in five rounds,
 * the bulk of the WebKit apps' ~180 MB a round (an 8 GB Mac reported 3.9 GB at round 12).
 */
import type { PaintJob } from "./text-paint-protocol.js";

/** A painted label: the canvas to upload and the frame size Phaser gives the label for it. */
export interface CachedLabel {
  readonly canvas: HTMLCanvasElement;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly resolution: number;
}

/** Up to this many bytes of label pixels are kept (width × height × 4 per label). */
export const LABEL_CACHE_BYTES = 24 * 1024 * 1024;

/** The cache key of a paint job: every field the pixels depend on. */
export function labelKeyOf(job: Omit<PaintJob, "id">): string {
  return JSON.stringify([
    job.width,
    job.height,
    job.resolution,
    job.font,
    job.background,
    job.paddingLeft,
    job.paddingTop,
    job.fill,
    job.stroke,
    job.strokeThickness,
    job.letterSpacing,
    job.shadow.offsetX,
    job.shadow.offsetY,
    job.shadow.color,
    job.shadow.blur,
    job.shadow.fill,
    job.shadow.stroke,
    job.lines.map((line) => [line.text, line.x, line.y]),
  ]);
}

/** Up to this many labels are kept: a whole screen's labels, twice over. */
export const LABEL_CACHE_ENTRIES = 500;

const bytesOf = (label: CachedLabel): number => label.canvas.width * label.canvas.height * 4;

export class LabelBitmapCache {
  readonly #entries = new Map<string, CachedLabel>();
  readonly #budget: number;
  readonly #maxEntries: number;
  #bytes = 0;

  constructor(budgetBytes: number = LABEL_CACHE_BYTES, maxEntries: number = LABEL_CACHE_ENTRIES) {
    this.#budget = budgetBytes;
    this.#maxEntries = maxEntries;
  }

  get size(): number {
    return this.#entries.size;
  }

  get bytes(): number {
    return this.#bytes;
  }

  /** The painted label for `key`, now the most recently used, or undefined. */
  get(key: string): CachedLabel | undefined {
    const found = this.#entries.get(key);
    if (!found) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, found);
    return found;
  }

  set(key: string, label: CachedLabel): void {
    const size = bytesOf(label);
    // An empty label has nothing to reuse; one bigger than a quarter of the budget would push out too much.
    if (size <= 0 || size > this.#budget / 4) return;
    const old = this.#entries.get(key);
    if (old) {
      this.#bytes -= bytesOf(old);
      this.#entries.delete(key);
    }
    this.#entries.set(key, label);
    this.#bytes += size;
    for (const [oldest, entry] of this.#entries) {
      if (this.#bytes <= this.#budget && this.#entries.size <= this.#maxEntries) break;
      this.#entries.delete(oldest);
      this.#bytes -= bytesOf(entry);
    }
  }

  clear(): void {
    this.#entries.clear();
    this.#bytes = 0;
  }
}
