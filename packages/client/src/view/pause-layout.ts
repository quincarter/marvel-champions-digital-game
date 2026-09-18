/**
 * Pause's own layout (docs/phase4-screen-gaps.md §3 "W4"; fidelity pass
 * 2026-09-17 against design canvases D13, P16 and L07).
 *
 * **Composition, read off the tiles.** An overlay *sheet* — not the two-panel
 * full-page split D13's own desktop tile happens to have room for — centered
 * over a 70%-ink scrim (`scenes/pause.ts` paints the scrim; this module only
 * places the sheet). The sheet is one ink ground throughout (the tablet/phone
 * tiles draw both its columns in ink, not parchment — the one place this pass
 * departs from the parent brief's paraphrase, in favor of what the renders
 * actually show; the *search field* is the one parchment/paper element, same
 * as every other text input in this app). Top to bottom: an ink title bar
 * ("Paused" + "‹scenario› · ‹difficulty› · Round ‹n› · ‹phase› · ‹seat›", a
 * boxed ✕ at its top-right corner that does the same thing Resume does), then
 * a two-column body — **"Rules reference"** (a search field, then a "Quick
 * reference" list of chevron rows: Villain phase order, Keyword glossary,
 * Scenario card list, Jump into the log) beside **"Table"** (the same toggle
 * rows `scenes/settings.ts` draws, from `view/settings-rows.ts`) — and a
 * footer of three buttons: Save & quit (secondary outline), Concede (quiet
 * outline), Resume (the one red primary action), left to right, matching
 * L07/P16's own order.
 *
 * **Responsive rule.** Side by side once the body is wide enough for both
 * columns at a readable width (`TWO_COLUMN_MIN_BODY_WIDTH`); below that
 * (phone) the Table group stacks below Rules reference instead — there is no
 * bespoke phone-only shape, just the same two groups in the order the wider
 * layout already puts them, stacked. Checked at 390×844, 768×1024, 1024×768
 * and 1440×900 in `pause-layout.test.ts`: two columns from tablet portrait up,
 * one column at phone width.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { overlayPanelLayout, stackedRow } from "./overlay-layout.js";

/** Wider than the shared `OVERLAY_MAX_WIDTH` (640): a two-column body needs the room, and D13/L07 both draw this sheet noticeably wider than Rules/Settings' own single-column overlays. */
export const PAUSE_PANEL_MAX_WIDTH = 760;
const HEADER_HEIGHT = 74;
const FOOTER_HEIGHT = hit.primary + 24;
const CLOSE_SIZE = 32;
const COLUMN_GAP = 24;
const GROUP_GAP = 20;
const ROW_GAP = 8;
const HEADING_HEIGHT = 18;
const SUBHEADING_HEIGHT = 16;
/** Below this body width (phone), the two column groups stack instead of sitting side by side. */
const TWO_COLUMN_MIN_BODY_WIDTH = 560;

export interface PauseColumnLayout {
  readonly heading: Rect;
  /** Zero-height outside the rules-reference column. */
  readonly search: Rect;
  /** Zero-height outside the rules-reference column ("Quick reference"). */
  readonly subheading: Rect;
  readonly rows: readonly Rect[];
}

export interface PauseLayout {
  readonly panel: Rect;
  readonly header: Rect;
  readonly closeButton: Rect;
  /** True when Rules reference and Table sit side by side; false when Table stacks below Rules reference. */
  readonly twoColumn: boolean;
  readonly rules: PauseColumnLayout;
  readonly table: PauseColumnLayout;
  readonly footer: Rect;
  readonly saveQuit: Rect;
  readonly concede: Rect;
  readonly resume: Rect;
}

