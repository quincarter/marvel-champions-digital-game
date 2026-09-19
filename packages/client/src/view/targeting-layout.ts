/**
 * The targeting panel's layout (design canvases D09 "Targeting", L06 "Inspect & target").
 *
 * Composition, read off the rendered canvases (docs/design-reference.md): a full-width Hero Red title bar —
 * "CHOOSE A TARGET" plus the source and its effect, "CANCEL · ESC" pinned to the right — over a paper ground; below
 * it a "N LEGAL TARGETS" rule, then the legal targets as a row of full card tiles (art, name, outcome). Desktop
 * (D09) gives the "Why not the others?" reasoning its own boxed column beside that row, sized to whatever width the
 * targets don't need. Tablet landscape (L06) spends that same width on the inspector rail instead — the source
 * card's full text beside the target list, "replacing the phone sheet" (its own caption) — so the "why not"
 * reasoning moves under the target row there, in the exact spot L06 draws its own per-target rationale strip.
 * Anything narrower than that (tablet portrait, phone) has room for one column only: target tiles stacked above the
 * "why not" reasoning, no rail — the source card is still one tap away through the ordinary Inspect overlay, the
 * same as everywhere else on the table.
 *
 * Pure function of `bounds` (and, at the boundary, a target count for the row's own tile width) — no text
 * measurement, no Phaser, so it is testable and stays in step with `boardLayout`'s own breakpoints (`layout.ts`'s
 * `formFactorFor`) rather than inventing a second set.
 */

import { CARD_ASPECT, formFactorFor, type FormFactor, type Rect } from "./layout.js";

const MARGIN = { phone: 10, tabletPortrait: 14, tabletLandscape: 16, desktop: 20 } as const;
const TITLE_BAR_HEIGHT = { phone: 44, tabletPortrait: 52, tabletLandscape: 56, desktop: 56 } as const;
/** Narrower on phone: a 128px CTA plus "CHOOSE A TARGET" and the source line left no room for the source at all at 390px wide. */
const CANCEL_WIDTH = { phone: 84, tabletPortrait: 112, tabletLandscape: 128, desktop: 128 } as const;
const HEADING_HEIGHT = 20;
/** The gap between tiles in a row/stack, and between the target list and its side column. Exported so the scene draws tiles at the same spacing the layout reserved room for. */
export const TARGETING_GAP = 12;
const GAP = TARGETING_GAP;

export interface TargetingLayout {
  readonly formFactor: FormFactor;
  /** The Hero Red bar: title, source line, and where "Cancel · Esc" sits. */
  readonly titleBar: Rect;
  readonly cancelButton: Rect;
  /** "N legal targets" rule, above the row. */
  readonly heading: Rect;
  /** The legal-target tiles: a row on a wide layout, a stacked list otherwise (the caller decides which from `formFactor`). */
  readonly targets: Rect;
  /** One target tile's size within `targets`, at `targetCount` tiles — a row of that many on a wide layout, one full-width row per tile otherwise. */
  readonly tileSize: Rect;
  /** "Why not the others?" — a side column on desktop, the strip under the target row on tablet landscape (L06's own rationale-strip position), and the block under the list everywhere narrower. Never zero height: there is always somewhere to say "nothing was excluded" too. */
  readonly excluded: Rect;
  /** The source card's full text beside the target list — tablet landscape only (L06's inspector rail); null everywhere else. */
  readonly inspectorRail: Rect | null;
}

/** Whether this layout has the horizontal room for a side column at all (the "why not" panel on desktop, the inspector rail on tablet landscape). */
const hasSideColumn = (formFactor: FormFactor): boolean => formFactor === "desktop" || formFactor === "tabletLandscape";

