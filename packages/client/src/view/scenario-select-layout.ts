/**
 * Scenario select (docs/phase4-screen-gaps.md §3 W2/W2b, D02/P02), composition
 * read off `docs/design-renders/ScreensDesktop_01-02.png` and
 * `ScreensPhone_00.png`, rebuilt 2026-09-18 for the owner's reopened brief
 * (pack shelves, full-width body, a full-height ink side panel):
 *
 * A full-width **ink** header bar runs across the top at every size — Back
 * (styled `onInk`) and "CHOOSE A SCENARIO" on the left, "STEP 1 OF 4" on the
 * right. Below it the ground is **paper**.
 *
 * **Wide (desktop/tabletLandscape): two columns**, matching D02. On the left,
 * the search field, the product-chip strip, and the pack-shelf roster
 * (`ui/shelf-roster.ts`'s `McShelfRoster` over `view/roster-shelves.ts`'s
 * `shelvesOf`) — tall art cards, one horizontally-scrolling shelf per pack —
 * with a fixed-height stat strip (main scheme, threat/player, villain
 * HP/player, encounter sets) underneath it, the same width. On the right, a
 * **full-height ink** "stages" panel for whichever scenario is selected
 * (stage table, encounter sets — data only, §4, no blurb) with the one red
 * action, "Choose heroes ▸", pinned at its own foot — D02's own "CHOOSE
 * HEROES ▸" sits at the bottom of that same dark panel, not detached from it.
 *
 * **Narrow (phone/tabletPortrait): one column**, stacked: search, chips, the
 * shelf roster (however tall the remaining space allows — it scrolls, so it
 * no longer needs the old "how many rows fit" arithmetic a *fixed-row* list
 * needed), the stat strip, the ink detail block (sized to its own line
 * count), then the full-width "Choose heroes ▸" CTA at the screen's own foot
 * — the same place P02 puts it.
 */
import { hit } from "../tokens.js";
import { chipStripHeight } from "./chip-layout.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";
import { setupMetrics } from "./setup-metrics.js";

export const HEADER_HEIGHT = 64;
/** One row's height. Narrow layouts get two rows (`statStripRows`) — the four cells' labels ("Starting threat", "Villain HP · stage I") don't fit four across a ~360px phone column (2026-09-18 fidelity pass: they ran into each other). */
export const STAT_STRIP_HEIGHT = 56;
export const DETAIL_LINE_HEIGHT = 20;
const DETAIL_WIDTH_MIN = 260;
const DETAIL_WIDTH_MAX = 360;
const SHELVES_MIN_HEIGHT = 160;

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
  /** 1 (wide: four cells across) or 2 (narrow: 2×2 — `scenes/scenario-select.ts#drawStatStrip` reads this to lay its own cells out, so the two can't disagree about how tall the strip needs to be). */
  readonly statStripRows: 1 | 2;
  /** The full-height (wide) or sized-to-content (narrow) ink stages panel. */
  readonly detail: Rect;
  readonly next: Rect;
}

/**
 * Every top-level region, for a no-overlap test. `next` is deliberately excluded: on a wide layout it is pinned
 * *inside* `detail`'s own foot by design (its own dedicated test checks that containment), and on a narrow one
 * it's the bottom-most row, already guaranteed clear by construction (`layoutAt`'s own arithmetic works upward
 * from it).
 */
export function scenarioSelectLayoutRects(layout: ScenarioSelectLayout): readonly Rect[] {
  return [layout.back, layout.step, layout.search, layout.chips, layout.shelves, layout.statStrip, layout.detail];
}

/**
 * The detail panel's own width, exposed so a caller can measure its detail text's *real* wrapped line count
 * against this exact width before calling `scenarioSelectLayout` (`view/layout.ts`'s `estimateWrappedLines`,
 * the same "count first, lay out second" rule `wrapChipsToRows` already established) — a fixed-height-per-line
 * detail block sized only by *how many strings* `scenarioDetailLines` returned, never how many of *those* wrap,
 * clipped the first line that ran long against this panel's ~300px width (2026-09-18 fidelity pass).
 */
export function detailPanelWidthFor(width: number, height: number): number {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const { pad } = setupMetrics(width, height);
  const maxColumn = wide ? 1200 : 640;
  const column = Math.min(width - pad * 2, maxColumn);
  return wide ? Math.min(DETAIL_WIDTH_MAX, Math.max(DETAIL_WIDTH_MIN, column * 0.26)) : column;
}

export function scenarioSelectLayout(input: ScenarioSelectLayoutInput): ScenarioSelectLayout {
  const { width, height } = input;
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const { pad, gap, smallGap } = setupMetrics(width, height);

  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 16;
  const backWidth = 70;
  const stepWidth = Math.min(140, Math.max(80, width * 0.3));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = { x: width - headerPad - stepWidth, y: (HEADER_HEIGHT - hit.target) / 2, width: stepWidth, height: hit.target };

  const maxColumn = wide ? 1200 : 640;
  const column = Math.min(width - pad * 2, maxColumn);
  const left = (width - column) / 2;

  const detailWidth = detailPanelWidthFor(width, height);
  const shelvesWidth = wide ? column - gap - detailWidth : column;

  const bodyTop = HEADER_HEIGHT + pad;
  const bodyBottom = height - pad;

  const search: Rect = { x: left, y: bodyTop, width: shelvesWidth, height: hit.target };
  let y = bodyTop + hit.target + smallGap;
  const chipsHeight = chipStripHeight(input.chipRows);
  const chips: Rect = { x: left, y, width: shelvesWidth, height: chipsHeight };
  y += chipsHeight + smallGap;

  const detailHeight = wide ? bodyBottom - bodyTop : Math.max(DETAIL_LINE_HEIGHT, input.detailLines * DETAIL_LINE_HEIGHT) + 16;
  const statStripRows: 1 | 2 = wide ? 1 : 2;
  const statStripHeight = STAT_STRIP_HEIGHT * statStripRows;

  if (wide) {
    const shelvesHeight = Math.max(SHELVES_MIN_HEIGHT, bodyBottom - y - gap - statStripHeight);
    const shelves: Rect = { x: left, y, width: shelvesWidth, height: shelvesHeight };
    const statStrip: Rect = { x: left, y: shelves.y + shelves.height + gap, width: shelvesWidth, height: statStripHeight };
    const detail: Rect = { x: left + shelvesWidth + gap, y: bodyTop, width: detailWidth, height: detailHeight };
    const next: Rect = { x: detail.x + 12, y: detail.y + detail.height - 12 - hit.primary, width: detail.width - 24, height: hit.primary };
    return { formFactor, wide, headerBar, back, step, search, chips, shelves, statStrip, statStripRows, detail, next };
  }

  const next: Rect = { x: left, y: bodyBottom - hit.primary, width: column, height: hit.primary };
  const detail: Rect = { x: left, y: next.y - gap - detailHeight, width: column, height: detailHeight };
  const statStrip: Rect = { x: left, y: detail.y - gap - statStripHeight, width: column, height: statStripHeight };
  const shelvesHeight = Math.max(SHELVES_MIN_HEIGHT, statStrip.y - gap - y);
  const shelves: Rect = { x: left, y, width: shelvesWidth, height: shelvesHeight };
  return { formFactor, wide, headerBar, back, step, search, chips, shelves, statStrip, statStripRows, detail, next };
}
