/**
 * Where the "Your name" sheet puts its parts (`scenes/online-name.ts`), worked out from the measured text heights and
 * the viewport. The sheet never grows past the viewport: when the natural layout does not fit (a short landscape phone,
 * a phone with its keyboard open, long Spanish text, the empty-name error showing) it first tightens its padding and
 * shrinks the field and buttons to the 44 px target, then lets the explanatory body scroll in a shorter box. The field
 * and both buttons always sit inside the box, and the box inside the viewport.
 */
import type { Rect } from "./layout.js";

export interface NameSheetInput {
  readonly width: number;
  readonly height: number;
  readonly titleHeight: number;
  readonly bodyHeight: number;
  /** The empty-name error's height, or null when it is not showing. */
  readonly problemHeight: number | null;
}

export interface NameSheetLayout {
  readonly box: Rect;
  readonly compact: boolean;
  /** The padding inside the box, left and right too. */
  readonly pad: number;
  readonly titleY: number;
  /** The body's rect; `contentHeight` is taller than `rect.height` when the body scrolls. */
  readonly body: { readonly rect: Rect; readonly contentHeight: number; readonly scrolls: boolean };
  readonly fieldRect: Rect;
  readonly problemY: number | null;
  readonly buttonY: number;
  readonly buttonHeight: number;
}

const MARGIN = 16;
const COMPACT_MARGIN = 8;
const FULL = { pad: 20, gapTitle: 8, gapField: 14, gapProblem: 8, gapButtons: 16, field: 52, button: 52 } as const;
const COMPACT = { pad: 10, gapTitle: 6, gapField: 8, gapProblem: 6, gapButtons: 8, field: 44, button: 44 } as const;

export function layoutNameSheet(input: NameSheetInput): NameSheetLayout {
  const { width, height, titleHeight, bodyHeight, problemHeight } = input;
  const fixedOf = (m: typeof FULL | typeof COMPACT): number =>
    m.pad +
    titleHeight +
    m.gapTitle +
    m.gapField +
    m.field +
    (problemHeight === null ? 0 : problemHeight + m.gapProblem) +
    m.gapButtons +
    m.button +
    m.pad;
  let compact = false;
  let m: typeof FULL | typeof COMPACT = FULL;
  let margin = MARGIN;
  if (fixedOf(FULL) + bodyHeight > height - 2 * MARGIN) {
    compact = true;
    m = COMPACT;
    margin = COMPACT_MARGIN;
  }
  const fixed = fixedOf(m);
  const available = Math.max(0, height - 2 * margin);
  const bodyView = Math.max(0, Math.min(bodyHeight, available - fixed));
  const boxHeight = fixed + bodyView;
  const boxWidth = Math.min(520, width - 2 * margin);
  const x = (width - boxWidth) / 2;
  // A third of the way down when there is room, never off the top or the bottom.
  const y = Math.min(Math.max(margin, (height - boxHeight) / 3), Math.max(margin, height - margin - boxHeight));
  const innerWidth = boxWidth - 2 * m.pad;
  const titleY = y + m.pad;
  const bodyY = titleY + titleHeight + m.gapTitle;
  const fieldY = bodyY + bodyView + m.gapField;
  return {
    box: { x, y, width: boxWidth, height: boxHeight },
    compact,
    pad: m.pad,
    titleY,
    body: {
      rect: { x: x + m.pad, y: bodyY, width: innerWidth, height: bodyView },
      contentHeight: bodyHeight,
      scrolls: bodyView < bodyHeight,
    },
    fieldRect: { x: x + m.pad, y: fieldY, width: innerWidth, height: m.field },
    problemY: problemHeight === null ? null : fieldY + m.field + m.gapProblem,
    buttonY: y + boxHeight - m.pad - m.button,
    buttonHeight: m.button,
  };
}
