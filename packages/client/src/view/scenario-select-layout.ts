/**
 * Scenario select (docs/phase4-screen-gaps.md §3 W2, D02/P02), composition
 * read off `docs/design-renders/ScreensDesktop_01-02.png` and
 * `ScreensPhone_00.png`:
 *
 * A full-width **ink** header bar runs across the top at every size — Back
 * (styled `onInk`) and "CHOOSE A SCENARIO" on the left, "STEP 1 OF 4" on the
 * right. Below it the ground is **paper**: the scenario roster (S8) as a
 * scrolling stack of card-styled rows (`scenes/roster-panel.ts`'s
 * `renderRosterRow`, the design's "entity card"/"list row"), then a dark
 * **ink** detail/"stage" panel for whichever scenario is selected (main
 * scheme, threat, the villain's own stage table, encounter sets — data only,
 * §4, no blurb), and the one red action, "Choose heroes ▸", full width at the
 * screen's own foot — the same place the mock's phone layout puts it, kept at
 * every size instead of tucked beside the stage panel only on desktop, so one
 * rect describes it everywhere.
 *
 * Same "flex the list to fit the viewport" rule `view/title-layout.ts`
 * pioneered (its own doc comment explains why: a screen has to lay out once,
 * measure whether the last control fell off the bottom, and give back exactly
 * enough rows to fix it, never a guessed breakpoint) — extended here to also
 * flex the detail panel's own line budget, since a short viewport with a long
 * detail (many villain stages) is the same problem twice.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { rosterBlockAt } from "./roster-block-layout.js";
import { setupColumnWidth, setupMetrics } from "./setup-metrics.js";

export const MAX_LIST_ROWS = 4;
export const MIN_LIST_ROWS = 1;
export const DETAIL_LINE_HEIGHT = 20;
export const HEADER_HEIGHT = 64;

export interface ScenarioSelectLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly chipRows: number;
  /** How many text lines the detail panel needs for the currently selected scenario (`view/scenario-detail.ts`'s own line count — see `scenes/scenario-select.ts`). */
  readonly detailLines: number;
}

export interface ScenarioSelectLayout {
  readonly pad: number;
  readonly left: number;
  readonly column: number;
  /** The full-width ink header strip Back/step sit inside. */
  readonly headerBar: Rect;
  readonly back: Rect;
  readonly step: Rect;
  readonly search: Rect;
  readonly chips: Rect;
  readonly list: Rect;
  readonly listRows: number;
  readonly detail: Rect;
  readonly detailLines: number;
  readonly next: Rect;
}

export function scenarioSelectLayoutRects(layout: ScenarioSelectLayout): readonly Rect[] {
  return [layout.back, layout.step, layout.search, layout.chips, layout.list, layout.detail, layout.next];
}

function layoutAt(input: ScenarioSelectLayoutInput, listRows: number, detailLines: number): ScenarioSelectLayout {
  const { width, height } = input;
  const { pad, gap, smallGap } = setupMetrics(width, height);
  const column = setupColumnWidth(width, height);
  const left = (width - column) / 2;

  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 16;
  const backWidth = 70;
  const stepWidth = Math.min(140, Math.max(80, width * 0.3));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = { x: width - headerPad - stepWidth, y: (HEADER_HEIGHT - hit.target) / 2, width: stepWidth, height: hit.target };

  let y = HEADER_HEIGHT + pad;
  const block = rosterBlockAt({ x: left, y, width: column, chipRows: input.chipRows, listRows, smallGap });
  y = block.bottom + gap;

  const detailHeight = Math.max(DETAIL_LINE_HEIGHT, detailLines * DETAIL_LINE_HEIGHT) + 16;
  const detail: Rect = { x: left, y, width: column, height: detailHeight };
  y += detailHeight + gap;

  const next: Rect = { x: left, y, width: column, height: hit.primary };

  return { pad, left, column, headerBar, back, step, search: block.search, chips: block.chips, list: block.list, listRows, detail, detailLines, next };
}

export function scenarioSelectLayout(input: ScenarioSelectLayoutInput): ScenarioSelectLayout {
  const trial = layoutAt(input, MAX_LIST_ROWS, input.detailLines);
  const overflow = trial.next.y + trial.next.height - input.height;
  if (overflow <= 0) return trial;
  // First give up whole list rows (cheapest: the list still scrolls for the rest).
  const rowsToCut = Math.ceil(overflow / hit.target);
  const rows = Math.max(MIN_LIST_ROWS, MAX_LIST_ROWS - rowsToCut);
  const afterRows = layoutAt(input, rows, input.detailLines);
  const stillOver = afterRows.next.y + afterRows.next.height - input.height;
  if (stillOver <= 0) return afterRows;
  // Still short: trim the detail panel's own line budget too, never below one line.
  const linesToCut = Math.ceil(stillOver / DETAIL_LINE_HEIGHT);
  const lines = Math.max(1, input.detailLines - linesToCut);
  return layoutAt(input, rows, lines);
}
