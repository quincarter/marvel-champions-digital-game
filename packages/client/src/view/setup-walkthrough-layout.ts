/**
 * Setup deal & mulligan (W3, docs/phase4-screen-gaps.md §3), composition read
 * off `docs/design-renders/ScreensDesktop_05-06.png` (D06), `ScreensPhone_02.png`
 * (P13) and `ScreensTablet_02-03.png` (L05):
 *
 * An ink void ground throughout, and a full-width ink header bar naming the
 * screen and "Step N of M", the same header every setup screen already uses.
 * Below it, a row of checklist chips.
 *
 * **Two different compositions, not one narrowed to fit.** Phone,
 * tablet-portrait and desktop share one — "focus" — built the same way
 * `table-setup-layout.ts` splits Table setup: a body column (the currently
 * deciding seat's own hand as full cards, "Mulligan N"/"Keep all N" under it,
 * then "Other seats" as compact status rows) beside a persistent sidebar
 * ("Setup card revealed" over "Setup log") on tablet-portrait and desktop,
 * the sidebar folded below the body on phone, where there isn't room for two
 * columns side by side. **Tablet landscape (L05) is its own composition**:
 * one column per seat so every seat's hand is visible at once, with a footer
 * row for the note and the commit buttons — not a wider "focus" body, which
 * would waste a long table's own width on a single seat when there's room to
 * show every seat mulliganing at once.
 */
import { hit } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";
import { LABEL_ROOM, setupColumnWidth, setupMetrics } from "./setup-metrics.js";

export const HEADER_HEIGHT = 64;
export const CHECKLIST_HEIGHT = 40;
const SIDEBAR_SHARE = 0.36;
const OTHER_SEAT_ROW_HEIGHT = 44;

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
}

export interface SetupWalkthroughLayout {
  readonly formFactor: FormFactor;
  readonly mode: SetupLayoutMode;
  readonly headerBar: Rect;
  readonly title: Rect;
  readonly step: Rect;
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

  // "allSeats" mode.
  readonly seatColumns: readonly Rect[];
  readonly footerNote: Rect | null;
  readonly footerCommit: Rect | null;
}

export function setupWalkthroughLayoutRects(layout: SetupWalkthroughLayout): readonly Rect[] {
  const rects: Rect[] = [layout.title, layout.step, layout.checklist];
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
  const stepWidth = Math.min(200, Math.max(110, width * 0.28));
  const step: Rect = { x: width - pad - stepWidth, y: 0, width: stepWidth, height: HEADER_HEIGHT };
  // The title takes whatever the step counter leaves it, with an 8px gap — never a fixed share that could overrun a
  // narrow header (`estimateWrappedLines`/`fitText` shrink the text itself at the scene layer; this only bounds the box).
  const title: Rect = { x: pad, y: 0, width: Math.max(40, step.x - pad - 8), height: HEADER_HEIGHT };
  const checklistRows = Math.max(1, input.checklistRows ?? 1);
  const checklistHeight = checklistRows * CHECKLIST_HEIGHT + (checklistRows - 1) * 6;
  const checklist: Rect = { x: pad, y: HEADER_HEIGHT + gap, width: width - pad * 2, height: checklistHeight };
  const bodyTop = checklist.y + checklist.height + gap;

  if (formFactor === "tabletLandscape") {
    return allSeatsLayout({ width, height, headerBar, title, step, checklist, formFactor, bodyTop, pad, gap, seatCount: Math.max(1, input.seatCount) });
  }
  return focusLayout({ width, height, headerBar, title, step, checklist, formFactor, bodyTop, pad, gap, otherSeatCount: Math.max(0, input.otherSeatCount) });
}

interface Shared {
  readonly width: number;
  readonly height: number;
  readonly headerBar: Rect;
  readonly title: Rect;
  readonly step: Rect;
  readonly checklist: Rect;
  readonly formFactor: FormFactor;
  readonly bodyTop: number;
  readonly pad: number;
  readonly gap: number;
}

/** Floors for the two budgets `focusLayout` shrinks when a tall checklist (two rows, a narrow phone) leaves less room than usual — never below a size that stops reading as a card row or a card panel. */
const MIN_HAND_ROW_HEIGHT = 120;
const MIN_REVEALED_HEIGHT_STACKED = 70;

