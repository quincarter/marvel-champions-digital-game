/**
 * `McGuidePanel`'s view model (guided mode G4b, `docs/guided-mode.md` §4): the collapsible yellow guide
 * side rail for desktop and tablet landscape (D01/D02 `artifacts/design-screenshots/individual/guided-desktop.dc/`,
 * T02 `guided-tablet.dc/`), companion to G4a's anchored `McGuideCallout` used on phone and tablet portrait.
 *
 * **Two things live here.** `guideRailWidthFor` says how wide the rail is for a given viewport (the board
 * layout hook in `view/layout.ts` reads it before reserving that width), and `guidePanelLayoutOf` says
 * where the panel's own four sections go once it's drawn at that width: header, an optional lesson list,
 * the step body, and a footer pinned to the bottom. Both are pure — no Phaser, no font metrics — mirroring
 * `guideCalloutLayoutOf`'s own split between "the widget measures its text, then asks this module where to
 * put it".
 *
 * **The footer is always pinned to the panel's bottom edge**, exactly like `McTooltip`/`McGuideCallout`
 * clamp to the viewport: `guidePanelLayoutOf` computes the footer's rect from the bottom up first, then
 * gives the body whatever's left between the header/lesson-list block and the footer. When the step body's
 * own measured content (`bodyContentHeight`, laid out by the widget before asking for this layout — the
 * same "measure first" shape `McGuideCallout#update` uses for its title/body) doesn't fit in what's left,
 * `scrollable` comes back `true` and the widget wraps it in an `McScrollRegion` instead of drawing it
 * straight into the container.
 */
import type { FormFactor, Rect } from "./layout.js";

/** How wide the rail's own body row (one lesson-list row, or one step-list extra row) draws at. */
export const GUIDE_PANEL_ROW_HEIGHT = 34;

/** The header row's fixed height: the `GUIDE` stamp, the context label, and the collapse/hide control. */
export const GUIDE_PANEL_HEADER_HEIGHT = 56;

/** Padding shared by every section, matching `McGuideCallout`'s own `PAD`. */
export const GUIDE_PANEL_PAD = 20;

/** The gap under a section divider (header, or the lesson list's own bottom rule) before the next section's content starts — otherwise a step's "STEP N OF M" label / title sits flush against the rule above it. */
export const GUIDE_PANEL_SECTION_TOP_PAD = 16;

/** The collapsed rail's own width — just enough for a vertical "GUIDE" label and a tap target. */
export const GUIDE_PANEL_COLLAPSED_WIDTH = 44;

/** The rail's width as a share of the reference viewport it was designed at (`REFERENCE_VIEWPORTS` in `view/layout.ts`). */
const RAIL_WIDTH_RATIO: Partial<Record<FormFactor, number>> = {
  desktop: 340 / 1440,
  tabletLandscape: 300 / 1024,
};

/** The fallback ratio for a form factor the rail isn't designed for (phone/tablet portrait use `McGuideCallout` instead, never this rail). */
const DEFAULT_RAIL_WIDTH_RATIO = 300 / 1024;

/**
 * The open rail's own width for a viewport of `viewportWidth` at `formFactor` — proportional to the design
 * canvases' own reference widths (desktop ~340 of 1440, tablet landscape ~300 of 1024), not a fixed pixel
 * count, so the rail keeps its own proportion of the table on a wider or narrower window of the same
 * form factor rather than eating a growing (or shrinking) share of it.
 */
export function guideRailWidthFor(viewportWidth: number, formFactor: FormFactor): number {
  const ratio = RAIL_WIDTH_RATIO[formFactor] ?? DEFAULT_RAIL_WIDTH_RATIO;
  return Math.round(viewportWidth * ratio);
}

export interface GuidePanelLayoutInput {
  /** The panel's own on-screen rect, already sized by `guideRailWidthFor`. */
  readonly rect: Rect;
  /** `false` hides the lesson list entirely (D02's villain-phase step, which uses `extra` instead). */
  readonly hasLessonList: boolean;
  /** How many rows the lesson list draws, when shown. */
  readonly lessonRowCount: number;
  /** The step body's own measured height (step label + Bangers title + `McTermText` body + tip box + extra block), at the body section's own width. */
  readonly bodyContentHeight: number;
  /** The footer's own measured height (progress ticks + Back + the "do this to continue" slot), already includes its own top/bottom padding. */
  readonly footerHeight: number;
}

export interface GuidePanelLayout {
  readonly header: Rect;
  /** `null` when `hasLessonList` is `false` or there are no rows. */
  readonly lessonList: Rect | null;
  /** The step body's own viewport — clipped and, when `scrollable`, scrolled; never taller than what's left after the header/lesson-list block and the footer. */
  readonly body: Rect;
  /** Pass-through of `bodyContentHeight`, for the widget's `McScrollRegion` (its `heights` sum). */
  readonly bodyContentHeight: number;
  /** Pinned to the panel's own bottom edge. */
  readonly footer: Rect;
  /** `true` when `bodyContentHeight` exceeds `body.height` — the widget should scroll the body instead of drawing it straight. */
  readonly scrollable: boolean;
}

export function guidePanelLayoutOf(input: GuidePanelLayoutInput): GuidePanelLayout {
  const { rect, hasLessonList, lessonRowCount, bodyContentHeight, footerHeight } = input;

  const header: Rect = { x: rect.x, y: rect.y, width: rect.width, height: GUIDE_PANEL_HEADER_HEIGHT };

  const lessonListHeight =
    hasLessonList && lessonRowCount > 0
      ? GUIDE_PANEL_PAD + lessonRowCount * GUIDE_PANEL_ROW_HEIGHT + GUIDE_PANEL_PAD * 0.5
      : 0;
  const lessonList: Rect | null =
    lessonListHeight > 0 ? { x: rect.x, y: rect.y + header.height, width: rect.width, height: lessonListHeight } : null;

  const bodyTop = rect.y + header.height + lessonListHeight + GUIDE_PANEL_SECTION_TOP_PAD;
  // The footer is computed from the bottom up first, then clamped so it never rises above the body's own
  // top — a panel too short for its own fixed-size sections (header + footer) at least keeps the footer
  // fully inside the rail rather than overlapping the lesson list above it.
  const footerTop = Math.max(bodyTop, rect.y + rect.height - footerHeight);
  const footer: Rect = { x: rect.x, y: footerTop, width: rect.width, height: rect.y + rect.height - footerTop };

  const body: Rect = { x: rect.x, y: bodyTop, width: rect.width, height: Math.max(0, footerTop - bodyTop) };

  return { header, lessonList, body, bodyContentHeight, footer, scrollable: bodyContentHeight > body.height };
}

/**
 * The slim collapsed tab's own rect at the rail's edge — a "slim yellow tab on the rail edge that
 * re-expands it" (docs/guided-mode.md §4 G4b), drawn instead of the full panel once collapsed. Sits at the
 * same edge the open rail would occupy (`side`), full height, `GUIDE_PANEL_COLLAPSED_WIDTH` wide.
 */
export function guidePanelCollapsedRectOf(viewport: Rect, side: "left" | "right"): Rect {
  const width = GUIDE_PANEL_COLLAPSED_WIDTH;
  const x = side === "left" ? viewport.x : viewport.x + viewport.width - width;
  return { x, y: viewport.y, width, height: viewport.height };
}
