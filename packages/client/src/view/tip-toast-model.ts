/**
 * `McTipToast`'s own layout (guided mode G10e part 2, `docs/guided-mode.md` §4 G10e): where the opportunistic-tip
 * surface sits, given the viewport, the board's own action-bar rect and the toast's measured content size. Unlike
 * `guide-callout-model.ts`'s `guideCalloutLayoutOf` this never anchors to a specific board thing — an opportunistic
 * tip has no single taught control the way a scripted lesson step does (§5.3's own tips are about something that
 * just happened on the table generally, not "tap this") — so there are exactly two fixed placements:
 *
 *  - **Tabbed (phone, tablet portrait): just above the action bar**, per the brief, so it never sits under the
 *    player's thumb reaching for it.
 *  - **Not tabbed (desktop, tablet landscape): the board's own bottom-right**, clear of a left-side tutorial rail
 *    (`ui/guide-panel.ts`) without this module needing to know whether one is even open — the rail only ever
 *    occupies the *left* edge (`scenes/board/guide-mount.ts#railOptionFor`), so bottom-right is unconditionally
 *    clear of it.
 */
import type { Rect } from "./layout.js";

const GUTTER = 16;
/** Gap between the toast's own bottom edge and the action bar's top edge, on a tabbed layout. */
const ACTION_BAR_GAP = 12;

export interface TipToastLayoutInput {
  readonly viewport: Rect;
  /** True on phone / tablet portrait (`view/layout.ts#isTabbed`). */
  readonly tabbed: boolean;
  /** The board's own action-bar zone rect this frame — only read when `tabbed` is true. */
  readonly actionBarRect: Rect | null;
  readonly width: number;
  readonly height: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

export function tipToastRectOf(input: TipToastLayoutInput): Rect {
  const { viewport, width, height } = input;
  const minX = viewport.x + GUTTER;
  const maxX = viewport.x + viewport.width - GUTTER - width;
  const x = clamp(viewport.x + (viewport.width - width) / 2, minX, maxX);

  if (input.tabbed && input.actionBarRect) {
    const y = clamp(
      input.actionBarRect.y - ACTION_BAR_GAP - height,
      viewport.y + GUTTER,
      viewport.y + viewport.height - GUTTER - height,
    );
    return { x, y, width, height };
  }

  return {
    x: clamp(viewport.x + viewport.width - GUTTER - width, minX, maxX),
    y: viewport.y + viewport.height - GUTTER - height,
    width,
    height,
  };
}
