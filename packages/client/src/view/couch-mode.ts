/**
 * The pure half of couch mode (`ui/render-resolution.ts` draws it): how far a chosen factor can really go on a window,
 * and the size the game lays out at. The layout follows the game's size on purpose (a smaller window drawn bigger, so a
 * 1080p TV at 200% lays out as a 960 x 540 window), but never as a phone's: the cap keeps `formFactorFor` off "phone"
 * and "phoneLandscape" for the scaled size.
 */
import { PHONE_LANDSCAPE_MAX_HEIGHT } from "./layout.js";

/** The narrowest game width that is not a phone's (`formFactorFor`). */
export const COUCH_MIN_GAME_WIDTH = 768;

export interface CouchSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The factor couch mode really uses on a window of `base` size (the fixed resolution when one is set): the choice,
 * lowered so the game stays at least 768 wide and `PHONE_LANDSCAPE_MAX_HEIGHT` tall, and never under 1.
 */
export function couchFactorFor(factor: number, base: CouchSize): number {
  return Math.max(1, Math.min(factor, base.width / COUCH_MIN_GAME_WIDTH, base.height / PHONE_LANDSCAPE_MAX_HEIGHT));
}

/** True when `factor` is used whole on `base`, so the Couch mode row can offer it. */
export function couchFactorFits(factor: number, base: CouchSize): boolean {
  return couchFactorFor(factor, base) >= factor - 1e-9;
}

/**
 * The size the game lays out at under couch mode: `base` divided by the factor. The height follows the rounded width
 * and the base's aspect, so FIT fills the window with no sliver of bar.
 */
export function couchSizeOf(base: CouchSize, factor: number): CouchSize {
  if (factor <= 1) return base;
  const width = Math.max(1, Math.round(base.width / factor));
  return { width, height: Math.max(1, Math.round((width * base.height) / base.width)) };
}
