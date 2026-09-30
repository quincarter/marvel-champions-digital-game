/**
 * `McTipToast`'s own layout (guided mode G10e part 2, `docs/guided-mode.md` §4 G10e; fixed post-merge — see this
 * module's own git history — after browser verification found the first placement sitting directly over the END
 * TURN/Flip buttons and the right side of the hand on desktop, and over the whole hand on phone): where the
 * opportunistic-tip surface sits, given the viewport and the board's own zone rects (`view/layout.ts#boardLayout`)
 * this frame. Unlike `guide-callout-model.ts`'s `guideCalloutLayoutOf` this never anchors to a specific board thing
 * — an opportunistic tip has no single taught control the way a scripted lesson step does (§5.3's own tips are
 * about something that just happened on the table generally, not "tap this") — so there are exactly two fixed
 * placements, both computed from real zone rects so the toast can never land on top of a control:
 *
 *  - **Desktop, tablet landscape (not tabbed): the lower-right of the play area**, pinned above the hand row —
 *    `playAreaRect`'s own bottom edge already sits a gutter above `handRect` in every `longTableZones` layout
 *    (`view/layout.ts`), and the play area never shares a row with the log, the encounter deck/discard or the
 *    action bar (those live in the villain band, above the player band, or the action bar strictly below the
 *    hand) — so anchoring inside `playAreaRect` is clear of all four by construction, not by a clamp against each
 *    one individually.
 *  - **Phone, tablet portrait (tabbed): just above the hand strip**, spanning `handRect`'s own width rather than
 *    the villain-band zones behind whichever tab happens to be open (those can legitimately still show through
 *    partially — the brief only promises the hand stays visible and tappable, not that every zone on the current
 *    tab is uncovered).
 */
import type { Rect } from "./layout.js";

const GUTTER = 16;
/** Gap between the toast's own bottom edge and the hand's top edge. */
const HAND_GAP = 12;

export interface TipToastLayoutInput {
  readonly viewport: Rect;
  /** True on phone / tablet portrait (`view/layout.ts#isTabbed`). */
  readonly tabbed: boolean;
  /** The board's own hand zone rect this frame (`view/layout.ts#boardLayout` never returns this null). */
  readonly handRect: Rect;
  /**
   * The board's own play area zone rect this frame — only read when `tabbed` is false. Null falls back to the
   * viewport (a defensive floor; `longTableZones` always returns one).
   */
  readonly playAreaRect: Rect | null;
  readonly width: number;
  readonly height: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

export function tipToastRectOf(input: TipToastLayoutInput): Rect {
  const { viewport, handRect, width, height } = input;
  const minY = viewport.y + GUTTER;

  if (input.tabbed) {
    const minX = handRect.x + GUTTER;
    const maxX = handRect.x + handRect.width - GUTTER - width;
    const x = clamp(handRect.x + (handRect.width - width) / 2, minX, maxX);
    const maxY = handRect.y - HAND_GAP - height;
    const y = clamp(maxY, minY, maxY);
    return { x, y, width, height };
  }

  const area = input.playAreaRect ?? viewport;
  const minX = area.x + GUTTER;
  const maxX = area.x + area.width - GUTTER - width;
  const x = clamp(maxX, minX, maxX);
  // Bottom-right of the play area, but never lower than a gutter above the hand — the play area's own bottom
  // edge already clears the hand in every `longTableZones` layout, so this is a defensive floor, not the usual case.
  const bottomLimit = Math.min(area.y + area.height, handRect.y - HAND_GAP);
  const maxY = bottomLimit - height;
  const y = clamp(maxY, minY, maxY);
  return { x, y, width, height };
}
