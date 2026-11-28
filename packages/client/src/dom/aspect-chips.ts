/**
 * Aspect chips (`mc-aspect-chip`) laid out by the screens that wear them: a chip's width, from its label, and a run of
 * chips drawn from the left or right-aligned to an edge. A chip's type is 10px on every screen, so the width is measured at
 * the size that comes out as 10px after the desktop bump (`SheetBuilder.typeSize`).
 */
import { typeRole } from "../tokens.js";
import { caseOf } from "../ui/theme.js";
import type { AspectStamp } from "../view/aspect-stamp.js";
import type { SheetBuilder } from "./sheet-builder.js";

export const CHIP_HEIGHT = 18;
export const CHIP_GAP = 6;

/** A chip's width: its label in the chip type, with the plate's padding. */
export const chipWidthOf = (b: SheetBuilder, label: string): number =>
  b.measure(caseOf(typeRole.label, label.toLocaleUpperCase()), typeRole.label, { size: 10 - (b.typeSize(10) - 10) })
    .width + 14;

/** The width a run of chips takes (their gaps included). */
export const chipRunWidth = (b: SheetBuilder, stamps: readonly AspectStamp[]): number =>
  stamps.reduce((sum, stamp, index) => sum + chipWidthOf(b, stamp.label) + (index > 0 ? CHIP_GAP : 0), 0);

/**
 * Draws `stamps` in one line with the top at `y`: from `x` going right, or with `right` ending at `x`. Returns the width it
 * took, so a title beside it can leave room.
 */
export function drawChipRun(
  b: SheetBuilder,
  x: number,
  y: number,
  stamps: readonly AspectStamp[],
  right = false,
): number {
  const total = chipRunWidth(b, stamps);
  let at = right ? x - total : x;
  for (const stamp of stamps) {
    b.chip(at, y, stamp.aspect, stamp.label, { height: CHIP_HEIGHT, size: 10 });
    at += chipWidthOf(b, stamp.label) + CHIP_GAP;
  }
  return total;
}