function rulesColumn(rect: Rect, rowCount: number): PauseColumnLayout {
  const heading: Rect = { x: rect.x, y: rect.y, width: rect.width, height: HEADING_HEIGHT };
  const search: Rect = { x: rect.x, y: heading.y + heading.height + 8, width: rect.width, height: hit.target };
  const subheading: Rect = { x: rect.x, y: search.y + search.height + 12, width: rect.width, height: SUBHEADING_HEIGHT };
  const rowsTop = subheading.y + subheading.height + 6;
  const rows = Array.from({ length: rowCount }, (_unused, index) => stackedRow({ x: rect.x, y: rowsTop, width: rect.width, height: 0 }, index, hit.target, ROW_GAP));
  return { heading, search, subheading, rows };
}

function tableColumn(rect: Rect, rowCount: number): PauseColumnLayout {
  const heading: Rect = { x: rect.x, y: rect.y, width: rect.width, height: HEADING_HEIGHT };
  const rowsTop = heading.y + heading.height + 10;
  const rows = Array.from({ length: rowCount }, (_unused, index) => stackedRow({ x: rect.x, y: rowsTop, width: rect.width, height: 0 }, index, hit.target, ROW_GAP));
  const zero: Rect = { x: rect.x, y: rect.y, width: 0, height: 0 };
  return { heading, search: zero, subheading: zero, rows };
}

function columnBottom(column: PauseColumnLayout): number {
  const last = column.rows[column.rows.length - 1];
  if (last) return last.y + last.height;
  return column.subheading.height > 0 ? column.subheading.y + column.subheading.height : column.heading.y + column.heading.height;
}

export function pauseLayout(bounds: Rect, quickReferenceRowCount: number, tableRowCount: number): PauseLayout {
  const { panel, header, body, footer } = overlayPanelLayout(bounds, HEADER_HEIGHT, FOOTER_HEIGHT, PAUSE_PANEL_MAX_WIDTH);
  const closeButton: Rect = { x: header.x + header.width - CLOSE_SIZE - 16, y: header.y + (header.height - CLOSE_SIZE) / 2, width: CLOSE_SIZE, height: CLOSE_SIZE };

  const inset: Rect = { x: body.x + 16, y: body.y + 8, width: Math.max(0, body.width - 32), height: Math.max(0, body.height - 16) };
  const twoColumn = inset.width >= TWO_COLUMN_MIN_BODY_WIDTH;
  const columnWidth = twoColumn ? (inset.width - COLUMN_GAP) / 2 : inset.width;

  const rules = rulesColumn({ x: inset.x, y: inset.y, width: columnWidth, height: inset.height }, quickReferenceRowCount);
  const tableOrigin: Rect = twoColumn
    ? { x: inset.x + columnWidth + COLUMN_GAP, y: inset.y, width: columnWidth, height: inset.height }
    : { x: inset.x, y: columnBottom(rules) + GROUP_GAP, width: columnWidth, height: inset.height };
  const table = tableColumn(tableOrigin, tableRowCount);

  const buttonGap = 8;
  const buttonWidth = (footer.width - 32 - buttonGap * 2) / 3;
  const saveQuit: Rect = { x: footer.x + 16, y: footer.y + 12, width: buttonWidth, height: hit.primary };
  const concede: Rect = { x: saveQuit.x + buttonWidth + buttonGap, y: saveQuit.y, width: buttonWidth, height: hit.primary };
  const resume: Rect = { x: concede.x + buttonWidth + buttonGap, y: saveQuit.y, width: buttonWidth, height: hit.primary };

  return { panel, header, closeButton, twoColumn, rules, table, footer, saveQuit, concede, resume };
}

/** Every rect this layout places, for a no-overlap test — excluding `header`/`heading`/`subheading` labels, which are non-interactive text bands rather than controls (the same convention `settings-layout.test.ts` and `rules-layout.test.ts` use). */
export function pauseLayoutRects(layout: PauseLayout): readonly Rect[] {
  return [
    layout.closeButton,
    layout.rules.search,
    ...layout.rules.rows,
    ...layout.table.rows,
    layout.saveQuit,
    layout.concede,
    layout.resume,
  ];
}
