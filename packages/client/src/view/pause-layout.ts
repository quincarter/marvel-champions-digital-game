/**
 * Pause's own layout (docs/phase4-screen-gaps.md §3 "W4").
 *
 * **OWNER DECISION (verbatim, 2026-09-18):** "the pause screen on tablet
 * should look like the pause screen on desktop [12-s13.png] - i like the
 * expanded view on the right side of the menu." This overrides the tablet
 * canvas (L07) for Pause: D13's two-panel composition — an ink menu on the
 * left, a paper "Rules reference" panel (a keyword/status grid, then "Jump
 * to a moment") on the right — is now the shape at *every* width down to
 * phone (`PAUSE_PHONE_MAX_WIDTH`), not only desktop's own width. Below that
 * width there is no room for two panels side by side, and the phone canvas
 * (P16) draws a genuinely different, single-column screen rather than a
 * squeezed copy of D13, so phone keeps its own shape.
 *
 * This file's previous pass (2026-09-17) argued the opposite — that L07's
 * ink sheet with "Rules reference"/"Table" chevron columns was the one true
 * shape at every size, D13's own desktop tile being "room the parent brief's
 * paraphrase happened to have" rather than a real second composition, and
 * built a single responsive shape from that reading. The owner's read of the
 * actual renders says otherwise, so that reasoning — and the layout it
 * justified — is retired in favor of what's below.
 *
 * **Wide (desktop and tablet, both orientations, `bounds.width` at or above
 * `PAUSE_PHONE_MAX_WIDTH`).** D13's own proportions
 * (`SHEET_WIDTH`×`SHEET_HEIGHT` at full size), scaled down with `SHEET_MARGIN`
 * of breathing room once the viewport is smaller than that — one sheet
 * holding two panels with `PANEL_GAP` between them:
 *  - **Left** (`LEFT_WIDTH` at full size, floored at `LEFT_MIN_WIDTH` per the
 *    owner's own "left menu ≥ 260px" sizing note): ink ground. Bangers
 *    "Paused", the status line, then four full-width menu buttons — Resume
 *    (the sheet's one red fill), Full game log, Rules reference, Settings
 *    (ink with a paper outline) — and Concede pinned at the panel's own foot
 *    as a dim outline, well clear of the menu above it.
 *  - **Right**: paper ground. A "Rules reference" header, a grid of bordered
 *    keyword/status cards (`pause-keyword-grid.ts` — 3 columns, dropping to 2
 *    under the grid's own ~560px width threshold, capped at 3 rows), then
 *    "Jump to a moment" over a box of the most recent log lines
 *    (`pause-log-window.ts`).
 *
 * **Phone (`bounds.width` under `PAUSE_PHONE_MAX_WIDTH`).** P16's own
 * single-column shape, unchanged in spirit from the previous pass: an ink
 * sheet with a boxed ✕, a status line, a search field, "Quick reference"
 * chevron rows, "Table" toggle rows, and a footer — now Resume full width
 * over Save & quit and Concede side by side, matching P16's own footer
 * arrangement rather than three equal-width buttons in one row.
 *
 * Checked at 1440×900, 1870×1050 (desktop), 1024×768, 768×1024, 820×1180
 * (tablet, both orientations) and 390×844 (phone) in `pause-layout.test.ts`.
 */
import { hit } from "../tokens.js";
import { toggleRowHeight, estimateWrappedLines, type Rect } from "./layout.js";
import { overlayPanelLayout } from "./overlay-layout.js";
import { pauseKeywordGrid, type PauseKeywordGrid } from "./pause-keyword-grid.js";

/** Below this width there is no room for D13's two panels side by side; Pause falls back to P16's own single-column phone design instead. */
export const PAUSE_PHONE_MAX_WIDTH = 700;

// ---------------------------------------------------------------------------
// Wide (desktop + tablet, both orientations)
// ---------------------------------------------------------------------------

const SHEET_WIDTH = 1055;
const SHEET_HEIGHT = 710;
const SHEET_MARGIN = 24;
const LEFT_WIDTH = 305;
/** The owner's own floor: "left menu ≥ 260px". */
const LEFT_MIN_WIDTH = 260;
const PANEL_GAP = 16;

const LEFT_PAD = 24;
const TITLE_HEIGHT = 40;
const STATUS_HEIGHT = 18;
const MENU_TOP_GAP = 20;
const MENU_GAP = 10;

