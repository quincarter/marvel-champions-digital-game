/**
 * Where every part of the payment bar sits, as a pure function of the bar's width and which parts are present.
 *
 * The bar used to place its parts left to right in one 52 px row and drop the ones that did not fit. On a phone the X
 * stepper's "+" landed under PAY (a tap raised nothing: Everywhere All at Once could only be played at its least X)
 * and the line of prose, which names the card and carries the "Only to overpay" reason, was the first thing dropped.
 *
 * Now the bar is one row when its prose has room, and otherwise stacked: the count and the Pay and Cancel buttons stay
 * in the bottom row (the thumb's place, the same spot at every width), and everything else takes a row above it, the
 * stepper and the cost-reduction chips each on their own. Nothing is ever dropped, and no rect touches another.
 *
 * Rects are relative to the bar's own top left. The bar is `height` tall, so a bar with extra rows is taller than the
 * 52 px one-row bar and grows upward from the hand (the scene draws it with its bottom row where the one-row bar sits).
 */

import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

/** The one-row bar: 44 px controls with 4 px above and below. */
export const BAR_ROW = hit.target + 8;
const EDGE = 12;
const GAP = 8;
/** Under the 3 px ink stripe on the bar's top edge. */
const TOP = 5;
const PROSE_HEIGHT = 40;
const OVER_HEIGHT = 22;
const LOCK_HEIGHT = 38;
const ORDER_HEIGHT = 52;
const HELPER_HEIGHT = 22;
const COUNT_WIDTH = 150;
/** The prose a one-row bar needs before it is chosen over the stacked bar. */
const ONE_ROW_PROSE_MIN = 300;
/** The prose room at which the notes (overpaid, lock, helpers) fit inline after it, as the one-row bar always did. */
const INLINE_NOTES_MIN = 640;
/** Under this width a long Pay label ("Play without overpaying") has a row of its own. */
const OWN_ROW_BELOW = 500;

export interface PaymentBarParts {
  /** The X stepper (a card printed with an X cost). */
  readonly stepper: boolean;
  /** How many `playCostReduction` chips. */
  readonly reductions: number;
  /** The Pay button reads "Play without overpaying", which is wide. */
  readonly payLabel: boolean;
  /** The "Overpaid by N" readout. */
  readonly overpaid: boolean;
  /** The lock note ("Mr. Hollywood: Only to overpay: ..."). */
  readonly lock: boolean;
  /** One line per helper ("Helped by Ana: 1 energy"). */
  readonly helperLines: number;
  /** The note on what the payment order means, where there is no hover to show it. */
  readonly orderNote: boolean;
}

export interface StepperRects {
  readonly less: Rect;
  readonly label: Rect;
  readonly more: Rect;
}

export interface PaymentBarLayout {
  readonly width: number;
  readonly height: number;
  /** One row for everything but the notes, or the stacked bar. */
  readonly stacked: boolean;
  /** The overpaid readout, lock note and helper lines are part of the prose's own text (a wide one-row bar). */
  readonly inlineNotes: boolean;
  /** "PAYING 1 / 3". */
  readonly count: Rect;
  readonly stepper: StepperRects | null;
  /** The cost-reduction chips, left to right. */
  readonly reductions: readonly Rect[];
  /** The headline and "Tap cards to spend". */
  readonly prose: Rect;
  readonly over: Rect | null;
  readonly lock: Rect | null;
  readonly helpers: readonly Rect[];
  readonly order: Rect | null;
  readonly pay: Rect;
  readonly cancel: Rect;
}

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

