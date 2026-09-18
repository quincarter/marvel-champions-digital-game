/**
 * Scenario select (docs/phase4-screen-gaps.md §3 W2/W2b, D02/P02), composition
 * read off `docs/design-renders/ScreensDesktop_01-02.png` and
 * `ScreensPhone_00.png`, rebuilt 2026-09-18 and revised the same day for the
 * owner's second-pass notes (real gutters instead of ~120px dead margins at
 * desktop widths, a fixed ~300px full-height side panel inset 24px like the
 * tile, no capped-at-1200 column):
 *
 * A full-width **ink** header bar runs across the top at every size — Back
 * (Bangers, `typeRole.backLabel`) and the Bangers page title
 * (`typeRole.pageTitle`) beside it on the left, the step meta as an uppercase
 * label on the right. Below it the ground is **paper**.
 *
 * **Wide (desktop/tabletLandscape): two columns**, matching D02, with a real
 * `GUTTER` (24px) on every edge — no artificial column cap producing dead
 * margins at wide viewports. On the left: the search field, the compact
 * product-chip strip, the pack-shelf roster (tall art cards, no boxed
 * background of its own — `ui/shelf-roster.ts`'s `background: false`, item 3
 * of the second pass), and a bordered stat strip underneath it, the same
 * width. On the right: a **full-height ink** "stages" panel, `DETAIL_WIDTH`
 * (300px) wide, inset `GUTTER` from the body's own top/right/bottom, with the
 * one red action pinned at its own foot and a small footer label under it.
 *
 * **Narrow (phone/tabletPortrait): one column**, stacked: search, chips, the
 * shelf roster (scrolls; no "how many rows fit" arithmetic), the stat strip,
 * the ink detail block (sized to its own line count), then the full-width CTA
 * at the screen's own foot.
 */
import { hit } from "../tokens.js";
import { chipStripHeight } from "./chip-layout.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export const HEADER_HEIGHT = 64;
/** One row's height. Narrow layouts get two rows (`statStripRows`) — the four cells' labels ("Starting threat", "Villain HP · stage I") don't fit four across a ~360px phone column. */
export const STAT_STRIP_HEIGHT = 56;
export const DETAIL_LINE_HEIGHT = 20;
/** The gutter on every edge of the body, and the inset the ink side panel keeps from the body's own top/right/bottom (second-pass item 2: "24px gutters ... 24px inset like the tile"). */
export const GUTTER = 24;
export const DETAIL_WIDTH = 300;
const SHELVES_MIN_HEIGHT = 160;
/** The small uppercase line under the CTA, inside the detail panel's own foot. */
export const FOOTER_HEIGHT = 18;

export interface ScenarioSelectLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly chipRows: number;
  /** How many text lines the detail panel needs for the currently selected scenario (`view/scenario-detail.ts`). */
  readonly detailLines: number;
}

export interface ScenarioSelectLayout {
  readonly formFactor: FormFactor;
  readonly wide: boolean;
  readonly headerBar: Rect;
  readonly back: Rect;
  readonly step: Rect;
  readonly search: Rect;
  readonly chips: Rect;
  /** The pack-shelf roster's own viewport. */
  readonly shelves: Rect;
  readonly statStrip: Rect;
  /** 1 (wide: four cells across) or 2 (narrow: 2×2). */
  readonly statStripRows: 1 | 2;
  /** The full-height (wide) or sized-to-content (narrow) ink stages panel. */
  readonly detail: Rect;
  readonly next: Rect;
  /** The small uppercase caption under the CTA, inside the detail panel. */
  readonly footer: Rect;
}

/**
 * Every top-level region, for a no-overlap test. `next`/`footer` are deliberately excluded: on a wide layout they
 * are pinned *inside* `detail`'s own foot by design, and on a narrow one they're the bottom-most rows, already
 * guaranteed clear by construction.
 */
export function scenarioSelectLayoutRects(layout: ScenarioSelectLayout): readonly Rect[] {
  return [layout.back, layout.step, layout.search, layout.chips, layout.shelves, layout.statStrip, layout.detail];
}

/**
 * The detail panel's own width, exposed so a caller can measure its detail text's *real* wrapped line count
 * against this exact width before calling `scenarioSelectLayout` (`view/layout.ts`'s `estimateWrappedLines`).
 */
