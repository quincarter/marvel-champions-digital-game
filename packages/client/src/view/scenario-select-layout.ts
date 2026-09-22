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
 * **Narrow (phone/tabletPortrait): one column**, stacked: one chip row — a
 * square search toggle at its head, then the product chips as a sideways-
 * scrolling rail (`chipsScroll`, `ui/chip-rail.ts`) — the search field only
 * while the toggle is on (`searchOpen`; the owner's 2026-09-21 phone note: "I
 * would rather have the vertical space back on mobile — add a search toggle"),
 * the shelf roster (scrolls; no "how many rows fit" arithmetic), the stat
 * strip, the ink detail block (sized to its own line count), then the
 * full-width CTA at the screen's own foot.
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
/** The collapsed stages panel: a header bar, and a touch target. */
export const DETAIL_COLLAPSED_HEIGHT = hit.target;

export interface ScenarioSelectLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly chipRows: number;
  /** How many text lines the detail panel needs for the currently selected scenario (`view/scenario-detail.ts`). */
  readonly detailLines: number;
  /**
   * Narrow layouts only: the stages panel folded down to its own header bar. It is the screen's one block of
   * pure reading, and at full height it left an iPhone SE (375×667) a sliver of a scenario card to choose from —
   * so on a phone it starts collapsed and the player opens it when they want it. Ignored on a wide layout, where
   * the panel is a side column and costs the shelves nothing.
   */
  readonly detailCollapsed?: boolean;
  /**
   * Narrow layouts only: the search field is shown (a row under the chips). Off by default — the row is the one
   * block a phone can spare, and the toggle at the head of the chip rail brings it back. Ignored on a wide layout,
   * where the field is always drawn above the chips.
   */
  readonly searchOpen?: boolean;
}

export interface ScenarioSelectLayout {
  readonly formFactor: FormFactor;
  readonly wide: boolean;
  readonly headerBar: Rect;
  readonly back: Rect;
  readonly step: Rect;
  /** The search field. Zero-height on a narrow layout whose toggle is off (`searchOpen`) — nothing is drawn there. */
  readonly search: Rect;
  /** Narrow only: the square toggle at the head of the chip row that shows/hides `search`. Null on wide. */
  readonly searchToggle: Rect | null;
  readonly chips: Rect;
  /** True on narrow: draw the chips as one horizontally-scrolling rail (`ui/chip-rail.ts`) rather than wrapped rows. */
  readonly chipsScroll: boolean;
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
  /**
   * Narrow and open: `detail` is a sheet risen over `chips` and `shelves` from its own bar (which stays put at its
   * foot), with `statStrip` inside it. The roster underneath keeps its shut geometry and is simply covered.
   */
  readonly detailOverlay: boolean;
}

/**
 * Every top-level region, for a no-overlap test. `next`/`footer` are deliberately excluded: on a wide layout they
 * are pinned *inside* `detail`'s own foot by design, and on a narrow one they're the bottom-most rows, already
 * guaranteed clear by construction.
 */
