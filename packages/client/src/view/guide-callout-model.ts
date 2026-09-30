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
import { hit } from "../tokens.js";
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

/** Gap between the two exit controls, right-aligned in the callout's own top row. */
const EXIT_GAP = 6;

export interface GuideCalloutExitsInput {
  /** The callout's own drawn rect (from `guideCalloutLayoutOf`) — only its `x`/`width`/`y` are used. */
  readonly rect: Rect;
  /** Horizontal padding from the callout's own edge, matching the widget's own `PAD`. */
  readonly pad: number;
  /** The top row's own vertical center, in the same space as `rect`. */
  readonly rowCenterY: number;
  /** "Skip this step" label's measured width (the widget's own text metrics). */
  readonly skipLabelWidth: number;
  /** "Stop tutorial" control's measured width (the widget draws it as a small × glyph, so this stays tiny). */
  readonly stopLabelWidth: number;
}

export interface GuideCalloutExitsLayout {
  /** "Stop tutorial" — the rightmost control (a small ×), always ≥ `hit.target` on a side. */
  readonly stop: Rect;
  /** "Skip this step" — immediately to the left of Stop, always ≥ `hit.target` on a side. */
  readonly skip: Rect;
}

/**
 * Both top-row exits (§3.10 "never locked in"), right-aligned inside the callout, each a hit area at
 * least `hit.target` on a side and never overlapping the other — Stop sits flush against the callout's
 * own right padding, Skip sits immediately to its left. The widget draws Stop as a small × glyph (its
 * `stopLabelWidth` is a few px), not the full "Stop tutorial" wording, precisely so this still fits on a
 * 390px phone even with the `GUIDE` stamp/step label sharing the row and "Skip this step" spelled out.
 */
export function guideCalloutExitsLayoutOf(input: GuideCalloutExitsInput): GuideCalloutExitsLayout {
  const { rect, pad, rowCenterY, skipLabelWidth, stopLabelWidth } = input;
  const stopWidth = Math.max(stopLabelWidth, hit.target);
  const stopX = rect.x + rect.width - pad - stopWidth;
  const stop: Rect = { x: stopX, y: rowCenterY - hit.target / 2, width: stopWidth, height: hit.target };

  const skipWidth = Math.max(skipLabelWidth, hit.target);
  const skipX = stopX - EXIT_GAP - skipWidth;
  const skip: Rect = { x: skipX, y: rowCenterY - hit.target / 2, width: skipWidth, height: hit.target };

  return { stop, skip };
}

export interface GuideCalloutStopConfirmInput {
  /** The callout's own drawn rect (from `guideCalloutLayoutOf`) — only its `x`/`width`/`y` are used. */
  readonly rect: Rect;
  /** Horizontal padding from the callout's own edge, matching the widget's own `PAD`. */
  readonly pad: number;
  /** The top row's own vertical center, in the same space as `rect`. */
  readonly rowCenterY: number;
  /** "Stop" confirm button's measured width. */
  readonly stopLabelWidth: number;
  /** "Keep going" cancel button's measured width. */
  readonly keepGoingLabelWidth: number;
}

export interface GuideCalloutStopConfirmLayout {
  /** "Stop" — the rightmost control, always ≥ `hit.target` on a side. */
  readonly stop: Rect;
  /** "Keep going" — immediately to the left of Stop, always ≥ `hit.target` on a side. */
  readonly keepGoing: Rect;
  /** Remaining width, from the callout's own left pad up to "Keep going", for the confirm question's own text —
   * never negative, so the widget can always ask for a word-wrapped label at this width. */
  readonly questionWidth: number;
}

/**
 * The inline "Stop the tutorial?" confirm row that replaces the callout's own top row once its × is tapped once
 * (guided mode G11 fix wave 2, `docs/guided-mode.md` §4 G11: "the phone and portrait × stops the tutorial in one
 * tap, with no label"). Mirrors `guideCalloutExitsLayoutOf`'s own right-alignment shape — same row, same `pad`,
 * same `hit.target` floor — so the confirm row never overflows a 390px phone either.
 */
export function guideCalloutStopConfirmLayoutOf(input: GuideCalloutStopConfirmInput): GuideCalloutStopConfirmLayout {
  const { rect, pad, rowCenterY, stopLabelWidth, keepGoingLabelWidth } = input;
  const stopWidth = Math.max(stopLabelWidth, hit.target);
  const stopX = rect.x + rect.width - pad - stopWidth;
  const stop: Rect = { x: stopX, y: rowCenterY - hit.target / 2, width: stopWidth, height: hit.target };

  const keepGoingWidth = Math.max(keepGoingLabelWidth, hit.target);
  const keepGoingX = stopX - EXIT_GAP - keepGoingWidth;
  const keepGoing: Rect = { x: keepGoingX, y: rowCenterY - hit.target / 2, width: keepGoingWidth, height: hit.target };

  const questionWidth = Math.max(0, keepGoingX - EXIT_GAP - (rect.x + pad));
  return { stop, keepGoing, questionWidth };
}
