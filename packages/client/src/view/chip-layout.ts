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
import type { Rect } from "./layout.js";

/**
 * A chip's own info toggle (the aspect chips' G10b tip, `ui/aspect-tip.ts`): drawn as a split chip's second segment,
 * like a split "Send ▾" button, so the tip has a full touch target of its own instead of a small badge on the chip's
 * corner (reported 2026-09-30: the corner badge was clipped by the chip rail and too small to tap on a phone).
 */
export interface ChipInfoToggle {
  readonly isOpen: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}

export interface ChipLabel {
  readonly id: string;
  readonly text: string;
  /** Present when the chip is split, with an info segment on its right (`INFO_SEGMENT_WIDTH` wider). */
  readonly info?: ChipInfoToggle;
}

/** A split chip's info segment width: a full touch target, so the "i" is as easy to hit as the chip itself. */
export const INFO_SEGMENT_WIDTH = hit.target;

/** Splits a chip's rect into its main (filter) segment and its info segment, which takes the right-hand end. */
export function splitInfoSegment(rect: Rect): { readonly main: Rect; readonly info: Rect } {
  const infoWidth = Math.min(INFO_SEGMENT_WIDTH, rect.width / 2);
  return {
    main: { x: rect.x, y: rect.y, width: rect.width - infoWidth, height: rect.height },
    info: { x: rect.x + rect.width - infoWidth, y: rect.y, width: infoWidth, height: rect.height },
  };
}

/** Matches `#drawChoiceRow`'s own cell gap. */
export const CHIP_GAP = 6;

/**
 * Conservative pixels-per-character at the smallest size `fitText` ever
 * lands a chip on (`CAPTION_FLOOR` = 8px, Public Sans ExtraBold, all-caps per
 * `typeRole.label`). Calibrated generously rather than measured, since this
 * module has no canvas to measure against — but **not so generously that it
 * undercounts**: the original 4.6px/char (2026-09 fidelity passes on the
 * Decks & Collection and Title screens both hit real truncation this module
 * was supposed to prevent) counted only the glyph's own advance width and
 * forgot `typeRole.label.letterSpacing` (1.2px), which `McButton` applies to
 * *every* character including the last, and which `fitText`'s own 1px of
 * shrink headroom (9px down to `CAPTION_FLOOR`'s 8px) can't make up for. 7.0
 * folds a same-order glyph estimate and the letter-spacing back in, so a chip
 * sized to exactly `minChipCellWidth` — not just one crammed into an
 * equal-width row with slack to spare — no longer truncates.
 */
export const CHIP_MIN_CHAR_WIDTH_PX = 7.0;

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

/** A compact chip's own width: sized to its label, not stretched to share a row's full width with its neighbors (W2b's roster filter chips, docs/phase4-screen-gaps.md §3 — the design's small pill chips, not a row of 44px-tall full-width buttons). */
export function compactChipWidth(label: string): number {
  return minChipCellWidth(label) + COMPACT_CHIP_PADDING_PX;
}

/** A compact chip's full width, info segment included when it has one. */
export function compactChipWidthOf(chip: ChipLabel): number {
  return compactChipWidth(chip.text) + (chip.info ? INFO_SEGMENT_WIDTH : 0);
}

/**
 * Packs `chips` into as few rows as possible at each chip's own compact width (`compactChipWidth`), left to right,
 * wrapping to a new row only when the next chip wouldn't fit — unlike `wrapChipsToRows`, which divides a row
 * *evenly* among however many chips it decided to put there (right for a difficulty/modular-set choice row of
 * equal-weight options, wrong for a filter strip where "Core" and "Playable now" are not the same width).
 */
export function packCompactChipsToRows<T extends ChipLabel>(
  chips: readonly T[],
  rowWidth: number,
): readonly (readonly T[])[] {
  const rows: T[][] = [];
  let current: T[] = [];
  let currentWidth = 0;
  for (const chip of chips) {
    const w = compactChipWidthOf(chip);
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