export function targetingLayout(bounds: Rect, targetCount: number): TargetingLayout {
  const formFactor = formFactorFor(bounds.width, bounds.height);
  const margin = MARGIN[formFactor];
  const titleBarHeight = TITLE_BAR_HEIGHT[formFactor];

  const cancelWidth = CANCEL_WIDTH[formFactor];
  const titleBar: Rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: titleBarHeight };
  const cancelButton: Rect = {
    x: titleBar.x + titleBar.width - cancelWidth - margin,
    y: titleBar.y + (titleBarHeight - 36) / 2,
    width: cancelWidth,
    height: 36,
  };

  const heading: Rect = { x: bounds.x + margin, y: titleBar.y + titleBar.height + margin, width: bounds.width - margin * 2, height: HEADING_HEIGHT };

  const contentTop = heading.y + heading.height + margin * 0.6;
  const contentBottom = bounds.y + bounds.height - margin;
  const contentHeight = Math.max(0, contentBottom - contentTop);
  const contentWidth = bounds.width - margin * 2;

  if (formFactor === "desktop") {
    // Target row beside the "why not" column — D09's own split.
    const excludedWidth = Math.min(380, contentWidth * 0.32);
    const targetsWidth = Math.max(0, contentWidth - excludedWidth - GAP);
    const targets: Rect = { x: bounds.x + margin, y: contentTop, width: targetsWidth, height: contentHeight };
    const excluded: Rect = { x: targets.x + targets.width + GAP, y: contentTop, width: excludedWidth, height: contentHeight };
    return { formFactor, titleBar, cancelButton, heading, targets, tileSize: rowTileSize(targets, targetCount), excluded, inspectorRail: null };
  }

  if (formFactor === "tabletLandscape") {
    // Target row beside the inspector rail (L06); "why not" moves to the strip under the row, matching L06's own
    // per-target rationale box.
    const railWidth = Math.min(340, contentWidth * 0.34);
    const columnWidth = Math.max(0, contentWidth - railWidth - GAP);
    const excludedHeight = Math.min(96, contentHeight * 0.28);
    const targetsHeight = Math.max(0, contentHeight - excludedHeight - GAP);
    const targets: Rect = { x: bounds.x + margin, y: contentTop, width: columnWidth, height: targetsHeight };
    const excluded: Rect = { x: bounds.x + margin, y: targets.y + targets.height + GAP, width: columnWidth, height: excludedHeight };
    const inspectorRail: Rect = { x: targets.x + targets.width + GAP, y: contentTop, width: railWidth, height: contentHeight };
    return { formFactor, titleBar, cancelButton, heading, targets, tileSize: rowTileSize(targets, targetCount), excluded, inspectorRail };
  }

  // Phone and tablet portrait: one column, target list above "why not", no rail.
  const excludedHeight = Math.min(140, contentHeight * 0.32);
  const targetsHeight = Math.max(0, contentHeight - excludedHeight - GAP);
  const targets: Rect = { x: bounds.x + margin, y: contentTop, width: contentWidth, height: targetsHeight };
  const excluded: Rect = { x: bounds.x + margin, y: targets.y + targets.height + GAP, width: contentWidth, height: excludedHeight };
  return { formFactor, titleBar, cancelButton, heading, targets, tileSize: stackedTileSize(targets, targetCount), excluded, inspectorRail: null };
}

/**
 * A target tile's own natural width (D09's own tiles read roughly card-shaped, not a portrait stretched to fill
 * whatever room the row has — the row sits near the top of its column and leaves the rest of it empty, exactly like
 * the mock's own target row does). Height still follows `CARD_ASPECT` from that width, so a tile is never anything
 * but card-shaped; only its width is ever capped, so two targets in a wide desktop column don't balloon into two
 * nearly-square giants stretched down the whole column.
 */
const MAX_TILE_WIDTH = 260;

/** One tile's size in a left-to-right row of `count` tiles filling `area`, capped at its own natural width. */
function rowTileSize(area: Rect, count: number): Rect {
  if (count <= 0) return { x: area.x, y: area.y, width: 0, height: 0 };
  const gaps = (count - 1) * GAP;
  const width = Math.min(MAX_TILE_WIDTH, Math.max(0, (area.width - gaps) / count));
  const height = Math.min(area.height, width / CARD_ASPECT);
  return { x: area.x, y: area.y, width, height };
}

/** One row's size in a top-to-bottom stack of `count` rows filling `area` — a phone/tablet-portrait target is a full-width row, not a portrait card. */
function stackedTileSize(area: Rect, count: number): Rect {
  if (count <= 0) return { x: area.x, y: area.y, width: 0, height: 0 };
  const gaps = (count - 1) * GAP;
  const height = Math.max(0, Math.min(96, (area.height - gaps) / count));
  return { x: area.x, y: area.y, width: area.width, height };
}

export { hasSideColumn };
