/**
 * Setup deal & mulligan (W3, docs/phase4-screen-gaps.md §3), composition read
 * off `docs/design-renders/ScreensDesktop_05-06.png` (D06), `ScreensPhone_02.png`
 * (P13) and `ScreensTablet_02-03.png` (L05), corrected by the 2026-09-18
 * fidelity pass against the same tiles (the first pass matched the structure
 * but not the look — see `scenes/setup-deal.ts`'s header for what changed):
 *
 * An ink void ground throughout, and a full-width ink header bar: "SETTING UP
 * THE TABLE" (Bangers, padded well clear of the viewport's top edge — the
 * glyphs' own ascenders clip if the bar has no headroom above the text) with
 * "Step N of M · <what's happening>" inline immediately to its right, not a
 * small badge pinned to the far corner. Below it, a row of checklist chips:
 * uppercase, letter-spaced, a green-outlined dark wash for a done step, solid
 * Hero Red for the one in progress, a dim outline for what's still ahead.
 *
 * **Two different compositions, not one narrowed to fit.** Phone,
 * tablet-portrait and desktop share one — "focus" — built the same way
 * `table-setup-layout.ts` splits Table setup: a body column (the currently
 * deciding seat's own hand as full cards — one row where they read, a
 * sideways-scrolling strip of full-height cards where they wouldn't,
 * `view/opening-hand-layout.ts` — a compact "Mulligan N"/"Keep all N"
 * pair under it, then "Other seats" — a side-by-side row of compact seat
 * cards on tablet-portrait/desktop, since a 4-player game only ever has up to
 * three, stacked full-width only on phone where there isn't the width for a
 * row) beside a persistent sidebar ("Setup card revealed" over "Setup log")
 * on tablet-portrait and desktop, the sidebar folded below the body on phone.
 * On phone the commit row is pinned to the bottom of the viewport, like the
 * Board's own action bar, rather than sitting inline after the hand — the
 * one place on this screen a player must always find without scrolling.
 * **Tablet landscape (L05) is its own composition**: one column per seat so
 * every seat's hand is visible at once, with a footer row for the note and
 * the commit buttons — not a wider "focus" body, which would waste a long
 * table's own width on a single seat when there's room to show every seat
 * mulliganing at once.
 */
import { hit } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";
import { setupColumnWidth, setupMetrics } from "./setup-metrics.js";

export const HEADER_HEIGHT = 92;
/** Where `titleRow` starts inside the header bar — the padding that keeps Bangers' ascenders off the viewport edge. */
const TITLE_TOP_PAD = 30;
export const CHECKLIST_HEIGHT = 40;
const SIDEBAR_SHARE = 0.36;
const OTHER_SEAT_ROW_HEIGHT = 44;
/** A compact "other seat" card on tablet-portrait/desktop: monogram + name + status + a row of facedown slots. */
const OTHER_SEAT_CARD_HEIGHT = 96;
const OTHER_SEAT_GAP = 10;
/** The empty "nothing revealed yet" state is one line, not a tall empty panel (fidelity pass). */
const REVEALED_EMPTY_HEIGHT = 56;
/**
 * Room for a Bangers section header ("Your opening hand — …", "Other seats") plus its rule (fidelity pass):
 * `LABEL_ROOM` (16px) is sized for the small uppercase labels it was built for, and a 22px Bangers line's own
 * descenders overflow that — the header ran into the card row directly beneath it.
 */
const SECTION_HEADER_ROOM = 30;

export type SetupLayoutMode = "focus" | "allSeats";

export interface SetupWalkthroughLayoutInput {
  readonly width: number;
  readonly height: number;
  /** Every seat other than the one currently deciding — "focus" mode only. */
  readonly otherSeatCount: number;
  /** Every seat in the game — "allSeats" mode only. */
  readonly seatCount: number;
  /**
   * How many rows the checklist strip needs at this width (`view/chip-layout.ts`'s own `wrapChipsToRows`, applied
   * by the caller to the checklist's five labels — this module only needs the count, the same split
   * `table-setup-layout.ts`'s `modularRows` already uses). Defaults to 1: every size this screen is tested at
   * except a narrow phone fits the checklist on one row.
   */
  readonly checklistRows?: number;
  /** Whether a setup card has been revealed yet — the empty state is short, not a big empty panel. Defaults true. */
  readonly hasRevealedCard?: boolean;
}

export interface SetupWalkthroughLayout {
  readonly formFactor: FormFactor;
  readonly mode: SetupLayoutMode;
  readonly headerBar: Rect;
  /** Title left-aligned, then the step caption drawn immediately after it (the scene measures the rendered width). */
  readonly titleRow: Rect;
  readonly checklist: Rect;