const RIGHT_PAD = 24;
const RIGHT_HEADER_HEIGHT = 30;
const GRID_TOP_GAP = 12;
const GRID_BOTTOM_GAP = 16;
const JUMP_HEADER_HEIGHT = 24;
const LOG_BOX_TOP_GAP = 8;
const LOG_BOX_MIN_HEIGHT = 80;
const KEYWORD_EMPTY_HEIGHT = 22;

export interface PauseMenuLayout {
  readonly resume: Rect;
  readonly fullGameLog: Rect;
  readonly rulesReference: Rect;
  readonly settings: Rect;
}

export interface PauseWideLayout {
  readonly kind: "wide";
  readonly sheet: Rect;
  readonly left: Rect;
  readonly right: Rect;
  readonly title: Rect;
  readonly status: Rect;
  readonly menu: PauseMenuLayout;
  readonly concede: Rect;
  /** Where the confirm's "Yes, concede" / "Cancel" pair replace Concede's own slot — placed just above it, in the gap between the menu and the foot. */
  readonly concedeConfirmYes: Rect;
  readonly concedeConfirmCancel: Rect;
  readonly rulesHeader: Rect;
  readonly keywordGrid: PauseKeywordGrid;
  readonly keywordEmpty: Rect;
  readonly jumpHeader: Rect;
  readonly logBox: Rect;
  /**
   * The union of `rulesHeader` through `logBox` — what "Full game log" draws
   * into instead of the header/grid/jump-header/log-box group, when the left
   * menu's own toggle expands it (`scenes/pause.ts`'s own doc comment says
   * why there's no separate expanded layout shape: it's the same footprint,
   * just one box instead of four).
   */
  readonly rightContent: Rect;
}

function wideLayout(bounds: Rect, keywordCount: number): PauseWideLayout {
  const width = Math.min(SHEET_WIDTH, Math.max(1, bounds.width - SHEET_MARGIN * 2));
  const height = Math.min(SHEET_HEIGHT, Math.max(1, bounds.height - SHEET_MARGIN * 2));
  const sheet: Rect = { x: bounds.x + (bounds.width - width) / 2, y: bounds.y + (bounds.height - height) / 2, width, height };

  const leftWidth = Math.max(LEFT_MIN_WIDTH, Math.min(LEFT_WIDTH, (width * LEFT_WIDTH) / SHEET_WIDTH));
  const left: Rect = { x: sheet.x, y: sheet.y, width: leftWidth, height: sheet.height };
  const right: Rect = { x: left.x + left.width + PANEL_GAP, y: sheet.y, width: Math.max(0, sheet.width - leftWidth - PANEL_GAP), height: sheet.height };

  const title: Rect = { x: left.x + LEFT_PAD, y: left.y + LEFT_PAD, width: Math.max(0, left.width - LEFT_PAD * 2), height: TITLE_HEIGHT };
  const status: Rect = { x: title.x, y: title.y + title.height, width: title.width, height: STATUS_HEIGHT };

  const menuTop = status.y + status.height + MENU_TOP_GAP;
  const menuButtonHeight = hit.primary;
  const menuWidth = title.width;
  const menuRect = (index: number): Rect => ({ x: title.x, y: menuTop + index * (menuButtonHeight + MENU_GAP), width: menuWidth, height: menuButtonHeight });
  const menu: PauseMenuLayout = { resume: menuRect(0), fullGameLog: menuRect(1), rulesReference: menuRect(2), settings: menuRect(3) };

  const concede: Rect = { x: title.x, y: left.y + left.height - LEFT_PAD - menuButtonHeight, width: menuWidth, height: menuButtonHeight };
  const concedeConfirmYes: Rect = concede;
  const concedeConfirmCancel: Rect = { x: title.x, y: concede.y - MENU_GAP - menuButtonHeight, width: menuWidth, height: menuButtonHeight };

  const rightInner: Rect = { x: right.x + RIGHT_PAD, y: right.y + RIGHT_PAD, width: Math.max(0, right.width - RIGHT_PAD * 2), height: Math.max(0, right.height - RIGHT_PAD * 2) };
  const rulesHeader: Rect = { x: rightInner.x, y: rightInner.y, width: rightInner.width, height: RIGHT_HEADER_HEIGHT };
  const gridTop = rulesHeader.y + rulesHeader.height + GRID_TOP_GAP;
  const gridRect: Rect = { x: rightInner.x, y: gridTop, width: rightInner.width, height: Math.max(0, rightInner.y + rightInner.height - gridTop) };
  const keywordGrid = pauseKeywordGrid(gridRect, keywordCount);
  const keywordEmpty: Rect = { x: gridRect.x, y: gridRect.y, width: gridRect.width, height: KEYWORD_EMPTY_HEIGHT };
  const gridContentHeight = keywordGrid.shown > 0 ? keywordGrid.height : keywordEmpty.height;

  const jumpHeader: Rect = { x: rightInner.x, y: gridTop + gridContentHeight + GRID_BOTTOM_GAP, width: rightInner.width, height: JUMP_HEADER_HEIGHT };
  const logBoxTop = jumpHeader.y + jumpHeader.height + LOG_BOX_TOP_GAP;
  const logBox: Rect = { x: rightInner.x, y: logBoxTop, width: rightInner.width, height: Math.max(LOG_BOX_MIN_HEIGHT, rightInner.y + rightInner.height - logBoxTop) };

  const rightContent: Rect = { x: rulesHeader.x, y: rulesHeader.y, width: rulesHeader.width, height: logBox.y + logBox.height - rulesHeader.y };

  return { kind: "wide", sheet, left, right, title, status, menu, concede, concedeConfirmYes, concedeConfirmCancel, rulesHeader, keywordGrid, keywordEmpty, jumpHeader, logBox, rightContent };
}

