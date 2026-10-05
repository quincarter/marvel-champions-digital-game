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

const HEADER_HEIGHT = 64;
const WAITING_HEIGHT = 36;
const SECTION_GAP = 10;
const SHEET_MARGIN_WIDE = 40;
const SHEET_MARGIN_NARROW = 8;
/**
 * The narrow (phone/tablet-portrait) options list's own floor: one row's title, cost/exhaust line, damage headline
 * and HP-after line (`#drawDefendOption`'s own fixed stack) need about this much before the next row's own panel
 * starts painting over the tail of it — found in browser verification (guided mode G7c follow-up): a plain even
 * split of whatever `options` had left often gave three-option rows nearer 70px, so "5-8 of 10 HP" ran straight
 * under the next card's own panel. `defendChoiceLayout` now reserves this per row *before* splitting the rest of
 * the sheet between the summary and the stack, rather than the other way around, so the options list is the one
 * section that never gets crushed to make room for the others.
 */
const OPTION_MIN_HEIGHT_NARROW = 92;
// Hard floors, not the usual comfortable minimums — these only bind in the rare "many defenders, short viewport"
// case where there truly isn't room for everything at once, and the options list is the section that must not
// give any more up past this (`OPTION_MIN_HEIGHT_NARROW`'s own comment): a plain "one line of stack, one line
// of summary" is still legible, a defend option missing its damage headline or HP-after line isn't.
const STACK_MIN_NARROW = 64;
const STACK_MAX_NARROW = 150;
const SUMMARY_MIN_NARROW = 90;
const SUMMARY_MAX_NARROW = 230;

function isWide(formFactor: FormFactor): boolean {
  return formFactor === "desktop" || formFactor === "tabletLandscape";
}

/** `optionCount` defaults to 2 (the usual "No defense" plus one defender) for any caller that doesn't know the
 * real count yet — `defendOptionSlots` is the one place that actually needs it right, so a stale default here
 * only ever makes a first, throwaway layout call slightly too generous, never wrong once the real count is known. */
