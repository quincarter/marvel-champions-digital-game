/**
 * The shared panel shape behind Pause, Rules Reference and Settings
 * (docs/phase4-screen-gaps.md §3 "W4"): a single centered ink-and-paper card,
 * header / scrollable body / footer, stacked top to bottom — the same shape at
 * every size rather than the design canvases' separate wide-desktop-rail and
 * tall-phone-list treatments (D13 vs P16). One reliable layout, checked for
 * no-overlap at phone/800×600/desktop, was judged worth more here than
 * reproducing two bespoke shapes for a menu screen.
 *
 * Pure function of `bounds` and the two fixed band heights a caller asks for —
 * no text measurement, so it's plain-TS testable without a live Phaser scene,
 * the same rule `title-layout.ts` states for itself.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export const OVERLAY_MAX_WIDTH = 640;
/** Breathing room from the screen edge on every side, at any size. */
export const OVERLAY_MARGIN = 16;

export interface OverlayPanelLayout {
  readonly panel: Rect;
  readonly header: Rect;
  readonly body: Rect;
  readonly footer: Rect;
}

export function overlayPanelLayout(bounds: Rect, headerHeight: number, footerHeight: number): OverlayPanelLayout {
  const width = Math.min(OVERLAY_MAX_WIDTH, bounds.width - OVERLAY_MARGIN * 2);
  const height = bounds.height - OVERLAY_MARGIN * 2;
  const panel: Rect = {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + OVERLAY_MARGIN,
    width,
    height,
  };
  const header: Rect = { x: panel.x, y: panel.y, width: panel.width, height: headerHeight };
  const footer: Rect = { x: panel.x, y: panel.y + panel.height - footerHeight, width: panel.width, height: footerHeight };
  const body: Rect = {
    x: panel.x,
    y: header.y + header.height,
    width: panel.width,
    height: Math.max(0, footer.y - (header.y + header.height)),
  };
  return { panel, header, body, footer };
}

/** One fixed-height row inside a panel body, stacked top to bottom — the shape every menu/toggle row on these three screens shares. */
export function stackedRow(body: Rect, index: number, rowHeight: number = hit.target, gap: number = 8): Rect {
  return { x: body.x, y: body.y + index * (rowHeight + gap), width: body.width, height: rowHeight };
}