  // "focus" mode.
  readonly handLabel: Rect;
  readonly handRow: Rect;
  readonly commitRow: Rect;
  readonly otherSeatsLabel: Rect;
  readonly otherSeats: readonly Rect[];
  readonly revealedPanel: Rect | null;
  readonly logPanel: Rect | null;
  readonly split: boolean;
  /** True when the commit row is pinned to the bottom of the viewport (phone) rather than sitting inline after the hand. */
  readonly commitSticky: boolean;

  // "allSeats" mode.
  readonly seatColumns: readonly Rect[];
  readonly footerNote: Rect | null;
  readonly footerCommit: Rect | null;
}

export function setupWalkthroughLayoutRects(layout: SetupWalkthroughLayout): readonly Rect[] {
  const rects: Rect[] = [layout.titleRow, layout.checklist];
  if (layout.mode === "focus") {
    rects.push(layout.handLabel, layout.handRow, layout.commitRow, layout.otherSeatsLabel, ...layout.otherSeats);
    if (layout.revealedPanel) rects.push(layout.revealedPanel);
    if (layout.logPanel) rects.push(layout.logPanel);
  } else {
    rects.push(...layout.seatColumns);
    if (layout.footerNote) rects.push(layout.footerNote);
    if (layout.footerCommit) rects.push(layout.footerCommit);
  }
  return rects;
}

export function setupWalkthroughLayout(input: SetupWalkthroughLayoutInput): SetupWalkthroughLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const { pad, gap } = setupMetrics(width, height);

  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const titleRow: Rect = { x: pad, y: TITLE_TOP_PAD, width: width - pad * 2, height: HEADER_HEIGHT - TITLE_TOP_PAD - 14 };
  const checklistRows = Math.max(1, input.checklistRows ?? 1);
  const checklistHeight = checklistRows * CHECKLIST_HEIGHT + (checklistRows - 1) * 6;
  const checklist: Rect = { x: pad, y: HEADER_HEIGHT + gap, width: width - pad * 2, height: checklistHeight };
  const bodyTop = checklist.y + checklist.height + gap;
  const hasRevealedCard = input.hasRevealedCard ?? true;

  if (formFactor === "tabletLandscape") {
    return allSeatsLayout({ width, height, headerBar, titleRow, checklist, formFactor, bodyTop, pad, gap, seatCount: Math.max(1, input.seatCount) });
  }
  return focusLayout({ width, height, headerBar, titleRow, checklist, formFactor, bodyTop, pad, gap, otherSeatCount: Math.max(0, input.otherSeatCount), hasRevealedCard });
}

interface Shared {
  readonly width: number;
  readonly height: number;
  readonly headerBar: Rect;
  readonly titleRow: Rect;
  readonly checklist: Rect;
  readonly formFactor: FormFactor;
  readonly bodyTop: number;
  readonly pad: number;
  readonly gap: number;
}

/** Floors for the two budgets `focusLayout` shrinks when a tall checklist (two rows, a narrow phone) leaves less room than usual — never below a size that stops reading as a card row or a card panel. */
const MIN_HAND_ROW_HEIGHT = 120;
/**
 * The phone's own floor is higher: there the hand is a horizontally scrolling strip of full-height cards
 * (`view/opening-hand-layout.ts`), so the row's height *is* each card's height, and a 120px card is the
 * unreadable thumbnail that strip exists to get rid of (Pixel 9 Pro XL report, 2026-09-19). 180px keeps a card
 * ~129px wide; the revealed-card panel gives up its slack first instead, down to its own floor.
 */
const MIN_HAND_STRIP_HEIGHT = 180;
const MIN_REVEALED_HEIGHT_STACKED = 70;

