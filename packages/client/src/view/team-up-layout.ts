/**
 * Where the Team-Up picture goes: the splash's title and full-height picture, and the circular badge in the Board's
 * top bar. Plain geometry so the "never cropped, never off screen" promises are tested without a canvas.
 */
import type { Rect } from "./layout.js";

const SPLASH_MARGIN = 12;
const SPLASH_GAP = 10;
/** Banner height above the picture: tall enough for the title's type at desktop and phone widths. */
const SPLASH_TITLE_HEIGHT = 40;

export interface SplashLayout {
  readonly title: Rect;
  readonly picture: Rect;
}

/**
 * The whole picture, contained (never cropped) in the viewport's height, with the title banner above it, the pair
 * centered as one block. A wide window is height-limited (the picture is portrait), a narrow phone width-limited.
 */
export function splashLayout(
  viewport: { readonly width: number; readonly height: number },
  image: { readonly width: number; readonly height: number },
): SplashLayout {
  const maxWidth = Math.max(1, viewport.width - SPLASH_MARGIN * 2);
  const maxHeight = Math.max(1, viewport.height - SPLASH_MARGIN * 2 - SPLASH_TITLE_HEIGHT - SPLASH_GAP);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const blockHeight = SPLASH_TITLE_HEIGHT + SPLASH_GAP + height;
  const top = Math.round((viewport.height - blockHeight) / 2);
  const x = Math.round((viewport.width - width) / 2);
  // The banner is as wide as the picture, or up to 360 when the title wants more room than a narrow picture gives.
  const titleWidth = Math.max(width, Math.min(maxWidth, 360));
  return {
    title: { x: Math.round((viewport.width - titleWidth) / 2), y: top, width: titleWidth, height: SPLASH_TITLE_HEIGHT },
    picture: { x, y: top + SPLASH_TITLE_HEIGHT + SPLASH_GAP, width, height },
  };
}

export interface BadgeSlot {
  /** Identifies this ring (a pair on a panel) for hover state. */
  readonly key: string;
  /** Center of the circle. */
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
}

/** Ring diameters: on the phone's tabbed board and on the wider table. */
export const RING_DIAMETER = { phone: 48, desktop: 64 } as const;
const RING_GAP = 6;
/** Most rings one panel carries; a seat with more Team-Ups active than this is rare enough to drop the rest. */
export const MAX_RINGS_PER_PANEL = 2;

export const ringDiameterFor = (tabbed: boolean): number => (tabbed ? RING_DIAMETER.phone : RING_DIAMETER.desktop);

/** The smallest ring worth drawing; a gap shorter than this is not a gap. */
const MIN_RING = 32;

/**
 * Rings in the free space of an identity panel's text column: below the name, tags and ability line and above the
 * stats and HP plate (which are pinned to the foot), right-aligned to the column with the first against its edge and
 * any others to its left while the width allows. They shrink to the gap's height (never under `MIN_RING`), and are
 * centered in it. That space is empty at every panel shape, and a ring there covers no stat, HP or form label.
 */
export function columnRings(free: Rect, keys: readonly string[], diameter: number): readonly BadgeSlot[] {
  const d = Math.max(MIN_RING, Math.min(diameter, free.height));
  const radius = d / 2;
  const fit = Math.max(1, Math.floor((free.width + RING_GAP) / (d + RING_GAP)));
  return keys.slice(0, Math.min(MAX_RINGS_PER_PANEL, fit)).map((key, index) => ({
    key,
    cx: free.x + free.width - radius - index * (d + RING_GAP),
    cy: free.y + free.height / 2,
    radius,
  }));
}

/**
 * A row under "Other heroes" with rings beside it: the row gives up the width to its right, one ring slot per key,
 * each centered vertically on the row and never larger than the row is tall.
 */
export function rowRings(
  row: Rect,
  keys: readonly string[],
  diameter: number,
): { readonly row: Rect; readonly slots: readonly BadgeSlot[] } {
  const d = Math.max(20, Math.min(diameter, row.height - 4));
  const radius = d / 2;
  const shown = keys.slice(0, MAX_RINGS_PER_PANEL);
  if (shown.length === 0) return { row, slots: [] };
  const used = shown.length * (d + RING_GAP);
  const slots = shown.map((key, index) => ({
    key,
    cx: row.x + row.width - radius - index * (d + RING_GAP),
    cy: row.y + row.height / 2,
    radius,
  }));
  return { row: { ...row, width: row.width - used }, slots };
}

/** The label under a badge: right-aligned to the circle, then pulled back inside the viewport. */
export function badgeLabelRect(
  slot: BadgeSlot,
  size: { readonly width: number; readonly height: number },
  viewport: { readonly width: number },
): Rect {
  const x = Math.max(4, Math.min(viewport.width - size.width - 4, slot.cx + slot.radius - size.width));
  return { x, y: slot.cy + slot.radius + 6, width: size.width, height: size.height };
}
