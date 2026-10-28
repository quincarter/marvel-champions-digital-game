/**
 * Where a Phaser `Graphics` command buffer keeps the colors dark mode swaps (`ui/color-scheme-phaser.ts`), as plain
 * arithmetic so it is tested without a canvas. Phaser 4 pushes a style command as its code then its arguments:
 *
 *  - `FILL_STYLE, color, alpha`: the color one after the code;
 *  - `LINE_STYLE, width, color, alpha`: two after;
 *  - `GRADIENT_FILL_STYLE, alpha ×4, color ×4`: five to eight after.
 *
 * `color-slots.test.ts` reads those push orders out of Phaser's own source, so an upgrade that reorders them fails a
 * test rather than recoloring an alpha.
 */
import { isSchemeColor, schemeColor, type ColorChannel, type ColorScheme } from "./color-scheme.js";

export type ColorSlot = readonly [index: number, channel: ColorChannel];

export const FILL_STYLE_COLOR_AT = 1;
export const LINE_STYLE_COLOR_AT = 2;
export const GRADIENT_FILL_COLORS_AT = [5, 6, 7, 8] as const;

/** The slot for a color pushed at `start + offset`, or null when no scheme changes it. */
export function slotOf(start: number, offset: number, color: number, channel: ColorChannel): ColorSlot | null {
  return isSchemeColor(color, channel) ? [start + offset, channel] : null;
}

/** Rewrite each slot's color in `buffer` from `previous` to `next`, in place. */
export function recolorBuffer(
  buffer: number[],
  slots: readonly ColorSlot[],
  next: ColorScheme,
  previous: ColorScheme,
): void {
  for (const [index, channel] of slots) buffer[index] = schemeColor(buffer[index]!, channel, next, previous);
}