function focusLayoutAt(
  shared: Shared & { readonly otherSeatCount: number; readonly hasRevealedCard: boolean },
  handRowHeightOverride?: number,
  revealedHeightOverride?: number,
): SetupWalkthroughLayout {
  const { width, height, formFactor, bodyTop, pad, gap, otherSeatCount, hasRevealedCard } = shared;
  const split = formFactor !== "phone";
  const commitSticky = formFactor === "phone";

  const bodyWidth = split ? Math.round(width * (1 - SIDEBAR_SHARE)) - pad * 1.5 : setupColumnWidth(width, height);
  const bodyLeft = split ? pad : (width - bodyWidth) / 2;
  const sidebarLeft = split ? bodyLeft + bodyWidth + pad : bodyLeft;
  const sidebarWidth = split ? width - sidebarLeft - pad : bodyWidth;

  // The commit row is 52px pinned to the bottom on phone (like the Board's action bar) rather than taking its turn
  // in the vertical flow, so it never scrolls out of reach under a crowded hand/other-seats/log stack.
  const commitRow: Rect = commitSticky
    ? { x: bodyLeft, y: height - pad - hit.primary, width: bodyWidth, height: hit.primary }
    : { x: 0, y: 0, width: 0, height: 0 }; // placed below, once `by` reaches it in normal flow.

  let by = bodyTop + SECTION_HEADER_ROOM;
  const handRowHeight = handRowHeightOverride ?? Math.min(260, Math.max(160, height * 0.28));
  const handLabel: Rect = { x: bodyLeft, y: bodyTop, width: bodyWidth, height: SECTION_HEADER_ROOM };
  const handRow: Rect = { x: bodyLeft, y: by, width: bodyWidth, height: handRowHeight };
  by += handRowHeight + gap;

  let resolvedCommitRow = commitRow;
  if (!commitSticky) {
    resolvedCommitRow = { x: bodyLeft, y: by, width: bodyWidth, height: hit.primary };
    by += hit.primary + gap;
  }

  const otherSeatsLabel: Rect = { x: bodyLeft, y: by, width: bodyWidth, height: SECTION_HEADER_ROOM };
  by += SECTION_HEADER_ROOM;
  // Side-by-side on tablet-portrait/desktop (a 4-player game has at most 3 other seats — one row always fits);
  // stacked full-width rows only on phone, where a row of three would be too narrow to read.
  let otherSeats: Rect[];
  if (split) {
    const cols = Math.max(1, otherSeatCount);
    const colWidth = (bodyWidth - OTHER_SEAT_GAP * (cols - 1)) / cols;
    otherSeats = Array.from({ length: otherSeatCount }, (_unused, index) => ({
      x: bodyLeft + index * (colWidth + OTHER_SEAT_GAP),
      y: by,
      width: colWidth,
      height: OTHER_SEAT_CARD_HEIGHT,
    }));
    if (otherSeatCount > 0) by += OTHER_SEAT_CARD_HEIGHT + gap;
  } else {
    otherSeats = Array.from({ length: otherSeatCount }, (_unused, index) => ({
      x: bodyLeft,
      y: by + index * (OTHER_SEAT_ROW_HEIGHT + 6),
      width: bodyWidth,
      height: OTHER_SEAT_ROW_HEIGHT,
    }));
    by += otherSeatCount * (OTHER_SEAT_ROW_HEIGHT + 6);
  }

  // On phone, the commit row no longer eats space out of the flow (it's pinned to the bottom), so the
  // hand/other-seats/revealed/log stack has the whole body height to itself, down to the commit row's own top.
  const floor = commitSticky ? resolvedCommitRow.y - gap : height - pad;

  let revealedPanel: Rect | null = null;
  let logPanel: Rect | null = null;
  if (split) {
    const revealedHeight = !hasRevealedCard ? REVEALED_EMPTY_HEIGHT : (revealedHeightOverride ?? Math.min(230, Math.max(160, height * 0.28)));
    revealedPanel = { x: sidebarLeft, y: bodyTop, width: sidebarWidth, height: revealedHeight };
    const logTop = revealedPanel.y + revealedPanel.height + gap;
    logPanel = { x: sidebarLeft, y: logTop, width: sidebarWidth, height: Math.max(80, height - pad - logTop) };
  } else {
    const revealedHeight = !hasRevealedCard ? REVEALED_EMPTY_HEIGHT : (revealedHeightOverride ?? 120);
    revealedPanel = { x: bodyLeft, y: by + gap, width: bodyWidth, height: revealedHeight };
    const logTop = revealedPanel.y + revealedPanel.height + gap;
    logPanel = { x: bodyLeft, y: logTop, width: bodyWidth, height: Math.max(60, floor - logTop) };
  }

  return {
    formFactor: shared.formFactor,
    mode: "focus",
    headerBar: shared.headerBar,
    titleRow: shared.titleRow,
    checklist: shared.checklist,
    handLabel,
    handRow,
    commitRow: resolvedCommitRow,
    otherSeatsLabel,
    otherSeats,
    revealedPanel,
    logPanel,
    split,
    commitSticky,
    seatColumns: [],
    footerNote: null,
    footerCommit: null,
  };
}

