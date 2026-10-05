/**
 * Which part of a Team-Up picture fills the circle (the popup's portrait, the board's ring, the seat pill).
 *
 * The circle shows the largest circle inscribed in a square crop, so the corners of the square are lost and a head
 * near a corner of a closeup can touch or leave the circle. A pair's crop spec says where the square is centered, how
 * far it is zoomed in, and which of the pair's two pictures it is cut from (the closeup, or the taller full picture
 * when the closeup is itself too tight). The default is the whole closeup, centered, as the largest square that fits.
 *
 * Pure: the scene reads the picture's size and draws `badgeCropRect`; nothing here knows what is in the picture.
 */
import type { Rect } from "./layout.js";

export type BadgeSource = "badge" | "splash";

export interface BadgeFocus {
  /** The crop's center as a fraction of the picture (0 left, 1 right). */
  readonly x: number;
  /** The crop's center as a fraction of the picture (0 top, 1 bottom). */
  readonly y: number;
  /** 1 is the whole short side as the square's side; 2 is half of it (a closer look). Never below 1. */
  readonly zoom: number;
  /** Which of the pair's pictures the crop is cut from; the closeup when absent. */
  readonly source?: BadgeSource;
}

export const DEFAULT_BADGE_FOCUS: BadgeFocus = { x: 0.5, y: 0.5, zoom: 1 };

/**
 * The square to cut from a picture of this size: centered on the focus, then slid back inside the picture, so the
 * rect never leaves the source image (a focus near an edge gives the nearest square that fits).
 */
export function badgeCropRect(source: { width: number; height: number }, focus: BadgeFocus): Rect {
  const side = Math.min(source.width, source.height) / Math.max(1, focus.zoom);
  return {
    x: Math.max(0, Math.min(source.width - side, source.width * focus.x - side / 2)),
    y: Math.max(0, Math.min(source.height - side, source.height * focus.y - side / 2)),
    width: side,
    height: side,
  };
}