export function paymentBarLayout(width: number, parts: PaymentBarParts): PaymentBarLayout {
  const buttonWidth = clamp(width * 0.16, 64, 120);
  // "Play without overpaying" is long for a button: the Pay button grows to hold it.
  // On a phone it does not fit beside the count and Cancel at any width the count can spare, so it takes a row of its
  // own at the foot of the bar, full width (a long label ellipsized to "PLAY WITHOUT OV...").
  const ownRow = parts.payLabel && width < OWN_ROW_BELOW;
  const payWidth = parts.payLabel ? Math.max(buttonWidth, Math.min(200, width * 0.3)) : buttonWidth;
  const cancelX = width - buttonWidth - 10;
  const payX = ownRow ? cancelX : cancelX - GAP - payWidth;
  const chipWidth = clamp(width * 0.12, 80, 150);
  const groupWidth = parts.reductions > 0 ? parts.reductions * chipWidth + (parts.reductions - 1) * 4 : 0;
  const reductionsX = groupWidth > 0 ? payX - GAP - groupWidth : payX;

  const stepperWidth = parts.stepper ? 44 + 56 + 44 : 0;
  const proseX = parts.stepper ? 170 + stepperWidth + 14 : 170;
  const proseRoom = reductionsX - 12 - proseX;
  const stacked = proseRoom < ONE_ROW_PROSE_MIN || ownRow;
  const inlineNotes = !stacked && proseRoom >= INLINE_NOTES_MIN;

  // Rows above the main row, top down. The notes keep the order the prose reads them in.
  const noteRows = !inlineNotes && (parts.overpaid || parts.lock || parts.helperLines > 0);
  let y = stacked || noteRows || parts.orderNote ? TOP : 0;
  const rowRect = (height: number): Rect => {
    const rect = { x: EDGE, y, width: width - 2 * EDGE, height };
    y += height + 2;
    return rect;
  };
  let prose: Rect | null = null;
  if (stacked) prose = rowRect(PROSE_HEIGHT);
  const over = !inlineNotes && parts.overpaid ? rowRect(OVER_HEIGHT) : null;
  const lock = !inlineNotes && parts.lock ? rowRect(LOCK_HEIGHT) : null;
  const helpers: Rect[] = [];
  if (!inlineNotes) for (let i = 0; i < parts.helperLines; i += 1) helpers.push(rowRect(HELPER_HEIGHT));
  const order = parts.orderNote ? rowRect(ORDER_HEIGHT) : null;

  const control = (x: number, rowTop: number, w: number): Rect => ({ x, y: rowTop + 4, width: w, height: hit.target });

  let reductions: Rect[] = [];
  let stepper: StepperRects | null = null;
  if (stacked) {
    if (parts.reductions > 0) {
      const each = (width - 2 * EDGE - 4 * (parts.reductions - 1)) / parts.reductions;
      reductions = Array.from({ length: parts.reductions }, (_, i) => control(EDGE + i * (each + 4), y, each));
      y += BAR_ROW;
    }
    if (parts.stepper) {
      stepper = {
        less: control(EDGE, y, 56),
        label: control(EDGE + 56 + 4, y, 84),
        more: control(EDGE + 56 + 4 + 84 + 4, y, 56),
      };
      y += BAR_ROW;
    }
  }
  // The main row: the count and the buttons, with the one-row bar's other parts beside them.
  const mainTop = y;
  const payTop = ownRow ? mainTop + BAR_ROW : mainTop;
  const height = payTop + BAR_ROW;
  if (!stacked) {
    prose = { x: proseX, y: mainTop + 4, width: proseRoom, height: hit.target };
    reductions = Array.from({ length: parts.reductions }, (_, i) =>
      control(reductionsX + i * (chipWidth + 4), mainTop, chipWidth),
    );
    if (parts.stepper) {
      stepper = {
        less: control(160, mainTop, 44),
        label: control(160 + 44, mainTop, 56),
        more: control(160 + 44 + 56, mainTop, 44),
      };
    }
  }
  const countRight = ownRow ? cancelX - GAP : stacked || !parts.stepper ? payX - GAP : Math.min(payX - GAP, 160 - 4);
  return {
    width,
    height,
    stacked,
    inlineNotes,
    count: {
      x: EDGE,
      y: mainTop + 4,
      width: Math.max(0, Math.min(COUNT_WIDTH, countRight - EDGE)),
      height: hit.target,
    },
    stepper,
    reductions,
    prose: prose!,
    over,
    lock,
    helpers,
    order,
    pay: ownRow ? control(EDGE, payTop, width - 2 * EDGE) : control(payX, mainTop, payWidth),
    cancel: control(cancelX, mainTop, buttonWidth),
  };
}