export function scenarioSelectLayoutRects(layout: ScenarioSelectLayout): readonly Rect[] {
  // An open phone sheet covers the chip row, the search row and the shelves on purpose (the scene hides the DOM
  // search field while it is up), and holds the stat strip inside itself.
  if (layout.detailOverlay) return [layout.back, layout.step, layout.detail];
  return [
    layout.back,
    layout.step,
    ...(layout.search.height > 0 ? [layout.search] : []),
    ...(layout.searchToggle ? [layout.searchToggle] : []),
    layout.chips,
    layout.shelves,
    layout.statStrip,
    layout.detail,
  ];
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
  const step: Rect = {
    x: width - headerPad - stepWidth,
    y: (HEADER_HEIGHT - hit.target) / 2,
    width: stepWidth,
    height: hit.target,
  };

  const left = gutter;
  const detailWidth = wide ? DETAIL_WIDTH : width - gutter * 2;
  const shelvesWidth = wide ? width - gutter * 2 - gap - detailWidth : width - gutter * 2;

  const bodyTop = HEADER_HEIGHT + gutter;
  const bodyBottom = height - gutter;

  const statStripRows: 1 | 2 = wide ? 1 : 2;
  const statStripHeight = STAT_STRIP_HEIGHT * statStripRows;
  const ctaBlockHeight = hit.primary + 4 + FOOTER_HEIGHT;

  if (wide) {
    const search: Rect = { x: left, y: bodyTop, width: shelvesWidth, height: hit.target };
    let y = bodyTop + hit.target + smallGap;
    const chipsHeight = chipStripHeight(input.chipRows);
    const chips: Rect = { x: left, y, width: shelvesWidth, height: chipsHeight };
    y += chipsHeight + smallGap;
    const detailHeight = bodyBottom - bodyTop;
    const shelvesHeight = Math.max(SHELVES_MIN_HEIGHT, bodyBottom - y - gap - statStripHeight);
    const shelves: Rect = { x: left, y, width: shelvesWidth, height: shelvesHeight };
    const statStrip: Rect = {
      x: left,
      y: shelves.y + shelves.height + gap,
      width: shelvesWidth,
      height: statStripHeight,
    };
    const detail: Rect = { x: left + shelvesWidth + gap, y: bodyTop, width: detailWidth, height: detailHeight };
    const next: Rect = {
      x: detail.x + 16,
      y: detail.y + detail.height - 16 - ctaBlockHeight,
      width: detail.width - 32,
      height: hit.primary,
    };
    const footer: Rect = { x: next.x, y: next.y + next.height + 4, width: next.width, height: FOOTER_HEIGHT };
    return {
      formFactor,
      wide,
      headerBar,
      back,
      step,
      search,
      searchToggle: null,
      chips,
      chipsScroll: false,
      shelves,
      statStrip,
      statStripRows,
      detail,
      next,
      footer,
      detailOverlay: false,
    };
  }

  // Narrow: one chip row first — the search toggle at its head, the product chips as a rail beside it — and the
  // search field only under it while the toggle is on. A phone's body is the roster's, and a 44px field that most
  // visits never type in was the one row it could give back (2026-09-21 owner note).
  const searchToggle: Rect = { x: left, y: bodyTop, width: hit.target, height: hit.target };
  const chips: Rect = {
    x: left + hit.target + smallGap,
    y: bodyTop,
    width: shelvesWidth - hit.target - smallGap,
    height: chipStripHeight(1),
  };
  let y = bodyTop + chips.height + smallGap;
  const searchOpen = input.searchOpen ?? false;
  const search: Rect = { x: left, y, width: shelvesWidth, height: searchOpen ? hit.target : 0 };
  if (searchOpen) y += hit.target + smallGap;

  // The stages panel is a disclosure (`detailCollapsed`). The roster is always laid out as if it were
  // shut — one bar between the shelves and the CTA — because that is the only arrangement that leaves a phone
  // room to choose from: open inline, the panel and the two-row stat strip left an iPhone SE (375×667) a sliver
  // of one scenario card. Open, the panel instead rises *over* the chips and shelves from that same bar, which
  // stays where it was at the sheet's foot, so opening and closing never moves the thing you tapped.
  const next: Rect = { x: left, y: bodyBottom - hit.primary, width: detailWidth, height: hit.primary };
  const footer: Rect = { x: left, y: next.y - FOOTER_HEIGHT - 4, width: detailWidth, height: FOOTER_HEIGHT };
  const bar: Rect = {
    x: left,
    y: footer.y - gap - DETAIL_COLLAPSED_HEIGHT,
    width: detailWidth,
    height: DETAIL_COLLAPSED_HEIGHT,
  };
  const shelvesHeight = Math.max(SHELVES_MIN_HEIGHT, bar.y - gap - y);
  const shelves: Rect = { x: left, y, width: shelvesWidth, height: shelvesHeight };
  if (input.detailCollapsed) {
    const statStrip: Rect = { x: left, y: bar.y, width: detailWidth, height: 0 };
    return {
      formFactor,
      wide,
      headerBar,
      back,
      step,
      search,
      searchToggle,
      chips,
      chipsScroll: true,
      shelves,
      statStrip,
      statStripRows,
      detail: bar,
      next,
      footer,
      detailOverlay: false,
    };
  }
  // A few pixels above the chips: their borders are stroked *around* their rects, and a sheet that starts flush
  // with them leaves those strokes poking out of its top edge.
  const sheetTop = chips.y - 4;
  // …and the same few pixels either side, for the chips' and cards' left and right strokes.
  const detail: Rect = { x: left - 4, y: sheetTop, width: detailWidth + 8, height: bar.y + bar.height - sheetTop };
  const statStrip: Rect = { x: left + 12, y: sheetTop + 12, width: detailWidth - 24, height: statStripHeight };
  return {
    formFactor,
    wide,
    headerBar,
    back,
    step,
    search,
    searchToggle,
    chips,
    chipsScroll: true,
    shelves,
    statStrip,
    statStripRows,
    detail,
    next,
    footer,
    detailOverlay: true,
  };
}