function focusLayoutAt(shared: Shared & { readonly otherSeatCount: number }, handRowHeightOverride?: number, revealedHeightOverride?: number): SetupWalkthroughLayout {
  const { width, height, formFactor, bodyTop, pad, gap, otherSeatCount } = shared;
  const split = formFactor !== "phone";

  const bodyWidth = split ? Math.round(width * (1 - SIDEBAR_SHARE)) - pad * 1.5 : setupColumnWidth(width, height);
  const bodyLeft = split ? pad : (width - bodyWidth) / 2;
  const sidebarLeft = split ? bodyLeft + bodyWidth + pad : bodyLeft;
  const sidebarWidth = split ? width - sidebarLeft - pad : bodyWidth;

  let by = bodyTop + LABEL_ROOM;
  const handRowHeight = handRowHeightOverride ?? Math.min(260, Math.max(160, height * 0.28));
  const handLabel: Rect = { x: bodyLeft, y: bodyTop, width: bodyWidth, height: LABEL_ROOM };
  const handRow: Rect = { x: bodyLeft, y: by, width: bodyWidth, height: handRowHeight };
  by += handRowHeight + gap;
  const commitRow: Rect = { x: bodyLeft, y: by, width: bodyWidth, height: hit.primary };
  by += hit.primary + gap;

  const otherSeatsLabel: Rect = { x: bodyLeft, y: by, width: bodyWidth, height: LABEL_ROOM };
  by += LABEL_ROOM;
  const otherSeats: Rect[] = Array.from({ length: otherSeatCount }, (_unused, index) => ({
    x: bodyLeft,
    y: by + index * (OTHER_SEAT_ROW_HEIGHT + 6),
    width: bodyWidth,
    height: OTHER_SEAT_ROW_HEIGHT,
  }));
  by += otherSeatCount * (OTHER_SEAT_ROW_HEIGHT + 6);

  let revealedPanel: Rect | null = null;
  let logPanel: Rect | null = null;
  if (split) {
    const revealedHeight = revealedHeightOverride ?? Math.min(230, Math.max(160, height * 0.28));
    revealedPanel = { x: sidebarLeft, y: bodyTop, width: sidebarWidth, height: revealedHeight };
    const logTop = revealedPanel.y + revealedPanel.height + gap;
    logPanel = { x: sidebarLeft, y: logTop, width: sidebarWidth, height: Math.max(80, height - pad - logTop) };
  } else {
    const revealedHeight = revealedHeightOverride ?? 120;
    revealedPanel = { x: bodyLeft, y: by + gap, width: bodyWidth, height: revealedHeight };
    const logTop = revealedPanel.y + revealedPanel.height + gap;
    logPanel = { x: bodyLeft, y: logTop, width: bodyWidth, height: Math.max(60, height - pad - logTop) };
  }

  return {
    formFactor: shared.formFactor,
    mode: "focus",
    headerBar: shared.headerBar,
    title: shared.title,
    step: shared.step,
    checklist: shared.checklist,
    handLabel,
    handRow,
    commitRow,
    otherSeatsLabel,
    otherSeats,
    revealedPanel,
    logPanel,
    split,
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
 * budgets built to give room back — the hand row first (down to `MIN_HAND_ROW_HEIGHT`, still a legible row or grid
 * of card thumbnails, `scenes/setup-deal.ts`'s own two-row grid takes over well above this floor), then the
 * revealed-card panel (down to `MIN_REVEALED_HEIGHT_STACKED`, still enough for a name and one line of rules text)
 * — never the checklist, the commit row's 44px+ touch targets, or the log panel's own floor.
 */
function focusLayout(shared: Shared & { readonly otherSeatCount: number }): SetupWalkthroughLayout {
  const trial = focusLayoutAt(shared);
  if (!trial.logPanel) return trial;
  const overflow = trial.logPanel.y + trial.logPanel.height - shared.height;
  if (overflow <= 0) return trial;

  const defaultHandRowHeight = trial.handRow.height;
  const takenFromHand = Math.min(overflow, Math.max(0, defaultHandRowHeight - MIN_HAND_ROW_HEIGHT));
  const handRowHeightOverride = defaultHandRowHeight - takenFromHand;
  const remaining = overflow - takenFromHand;
  if (remaining <= 0) return focusLayoutAt(shared, handRowHeightOverride);

  const defaultRevealedHeight = trial.revealedPanel?.height ?? MIN_REVEALED_HEIGHT_STACKED;
  const takenFromRevealed = Math.min(remaining, Math.max(0, defaultRevealedHeight - MIN_REVEALED_HEIGHT_STACKED));
  const revealedHeightOverride = defaultRevealedHeight - takenFromRevealed;
  return focusLayoutAt(shared, handRowHeightOverride, revealedHeightOverride);
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
    title: shared.title,
    step: shared.step,
    checklist: shared.checklist,
    handLabel: { x: 0, y: 0, width: 0, height: 0 },
    handRow: { x: 0, y: 0, width: 0, height: 0 },
    commitRow: { x: 0, y: 0, width: 0, height: 0 },
    otherSeatsLabel: { x: 0, y: 0, width: 0, height: 0 },
    otherSeats: [],
    revealedPanel: null,
    logPanel: null,
    split: false,
    seatColumns,
    footerNote,
    footerCommit,
  };
}