/**
 * `focusLayoutAt`'s own defaults fit every size this screen is tested at with one checklist row. A two-row
 * checklist (a narrow phone with five labels, `#draw`'s own `wrapChipsToRows` call) pushes everything under it down
 * by a row's worth of height, which the phone composition — already the tightest of the three, no sidebar to fold
 * the overflow into — has no slack for. Rather than a fixed shrink for "the phone case", this measures the actual
 * overflow past the viewport (from the log panel's own floor, the last thing laid out) and takes it out of the two
 * budgets built to give room back — the hand row first (down to `MIN_HAND_ROW_HEIGHT`, or `MIN_HAND_STRIP_HEIGHT`
 * on phone, where the row is a scrolling strip and its height is every card's height), then the
 * revealed-card panel (down to `MIN_REVEALED_HEIGHT_STACKED`, still enough for a name and one line of rules text)
 * — never the checklist, the commit row's 44px+ touch targets, or the log panel's own floor.
 */
function focusLayout(shared: Shared & { readonly otherSeatCount: number; readonly hasRevealedCard: boolean }): SetupWalkthroughLayout {
  const trial = focusLayoutAt(shared);
  if (!trial.logPanel) return trial;
  const floor = trial.commitSticky ? trial.commitRow.y - shared.gap : shared.height;
  const overflow = trial.logPanel.y + trial.logPanel.height - floor;
  if (overflow <= 0) return trial;

  const defaultHandRowHeight = trial.handRow.height;
  const minHandRowHeight = trial.formFactor === "phone" ? MIN_HAND_STRIP_HEIGHT : MIN_HAND_ROW_HEIGHT;
  const takenFromHand = Math.min(overflow, Math.max(0, defaultHandRowHeight - minHandRowHeight));
  const handRowHeightOverride = defaultHandRowHeight - takenFromHand;
  const remaining = overflow - takenFromHand;
  if (remaining <= 0) return focusLayoutAt(shared, handRowHeightOverride);

  const defaultRevealedHeight = trial.revealedPanel?.height ?? MIN_REVEALED_HEIGHT_STACKED;
  const takenFromRevealed = Math.min(remaining, Math.max(0, defaultRevealedHeight - MIN_REVEALED_HEIGHT_STACKED));
  const revealedHeightOverride = defaultRevealedHeight - takenFromRevealed;
  const stillOver = remaining - takenFromRevealed;
  if (stillOver <= 0) return focusLayoutAt(shared, handRowHeightOverride, revealedHeightOverride);

  // Last resort, phone only: even both floors don't fit (a checklist wrapped to four or five rows on a narrow
  // phone). The strip's higher floor gives way down to the plain row floor before anything is allowed to overflow —
  // a shorter strip still beats a stack that runs under the pinned commit row.
  const lastResort = Math.min(stillOver, Math.max(0, handRowHeightOverride - MIN_HAND_ROW_HEIGHT));
  return focusLayoutAt(shared, handRowHeightOverride - lastResort, revealedHeightOverride);
}

function allSeatsLayout(shared: Shared & { readonly seatCount: number }): SetupWalkthroughLayout {
  const { width, height, bodyTop, pad, gap, seatCount } = shared;
  const footerHeight = hit.primary + 8;
  const columnsTop = bodyTop;
  const columnsHeight = Math.max(120, height - columnsTop - footerHeight - gap - pad);
  const columnWidth = (width - pad * 2 - gap * (seatCount - 1)) / seatCount;
  const seatColumns: Rect[] = Array.from({ length: seatCount }, (_unused, index) => ({
    x: pad + index * (columnWidth + gap),
    y: columnsTop,
    width: columnWidth,
    height: columnsHeight,
  }));

  const footerTop = columnsTop + columnsHeight + gap;
  const commitWidth = Math.min(260, width * 0.28);
  const footerNote: Rect = { x: pad, y: footerTop, width: width - pad * 3 - commitWidth, height: footerHeight };
  const footerCommit: Rect = { x: width - pad - commitWidth, y: footerTop, width: commitWidth, height: footerHeight };

  return {
    formFactor: shared.formFactor,
    mode: "allSeats",
    headerBar: shared.headerBar,
    titleRow: shared.titleRow,
    checklist: shared.checklist,
    handLabel: { x: 0, y: 0, width: 0, height: 0 },
    handRow: { x: 0, y: 0, width: 0, height: 0 },
    commitRow: { x: 0, y: 0, width: 0, height: 0 },
    otherSeatsLabel: { x: 0, y: 0, width: 0, height: 0 },
    otherSeats: [],
    revealedPanel: null,
    logPanel: null,
    split: false,
    commitSticky: false,
    seatColumns,
    footerNote,
    footerCommit,
  };
}
