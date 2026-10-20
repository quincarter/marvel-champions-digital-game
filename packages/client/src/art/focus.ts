/**
 * Cover-crop focus points, free of Phaser and of the picture loader so the card-face worker can import them.
 */
/**
 * Where the subject of a picture is, as a point in the picture: 0 left/top to 1 right/bottom. A cover crop centers on
 * it (clamped to the picture's edges) instead of on the middle. An axis left out keeps the caller's own default.
 */
export interface PictureFocus {
  readonly x?: number;
  readonly y?: number;
}

/**
 * Where a crop of `cropLength` starts along an axis of `length` so it is centered on the `point` (0 to 1) of the
 * picture, kept inside the picture. No point, or a crop that is the whole axis, centers it.
 */
export function focusedOffset(length: number, cropLength: number, point: number | undefined): number {
  const room = length - cropLength;
  if (point === undefined || !Number.isFinite(point) || room <= 0) return room / 2;
  return Math.max(0, Math.min(room, point * length - cropLength / 2));
}
