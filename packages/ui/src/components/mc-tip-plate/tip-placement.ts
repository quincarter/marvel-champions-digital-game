/**
 * Where an aspect tip's plate sits for the control it points at: the placement rules of the client's
 * `dom/aspect-tip-sheet.ts` (`tipPlacement`), as a pure function the plate calls on every layout. Centered on the
 * anchor and clamped to the viewport, below it unless there is no room, then above, whichever side has more room when
 * neither fits; a plate that fits neither side is clamped inside the screen over the anchor, with no arrow.
 */

export interface TipRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TipPlacement {
  /** The plate. */
  readonly panel: TipRect;
  /** Where the arrow's point is along the plate's edge. */
  readonly arrowX: number;
  /** The plate is above the anchor (its arrow points down). */
  readonly above: boolean;
  /** Whether the arrow is drawn: not when the plate had to sit over the anchor for lack of room either side. */
  readonly arrow: boolean;
}

/** The plate's width when there is room, and its narrowest. */
export const TIP_WIDE = 300;
const TIP_NARROW = 120;
const MARGIN = 4;
const GAP = 8;
export const TIP_ARROW = 7;

/** The plate's width for a screen: wider where there is room (fewer lines), never wider than the screen less its margins. */
export function tipWidthFor(viewportWidth: number): number {
  return Math.max(TIP_NARROW, Math.min(TIP_WIDE, viewportWidth - 8));
}

export function tipPlacement(anchor: TipRect, contentHeight: number, viewport: TipRect, width: number): TipPlacement {
  const centerX = anchor.x + anchor.width / 2;
  const x = Math.max(viewport.x + MARGIN, Math.min(centerX - width / 2, viewport.x + viewport.width - width - MARGIN));
  const clearBelow = anchor.y + anchor.height;
  const spaceBelow = viewport.y + viewport.height - clearBelow;
  const spaceAbove = anchor.y - viewport.y;
  const need = contentHeight + GAP + TIP_ARROW;
  const above = spaceBelow < need && (spaceAbove >= need || spaceAbove > spaceBelow);
  const wantedY = above ? anchor.y - GAP - TIP_ARROW - contentHeight : clearBelow + GAP + TIP_ARROW;
  const top = viewport.y + MARGIN;
  const bottom = viewport.y + viewport.height - MARGIN - contentHeight;
  const y = Math.max(top, Math.min(wantedY, Math.max(top, bottom)));
  const panel: TipRect = { x, y, width, height: contentHeight };
  const arrowX = Math.max(panel.x + TIP_ARROW, Math.min(centerX, panel.x + panel.width - TIP_ARROW));
  return { panel, arrowX, above, arrow: y === wantedY };
}
