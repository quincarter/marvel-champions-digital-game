/**
 * Wrapping a row of quick-filter chips (S8) so every label reads in full at
 * phone width, instead of the equal-width single row `#drawChoiceRow` and
 * `title-layout.ts` used before: 8 hero chips ("Aggression", "Justice",
 * "Leadership", "Protection", "Precon", "Imported", "Built", "Playable now")
 * in one row at a ~340px phone column gave each chip about 40px, and
 * `McButton`'s own `fitText` (`ui/widgets.ts`) can only shrink a label from
 * 9px down to `CAPTION_FLOOR` (8px) before it falls back to truncating with
 * "…" — nowhere near enough range to fit "Leadership" or "Playable now" in
 * 40px, so every chip truncated.
 *
 * This module decides *how many rows* a chip strip needs, not how a chip
 * looks — drawing stays `scenes/title.ts`'s `#drawChoiceRow`, one call per
 * row this module returns. It's plain TypeScript (no live Phaser scene, no
 * canvas), so "would this label fit" is answered with a deliberately
 * conservative width estimate rather than a real text measurement — the same
 * trade `title-layout.ts`'s own doc comment makes for row heights, for the
 * same reason (a pure function a test can check without a canvas).
 */
import { hit } from "../tokens.js";

export interface ChipLabel {
  readonly id: string;
  readonly text: string;
}

/** Matches `#drawChoiceRow`'s own cell gap. */
export const CHIP_GAP = 6;

/**
 * Conservative pixels-per-character at the smallest size `fitText` ever
 * lands a chip on (`CAPTION_FLOOR` = 8px, Public Sans, all-caps per
 * `typeRole.label`). Real glyphs average narrower than this — deliberately:
 * overestimating a label's width can only push it to an earlier row (or its
 * own), never let a label through that actually truncates. Calibrated
 * generously rather than measured, since this module has no canvas to
 * measure against.
 */
export const CHIP_MIN_CHAR_WIDTH_PX = 4.6;

/** Matches `McButton.redraw`'s own `fitText` margin for a plain (no `value`) label: `rect.width - 16`. */
export const CHIP_LABEL_PADDING_PX = 16;

/** The narrowest a cell can be and still fit `label` without `fitText` falling back to truncation, by this module's conservative estimate. */
export function minChipCellWidth(label: string): number {
  return label.length * CHIP_MIN_CHAR_WIDTH_PX + CHIP_LABEL_PADDING_PX;
}

/** True when every chip in `row`, drawn as equal-width cells across `rowWidth`, fits without truncating. */
export function chipRowFits(row: readonly ChipLabel[], rowWidth: number): boolean {
  if (row.length === 0) return true;
  const cellWidth = (rowWidth - (row.length - 1) * CHIP_GAP) / row.length;
  return row.every((chip) => cellWidth >= minChipCellWidth(chip.text));
}

/**
 * Greedily packs `chips` into as few equal-width rows as possible (in their
 * given order, so aspect chips stay grouped ahead of source chips ahead of
 * "Playable now" — the order a caller already builds them in), never letting
 * a row hold a chip whose label wouldn't fit at that row's cell width.
 */
export function wrapChipsToRows<T extends ChipLabel>(chips: readonly T[], rowWidth: number): readonly (readonly T[])[] {
  const rows: T[][] = [];
  let current: T[] = [];
  for (const chip of chips) {
    const trial = [...current, chip];
    if (current.length > 0 && !chipRowFits(trial, rowWidth)) {
      rows.push(current);
      current = [chip];
    } else {
      current = trial;
    }
  }
  if (current.length > 0) rows.push(current);
  // A single chip that can never fit (an absurdly long label in a very narrow column) still gets its own row
  // rather than being dropped — `chipRowFits` on a one-chip row is the same "not truncated" question at that
  // row's full width, so this only matters when `rowWidth` itself is too narrow for any label at all.
  return rows;
}

/** The height of a chip strip with `rowCount` rows, stacked with `CHIP_GAP` between — what `title-layout.ts` reserves for it. */
export function chipStripHeight(rowCount: number): number {
  return rowCount <= 0 ? 0 : rowCount * hit.target + (rowCount - 1) * CHIP_GAP;
}

/** Horizontal padding either side of a compact chip's own label — generous enough that `fitText` never has to shrink it. */
export const COMPACT_CHIP_PADDING_PX = 20;

/** A compact chip's own width: sized to its label, not stretched to share a row's full width with its neighbours (W2b's roster filter chips, docs/phase4-screen-gaps.md §3 — the design's small pill chips, not a row of 44px-tall full-width buttons). */
export function compactChipWidth(label: string): number {
  return minChipCellWidth(label) + COMPACT_CHIP_PADDING_PX;
}

/**
 * Packs `chips` into as few rows as possible at each chip's own compact width (`compactChipWidth`), left to right,
 * wrapping to a new row only when the next chip wouldn't fit — unlike `wrapChipsToRows`, which divides a row
 * *evenly* among however many chips it decided to put there (right for a difficulty/modular-set choice row of
 * equal-weight options, wrong for a filter strip where "Core" and "Playable now" are not the same width).
 */
export function packCompactChipsToRows<T extends ChipLabel>(chips: readonly T[], rowWidth: number): readonly (readonly T[])[] {
  const rows: T[][] = [];
  let current: T[] = [];
  let currentWidth = 0;
  for (const chip of chips) {
    const w = compactChipWidth(chip.text);
    const needed = currentWidth + (current.length > 0 ? CHIP_GAP : 0) + w;
    if (current.length > 0 && needed > rowWidth) {
      rows.push(current);
      current = [chip];
      currentWidth = w;
    } else {
      current.push(chip);
      currentWidth = needed;
    }
  }
  if (current.length > 0) rows.push(current);
  return rows;
}
