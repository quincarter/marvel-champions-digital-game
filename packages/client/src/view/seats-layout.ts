/**
 * Take your seats (docs/phase4-screen-gaps.md §3 W2, D03/P03/T-P02),
 * composition read off `docs/design-renders/ScreensDesktop_02-03.png` and
 * `ScreensPhone_00.png`:
 *
 * The same full-width **ink** header bar as Scenario select — Back (labelled
 * with the chosen scenario's own name, e.g. "◂ Klaw", matching the mock) and
 * "TAKE YOUR SEATS" on the left, the step count on the right. Below it, a
 * **paper** body: up to four fixed seat-slot cards in one row (bordered
 * boxes, the occupied seat's own red border), a small quiet "Use
 * preconstructed for all seats" link, the searchable/scrollable deck roster
 * (S8), then a dark **ink** hero-detail panel (stats, obligation, nemesis
 * set — data only). The one red action at the screen's own foot is "Deck
 * check ▸" (docs/phase4-screen-gaps.md §3 W2's own wording — the mock's "Build
 * decks ▸" plays the same role), not a generic "Take these seats"; it is the
 * hook this build routes straight to Table setup until W1's Deck check scene
 * lands (`scenes/seats.ts`'s `goToDeckCheckOrTableSetup`).
 *
 * The four seat slots are one row of equal-width cards rather than a 2×2
 * grid: at the column's own 640px cap that's 150px per slot, enough for a
 * name and three stat numbers even at phone width, and it keeps the roster
 * below it starting at the same fixed y at every seat count (1–4), so the
 * list doesn't jump around as seats are added or removed.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { rosterBlockAt } from "./roster-block-layout.js";
import { LABEL_ROOM, setupColumnWidth, setupMetrics } from "./setup-metrics.js";

export const MAX_SEATS = 4;
export const SEAT_SLOT_HEIGHT = 64;
export const MAX_LIST_ROWS = 4;
export const MIN_LIST_ROWS = 1;
export const DETAIL_LINE_HEIGHT = 20;
export const HEADER_HEIGHT = 64;

export interface SeatsLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly chipRows: number;
  readonly detailLines: number;
}

export interface SeatsLayout {
  readonly pad: number;
  readonly left: number;
  readonly column: number;
  readonly headerBar: Rect;
  readonly back: Rect;
  readonly step: Rect;
  readonly seatSlots: readonly Rect[];
  readonly usePreconstructed: Rect;
  readonly search: Rect;
  readonly chips: Rect;
  readonly list: Rect;
  readonly listRows: number;
  readonly detail: Rect;
  readonly detailLines: number;
  readonly deckCheck: Rect;
  readonly next: Rect;
}

export function seatsLayoutRects(layout: SeatsLayout): readonly Rect[] {
  return [layout.back, layout.step, ...layout.seatSlots, layout.usePreconstructed, layout.search, layout.chips, layout.list, layout.detail, layout.next];
}

function layoutAt(input: SeatsLayoutInput, listRows: number, detailLines: number): SeatsLayout {
  const { width, height } = input;
  const { pad, gap, smallGap } = setupMetrics(width, height);
  const column = setupColumnWidth(width, height);
  const left = (width - column) / 2;

  const headerBar: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const headerPad = 16;
  const backWidth = 70;
  const stepWidth = Math.min(160, Math.max(90, width * 0.32));
  const back: Rect = { x: headerPad, y: (HEADER_HEIGHT - hit.target) / 2, width: backWidth, height: hit.target };
  const step: Rect = { x: width - headerPad - stepWidth, y: (HEADER_HEIGHT - hit.target) / 2, width: stepWidth, height: hit.target };

  let y = HEADER_HEIGHT + pad;
  const slotWidth = (column - (MAX_SEATS - 1) * 6) / MAX_SEATS;
  const seatSlots: Rect[] = Array.from({ length: MAX_SEATS }, (_, i) => ({ x: left + i * (slotWidth + 6), y, width: slotWidth, height: SEAT_SLOT_HEIGHT }));
  y += SEAT_SLOT_HEIGHT + smallGap;

  const usePreconstructed: Rect = { x: left, y, width: column, height: 20 };
  y += 20 + gap;

  // Room for the "Heroes — N seats..." section label drawn just above the search field (`scenes/seats.ts`).
  y += LABEL_ROOM;
  const block = rosterBlockAt({ x: left, y, width: column, chipRows: input.chipRows, listRows, smallGap });
  y = block.bottom + gap;

  const detailHeight = Math.max(DETAIL_LINE_HEIGHT, detailLines * DETAIL_LINE_HEIGHT) + 16;
  const detail: Rect = { x: left, y, width: column, height: detailHeight };
  y += detailHeight + gap;

  // Kept for the deck-check hook's own focus stop even though it now shares the primary CTA's row visually — see `scenes/seats.ts`.
  const deckCheck: Rect = { x: left, y, width: column, height: hit.primary };
  const next: Rect = deckCheck;

  return {
    pad,
    left,
    column,
    headerBar,
    back,
    step,
    seatSlots,
    usePreconstructed,
    search: block.search,
    chips: block.chips,
    list: block.list,
    listRows,
    detail,
    detailLines,
    deckCheck,
    next,
  };
}

export function seatsLayout(input: SeatsLayoutInput): SeatsLayout {
  const trial = layoutAt(input, MAX_LIST_ROWS, input.detailLines);
  const overflow = trial.next.y + trial.next.height - input.height;
  if (overflow <= 0) return trial;
  const rowsToCut = Math.ceil(overflow / hit.target);
  const rows = Math.max(MIN_LIST_ROWS, MAX_LIST_ROWS - rowsToCut);
  const afterRows = layoutAt(input, rows, input.detailLines);
  const stillOver = afterRows.next.y + afterRows.next.height - input.height;
  if (stillOver <= 0) return afterRows;
  const linesToCut = Math.ceil(stillOver / DETAIL_LINE_HEIGHT);
  const lines = Math.max(1, input.detailLines - linesToCut);
  return layoutAt(input, rows, lines);
}