// ---------------------------------------------------------------------------
// Phone (P16)
// ---------------------------------------------------------------------------

/** Wider than the shared `OVERLAY_MAX_WIDTH` (640): P16 draws this sheet close to full width, not a centered narrow column. */
const PHONE_PANEL_MAX_WIDTH = 680;
const PHONE_HEADER_HEIGHT = 68;
const PHONE_CLOSE_SIZE = 32;
const PHONE_RESUME_HEIGHT = hit.primary;
/** Save & quit / Concede are the footer's secondary pair, not its one forward action, so they use the ordinary touch-target minimum rather than the primary row's taller one — freeing height a two-row phone footer needs that the old single-row one didn't. */
const PHONE_SECOND_ROW_HEIGHT = hit.target;
const PHONE_FOOTER_ROW_GAP = 6;
const PHONE_FOOTER_PAD = 8;
const PHONE_FOOTER_HEIGHT = PHONE_RESUME_HEIGHT + PHONE_FOOTER_ROW_GAP + PHONE_SECOND_ROW_HEIGHT + PHONE_FOOTER_PAD * 2;
const PHONE_COLUMN_GAP = 24;
const PHONE_ROW_GAP = 6;
const PHONE_HEADING_HEIGHT = 18;
const PHONE_SUBHEADING_HEIGHT = 16;
const PHONE_GROUP_GAP = 16;

/**
 * Fidelity pass, 2026-09-17: both row lists used one *fixed* height
 * (`hit.target`, 44 — a touch-target minimum, not a text budget) for every
 * row regardless of its own detail text, so a long one ran past its row and
 * into whatever sat below it. Each row is now sized to its *own* detail text
 * (`estimateWrappedLines`), with a floor at the old fixed height so a short
 * row never shrinks below a comfortable touch target.
 */
const QUICK_REFERENCE_ROW_MIN_HEIGHT = 44;
const QUICK_REFERENCE_DETAIL_TOP = 24;
const QUICK_REFERENCE_DETAIL_LINE_HEIGHT = 11;
const QUICK_REFERENCE_DETAIL_CHAR_WIDTH = 5;
const QUICK_REFERENCE_BOTTOM_PADDING = 8;

function quickReferenceRowHeight(detail: string, columnWidth: number): number {
  const wrapWidth = Math.max(1, columnWidth - 24);
  const lines = estimateWrappedLines(detail, wrapWidth, QUICK_REFERENCE_DETAIL_CHAR_WIDTH);
  return Math.max(QUICK_REFERENCE_ROW_MIN_HEIGHT, QUICK_REFERENCE_DETAIL_TOP + lines * QUICK_REFERENCE_DETAIL_LINE_HEIGHT + QUICK_REFERENCE_BOTTOM_PADDING);
}

/** Stacks rects of each given height, top to bottom, `gap` apart. */
function stackedRowsOf(top: number, x: number, width: number, heights: readonly number[], gap: number): Rect[] {
  const rows: Rect[] = [];
  let y = top;
  for (const height of heights) {
    rows.push({ x, y, width, height });
    y += height + gap;
  }
  return rows;
}

export interface PausePhoneLayout {
  readonly kind: "phone";
  readonly panel: Rect;
  readonly header: Rect;
  readonly closeButton: Rect;
  readonly footer: Rect;
  readonly search: Rect;
  readonly quickReferenceHeading: Rect;
  readonly quickReferenceRows: readonly Rect[];
  readonly tableHeading: Rect;
  readonly tableRows: readonly Rect[];
  readonly resume: Rect;
  readonly saveQuit: Rect;
  readonly concede: Rect;
}

