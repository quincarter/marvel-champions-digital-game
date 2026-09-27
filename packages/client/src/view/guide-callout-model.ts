/**
 * `McGuideCallout`'s view model (guided mode G4a, `docs/guided-mode.md` §4): where the anchored yellow
 * guide callout sits, given the viewport, its anchor (the board thing it's teaching, if any) and the
 * callout's own measured content size.
 *
 * **Anchored.** Mirrors `McTooltip`'s own flip/clamp shape (`ui/tooltip.ts`): the callout prefers one
 * side of the anchor (`preferredSide`), flips to the other when the preferred side doesn't fit inside
 * `viewport` shrunk by `gutter`, and centers on the anchor horizontally, clamped so the whole box stays
 * inside the gutter. The arrow tip tracks the anchor's own center, clamped so it never draws past the
 * callout's rounded corners (`arrowMargin` in from each edge).
 *
 * **No anchor** (an opportunistic tip with nothing specific on the board to point at, or the very first
 * lesson step before anything is drawn): the callout centers horizontally and sits near the bottom of the
 * viewport, `side: "center"`, no arrow.
 */
import type { Rect } from "./layout.js";

export type GuideCalloutSide = "above" | "below" | "center";

export interface GuideCalloutLayoutInput {
  readonly viewport: Rect;
  /** The board thing this step is teaching — a zone, a card, a button — or `null` for no anchor. */
  readonly anchor: Rect | null;
  /** The callout's own measured content size (the widget measures its text before asking for a layout). */
  readonly width: number;
  readonly height: number;
  /** Which side of the anchor the callout would rather sit on. Ignored when `anchor` is `null`. */
  readonly preferredSide: "above" | "below";
  /** Clamp distance from every viewport edge. Default 16 (the design's standard gutter). */
  readonly gutter?: number;
  /** Gap between the anchor's own edge and the callout's, not counting the arrow. Default 12. */
  readonly gap?: number;
  /** How far the arrow's triangle extends beyond the callout's edge. Default 10. */
  readonly arrowSize?: number;
}

export interface GuideCalloutLayout {
  readonly rect: Rect;
  readonly side: GuideCalloutSide;
  /** The arrow tip's x, in the same coordinate space as `rect` — `null` when `side === "center"`. */
  readonly arrowX: number | null;
}

const DEFAULT_GUTTER = 16;
const DEFAULT_GAP = 12;
const DEFAULT_ARROW_SIZE = 10;
/** How far the arrow tip is kept from the callout's own corners, so its triangle never draws outside the box. */
const ARROW_MARGIN = 20;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

export function guideCalloutLayoutOf(input: GuideCalloutLayoutInput): GuideCalloutLayout {
  const { viewport, width, height } = input;
  const gutter = input.gutter ?? DEFAULT_GUTTER;
  const gap = input.gap ?? DEFAULT_GAP;
  const arrowSize = input.arrowSize ?? DEFAULT_ARROW_SIZE;

  const minX = viewport.x + gutter;
  const maxX = viewport.x + viewport.width - gutter - width;

  if (!input.anchor) {
    const x = clamp(viewport.x + (viewport.width - width) / 2, minX, maxX);
    const y = clamp(
      viewport.y + viewport.height - height - gutter,
      viewport.y + gutter,
      viewport.y + viewport.height - height - gutter,
    );
    return { rect: { x, y, width, height }, side: "center", arrowX: null };
  }

  const anchor = input.anchor;
  const clearance = gap + arrowSize;

  const fitsBelow = anchor.y + anchor.height + clearance + height <= viewport.y + viewport.height - gutter;
  const fitsAbove = anchor.y - clearance - height >= viewport.y + gutter;

  let side: "above" | "below" = input.preferredSide;
  if (side === "below" && !fitsBelow && fitsAbove) side = "above";
  else if (side === "above" && !fitsAbove && fitsBelow) side = "below";

  const y =
    side === "below"
      ? clamp(anchor.y + anchor.height + clearance, viewport.y + gutter, viewport.y + viewport.height - gutter - height)
      : clamp(anchor.y - clearance - height, viewport.y + gutter, viewport.y + viewport.height - gutter - height);

  const anchorCenterX = anchor.x + anchor.width / 2;
  const x = clamp(anchorCenterX - width / 2, minX, maxX);

  const arrowX = clamp(anchorCenterX, x + ARROW_MARGIN, x + width - ARROW_MARGIN);

  return { rect: { x, y, width, height }, side, arrowX };
}
