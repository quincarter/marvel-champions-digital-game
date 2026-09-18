/**
 * Where the dedicated defend sheet's sections sit (W6, docs/phase4-screen-gaps.md).
 *
 * Composition, read off the rendered canvases (docs/design-reference.md) rather than guessed:
 *  - **Desktop (D10)**: an ink title bar ("Villain Phase · Step N — X activates against you", authority on the
 *    right), a cream incoming-attack card, a row of cream option cards side by side under "Your options", and a
 *    right-hand ink rail — "The Stack" above, "Waiting on" below it, Confirm at the rail's own width, not the
 *    sheet's.
 *  - **Phone (P15)**: the same sections stacked full-width top to bottom, options as rows rather than a side-by-side
 *    row (there is no width to spare), Confirm full-width at the thumb.
 *  - **Tablet landscape**: desktop's two-column split; the board's own team rail stays legible behind the sheet at
 *    that width (L02's own rule for an interrupt over the table), so this sheet does not claim the *entire* viewport
 *    the way the phone sheet does — see `sheet` below.
 *
 * Pure geometry, no text measurement — same rule every other layout module in this package states for itself
 * (`title-layout.ts`, `overlay-layout.ts`): a caller can test it without a live Phaser scene.
 */

import { hit } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export interface DefendChoiceLayout {
  readonly formFactor: FormFactor;
  /** The panel itself. Leaves a margin on every side so the dimmed board stays visible around it (tablet L02's rule). */
  readonly sheet: Rect;
  readonly header: Rect;
  readonly summary: Rect;
  /** Where the option cards/rows go — `defendOptionSlots` splits this further, once the count is known. */
  readonly options: Rect;
  readonly stack: Rect;
  readonly waitingOn: Rect;
  readonly commit: Rect;
}

const HEADER_HEIGHT = 56;
const WAITING_HEIGHT = 36;
const SECTION_GAP = 10;
const SHEET_MARGIN_WIDE = 40;
const SHEET_MARGIN_NARROW = 8;

function isWide(formFactor: FormFactor): boolean {
  return formFactor === "desktop" || formFactor === "tabletLandscape";
}

export function defendChoiceLayout(viewport: Rect): DefendChoiceLayout {
  const formFactor = formFactorFor(viewport.width, viewport.height);
  const wide = isWide(formFactor);
  const margin = wide ? SHEET_MARGIN_WIDE : SHEET_MARGIN_NARROW;

  const sheet: Rect = {
    x: viewport.x + margin,
    y: viewport.y + margin,
    width: Math.max(280, viewport.width - margin * 2),
    height: Math.max(280, viewport.height - margin * 2),
  };

  const header: Rect = { x: sheet.x, y: sheet.y, width: sheet.width, height: HEADER_HEIGHT };
  const bodyTop = header.y + header.height + SECTION_GAP;

  if (wide) {
    const railWidth = Math.round(sheet.width * 0.28);
    const mainWidth = sheet.width - railWidth - SECTION_GAP;
    const railX = sheet.x + mainWidth + SECTION_GAP;

    const commit: Rect = {
      x: railX,
      y: sheet.y + sheet.height - hit.primary - SECTION_GAP,
      width: railWidth,
      height: hit.primary,
    };
    const waitingOn: Rect = {
      x: railX,
      y: commit.y - WAITING_HEIGHT - SECTION_GAP,
      width: railWidth,
      height: WAITING_HEIGHT,
    };
    const stack: Rect = {
      x: railX,
      y: bodyTop,
      width: railWidth,
      height: Math.max(0, waitingOn.y - SECTION_GAP - bodyTop),
    };

    const summaryHeight = Math.min(170, Math.round((sheet.y + sheet.height - bodyTop) * 0.4));
    const summary: Rect = { x: sheet.x, y: bodyTop, width: mainWidth, height: summaryHeight };
    const options: Rect = {
      x: sheet.x,
      y: summary.y + summary.height + SECTION_GAP,
      width: mainWidth,
      height: Math.max(0, sheet.y + sheet.height - SECTION_GAP - (summary.y + summary.height + SECTION_GAP)),
    };

    return { formFactor, sheet, header, summary, options, stack, waitingOn, commit };
  }

  // Narrow: one column, stacked top to bottom, Confirm full-width at the thumb.
  const commit: Rect = {
    x: sheet.x,
    y: sheet.y + sheet.height - hit.primary - SECTION_GAP,
    width: sheet.width,
    height: hit.primary,
  };
  const waitingOn: Rect = { x: sheet.x, y: commit.y - WAITING_HEIGHT - SECTION_GAP, width: sheet.width, height: WAITING_HEIGHT };
  const bodyBottomForStack = waitingOn.y - SECTION_GAP;
  const stackHeight = Math.min(150, Math.max(84, Math.round((bodyBottomForStack - bodyTop) * 0.24)));
  const stack: Rect = { x: sheet.x, y: bodyBottomForStack - stackHeight, width: sheet.width, height: stackHeight };

  const summaryHeight = Math.min(150, Math.round((stack.y - SECTION_GAP - bodyTop) * 0.38));
  const summary: Rect = { x: sheet.x, y: bodyTop, width: sheet.width, height: summaryHeight };
  const options: Rect = {
    x: sheet.x,
    y: summary.y + summary.height + SECTION_GAP,
    width: sheet.width,
    height: Math.max(0, stack.y - SECTION_GAP - (summary.y + summary.height + SECTION_GAP)),
  };

  return { formFactor, sheet, header, summary, options, stack, waitingOn, commit };
}

const OPTION_GAP = 8;
/** Below this an option card stops holding a title, an exhaust line and a damage line without crowding. */
const OPTION_MIN_MAIN_AXIS = 132;

/**
 * One rect per option: a row on phone/tablet-portrait (there's no width to spare for a second column), a side-by-side
 * card on tablet-landscape/desktop (D10's own "Your options" row) — until there isn't room for one at a readable
 * width, at which point it wraps into more rows rather than squeezing every option into an unreadable sliver, the
 * same floor `cardRow`/`wrapChipsToRows` hold for their own content.
 */
export function defendOptionSlots(area: Rect, count: number, formFactor: FormFactor): readonly Rect[] {
  if (count <= 0) return [];
  if (!isWide(formFactor)) {
    // Divides evenly rather than holding a minimum row height: unlike a fanned hand of cards, a text row has
    // nothing left to show once it's a sliver, so there is no "collapse to a spine" fallback here — a caller with
    // more options than read well at the current height shows the first few plus "+N more", the same overflow
    // `scenes/choice.ts`'s own generic option list already uses.
    const height = (area.height - OPTION_GAP * (count - 1)) / count;
    return Array.from({ length: count }, (_unused, index) => ({
      x: area.x,
      y: area.y + index * (height + OPTION_GAP),
      width: area.width,
      height,
    }));
  }

  const perRow = Math.max(1, Math.min(count, Math.floor((area.width + OPTION_GAP) / (OPTION_MIN_MAIN_AXIS + OPTION_GAP))));
  const rows = Math.ceil(count / perRow);
  const rowHeight = (area.height - OPTION_GAP * (rows - 1)) / rows;

  const slots: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    const start = row * perRow;
    const inRow = Math.min(perRow, count - start);
    const width = (area.width - OPTION_GAP * (inRow - 1)) / inRow;
    for (let col = 0; col < inRow; col++) {
      slots.push({
        x: area.x + col * (width + OPTION_GAP),
        y: area.y + row * (rowHeight + OPTION_GAP),
        width,
        height: rowHeight,
      });
    }
  }
  return slots;
}