export function detailPanelWidthFor(width: number, height: number): number {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const gutter = formFactor === "phone" ? 16 : GUTTER;
  return wide ? DETAIL_WIDTH : width - gutter * 2;
}

export function scenarioSelectLayout(input: ScenarioSelectLayoutInput): ScenarioSelectLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const gutter = formFactor === "phone" ? 16 : GUTTER;
  const gap = gutter;
  const smallGap = 8;

  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 16;
  const backWidth = 90;
  const stepWidth = Math.min(140, Math.max(80, width * 0.3));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = { x: width - headerPad - stepWidth, y: (HEADER_HEIGHT - hit.target) / 2, width: stepWidth, height: hit.target };

  const left = gutter;
  const detailWidth = wide ? DETAIL_WIDTH : width - gutter * 2;
  const shelvesWidth = wide ? width - gutter * 2 - gap - detailWidth : width - gutter * 2;

  const bodyTop = HEADER_HEIGHT + gutter;
  const bodyBottom = height - gutter;

  const search: Rect = { x: left, y: bodyTop, width: shelvesWidth, height: hit.target };
  let y = bodyTop + hit.target + smallGap;
  const chipsHeight = chipStripHeight(input.chipRows);
  const chips: Rect = { x: left, y, width: shelvesWidth, height: chipsHeight };
  y += chipsHeight + smallGap;

  const statStripRows: 1 | 2 = wide ? 1 : 2;
  const statStripHeight = STAT_STRIP_HEIGHT * statStripRows;
  const ctaBlockHeight = hit.primary + 4 + FOOTER_HEIGHT;

  if (wide) {
    const detailHeight = bodyBottom - bodyTop;
    const shelvesHeight = Math.max(SHELVES_MIN_HEIGHT, bodyBottom - y - gap - statStripHeight);
    const shelves: Rect = { x: left, y, width: shelvesWidth, height: shelvesHeight };
    const statStrip: Rect = { x: left, y: shelves.y + shelves.height + gap, width: shelvesWidth, height: statStripHeight };
    const detail: Rect = { x: left + shelvesWidth + gap, y: bodyTop, width: detailWidth, height: detailHeight };
    const next: Rect = { x: detail.x + 16, y: detail.y + detail.height - 16 - ctaBlockHeight, width: detail.width - 32, height: hit.primary };
    const footer: Rect = { x: next.x, y: next.y + next.height + 4, width: next.width, height: FOOTER_HEIGHT };
    return { formFactor, wide, headerBar, back, step, search, chips, shelves, statStrip, statStripRows, detail, next, footer };
  }

  // The detail block's own height is clamped so `shelves` can never be squeezed below `SHELVES_MIN_HEIGHT` by a
  // long detail — otherwise (an oversized `detailLines`, or simply a short viewport) `shelves` clamping to its own
  // minimum left `statStrip`/`detail` positioned as if it hadn't, overlapping it.
  const rawDetailHeight = Math.max(DETAIL_LINE_HEIGHT, input.detailLines * DETAIL_LINE_HEIGHT) + 16;
  const reservedAroundDetail = SHELVES_MIN_HEIGHT + gap + statStripHeight + gap + FOOTER_HEIGHT + 4 + hit.primary;
  const maxDetailHeight = Math.max(DETAIL_LINE_HEIGHT + 16, bodyBottom - y - reservedAroundDetail);
  const detailHeight = Math.min(rawDetailHeight, maxDetailHeight);
  const next: Rect = { x: left, y: bodyBottom - hit.primary, width: detailWidth, height: hit.primary };
  const footer: Rect = { x: left, y: next.y - FOOTER_HEIGHT - 4, width: detailWidth, height: FOOTER_HEIGHT };
  const detail: Rect = { x: left, y: footer.y - gap - detailHeight, width: detailWidth, height: detailHeight };
  const statStrip: Rect = { x: left, y: detail.y - gap - statStripHeight, width: detailWidth, height: statStripHeight };
  const shelvesHeight = Math.max(SHELVES_MIN_HEIGHT, statStrip.y - gap - y);
  const shelves: Rect = { x: left, y, width: shelvesWidth, height: shelvesHeight };
  return { formFactor, wide, headerBar, back, step, search, chips, shelves, statStrip, statStripRows, detail, next, footer };
}