export function defendChoiceLayout(viewport: Rect, optionCount = 2): DefendChoiceLayout {
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

    const summaryHeight = Math.min(250, Math.round((sheet.y + sheet.height - bodyTop) * 0.45));
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
  const waitingOn: Rect = {
    x: sheet.x,
    y: commit.y - WAITING_HEIGHT - SECTION_GAP,
    width: sheet.width,
    height: WAITING_HEIGHT,
  };
  const bodyBottomForStack = waitingOn.y - SECTION_GAP;
  const contentHeight = bodyBottomForStack - bodyTop;

  // The options list is sized first, against its own floor, and the summary/stack split whatever it leaves —
  // the opposite order from the old "options get whatever's left" split, which is what let a cramped viewport
  // crush option rows below their own readable minimum (this file's own `OPTION_MIN_HEIGHT_NARROW` comment).
  const count = Math.max(1, optionCount);
  const requiredOptionsHeight = count * OPTION_MIN_HEIGHT_NARROW + OPTION_GAP * (count - 1);
  const summaryStackFloor = SUMMARY_MIN_NARROW + STACK_MIN_NARROW;
  const summaryStackBudget = contentHeight - requiredOptionsHeight - SECTION_GAP * 2;
  // Only when even the summary/stack floors can't be met does the options list give any of its own floor back —
  // never below one row's own minimum, so a pathologically short viewport still reads as "too small" rather than
  // silently overlapping again.
  const optionsHeight =
    summaryStackBudget < summaryStackFloor
      ? Math.max(OPTION_MIN_HEIGHT_NARROW, requiredOptionsHeight - (summaryStackFloor - summaryStackBudget))
      : requiredOptionsHeight;
  const summaryStackHeight = Math.max(summaryStackFloor, contentHeight - optionsHeight - SECTION_GAP * 2);

  const stackHeight = Math.min(STACK_MAX_NARROW, Math.max(STACK_MIN_NARROW, Math.round(summaryStackHeight * 0.36)));
  const stack: Rect = { x: sheet.x, y: bodyBottomForStack - stackHeight, width: sheet.width, height: stackHeight };

  const summaryHeight = Math.min(SUMMARY_MAX_NARROW, Math.max(SUMMARY_MIN_NARROW, summaryStackHeight - stackHeight));
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
/** Below this an option card stops holding its defender's scan beside a title, an exhaust line and a damage line. */
const OPTION_MIN_MAIN_AXIS = 220;

/**
 * One rect per option: a row on phone/tablet-portrait (there's no width to spare for a second column), a side-by-side
 * card on tablet-landscape/desktop (D10's own "Your options" row) — until there isn't room for one at a readable
 * width, at which point it wraps into more rows rather than squeezing every option into an unreadable sliver, the
 * same floor `cardRow`/`wrapChipsToRows` hold for their own content.
 */
export function defendOptionSlots(
  area: Rect,
  count: number,
  formFactor: FormFactor,
  /** Relative height each stacked row needs (1 = a plain option), so a row with a longer consequence line gets more. */
  weights?: readonly number[],
): readonly Rect[] {
  if (count <= 0) return [];
  if (!isWide(formFactor) && weights && weights.length === count) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const room = area.height - OPTION_GAP * (count - 1);
    let y = area.y;
    return weights.map((weight) => {
      const height = (room * weight) / total;
      const slot = { x: area.x, y, width: area.width, height };
      y += height + OPTION_GAP;
      return slot;
    });
  }
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

  const perRow = Math.max(
    1,
    Math.min(count, Math.floor((area.width + OPTION_GAP) / (OPTION_MIN_MAIN_AXIS + OPTION_GAP))),
  );
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

/** A card scan's width over its height (63mm × 88mm). */
const CARD_ASPECT = 63 / 88;
const MATCHUP_PAD = 12;
const CAPTION_HEIGHT = 16;

/**
 * The incoming-attack card's own insides: the attacker's scan, what it is swinging with, and the character it is
 * aimed at, read left to right like the sentence in the header — then the notes, beside the matchup where there is
 * width for them and under it where there isn't (phone).
 */
export interface DefendMatchupLayout {
  readonly attacker: Rect;
  /** "ATK 3", the arrow, and the facedown boost backs — between the two scans. */
  readonly middle: Rect;
  readonly target: Rect;
  /** One caption line under each scan. */
  readonly attackerCaption: Rect;
  readonly targetCaption: Rect;
  readonly notes: Rect;
}

export function defendMatchupLayout(summary: Rect, formFactor: FormFactor): DefendMatchupLayout {
  const wide = isWide(formFactor);
  const innerTop = summary.y + MATCHUP_PAD + CAPTION_HEIGHT; // the eyebrow line sits above the scans
  const rowHeight = wide
    ? summary.height - MATCHUP_PAD * 2 - CAPTION_HEIGHT * 2
    : Math.round((summary.height - MATCHUP_PAD * 2 - CAPTION_HEIGHT * 2) * 0.62);
  const cardHeight = Math.max(40, rowHeight);
  const cardWidth = Math.round(cardHeight * CARD_ASPECT);
  const middleWidth = Math.max(96, Math.min(150, Math.round(cardWidth * 1.1)));

  const attacker: Rect = { x: summary.x + MATCHUP_PAD, y: innerTop, width: cardWidth, height: cardHeight };
  const middle: Rect = { x: attacker.x + cardWidth + 8, y: innerTop, width: middleWidth, height: cardHeight };
  const target: Rect = { x: middle.x + middleWidth + 8, y: innerTop, width: cardWidth, height: cardHeight };
  const captionY = innerTop + cardHeight + 3;
  const attackerCaption: Rect = {
    x: attacker.x,
    y: captionY,
    width: cardWidth + Math.round(middleWidth * 0.3),
    height: CAPTION_HEIGHT,
  };
  const targetCaption: Rect = {
    x: target.x - Math.round(middleWidth * 0.65),
    y: captionY,
    width: cardWidth + Math.round(middleWidth * 0.65),
    height: CAPTION_HEIGHT,
  };

  const matchupRight = target.x + cardWidth;
  const notes: Rect = wide
    ? {
        x: matchupRight + 16,
        y: innerTop,
        width: Math.max(0, summary.x + summary.width - MATCHUP_PAD - (matchupRight + 16)),
        height: summary.height - MATCHUP_PAD * 2 - CAPTION_HEIGHT,
      }
    : {
        x: summary.x + MATCHUP_PAD,
        y: captionY + CAPTION_HEIGHT + 2,
        width: summary.width - MATCHUP_PAD * 2,
        height: Math.max(0, summary.y + summary.height - MATCHUP_PAD - (captionY + CAPTION_HEIGHT + 2)),
      };
  return { attacker, middle, target, attackerCaption, targetCaption, notes };
}

/** Where an option card's scan goes, or null when the card is too narrow to hold one beside its text. */
export function defendOptionPicture(slot: Rect): Rect | null {
  const height = Math.min(slot.height - 16, 160);
  const width = Math.round(height * CARD_ASPECT);
  if (height < 40 || slot.width - width - 30 < 120) return null;
  return { x: slot.x + 8, y: slot.y + 8, width, height };
}
