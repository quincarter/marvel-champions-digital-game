/**
 * The small pieces every section is made of: a kicker (a short label in capitals over a row), a wrapped note under it, and a
 * framed row with an optional colour stripe. None decides anything; they take a builder, a place and words.
 */
import type { SheetBuilder } from "../../../../../dom/sheet-builder.js";
import { ink, surface, typeRole } from "../../../../../tokens.js";
import type { Rect } from "../../../../../view/layout.js";

/** A short label in capitals at (`x`, `y`) in `color`; returns its height. */
export function drawKicker(b: SheetBuilder, x: number, y: number, text: string, color: number, size?: number): number {
  return b.text(x, y, text.toLocaleUpperCase(), typeRole.label, {
    color,
    ...(size !== undefined ? { size } : {}),
  }).height;
}

/** A wrapped note in the secondary ink at (`x`, `y`); returns its bottom with a 4px gap, as the paragraphs stack. */
export function drawNote(
  b: SheetBuilder,
  x: number,
  y: number,
  width: number,
  text: string,
  options: { readonly size?: number; readonly full?: boolean } = {},
): number {
  const note = b.text(x, y, text, typeRole.body, {
    size: options.size ?? 12,
    color: surface.ink.hex,
    alpha: options.full ? 1 : ink.secondary,
    wrapWidth: width,
  });
  return y + note.height + 4;
}

/** A paper row with an ink frame, and a stripe down its left edge when `stripe` is given. */
export function drawFramedRow(
  b: SheetBuilder,
  rect: Rect,
  options: { readonly stripe?: number; readonly fill?: number } = {},
): void {
  b.box(rect, { fill: options.fill ?? surface.card.hex });
  b.box(rect, { stroke: surface.ink.hex, strokeWidth: 2 });
  if (options.stripe !== undefined)
    b.box({ x: rect.x, y: rect.y, width: 6, height: rect.height }, { fill: options.stripe });
}