function phoneLayout(bounds: Rect, quickReferenceDetails: readonly string[], tableDetails: readonly string[]): PausePhoneLayout {
  const { panel, header, body, footer } = overlayPanelLayout(bounds, PHONE_HEADER_HEIGHT, PHONE_FOOTER_HEIGHT, PHONE_PANEL_MAX_WIDTH);
  const closeButton: Rect = { x: header.x + header.width - PHONE_CLOSE_SIZE - 16, y: header.y + (header.height - PHONE_CLOSE_SIZE) / 2, width: PHONE_CLOSE_SIZE, height: PHONE_CLOSE_SIZE };

  const inset: Rect = { x: body.x + 16, y: body.y + 6, width: Math.max(0, body.width - 32), height: Math.max(0, body.height - 12) };
  const search: Rect = { x: inset.x, y: inset.y, width: inset.width, height: hit.target };
  const quickReferenceHeading: Rect = { x: inset.x, y: search.y + search.height + 10, width: inset.width, height: PHONE_SUBHEADING_HEIGHT };
  const qrTop = quickReferenceHeading.y + quickReferenceHeading.height + 4;
  const qrHeights = quickReferenceDetails.map((detail) => quickReferenceRowHeight(detail, inset.width));
  const quickReferenceRows = stackedRowsOf(qrTop, inset.x, inset.width, qrHeights, PHONE_ROW_GAP);
  const qrBottom = quickReferenceRows.length > 0 ? quickReferenceRows[quickReferenceRows.length - 1]!.y + quickReferenceRows[quickReferenceRows.length - 1]!.height : qrTop;

  const tableHeading: Rect = { x: inset.x, y: qrBottom + PHONE_GROUP_GAP, width: inset.width, height: PHONE_HEADING_HEIGHT };
  const tableTop = tableHeading.y + tableHeading.height + 8;
  const tableHeights = tableDetails.map((detail) => toggleRowHeight(detail, inset.width));
  const tableRows = stackedRowsOf(tableTop, inset.x, inset.width, tableHeights, PHONE_ROW_GAP);

  const resume: Rect = { x: footer.x + 16, y: footer.y + PHONE_FOOTER_PAD, width: footer.width - 32, height: PHONE_RESUME_HEIGHT };
  const secondRowY = resume.y + resume.height + PHONE_FOOTER_ROW_GAP;
  const secondRowWidth = (footer.width - 32 - PHONE_COLUMN_GAP) / 2;
  const saveQuit: Rect = { x: footer.x + 16, y: secondRowY, width: secondRowWidth, height: PHONE_SECOND_ROW_HEIGHT };
  const concede: Rect = { x: saveQuit.x + secondRowWidth + PHONE_COLUMN_GAP, y: secondRowY, width: secondRowWidth, height: PHONE_SECOND_ROW_HEIGHT };

  return { kind: "phone", panel, header, closeButton, footer, search, quickReferenceHeading, quickReferenceRows, tableHeading, tableRows, resume, saveQuit, concede };
}

// ---------------------------------------------------------------------------
// Shared entry point
// ---------------------------------------------------------------------------

export type PauseLayout = PauseWideLayout | PausePhoneLayout;

export interface PauseLayoutInput {
  /** How many keyword/status entries `rulesGlossaryOf` reports right now — wide mode only; ignored (but harmless) on phone. */
  readonly keywordCount: number;
  /** Phone's own "Quick reference" row details, in row order. */
  readonly quickReferenceDetails: readonly string[];
  /** Phone's own "Table" row details, in row order. */
  readonly tableDetails: readonly string[];
}

export function pauseLayout(bounds: Rect, input: PauseLayoutInput): PauseLayout {
  if (bounds.width < PAUSE_PHONE_MAX_WIDTH) return phoneLayout(bounds, input.quickReferenceDetails, input.tableDetails);
  return wideLayout(bounds, input.keywordCount);
}

/** Every rect this layout places, for a no-overlap test — excluding heading/label text bands, which aren't controls (the same convention `settings-layout.test.ts` and `rules-layout.test.ts` use). */
export function pauseLayoutRects(layout: PauseLayout): readonly Rect[] {
  if (layout.kind === "wide") {
    return [layout.menu.resume, layout.menu.fullGameLog, layout.menu.rulesReference, layout.menu.settings, layout.concede, ...layout.keywordGrid.cells];
  }
  return [layout.closeButton, layout.search, ...layout.quickReferenceRows, ...layout.tableRows, layout.resume, layout.saveQuit, layout.concede];
}
