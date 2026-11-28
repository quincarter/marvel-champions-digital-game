/**
 * Where a tip plate sits for an anchor (a chip segment, a button) inside a viewport: the placement math the client's
 * `ui/tooltip.ts` uses. Centered on the anchor and clamped to the viewport, below it unless there is no room, then
 * above, whichever side has more room when neither fits; a plate that fits neither side is clamped inside the screen
 * over the anchor (no arrow), never off it.
 */
export interface TipRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const TIP_WIDTH = 220;
/** The gap between the anchor and the plate, and the arrow's size. */
export const TIP_GAP = 8;
export const TIP_ARROW = 7;
/** The widest a tip grows to, so a long one wraps to fewer lines than the 220px plate would. */
const WIDE_TIP = 300;

/** The plate's width for a screen: wider where there is room (fewer lines), never wider than the screen less its margins. */
export function tipWidthFor(viewport: TipRect): number {
  return Math.max(120, Math.min(WIDE_TIP, viewport.width - 8));
}

export interface TipPlacement {
  /** The plate. */
  readonly panel: TipRect;
  /** Where the arrow's point is: x along the plate's edge, which edge. */
  readonly arrowX: number;
  readonly above: boolean;
  /** Whether the arrow is drawn: not when the plate had to sit over the segment for lack of room either side. */
  readonly arrow: boolean;
  /** The plate and its arrow, the region the sheet covers. */
  readonly bounds: TipRect;
}

/** `width` is the plate's width (`tipWidthFor`); `contentHeight` the plate's own height. */
export function tipPlacement(
  anchor: TipRect,
  contentHeight: number,
  viewport: TipRect,
  width = TIP_WIDTH,
): TipPlacement {
  const centerX = anchor.x + anchor.width / 2;
  const x = Math.max(viewport.x + 4, Math.min(centerX - width / 2, viewport.x + viewport.width - width - 4));
  const clearBelow = anchor.y + anchor.height;
  const spaceBelow = viewport.y + viewport.height - clearBelow;
  const spaceAbove = anchor.y - viewport.y;
  const need = contentHeight + TIP_GAP + TIP_ARROW;
  const above = spaceBelow < need && (spaceAbove >= need || spaceAbove > spaceBelow);
  const wantedY = above ? anchor.y - TIP_GAP - TIP_ARROW - contentHeight : clearBelow + TIP_GAP + TIP_ARROW;
  const top = viewport.y + 4;
  const bottom = viewport.y + viewport.height - 4 - contentHeight;
  const y = Math.max(top, Math.min(wantedY, Math.max(top, bottom)));
  const arrow = y === wantedY;
  const panel: TipRect = { x, y, width, height: contentHeight };
  const arrowX = Math.max(panel.x + TIP_ARROW, Math.min(centerX, panel.x + panel.width - TIP_ARROW));
  const bounds: TipRect = !arrow
    ? panel
    : above
      ? { x: panel.x, y: panel.y, width: panel.width, height: panel.height + TIP_ARROW }
      : { x: panel.x, y: panel.y - TIP_ARROW, width: panel.width, height: panel.height + TIP_ARROW };
  return { panel, arrowX, above, arrow, bounds };
}
