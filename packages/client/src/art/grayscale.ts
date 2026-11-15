/**
 * A picture's gray copy, baked once (issue #716). A live grayscale filter re-renders its picture through a framebuffer
 * on every frame the screen draws, which on Extras' shelf of locked tiles made each frame of the fade-in 60 to 190 ms.
 * Baked into its own texture, a gray picture draws like any other. It is baked at the size it is drawn at (to a
 * power-of-two bucket), not the picture's own: some are 2400 x 3600, and uploading those for a 180-pixel tile held the
 * screen for a fifth of a second.
 *
 * The same mix as Phaser's `ColorMatrix.grayscale(1)` (`saturate(-1)`: every channel the mean of the three), so a
 * baked picture looks as the filtered one did. Alpha is left as it is. Plain TypeScript, for the worker and the tests.
 */
export function grayscalePixels(data: Uint8ClampedArray): void {
  for (let index = 0; index + 3 < data.length; index += 4) {
    const gray = (data[index]! + data[index + 1]! + data[index + 2]!) / 3;
    data[index] = gray;
    data[index + 1] = gray;
    data[index + 2] = gray;
  }
}

/** The sizes a gray copy is baked for: the smallest that covers what is drawn, so one bake serves similar slots. */
export const GRAY_BUCKETS = [128, 256, 512, 1024, 2048, 4096] as const;

/** The bucket for a slot `pixels` device pixels long. */
export function grayBucket(pixels: number): number {
  return GRAY_BUCKETS.find((bucket) => bucket >= pixels) ?? GRAY_BUCKETS[GRAY_BUCKETS.length - 1]!;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The slot a gray copy is baked for: the drawn rect in device pixels, each side to its bucket. */
export function graySlotOf(rect: Size, renderScale: number): Size {
  return { width: grayBucket(rect.width * renderScale), height: grayBucket(rect.height * renderScale) };
}

/**
 * The size to bake a `source` picture at so it still covers `slot` (a cover crop's scale), never larger than the
 * picture itself.
 */
export function bakedSizeOf(source: Size, slot: Size): Size {
  if (source.width <= 0 || source.height <= 0) return { width: 1, height: 1 };
  const scale = Math.min(1, Math.max(slot.width / source.width, slot.height / source.height));
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

/** A picture's gray copy's texture key, beside the picture's own: one per slot bucket. */
export const grayKeyOf = (key: string, slot: Size): string => `${key}#gray@${slot.width}x${slot.height}`;

/**
 * A picture's color copy scaled to a slot (issue #722): uploading a 2400 x 3600 picture for a 180-pixel tile cost the
 * frame it landed in. One per slot bucket, like the gray copies.
 */
export const scaledKeyOf = (key: string, slot: Size): string => `${key}#@${slot.width}x${slot.height}`;
