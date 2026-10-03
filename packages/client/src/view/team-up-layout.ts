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
  readonly key: string;
  /** Center of the circle. */
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
}

/** Most badges the bar shows; a table with more Team-Ups active than this is rare enough to drop the rest. */
export const MAX_BADGES = 3;

/**
 * Circles in a row, right-aligned to `rightEdge` inside the chrome bar, inset a few pixels so the ring sits clear of
 * the bar's edges. Returns the slots and the x the next thing to the left may use.
 */
export function badgeSlots(
  bar: Rect,
  rightEdge: number,
  keys: readonly string[],
): { readonly slots: readonly BadgeSlot[]; readonly leftEdge: number } {
  const diameter = Math.max(20, bar.height - 4);
  const radius = diameter / 2;
  const gap = 6;
  const shown = keys.slice(0, MAX_BADGES);
  const slots = shown.map((key, index) => ({
    key,
    cx: rightEdge - radius - index * (diameter + gap),
    cy: bar.y + bar.height / 2,
    radius,
  }));
  const leftEdge = shown.length === 0 ? rightEdge : rightEdge - shown.length * (diameter + gap) + gap;
  return { slots, leftEdge };
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
